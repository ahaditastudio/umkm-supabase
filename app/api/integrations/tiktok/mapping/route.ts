import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const connectionId = request.nextUrl.searchParams.get("connectionId");
  const companyId = request.nextUrl.searchParams.get("companyId");

  if (!connectionId || !companyId) {
    return NextResponse.json(
      { error: "connectionId and companyId required" },
      { status: 400 }
    );
  }

  const { data: mappings, error } = await supabase
    .from("marketplace_account_mapping")
    .select("*")
    .eq("connection_id", connectionId)
    .eq("company_id", companyId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ mappings: mappings || [] });
}

export async function POST(request: NextRequest) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await request.json();
    const { connectionId, companyId, mappings } = body;

    if (!connectionId || !companyId || !Array.isArray(mappings)) {
      return NextResponse.json(
        { error: "connectionId, companyId, and mappings array required" },
        { status: 400 }
      );
    }

    // Delete existing mappings for this connection
    await supabase
      .from("marketplace_account_mapping")
      .delete()
      .eq("connection_id", connectionId)
      .eq("company_id", companyId);

    // Insert new mappings
    const mappingsWithIds = mappings.map((m: any) => ({
      id: `${connectionId}_${m.mappingType}`,
      connection_id: connectionId,
      company_id: companyId,
      mapping_type: m.mappingType,
      kasflow_category_id: m.kasflowCategoryId || null,
      kasflow_cash_account_id: m.kasflowCashAccountId || null,
      kasflow_account_id: m.kasflowAccountId || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("marketplace_account_mapping")
      .insert(mappingsWithIds);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, mappings: mappingsWithIds });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
