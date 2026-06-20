import crypto from "crypto";

// ============================================================
// TIKTOK SHOP API CLIENT
// ============================================================

const BASE_URL = "https://open-api.tiktokglobalshop.com";

export type TikTokApiParams = Record<string, string | number | undefined>;

/**
 * Generate HMAC-SHA256 signature for TikTok Shop API
 *
 * Algorithm:
 * 1. Filter out: sign, app_secret, token, access_token
 * 2. Sort params alphabetically by key
 * 3. Concat: key1value1key2value2 (NO separators)
 * 4. Message: app_secret + path + concat_params + body + app_secret
 * 5. HMAC-SHA256(message, key=app_secret) → hex lowercase
 */
export function generateSign(
  path: string,
  params: TikTokApiParams,
  appSecret: string,
  body: string = ""
): string {
  // Filter out excluded params
  const filteredParams = { ...params };
  delete filteredParams.sign;
  delete filteredParams.app_secret;
  delete filteredParams.token;
  delete filteredParams.access_token;

  // Sort keys alphabetically
  const sortedKeys = Object.keys(filteredParams).sort();

  // Concat: key1value1key2value2 (no separators)
  const paramString = sortedKeys
    .map((key) => `${key}${filteredParams[key]}`)
    .join("");

  // Build message: app_secret + path + params + body + app_secret
  const message = `${appSecret}${path}${paramString}${body}${appSecret}`;

  // HMAC-SHA256 hash
  return crypto.createHmac("sha256", appSecret).update(message).digest("hex");
}

/**
 * Make GET request to TikTok Shop API
 */
export async function tiktokApiGet<T = any>(
  path: string,
  accessToken: string,
  shopCipher: string,
  appKey: string,
  appSecret: string,
  extraParams: TikTokApiParams = {}
): Promise<T> {
  const params: TikTokApiParams = {
    app_key: appKey,
    shop_cipher: shopCipher,
    timestamp: Math.floor(Date.now() / 1000),
    ...extraParams,
  };

  // Generate signature
  params.sign = generateSign(path, params, appSecret);

  // Build URL
  const url = new URL(`${BASE_URL}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.append(key, String(value));
    }
  });

  // Make request
  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "content-type": "application/json",
      "x-tts-access-token": accessToken,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const result = await response.json();

  if (result.code !== 0) {
    throw new Error(`TikTok API Error ${result.code}: ${result.message}`);
  }

  return result.data as T;
}

/**
 * Make POST request to TikTok Shop API
 */
export async function tiktokApiPost<T = any>(
  path: string,
  accessToken: string,
  shopCipher: string,
  appKey: string,
  appSecret: string,
  body: any = {},
  extraParams: TikTokApiParams = {}
): Promise<T> {
  const params: TikTokApiParams = {
    app_key: appKey,
    shop_cipher: shopCipher,
    timestamp: Math.floor(Date.now() / 1000),
    ...extraParams,
  };

  const bodyString = JSON.stringify(body);

  // Generate signature with body
  params.sign = generateSign(path, params, appSecret, bodyString);

  // Build URL
  const url = new URL(`${BASE_URL}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.append(key, String(value));
    }
  });

  // Make request
  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-tts-access-token": accessToken,
    },
    body: bodyString,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const result = await response.json();

  if (result.code !== 0) {
    throw new Error(`TikTok API Error ${result.code}: ${result.message}`);
  }

  return result.data as T;
}

/**
 * Fetch all pages from a paginated TikTok API endpoint
 * Handles: statements, transactions, orders
 */
export async function fetchAllPages<T = any>(
  path: string,
  accessToken: string,
  shopCipher: string,
  appKey: string,
  appSecret: string,
  extraParams: TikTokApiParams = {},
  pageKey: "statements" | "transactions" | "orders" = "statements"
): Promise<T[]> {
  const allResults: T[] = [];
  let pageToken: string | undefined;

  while (true) {
    const params: TikTokApiParams = {
      ...extraParams,
      page_size: 100,
    };

    if (pageToken) {
      params.page_token = pageToken;
    }

    const result = await tiktokApiGet<any>(
      path,
      accessToken,
      shopCipher,
      appKey,
      appSecret,
      params
    );

    const items = result[pageKey] || [];
    allResults.push(...items);

    // Check if there's a next page
    if (!result.next_page_token) {
      break;
    }

    pageToken = result.next_page_token;

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return allResults;
}

/**
 * Error codes from TikTok API
 */
export const TIKTOK_ERROR_CODES = {
  SUCCESS: 0,
  INVALID_SIGN: 106001,
  INTERNAL_ERROR: 36009003,
  FAILED_TO_GET_ORDERS: 10002014,
  ORDER_NOT_BELONG_TO_SELLER: 21008111,
} as const;

/**
 * Check if error is retryable
 */
export function isRetryableError(error: any): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("internal error") ||
      message.includes("failed to get") ||
      message.includes("timeout") ||
      message.includes("network")
    );
  }
  return false;
}
