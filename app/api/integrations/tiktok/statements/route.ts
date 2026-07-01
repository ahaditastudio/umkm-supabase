// ============================================================
// GET CACHED STATEMENTS WITH DATE FILTER & SUMMARY
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
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = parseInt(searchParams.get("offset") || "0");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!companyId) {
      return NextResponse.json(
        { error: "companyId is required" },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Build paginated query
    let query = supabase
      .from("marketplace_statements")
      .select("*, marketplace_connections(id, platform, shop_name, display_name)", { count: "exact" })
      .eq("company_id", companyId)
      .order("statement_time", { ascending: false })
      .range(offset, offset + limit - 1);

    if (connectionId && connectionId !== "all") {
      query = query.eq("connection_id", connectionId);
    }
    if (startDate) {
      query = query.gte("statement_time", `${startDate}T00:00:00Z`);
    }
    if (endDate) {
      query = query.lte("statement_time", `${endDate}T23:59:59Z`);
    }

    const { data: statements, error, count } = await query;

    if (error) {
      console.error("[Get Statements] Error:", error);
      return NextResponse.json(
        { error: "Failed to fetch statements" },
        { status: 500 }
      );
    }

    // 2. Build summary query for totals
    let summaryQuery = supabase
      .from("marketplace_statements")
      .select("revenue_amount, fee_amount, settlement_amount, payment_status, reconciled, approval_status")
      .eq("company_id", companyId);

    if (connectionId && connectionId !== "all") {
      summaryQuery = summaryQuery.eq("connection_id", connectionId);
    }
    if (startDate) {
      summaryQuery = summaryQuery.gte("statement_time", `${startDate}T00:00:00Z`);
    }
    if (endDate) {
      summaryQuery = summaryQuery.lte("statement_time", `${endDate}T23:59:59Z`);
    }

    const { data: summaryData } = await summaryQuery;

    let totalRevenue = 0;
    let totalFee = 0;
    let totalSettlement = 0;
    let reconciledCount = 0;
    let pendingCount = 0;

    if (summaryData) {
      const settled = summaryData.filter((s) => s.payment_status === "PAID");
      totalRevenue = settled.reduce((sum, s) => sum + (s.revenue_amount || 0), 0);
      totalFee = settled.reduce((sum, s) => sum + Math.abs(s.fee_amount || 0), 0);
      totalSettlement = settled.reduce((sum, s) => sum + (s.settlement_amount || 0), 0);
      reconciledCount = summaryData.filter((s) => s.reconciled).length;
      pendingCount = summaryData.filter((s) => s.approval_status === "pending_approval").length;
    }

    return NextResponse.json({
      statements: statements.map((stmt) => ({
        id: stmt.id,
        connectionId: stmt.connection_id,
        shopName: stmt.marketplace_connections?.display_name || stmt.marketplace_connections?.shop_name || 'Unknown',
        platformStatementId: stmt.platform_statement_id,
        statementTime: stmt.statement_time,
        currency: stmt.currency,
        settlementAmount: stmt.settlement_amount,
        revenueAmount: stmt.revenue_amount,
        feeAmount: stmt.fee_amount,
        adjustmentAmount: stmt.adjustment_amount,
        netSalesAmount: stmt.net_sales_amount,
        shippingCostAmount: stmt.shipping_cost_amount,
        paymentStatus: stmt.payment_status,
        paymentId: stmt.payment_id,
        paymentTime: stmt.payment_time,
        reconciled: stmt.reconciled,
        orderCount: stmt.order_count,
        kasflowIncomeTxnId: stmt.kasflow_income_txn_id,
        kasflowExpenseTxnId: stmt.kasflow_expense_txn_id,
        kasflowTransferTxnId: stmt.kasflow_transfer_txn_id,
        approvalStatus: stmt.approval_status || 'pending_approval',
        approvedBy: stmt.approved_by || null,
        approvedAt: stmt.approved_at || null,
        rejectedReason: stmt.rejected_reason || null,
      })),
      total: count,
      limit,
      offset,
      summary: {
        totalRevenue,
        totalFee,
        totalSettlement,
        reconciledCount,
        pendingCount,
      },
    });
  } catch (error) {
    console.error("[Get Statements] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch statements" },
      { status: 500 }
    );
  }
}
