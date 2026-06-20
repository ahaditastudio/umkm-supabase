// ============================================================
// GET AUTHORIZED SHOPS
// ============================================================
// Fetch list of shops authorized for a connection
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthorizedShops } from "@/lib/marketplace/tiktok/auth";

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

    // Get connection from database
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
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

    // Fetch authorized shops
    const shops = await getAuthorizedShops(
      connection.access_token,
      tiktokAppKey,
      tiktokAppSecret
    );

    return NextResponse.json({
      shops: shops.map((shop) => ({
        id: shop.id,
        name: shop.name,
        region: shop.region,
        sellerType: shop.seller_type,
      })),
    });
  } catch (error) {
    console.error("[Get Shops] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch authorized shops" },
      { status: 500 }
    );
  }
}
