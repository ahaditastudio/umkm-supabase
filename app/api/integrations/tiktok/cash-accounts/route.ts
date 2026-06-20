import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");

    if (!companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: cashAccounts, error } = await supabase
      .from("cash_accounts")
      .select("id, company_id, name, type, account_id, is_active")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("name");

    if (error) {
      console.error("[Cash Accounts] Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Convert snake_case to camelCase
    const cashAccountsCamel = (cashAccounts || []).map((ca: any) => ({
      id: ca.id,
      companyId: ca.company_id,
      name: ca.name,
      type: ca.type,
      accountId: ca.account_id,
      isActive: ca.is_active,
    }));

    return NextResponse.json({ cashAccounts: cashAccountsCamel });
  } catch (error: any) {
    console.error("[Cash Accounts] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
