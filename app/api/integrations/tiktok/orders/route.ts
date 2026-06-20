// ============================================================
// GET CACHED ORDERS
// ============================================================
// Fetch marketplace orders from cache (for analytics only)
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const connectionId = searchParams.get("connectionId");
    const companyId = searchParams.get("companyId");
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const status = searchParams.get("status");

    if (!companyId) {
      return NextResponse.json(
        { error: "companyId is required" },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Build query — connectionId is optional for cross-shop view
    let query = supabase
      .from("marketplace_orders")
      .select("*, marketplace_connections(id, platform, shop_name, display_name)", { count: "exact" })
      .eq("company_id", companyId)
      .order("order_create_time", { ascending: false })
      .range(offset, offset + limit - 1);

    if (connectionId) {
      query = query.eq("connection_id", connectionId);
    }

    // Server-side date filtering (convert WIB UTC+7 to UTC)
    if (startDate) {
      const startDateWIB = new Date(`${startDate}T00:00:00+07:00`);
      query = query.gte("order_create_time", startDateWIB.toISOString());
    }
    if (endDate) {
      const endDateWIB = new Date(`${endDate}T23:59:59.999+07:00`);
      query = query.lte("order_create_time", endDateWIB.toISOString());
    }

    // Server-side status filtering
    if (status && status !== "all") {
      query = query.eq("platform_status", status);
    }

    // Execute paginated query
    const { data: orders, error, count } = await query;

    // Fetch statements for proportional settlement calculation
    let stmtQuery = supabase
      .from("marketplace_statements")
      .select("statement_time, settlement_amount, revenue_amount, fee_amount")
      .eq("company_id", companyId);

    if (connectionId) {
      stmtQuery = stmtQuery.eq("connection_id", connectionId);
    }

    if (startDate) {
      const startDateWIB = new Date(`${startDate}T00:00:00+07:00`);
      stmtQuery = stmtQuery.gte("statement_time", startDateWIB.toISOString());
    }
    if (endDate) {
      const endDateWIB = new Date(`${endDate}T23:59:59.999+07:00`);
      stmtQuery = stmtQuery.lte("statement_time", endDateWIB.toISOString());
    }

    const { data: statements } = await stmtQuery;

    // Build statement map by date for quick lookup
    const statementMap = new Map<string, { settlement: number; revenue: number; fee: number }>();
    statements?.forEach(stmt => {
      const date = new Date(stmt.statement_time).toISOString().split("T")[0];
      if (!statementMap.has(date)) {
        statementMap.set(date, { settlement: 0, revenue: 0, fee: 0 });
      }
      const existing = statementMap.get(date)!;
      existing.settlement += stmt.settlement_amount || 0;
      existing.revenue += stmt.revenue_amount || 0;
      existing.fee += stmt.fee_amount || 0;
    });

    // Calculate proportional settlement for each order
    const ordersWithSettlement = orders?.map(order => {
      const orderDate = new Date(order.order_create_time).toISOString().split("T")[0];
      const stmtData = statementMap.get(orderDate);

      let settlementAmount = 0;
      let revenueAmount = 0;
      let feeAmount = 0;

      if (stmtData && stmtData.revenue > 0) {
        // Proportional distribution based on order's total_amount vs total revenue
        const ratio = (order.total_amount || 0) / stmtData.revenue;
        settlementAmount = Math.round(stmtData.settlement * ratio);
        revenueAmount = Math.round(stmtData.revenue * ratio);
        feeAmount = Math.round(stmtData.fee * ratio);
      }

      return {
        ...order,
        settlement_amount: settlementAmount,
        revenue_amount: revenueAmount,
        fee_amount: feeAmount,
      };
    });

    // Calculate status breakdown (need separate query without status filter)
    let statsQuery = supabase
      .from("marketplace_orders")
      .select("platform_status, total_amount, settlement_status")
      .eq("company_id", companyId);

    if (connectionId) {
      statsQuery = statsQuery.eq("connection_id", connectionId);
    }

    // Apply same date filters to stats query
    if (startDate) {
      const startDateWIB = new Date(`${startDate}T00:00:00+07:00`);
      statsQuery = statsQuery.gte("order_create_time", startDateWIB.toISOString());
    }
    if (endDate) {
      const endDateWIB = new Date(`${endDate}T23:59:59.999+07:00`);
      statsQuery = statsQuery.lte("order_create_time", endDateWIB.toISOString());
    }

    // Fetch all stats with pagination (Supabase limits 1000 per request)
    const allStats: any[] = [];
    let statsOffset = 0;
    const statsBatch = 1000;
    while (true) {
      const { data: batch } = await statsQuery.range(statsOffset, statsOffset + statsBatch - 1);
      if (!batch || batch.length === 0) break;
      allStats.push(...batch);
      statsOffset += statsBatch;
      if (batch.length < statsBatch) break;
    }

    // Calculate breakdown from all filtered orders
    const breakdown = {
      total: allStats.length,
      completed: 0,
      delivered: 0,
      inTransit: 0,
      awaitingCollection: 0,
      awaitingShipment: 0,
      cancelled: 0,
      totalRevenue: 0,
      settledCount: 0,
    };

    allStats?.forEach(order => {
      const status = order.platform_status?.toUpperCase();
      if (status === "COMPLETED") breakdown.completed++;
      else if (status === "DELIVERED") breakdown.delivered++;
      else if (status === "IN_TRANSIT") breakdown.inTransit++;
      else if (status === "AWAITING_COLLECTION") breakdown.awaitingCollection++;
      else if (status === "AWAITING_SHIPMENT") breakdown.awaitingShipment++;
      else if (status === "CANCELLED") breakdown.cancelled++;

      // Only count revenue from COMPLETED orders
      if (status === "COMPLETED") {
        breakdown.totalRevenue += order.total_amount || 0;
      }

      if (order.settlement_status === "settled") {
        breakdown.settledCount++;
      }
    });

    if (error) {
      console.error("[Get Orders] Error:", error);
      return NextResponse.json(
        { error: "Failed to fetch orders" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      orders: (ordersWithSettlement || []).map((order) => ({
        id: order.id,
        connectionId: order.connection_id,
        shopName: order.marketplace_connections?.display_name || order.marketplace_connections?.shop_name || 'Unknown',
        platformOrderId: order.platform_order_id,
        platformStatus: order.platform_status,
        orderCreateTime: order.order_create_time,
        orderUpdateTime: order.order_update_time,
        currency: order.currency,
        subtotal: order.subtotal,
        shippingFee: order.shipping_fee,
        sellerDiscount: order.seller_discount,
        platformDiscount: order.platform_discount,
        totalAmount: order.total_amount,
        settlementStatus: order.settlement_status,
        settlementAmount: order.settlement_amount,
        revenueAmount: order.revenue_amount,
        feeAmount: order.fee_amount,
        syncStatus: order.sync_status,
        shippingProvider: order.shipping_provider,
      })),
      total: count,
      limit,
      offset,
      stats: breakdown,
    });
  } catch (error) {
    console.error("[Get Orders] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}
