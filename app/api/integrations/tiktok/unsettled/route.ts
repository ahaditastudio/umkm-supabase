// ============================================================
// GET UNSETTLED TRANSACTIONS
// ============================================================
// Fetch unsettled transactions (estimates only)
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncUnsettled } from "@/lib/marketplace/tiktok/sync-unsettled";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const tiktokAppKey = process.env.TIKTOK_APP_KEY!;
const tiktokAppSecret = process.env.TIKTOK_APP_SECRET!;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const connectionId = searchParams.get("connectionId");
    const companyId = searchParams.get("companyId");

    if (!connectionId || !companyId) {
      return NextResponse.json(
        { error: "connectionId and companyId are required" },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    // Check if token needs refresh
    if (connection.token_expires_at && new Date(connection.token_expires_at) < new Date()) {
      return NextResponse.json(
        { error: "Access token expired, please reconnect" },
        { status: 401 }
      );
    }

    // Fetch unsettled transactions from TikTok API
    const unsettledResult = await syncUnsettled({
      accessToken: connection.access_token,
      shopCipher: connection.shop_cipher,
      appKey: tiktokAppKey,
      appSecret: tiktokAppSecret,
      companyId,
      connectionId,
    });

    return NextResponse.json({
      summary: {
        totalCount: unsettledResult.totalCount,
        totalEstSettlementAmount: unsettledResult.totalEstSettlementAmount,
        totalEstRevenueAmount: unsettledResult.totalEstRevenueAmount,
        totalEstFeeAmount: unsettledResult.totalEstFeeAmount,
      },
      transactions: unsettledResult.unsettled.map((txn) => ({
        id: txn.id,
        orderId: txn.order_id,
        orderCreateTime: txn.order_create_time,
        estSettlementAmount: txn.est_settlement_amount,
        estRevenueAmount: txn.est_revenue_amount,
        estFeeAmount: txn.est_fee_amount,
        unsettledReason: txn.unsettled_reason,
      })),
      warning: "Data ini adalah ESTIMASI dan dapat berubah sebelum settlement final",
    });
  } catch (error) {
    console.error("[Get Unsettled] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch unsettled transactions" },
      { status: 500 }
    );
  }
}
