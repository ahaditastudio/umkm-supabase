// ============================================================
// GET CACHED STATEMENTS
// ============================================================
// Fetch marketplace statements from cache
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

    if (!companyId) {
      return NextResponse.json(
        { error: "companyId is required" },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Build query — connectionId is optional for cross-shop view
    let query = supabase
      .from("marketplace_statements")
      .select("*, marketplace_connections(id, platform, shop_name, display_name)", { count: "exact" })
      .eq("company_id", companyId)
      .order("statement_time", { ascending: false })
      .range(offset, offset + limit - 1);

    if (connectionId) {
      query = query.eq("connection_id", connectionId);
    }

    const { data: statements, error, count } = await query;

    if (error) {
      console.error("[Get Statements] Error:", error);
      return NextResponse.json(
        { error: "Failed to fetch statements" },
        { status: 500 }
      );
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
    });
  } catch (error) {
    console.error("[Get Statements] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch statements" },
      { status: 500 }
    );
  }
}
