// ============================================================
// TIKTOK SHOP OAUTH FLOW
// ============================================================

const AUTH_DOMAIN = "https://auth.tiktok-shops.com";

export type TikTokOAuthConfig = {
  appKey: string;
  appSecret: string;
  redirectUri: string;
};

export type TikTokTokenResponse = {
  access_token: string;
  access_token_expire_in: number; // Unix timestamp
  refresh_token: string;
  refresh_token_expire_in: number; // Unix timestamp
  open_id: string;
  seller_name: string;
  seller_base_region: string;
  user_type: number; // 0=Seller, 1=Creator, 3=Partner
  shop_cipher?: string;
};

export type TikTokShopInfo = {
  id: string;
  name: string;
  region: string;
  seller_type: string;
  cipher: string;
  code: string;
};

/**
 * Generate OAuth authorization URL
 *
 * Flow:
 * 1. Redirect user to this URL
 * 2. User logs in & authorizes
 * 3. TikTok redirects to: REDIRECT_URI?code=AUTH_CODE&state=STATE&app_key=...
 * 4. Exchange auth_code → access_token
 */
export function generateAuthUrl(config: TikTokOAuthConfig, state: string): string {
  const params = new URLSearchParams({
    app_key: config.appKey,
    state,
  });

  return `${AUTH_DOMAIN}/oauth/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 *
 * IMPORTANT:
 * - auth_code expires in 30 minutes
 * - auth_code can only be used ONCE
 * - This endpoint does NOT require signature
 */
export async function exchangeAuthCode(
  config: TikTokOAuthConfig,
  authCode: string
): Promise<TikTokTokenResponse> {
  const params = new URLSearchParams({
    app_key: config.appKey,
    app_secret: config.appSecret,
    auth_code: authCode,
    grant_type: "authorized_code",
  });

  const response = await fetch(`${AUTH_DOMAIN}/api/v2/token/get?${params.toString()}`, {
    method: "GET",
    headers: {
      "content-type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const result = await response.json();

  if (result.code !== 0) {
    throw new Error(`TikTok OAuth Error ${result.code}: ${result.message}`);
  }

  return result.data as TikTokTokenResponse;
}

/**
 * Refresh access token
 *
 * IMPORTANT:
 * - access_token expires in 7 days
 * - Auto-refresh every 6 days recommended
 * - This endpoint does NOT require signature
 */
export async function refreshAccessToken(
  config: TikTokOAuthConfig,
  refreshToken: string
): Promise<TikTokTokenResponse> {
  const params = new URLSearchParams({
    app_key: config.appKey,
    app_secret: config.appSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch(`${AUTH_DOMAIN}/api/v2/token/refresh?${params.toString()}`, {
    method: "GET",
    headers: {
      "content-type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const result = await response.json();

  if (result.code !== 0) {
    throw new Error(`TikTok OAuth Error ${result.code}: ${result.message}`);
  }

  return result.data as TikTokTokenResponse;
}

/**
 * Check if access token needs refresh (expires in 7 days, refresh at 6 days)
 */
export function shouldRefreshToken(expiresAt: string | undefined): boolean {
  if (!expiresAt) return true;

  const expiresAtDate = new Date(expiresAt).getTime();
  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;

  // Refresh if expires in less than 1 day
  return expiresAtDate - now < oneDayMs;
}

/**
 * Convert Unix timestamp to ISO date string
 */
export function unixTimestampToISO(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString();
}

/**
 * Get authorized shops for the authenticated user
 */
export async function getAuthorizedShops(
  accessToken: string,
  appKey: string,
  appSecret: string
): Promise<TikTokShopInfo[]> {
  const { tiktokApiGet } = await import("./client");

  const data = await tiktokApiGet<{ shops: TikTokShopInfo[] }>(
    "/authorization/202309/shops",
    accessToken,
    "", // shop_cipher not required for this endpoint
    appKey,
    appSecret
  );

  return data.shops || [];
}

/**
 * Generate random state parameter for CSRF protection
 */
export function generateOAuthState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
