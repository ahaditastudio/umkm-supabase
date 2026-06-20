import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const tiktokAppKey = process.env.TIKTOK_APP_KEY!;
const tiktokAppSecret = process.env.TIKTOK_APP_SECRET!;

// Generate signature for TikTok API
function generateSignature(
  path: string,
  params: Record<string, string>,
  body: string = ""
): string {
  // Filter out sign, app_secret, token, access_token
  const filteredParams: Record<string, string> = {};
  Object.keys(params).forEach((key) => {
    if (!["sign", "app_secret", "token", "access_token"].includes(key)) {
      filteredParams[key] = params[key];
    }
  });

  // Sort by key and concatenate
  const sortedKeys = Object.keys(filteredParams).sort();
  const paramString = sortedKeys.map((key) => `${key}${filteredParams[key]}`).join("");

  // Build signature string: app_secret + path + params + body + app_secret
  const signatureString = `${tiktokAppSecret}${path}${paramString}${body}${tiktokAppSecret}`;

  // HMAC-SHA256
  return crypto.createHmac("sha256", tiktokAppSecret).update(signatureString).digest("hex");
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  console.log("[OAuth Callback] Received callback with code:", code ? "yes" : "no", "state:", state);

  if (!code || !state) {
    console.error("[OAuth Callback] Missing code or state");
    // Redirect to integrations page with error instead of JSON
    return NextResponse.redirect(new URL("/integrations?error=missing_params", request.url));
  }

  // Extract companyId from state (format: companyId_randomUuid)
  // companyId contains dashes like "company_uid123", UUID has no underscores
  // So split on last underscore: everything before = companyId, after = UUID
  const lastUnderscoreIndex = state.lastIndexOf("_");
  const companyId = state.substring(0, lastUnderscoreIndex);

  if (!companyId) {
    console.error("[OAuth Callback] Could not extract companyId from state:", state);
    return NextResponse.redirect(new URL("/integrations?error=invalid_state", request.url));
  }

  console.log("[OAuth Callback] Extracted companyId:", companyId);

  try {
    // Exchange code for access token (GET without signature)
    console.log("[OAuth Callback] Exchanging code for access token...");
    const tokenUrl = new URL("https://auth.tiktok-shops.com/api/v2/token/get");
    tokenUrl.searchParams.append("app_key", tiktokAppKey);
    tokenUrl.searchParams.append("app_secret", tiktokAppSecret);
    tokenUrl.searchParams.append("auth_code", code);
    tokenUrl.searchParams.append("grant_type", "authorized_code");

    const tokenResponse = await fetch(tokenUrl.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const tokenData = await tokenResponse.json();
    console.log("[OAuth Callback] Token response:", JSON.stringify(tokenData, null, 2));

    if (tokenData.code !== 0) {
      console.error("[OAuth Callback] Token exchange failed:", tokenData);
      return NextResponse.redirect(new URL("/integrations?error=token_exchange_failed", request.url));
    }

    const {
      access_token,
      refresh_token,
      access_token_expire_in,
      refresh_token_expire_in,
      open_id,
      seller_name,
      seller_base_region,
      user_type,
    } = tokenData.data;

    // Get authorized shops (requires signature)
    console.log("[OAuth Callback] Fetching authorized shops...");
    const shopPath = "/authorization/202309/shops";
    const shopTimestamp = Math.floor(Date.now() / 1000).toString();
    const shopParams: Record<string, string> = {
      app_key: tiktokAppKey,
      timestamp: shopTimestamp,
    };
    const shopSign = generateSignature(shopPath, shopParams);

    const shopUrl = new URL(`https://open-api.tiktokglobalshop.com${shopPath}`);
    shopUrl.searchParams.append("app_key", tiktokAppKey);
    shopUrl.searchParams.append("timestamp", shopTimestamp);
    shopUrl.searchParams.append("sign", shopSign);

    const shopResponse = await fetch(shopUrl.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-tts-access-token": access_token,
      },
    });

    const shopData = await shopResponse.json();
    console.log("[OAuth Callback] Shop response:", JSON.stringify(shopData, null, 2));

    if (shopData.code !== 0 || !shopData.data?.shops || shopData.data.shops.length === 0) {
      console.error("[OAuth Callback] Failed to get shops:", shopData);
      return NextResponse.redirect(new URL("/integrations?error=get_shops_failed", request.url));
    }

    const shops = shopData.data.shops;
    console.log("[OAuth Callback] Found shops:", shops.length);

    // Save connection to database
    console.log("[OAuth Callback] Saving connection to database...");
    console.log("[OAuth Callback] Using companyId:", companyId);
    console.log("[OAuth Callback] Shop data:", shops[0]);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Test database connection first
    const { error: testError } = await supabase
      .from("marketplace_connections")
      .select("id")
      .limit(1);

    if (testError) {
      console.error("[OAuth Callback] Database connection test failed:", testError.message, testError.details);
      return NextResponse.redirect(new URL("/integrations?error=db_connection_failed", request.url));
    }

    console.log("[OAuth Callback] Database connection OK, checking company profile...");

    // Ensure company profile exists
    const { data: existingCompany, error: checkCompanyError } = await supabase
      .from("business_profiles")
      .select("id")
      .eq("id", companyId)
      .single();

    if (checkCompanyError || !existingCompany) {
      console.log("[OAuth Callback] Company profile not found, creating default profile...");

      const companyName = seller_name || "TikTok Shop";

      const { error: createCompanyError } = await supabase
        .from("business_profiles")
        .insert({
          id: companyId,
          business_name: companyName,
          owner_name: seller_name || "TikTok Seller",
          business_type: "online_shop",
          tax_number: "",
          currency: "IDR",
        });

      if (createCompanyError) {
        console.error("[OAuth Callback] Failed to create company profile:", createCompanyError);
        return NextResponse.redirect(new URL("/integrations?error=company_creation_failed", request.url));
      }

      console.log("[OAuth Callback] Company profile created successfully");
    } else {
      console.log("[OAuth Callback] Company profile already exists:", companyId);
    }

    console.log("[OAuth Callback] Saving shops...");

    // Save each shop as a separate connection
    let savedCount = 0;
    for (const shop of shops) {
      const connectionId = `shop_${shop.id}_${Date.now()}`;
      const connectionData = {
        id: connectionId,
        company_id: companyId,
        platform: "tiktok_shop",
        shop_id: shop.id,
        shop_name: shop.name || seller_name,
        shop_cipher: shop.cipher,
        region: shop.region || seller_base_region,
        seller_type: shop.seller_type,
        access_token: access_token,
        refresh_token: refresh_token,
        token_expires_at: new Date(access_token_expire_in * 1000).toISOString(),
        refresh_token_expires_at: new Date(refresh_token_expire_in * 1000).toISOString(),
        status: "active",
        config: {
          open_id,
          user_type,
        },
      };

      console.log("[OAuth Callback] Inserting connection:", {
        id: connectionId,
        company_id: companyId,
        shop_id: shop.id,
        shop_name: shop.name || seller_name
      });

      const { error: insertError, data: insertedData } = await supabase
        .from("marketplace_connections")
        .upsert(connectionData, {
          onConflict: "company_id,platform,shop_id",
          ignoreDuplicates: false
        })
        .select();

      if (insertError) {
        console.error("[OAuth Callback] Failed to save connection:", insertError);
        console.error("[OAuth Callback] Error details:", {
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint,
          code: insertError.code
        });
      } else {
        console.log("[OAuth Callback] Successfully saved connection:", insertedData);
        savedCount++;
      }
    }

    console.log(`[OAuth Callback] Save summary: ${savedCount} of ${shops.length} shops saved`);

    // Redirect back to integrations page with success
    console.log("[OAuth Callback] Redirecting to integrations page...");
    return NextResponse.redirect(new URL("/integrations?connected=true", request.url));

  } catch (error) {
    console.error("[OAuth Callback] Error:", error);
    return NextResponse.redirect(new URL("/integrations?error=internal_error", request.url));
  }
}
