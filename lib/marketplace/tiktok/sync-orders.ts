// ============================================================
// SYNC ORDERS
// ============================================================
// Fetch orders from TikTok Order API and cache them for analytics.
// Orders are NOT used to create KasFlow transactions — only statements.
// This is purely for dashboard/analytics purposes.
// ============================================================

import type { MarketplaceOrder, MarketplaceOrderItem } from "@/lib/types";
import { fetchAllPages, tiktokApiGet, tiktokApiPost } from "./client";
import type { TikTokOrder, TikTokOrderItem } from "./types";
import { uid } from "@/lib/utils";

export type SyncOrdersParams = {
  accessToken: string;
  shopCipher: string;
  appKey: string;
  appSecret: string;
  companyId: string;
  connectionId: string;
  startDate?: string; // ISO date string
  endDate?: string; // ISO date string
  /** Order statuses to fetch. Default: all operational + final statuses. */
  statuses?: string[];
  /** Filter by update_time instead of create_time. Useful for catching status changes. Default: true */
  useUpdateTime?: boolean;
};

/** Statuses to sync — operational tracking + final revenue + cancellations */
export const DEFAULT_SYNC_STATUSES = [
  "AWAITING_SHIPMENT",
  "AWAITING_COLLECTION",
  "IN_TRANSIT",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
];

export type SyncOrdersResult = {
  orders: MarketplaceOrder[];
  items: MarketplaceOrderItem[];
  fetched: number;
  created: number;
  updated: number;
};

/**
 * Convert TikTok API order to KasFlow MarketplaceOrder
 */
function convertToOrder(
  tiktokOrder: TikTokOrder,
  connectionId: string,
  companyId: string
): MarketplaceOrder {
  const now = new Date().toISOString();

  return {
    id: uid("mkp_order"),
    connectionId,
    companyId,
    platformOrderId: tiktokOrder.id,
    platformStatus: tiktokOrder.status,
    orderCreateTime: tiktokOrder.create_time
      ? new Date(tiktokOrder.create_time * 1000).toISOString()
      : undefined,
    orderUpdateTime: tiktokOrder.update_time
      ? new Date(tiktokOrder.update_time * 1000).toISOString()
      : undefined,
    currency: tiktokOrder.payment?.currency || "IDR",
    subtotal: parseFloat(tiktokOrder.payment?.sub_total) || 0,
    shippingFee: parseFloat(tiktokOrder.payment?.shipping_fee) || 0,
    sellerDiscount: parseFloat(tiktokOrder.payment?.seller_discount) || 0,
    platformDiscount: parseFloat(tiktokOrder.payment?.platform_discount || "0") || 0,
    totalAmount: parseFloat(tiktokOrder.payment?.total_amount || "0") || 0,
    settlementStatus: "unsettled",
    settlementAmount: 0,
    revenueAmount: 0,
    feeAmount: 0,
    adjustmentAmount: 0,
    shippingCostAmount: 0,
    syncStatus: "pending",
    rawData: tiktokOrder as any,
    cancellationInitiator: tiktokOrder.cancellation_initiator,
    shippingProvider: tiktokOrder.shipping_provider,
    buyerUserId: tiktokOrder.user_id,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Convert TikTok API order item to KasFlow MarketplaceOrderItem
 */
function convertToOrderItem(
  tiktokItem: TikTokOrderItem,
  orderId: string,
  companyId: string
): MarketplaceOrderItem {
  return {
    id: uid("mkp_item"),
    orderId,
    companyId,
    skuId: tiktokItem.sku_id,
    skuName: tiktokItem.sku_name,
    productName: tiktokItem.product_name,
    quantity: tiktokItem.quantity || 1,
    unitPrice: parseFloat(tiktokItem.unit_price) || 0,
    settlementAmount: parseFloat(tiktokItem.settlement_amount) || 0,
    revenueAmount: parseFloat(tiktokItem.revenue_amount) || 0,
    rawData: tiktokItem as any,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Fetch order detail (includes items/SKUs) from TikTok API
 */
async function fetchOrderDetail(
  accessToken: string,
  shopCipher: string,
  appKey: string,
  appSecret: string,
  orderIds: string[]
): Promise<TikTokOrder[]> {
  // Max 50 orders per request
  const batchSize = 50;
  const allOrders: TikTokOrder[] = [];

  for (let i = 0; i < orderIds.length; i += batchSize) {
    const batch = orderIds.slice(i, i + batchSize);
    const data = await tiktokApiGet<any>(
      "/order/202507/orders",
      accessToken,
      shopCipher,
      appKey,
      appSecret,
      { ids: batch.join(",") }
    );

    if (data.orders) {
      allOrders.push(...data.orders);
    }

    // Small delay between batches
    if (i + batchSize < orderIds.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  return allOrders;
}

/**
 * Sync orders from TikTok Order API
 *
 * This fetches orders and converts them. The caller is responsible for
 * upserting to database and handling deduplication.
 *
 * Now fetches all operational + final statuses, not just COMPLETED.
 * Filter by create_time to get orders created within the date range.
 */
export async function syncOrders(params: SyncOrdersParams): Promise<SyncOrdersResult> {
  const {
    accessToken,
    shopCipher,
    appKey,
    appSecret,
    companyId,
    connectionId,
    startDate,
    endDate,
    statuses = DEFAULT_SYNC_STATUSES,
  } = params;

  // Fetch orders for each status (TikTok API only allows one status per request)
  const allPages: TikTokOrder[] = [];

  for (const status of statuses) {
    const body: Record<string, any> = {
      order_status: status,
    };

    if (startDate) {
      // Convert WIB (UTC+7) to UTC for TikTok API
      const startDateWIB = new Date(`${startDate}T00:00:00+07:00`);
      body.create_time_ge = Math.floor(startDateWIB.getTime() / 1000);
    }

    if (endDate) {
      // Convert WIB (UTC+7) to UTC for TikTok API, add 1 second past 23:59:59 to make exclusive upper bound
      const endDateWIB = new Date(`${endDate}T23:59:59+07:00`);
      body.create_time_lt = Math.floor(endDateWIB.getTime() / 1000) + 1;
    }

    let pageToken: string | undefined;
    let statusCount = 0;

    while (true) {
      const extraParams: Record<string, any> = {
        page_size: 100,
        sort_field: "create_time",
        sort_order: "ASC",
      };

      if (pageToken) {
        extraParams.page_token = pageToken;
      }

      const result = await tiktokApiPost<any>(
        "/order/202309/orders/search",
        accessToken,
        shopCipher,
        appKey,
        appSecret,
        body,
        extraParams
      );

      const orders = result.orders || [];
      allPages.push(...orders);
      statusCount += orders.length;

      if (!result.next_page_token) break;
      pageToken = result.next_page_token;

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(`[SyncOrders] Status ${status}: ${statusCount} orders fetched`);
  }

  // Convert to KasFlow format
  const allOrders = allPages.map((to) => convertToOrder(to, connectionId, companyId));

  return {
    orders: allOrders,
    items: [], // Items fetched separately if needed
    fetched: allOrders.length,
    created: 0, // Caller determines
    updated: 0,
  };
}
