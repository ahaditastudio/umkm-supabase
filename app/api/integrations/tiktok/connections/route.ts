import { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const companyId = searchParams.get("companyId");

    if (!companyId) {
      return NextResponse.json(
        { error: "companyId is required" },
        { status: 400 }
      );
    }

    console.log("[Get Connections] Fetching connections for company:", companyId);

    // Use REST API directly with service role key (bypasses RLS)
    const response = await fetch(
      `${supabaseUrl}/rest/v1/marketplace_connections?company_id=eq.${encodeURIComponent(companyId)}&status=eq.active&order=created_at.desc`,
      {
        method: "GET",
        headers: {
          apikey: supabaseServiceKey,
          Authorization: `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Get Connections] REST API error:", response.status, errorText);
      return NextResponse.json(
        { error: "Failed to fetch connections", details: errorText },
        { status: 500 }
      );
    }

    const connections = await response.json();
    console.log("[Get Connections] Found", connections.length, "connections");

    return NextResponse.json({
      connections: connections || [],
    });
  } catch (error) {
    console.error("[Get Connections] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
