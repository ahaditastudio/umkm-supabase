// ============================================================
// TIKTOK OAUTH CALLBACK
// ============================================================
// Handles callback from TikTok after user authorization
// Exchanges auth_code for access_token and saves connection
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  exchangeAuthCode,
  getAuthorizedShops,
  unixTimestampToISO,
} from "@/lib/marketplace/tiktok/auth";
import { uid } from "@/lib/utils";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const tiktokAppKey = process.env.TIKTOK_APP_KEY!;
const tiktokAppSecret = process.env.TIKTOK_APP_SECRET!;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code || !state) {
      return NextResponse.json(
        { error: "Missing code or state parameter" },
        { status: 400 }
      );
    }

    console.log("[OAuth Callback] Received code and state");

    // Verify state and get company_id
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: oauthState, error: stateError } = await supabase
      .from("marketplace_oauth_states")
      .select("*")
      .eq("state", state)
      .eq("platform", "tiktok_shop")
      .is("used_at", null)
      .single();

    if (stateError || !oauthState) {
      console.error("[OAuth Callback] Invalid state:", stateError);
      return NextResponse.json(
        { error: "Invalid or expired state" },
        { status: 400 }
      );
    }

    // Check if state is expired
    if (new Date(oauthState.expires_at) < new Date()) {
      await supabase
        .from("marketplace_oauth_states")
        .update({ used_at: new Date().toISOString() })
        .eq("state", state);

      return NextResponse.json(
        { error: "State expired" },
        { status: 400 }
      );
    }

    // Exchange auth_code for access_token
    console.log("[OAuth Callback] Exchanging auth code for tokens...");
    const tokenData = await exchangeAuthCode(
      {
        appKey: tiktokAppKey,
        appSecret: tiktokAppSecret,
        redirectUri: process.env.NEXT_PUBLIC_APP_URL + "/api/integrations/tiktok/callback",
      },
      code
    );

    console.log("[OAuth Callback] Token exchange successful");

    // Get authorized shops
    console.log("[OAuth Callback] Fetching authorized shops...");
    const shops = await getAuthorizedShops(
      tokenData.access_token,
      tiktokAppKey,
      tiktokAppSecret
    );

    if (shops.length === 0) {
      return NextResponse.json(
        { error: "No authorized shops found" },
        { status: 400 }
      );
    }

    const shop = shops[0]; // Take first shop
    console.log("[OAuth Callback] Found shop:", shop.name);

    // Create marketplace connection
    const connectionId = uid("mkp_conn");
    const now = new Date().toISOString();

    const { data: connection, error: connError } = await supabase
      .from("marketplace_connections")
      .insert({
        id: connectionId,
        company_id: oauthState.company_id,
        platform: "tiktok_shop",
        shop_id: shop.id,
        shop_name: shop.name,
        shop_cipher: tokenData.shop_cipher,
        region: shop.region,
        seller_type: shop.seller_type,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: unixTimestampToISO(tokenData.access_token_expire_in),
        refresh_token_expires_at: unixTimestampToISO(
          tokenData.refresh_token_expire_in
        ),
        status: "active",
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (connError) {
      console.error("[OAuth Callback] Failed to create connection:", connError);
      return NextResponse.json(
        { error: "Failed to create connection" },
        { status: 500 }
      );
    }

    // Mark state as used
    await supabase
      .from("marketplace_oauth_states")
      .update({ used_at: now })
      .eq("state", state);

    // Create default account mappings
    console.log("[OAuth Callback] Creating default account mappings...");
    const defaultMappings = [
      {
        id: uid("mkp_map"),
        connection_id: connectionId,
        company_id: oauthState.company_id,
        mapping_type: "revenue",
        kasflow_category_id: null, // User will configure later
        created_at: now,
        updated_at: now,
      },
      {
        id: uid("mkp_map"),
        connection_id: connectionId,
        company_id: oauthState.company_id,
        mapping_type: "platform_fee",
        kasflow_category_id: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: uid("mkp_map"),
        connection_id: connectionId,
        company_id: oauthState.company_id,
        mapping_type: "receivable",
        kasflow_account_id: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: uid("mkp_map"),
        connection_id: connectionId,
        company_id: oauthState.company_id,
        mapping_type: "settlement_bank",
        kasflow_account_id: null,
        created_at: now,
        updated_at: now,
      },
    ];

    await supabase.from("marketplace_account_mapping").insert(defaultMappings);

    console.log("[OAuth Callback] Connection created successfully:", connectionId);

    // Redirect to integration page
    const redirectUrl = new URL("/integrations", request.nextUrl.origin);
    redirectUrl.searchParams.append("success", "true");
    redirectUrl.searchParams.append("connectionId", connectionId);

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error("[OAuth Callback] Error:", error);
    return NextResponse.json(
      { error: "OAuth callback failed" },
      { status: 500 }
    );
  }
}
