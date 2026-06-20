import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    const connectionId = searchParams.get("connectionId");

    if (!companyId) {
      return NextResponse.json(
        { error: "companyId is required" },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let query = supabase
      .from("marketplace_statements")
      .select("*, marketplace_connections!inner(id, platform, shop_name)")
      .eq("company_id", companyId)
      .eq("approval_status", "pending_approval")
      .order("statement_time", { ascending: false });

    if (connectionId) {
      query = query.eq("connection_id", connectionId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[Pending] Error:", error);
      return NextResponse.json(
        { error: "Failed to fetch pending statements", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      statements: data || [],
      count: data?.length || 0,
    });
  } catch (error) {
    console.error("[Pending] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch pending statements", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
