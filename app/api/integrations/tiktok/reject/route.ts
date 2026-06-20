import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const { statementIds, reason } = await request.json();

    if (!statementIds || !Array.isArray(statementIds) || statementIds.length === 0) {
      return NextResponse.json(
        { error: "statementIds is required and must be a non-empty array" },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error } = await supabase
      .from("marketplace_statements")
      .update({
        approval_status: "rejected",
        rejected_reason: reason || null,
        updated_at: new Date().toISOString(),
      })
      .in("id", statementIds)
      .eq("approval_status", "pending_approval");

    if (error) {
      console.error("[Reject] Error:", error);
      return NextResponse.json(
        { error: "Failed to reject statements", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Rejected ${statementIds.length} statement(s)`,
    });
  } catch (error) {
    console.error("[Reject] Error:", error);
    return NextResponse.json(
      { error: "Failed to reject statements", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
