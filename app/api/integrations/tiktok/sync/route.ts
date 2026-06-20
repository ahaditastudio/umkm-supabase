// ============================================================
// TRIGGER MANUAL SYNC
// ============================================================
// Orchestrates full sync: statements, orders, unsettled
// Creates KasFlow transactions from statements
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runSync, createSyncLogFromResult } from "@/lib/marketplace/tiktok/sync-engine";
import { refreshAccessToken, shouldRefreshToken } from "@/lib/marketplace/tiktok/auth";
import { uid } from "@/lib/utils";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const tiktokAppKey = process.env.TIKTOK_APP_KEY!;
const tiktokAppSecret = process.env.TIKTOK_APP_SECRET!;

export async function POST(request: NextRequest) {
  let syncLogId: string | null = null;
  let supabase: ReturnType<typeof createClient>;

  try {
    const { connectionId, companyId, mode = "incremental", startDate, endDate } = await request.json();

    if (!connectionId || !companyId) {
      return NextResponse.json(
        { error: "connectionId and companyId are required" },
        { status: 400 }
      );
    }

    console.log(`[Sync] Starting ${mode} sync for connection ${connectionId}`);

    supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get connection
    const { data: connection, error: connError } = await supabase
      .from("marketplace_connections")
      .select("*")
      .eq("id", connectionId)
      .eq("company_id", companyId)
      .eq("status", "active")
      .single();

    if (connError || !connection) {
      return NextResponse.json(
        { error: "Connection not found or inactive" },
        { status: 404 }
      );
    }

    // Check if token needs refresh (proactive refresh 1 day before expiry)
    if (shouldRefreshToken(connection.token_expires_at)) {
      console.log("[Sync] Token needs refresh, refreshing...");
      try {
        const tokenData = await refreshAccessToken(
          {
            appKey: tiktokAppKey,
            appSecret: tiktokAppSecret,
            redirectUri: process.env.NEXT_PUBLIC_APP_URL + "/api/integrations/tiktok/callback",
          },
          connection.refresh_token
        );

        // Update connection with new tokens
        const { error: updateError } = await supabase
          .from("marketplace_connections")
          .update({
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            token_expires_at: new Date(tokenData.access_token_expire_in * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", connectionId);

        if (updateError) {
          console.error("[Sync] Failed to update refreshed tokens:", updateError);
          return NextResponse.json(
            { error: "Failed to update refreshed tokens" },
            { status: 500 }
          );
        }

        // Update connection object with new tokens
        connection.access_token = tokenData.access_token;
        connection.refresh_token = tokenData.refresh_token;
        connection.token_expires_at = new Date(tokenData.access_token_expire_in * 1000).toISOString();

        console.log("[Sync] Token refreshed successfully");
      } catch (refreshError) {
        console.error("[Sync] Failed to refresh token:", refreshError);

        // If token is already expired, return 401
        if (connection.token_expires_at && new Date(connection.token_expires_at) < new Date()) {
          return NextResponse.json(
            { error: "Access token expired and refresh failed, please reconnect" },
            { status: 401 }
          );
        }

        // Otherwise continue with existing token (it might still work)
        console.warn("[Sync] Token refresh failed but token not yet expired, continuing...");
      }
    }

    // Get account mappings
    const { data: mappings, error: mapError } = await supabase
      .from("marketplace_account_mapping")
      .select("*")
      .eq("connection_id", connectionId)
      .eq("company_id", companyId);

    if (mapError) {
      return NextResponse.json(
        { error: "Failed to fetch account mappings" },
        { status: 500 }
      );
    }

    // Get categories and cash accounts for transaction creation
    const [{ data: categories }, { data: cashAccounts }] = await Promise.all([
      supabase
        .from("account_categories")
        .select("*")
        .eq("company_id", companyId)
        .eq("is_active", true),
      supabase
        .from("cash_accounts")
        .select("*")
        .eq("company_id", companyId)
        .eq("is_active", true),
    ]);

    // Create initial sync log
    syncLogId = uid("mkp_sync");
    await supabase.from("marketplace_sync_logs").insert({
      id: syncLogId,
      connection_id: connectionId,
      company_id: companyId,
      sync_type: mode,
      status: "running",
      records_fetched: 0,
      records_created: 0,
      records_updated: 0,
      records_skipped: 0,
      started_at: new Date().toISOString(),
    });

    // Run sync engine
    console.log("[Sync] Running sync engine...");

    // Transform connection from snake_case (DB) to camelCase (sync engine expects)
    const connectionCamelCase = {
      id: connection.id,
      companyId: connection.company_id,
      platform: connection.platform,
      shopId: connection.shop_id,
      shopName: connection.shop_name,
      shopCipher: connection.shop_cipher,
      region: connection.region,
      sellerType: connection.seller_type,
      accessToken: connection.access_token,
      refreshToken: connection.refresh_token,
      tokenExpiresAt: connection.token_expires_at,
      refreshTokenExpiresAt: connection.refresh_token_expires_at,
      lastSyncAt: connection.last_sync_at,
      status: connection.status,
      createdAt: connection.created_at,
      updatedAt: connection.updated_at,
    };

    const syncResult = await runSync({
      connection: connectionCamelCase,
      mappings: mappings || [],
      categories: categories || [],
      cashAccounts: cashAccounts || [],
      companyId,
      appKey: tiktokAppKey,
      appSecret: tiktokAppSecret,
      mode,
      startDate,
      endDate,
    });

    console.log("[Sync] Sync engine completed:", syncResult.status);

    // Upsert statements with approval-aware logic
    if (syncResult.data.statements.length > 0) {
      console.log(`[Sync] Upserting ${syncResult.data.statements.length} statements...`);

      const mapPaymentStatus = (status: string | undefined): "PAID" | "FAILED" | "PROCESSING" => {
        if (!status) return "PROCESSING";
        const upperStatus = status.toUpperCase();
        if (upperStatus === "SETTLED" || upperStatus === "PAID" || upperStatus === "SUCCESS") {
          return "PAID";
        }
        if (upperStatus === "FAILED" || upperStatus === "ERROR") {
          return "FAILED";
        }
        return "PROCESSING";
      };

      // Pass 1: Fetch existing statements for this connection to check approval status
      const platformIds = syncResult.data.statements.map((s) => s.platformStatementId);
      const { data: existingStatements } = await supabase
        .from("marketplace_statements")
        .select("platform_statement_id, approval_status")
        .eq("connection_id", connectionId)
        .eq("company_id", companyId)
        .in("platform_statement_id", platformIds);

      const existingMap = new Map<string, string>();
      (existingStatements || []).forEach((es: any) => {
        existingMap.set(es.platform_statement_id, es.approval_status);
      });

      // Pass 2: Separate into new vs existing, skip rejected
      const newStatements: any[] = [];
      const updateStatements: any[] = [];
      let skippedCount = 0;

      for (const stmt of syncResult.data.statements) {
        const existingStatus = existingMap.get(stmt.platformStatementId);

        // Skip rejected statements — don't touch them
        if (existingStatus === "rejected") {
          skippedCount++;
          continue;
        }

        const baseData = {
          connection_id: connectionId,
          company_id: companyId,
          platform_statement_id: stmt.platformStatementId,
          statement_time: stmt.statementTime,
          currency: stmt.currency,
          settlement_amount: stmt.settlementAmount,
          revenue_amount: stmt.revenueAmount,
          fee_amount: stmt.feeAmount,
          adjustment_amount: stmt.adjustmentAmount,
          net_sales_amount: stmt.netSalesAmount,
          shipping_cost_amount: stmt.shippingCostAmount,
          payment_status: mapPaymentStatus(stmt.paymentStatus),
          payment_id: stmt.paymentId,
          payment_time: stmt.paymentTime,
          reconciled: stmt.reconciled,
          order_count: stmt.orderCount,
          updated_at: new Date().toISOString(),
        };

        if (!existingStatus) {
          // New statement → set as pending_approval
          newStatements.push({
            ...baseData,
            id: stmt.id,
            approval_status: "pending_approval",
          });
        } else {
          // Existing statement → update data only, preserve approval_status
          // Find the DB row ID for targeted update
          updateStatements.push({
            ...baseData,
            // Don't set approval_status — preserve whatever it currently is
          });
        }
      }

      console.log(`[Sync] Statements: ${newStatements.length} new, ${updateStatements.length} existing, ${skippedCount} skipped (rejected)`);

      // Insert new statements
      if (newStatements.length > 0) {
        const { error: insertError } = await supabase
          .from("marketplace_statements")
          .insert(newStatements);

        if (insertError) {
          console.error("[Sync] Failed to insert new statements:", insertError);
          syncResult.errors.push({
            stage: "statements",
            message: `Failed to insert ${newStatements.length} new statements: ${insertError.message}`,
          });
        }
      }

      // Update existing statements (preserving approval_status)
      if (updateStatements.length > 0) {
        console.log(`[Sync] Updating ${updateStatements.length} existing statements...`);

        const updatePromises = updateStatements.map(async (stmt) => {
          const { error: updateError } = await supabase
            .from("marketplace_statements")
            .update(stmt)
            .eq("connection_id", connectionId)
            .eq("company_id", companyId)
            .eq("platform_statement_id", stmt.platform_statement_id);

          if (updateError) {
            console.error("[Sync] Failed to update statement:", stmt.platform_statement_id, updateError);
            return 1;
          }
          return 0;
        });

        const errors = await Promise.all(updatePromises);
        const errorCount = errors.reduce((sum, e) => sum + e, 0);
        console.log(`[Sync] Statement updates: ${updateStatements.length - errorCount} succeeded, ${errorCount} failed`);
      }
    }

    // Upsert orders
    if (syncResult.data.orders.length > 0) {
      console.log(`[Sync] Upserting ${syncResult.data.orders.length} orders...`);

      const ordersToUpsert = syncResult.data.orders.map((order) => ({
        id: order.id,
        connection_id: connectionId,
        company_id: companyId,
        platform_order_id: order.platformOrderId,
        platform_status: order.platformStatus,
        order_create_time: order.orderCreateTime,
        order_update_time: order.orderUpdateTime,
        currency: order.currency,
        subtotal: order.subtotal,
        shipping_fee: order.shippingFee,
        seller_discount: order.sellerDiscount,
        platform_discount: order.platformDiscount,
        total_amount: order.totalAmount,
        settlement_status: order.settlementStatus,
        settlement_amount: order.settlementAmount,
        revenue_amount: order.revenueAmount,
        fee_amount: order.feeAmount,
        adjustment_amount: order.adjustmentAmount,
        shipping_cost_amount: order.shippingCostAmount,
        sync_status: order.syncStatus,
        raw_data: order.rawData,
        cancellation_initiator: order.cancellationInitiator,
        shipping_provider: order.shippingProvider,
        buyer_user_id: order.buyerUserId,
        updated_at: new Date().toISOString(),
      }));

      const { error: orderError } = await supabase
        .from("marketplace_orders")
        .upsert(ordersToUpsert, {
          onConflict: "connection_id,platform_order_id",
        });

      if (orderError) {
        console.error("[Sync] Failed to upsert orders:", orderError);
        syncResult.errors.push({
          stage: "orders",
          message: `Failed to upsert ${ordersToUpsert.length} orders: ${orderError.message}`,
        });
      }
    }

    // Update sync log
    const completedAt = new Date().toISOString();
    await supabase
      .from("marketplace_sync_logs")
      .update({
        status: syncResult.status,
        records_fetched: syncResult.statements.fetched + syncResult.orders.fetched + syncResult.unsettled.fetched,
        records_created: syncResult.statements.created + syncResult.orders.created,
        records_updated: syncResult.statements.updated + syncResult.orders.updated,
        records_skipped: 0,
        error_message: syncResult.errors.length > 0 ? syncResult.errors.map((e) => e.message).join("; ") : null,
        completed_at: completedAt,
      })
      .eq("id", syncLogId);

    // Update connection last_sync_at — use endDate if user specified a range, else use now
    const syncAnchor = endDate || completedAt;
    await supabase
      .from("marketplace_connections")
      .update({ last_sync_at: syncAnchor })
      .eq("id", connectionId);

    console.log(`[Sync] Completed: ${syncResult.statements.fetched} statements, ${syncResult.orders.fetched} orders, ${syncResult.unsettled.fetched} unsettled`);

    return NextResponse.json({
      success: true,
      syncLogId,
      summary: {
        statements: syncResult.statements,
        orders: syncResult.orders,
        unsettled: syncResult.unsettled,
        duration: syncResult.duration,
      },
      errors: syncResult.errors,
    });
  } catch (error) {
    console.error("[Sync] Error:", error);

    // Update sync log to error state if syncLogId exists
    if (syncLogId) {
      try {
        await supabase
          .from("marketplace_sync_logs")
          .update({
            status: "error",
            error_message: error instanceof Error ? error.message : String(error),
            completed_at: new Date().toISOString(),
          })
          .eq("id", syncLogId);
      } catch (logError) {
        console.error("[Sync] Failed to update sync log to error state:", logError);
      }
    }

    return NextResponse.json(
      { error: "Sync failed", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
