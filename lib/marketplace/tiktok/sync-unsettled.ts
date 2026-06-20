// ============================================================
// SYNC UNSETTLED TRANSACTIONS
// ============================================================
// Fetch unsettled transactions from TikTok Finance API.
// These are ESTIMATES — may change before final settlement.
// Used for tracking purposes only, NOT for creating transactions.
// ============================================================

import type { MarketplaceOrder } from "@/lib/types";
import { tiktokApiGet } from "./client";
import type { TikTokUnsettledTransaction } from "./types";

export type SyncUnsettledParams = {
  accessToken: string;
  shopCipher: string;
  appKey: string;
  appSecret: string;
  companyId: string;
  connectionId: string;
  startDate?: string; // ISO date string
};

export type SyncUnsettledResult = {
  unsettled: TikTokUnsettledTransaction[];
  totalCount: number;
  totalEstSettlementAmount: number;
  totalEstRevenueAmount: number;
  totalEstFeeAmount: number;
};

/**
 * Fetch unsettled transactions from TikTok Finance API
 *
 * IMPORTANT:
 * - Data available after 2025-01-01
 * - These are ESTIMATES — may change before settlement
 * - Used for tracking only, NOT for creating KasFlow transactions
 */
export async function syncUnsettled(
  params: SyncUnsettledParams
): Promise<SyncUnsettledResult> {
  const {
    accessToken,
    shopCipher,
    appKey,
    appSecret,
    startDate,
  } = params;

  const extraParams: Record<string, any> = {
    sort_field: "order_create_time",
    sort_order: "DESC",
  };

  if (startDate) {
    extraParams.search_time_ge = Math.floor(new Date(startDate).getTime() / 1000);
  }

  const result = await tiktokApiGet<any>(
    "/finance/202507/orders/unsettled",
    accessToken,
    shopCipher,
    appKey,
    appSecret,
    extraParams
  );

  const unsettled: TikTokUnsettledTransaction[] = result.transactions || [];

  return {
    unsettled,
    totalCount: result.total_count || 0,
    totalEstSettlementAmount: parseFloat(result.sum_est_settlement_amount || "0"),
    totalEstRevenueAmount: parseFloat(result.sum_est_revenue_amount || "0"),
    totalEstFeeAmount: parseFloat(result.sum_est_fee_amount || "0"),
  };
}

/**
 * Update existing orders with unsettled status
 *
 * Takes the unsettled data and updates the corresponding orders
 * in the cache with settlement_status = 'unsettled'
 */
export function markOrdersAsUnsettled(
  orders: MarketplaceOrder[],
  unsettled: TikTokUnsettledTransaction[]
): MarketplaceOrder[] {
  const unsettledOrderIds = new Set(unsettled.map((u) => u.order_id));

  return orders.map((order) => {
    if (unsettledOrderIds.has(order.platformOrderId)) {
      const unsettledData = unsettled.find((u) => u.order_id === order.platformOrderId);
      return {
        ...order,
        settlementStatus: "unsettled" as const,
        settlementAmount: unsettledData
          ? parseFloat(unsettledData.est_settlement_amount)
          : order.settlementAmount,
        revenueAmount: unsettledData
          ? parseFloat(unsettledData.est_revenue_amount)
          : order.revenueAmount,
        feeAmount: unsettledData
          ? parseFloat(unsettledData.est_fee_amount)
          : order.feeAmount,
        updatedAt: new Date().toISOString(),
      };
    }
    return order;
  });
}
