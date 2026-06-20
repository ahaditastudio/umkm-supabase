// ============================================================
// SYNC SETTLEMENT DATA
// ============================================================
// Fetch settlement details from Finance API for each statement.
// This enriches marketplace_orders with actual settlement amounts.
//
// Flow:
// 1. For each statement → fetch statement transactions (order IDs)
// 2. For each unique order ID → fetch order transaction details
// 3. Return settlement amounts per order
// ============================================================

import type { MarketplaceStatement } from "@/lib/types";
import { fetchAllPages, tiktokApiGet } from "./client";
import type { TikTokStatementTransaction } from "./types";

export type OrderSettlement = {
  platformOrderId: string;
  statementId: string;
  settlementAmount: number;
  revenueAmount: number;
  feeAmount: number;
  shippingCostAmount: number;
};

export type StatementOrderCount = {
  platformStatementId: string;
  orderCount: number;
};

export type SyncSettlementResult = {
  orderSettlements: OrderSettlement[];
  statementOrderCounts: StatementOrderCount[];
  fetched: number;
  errors: Array<{ statementId: string; orderId?: string; message: string }>;
};

/**
 * Fetch statement transactions for a single statement
 * Returns order IDs and count
 */
async function fetchStatementTransactions(
  statementId: string,
  accessToken: string,
  shopCipher: string,
  appKey: string,
  appSecret: string
): Promise<{ orderIds: string[]; orderCount: number }> {
  const transactions = await fetchAllPages<TikTokStatementTransaction>(
    `/finance/202501/statements/${statementId}/statement_transactions`,
    accessToken,
    shopCipher,
    appKey,
    appSecret,
    {
      sort_field: "order_create_time",
      sort_order: "ASC",
    },
    "transactions"
  );

  // Extract order IDs (only for ORDER type, skip ADJUSTMENT)
  const orderIds = transactions
    .filter((t) => t.type === "ORDER" && t.order_id)
    .map((t) => t.order_id!)
    .filter((id, index, self) => self.indexOf(id) === index); // dedupe

  return {
    orderIds,
    orderCount: orderIds.length,
  };
}

/**
 * Fetch order-level settlement details
 */
async function fetchOrderSettlement(
  orderId: string,
  accessToken: string,
  shopCipher: string,
  appKey: string,
  appSecret: string
): Promise<OrderSettlement | null> {
  try {
    const data = await tiktokApiGet<any>(
      `/finance/202501/orders/${orderId}/statement_transactions`,
      accessToken,
      shopCipher,
      appKey,
      appSecret,
      {}
    );

    // Parse amounts (they come as strings)
    return {
      platformOrderId: orderId,
      statementId: data.statement_id || "",
      settlementAmount: parseFloat(data.settlement_amount) || 0,
      revenueAmount: parseFloat(data.revenue_amount) || 0,
      feeAmount: parseFloat(data.fee_amount) || 0,
      shippingCostAmount: parseFloat(data.shipping_cost_amount) || 0,
    };
  } catch (error) {
    console.error(`[Settlement] Failed to fetch order ${orderId}:`, error);
    return null;
  }
}

/**
 * Process items in parallel batches with concurrency control
 */
async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number = 5
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);

    // Small delay between batches to respect rate limits
    if (i + concurrency < items.length) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  return results;
}

/**
 * Sync settlement data for all statements
 */
export async function syncSettlements(
  statements: MarketplaceStatement[],
  accessToken: string,
  shopCipher: string,
  appKey: string,
  appSecret: string
): Promise<SyncSettlementResult> {
  const statementOrderCounts: StatementOrderCount[] = [];
  const errors: SyncSettlementResult["errors"] = [];
  const allOrderIds = new Set<string>();
  const orderToStatementMap = new Map<string, string>();

  console.log(`[Settlement] Starting settlement sync for ${statements.length} statements...`);
  const startTime = Date.now();

  // Stage 1.5: Fetch statement transactions in parallel (concurrency: 5)
  console.log(`[Settlement] Stage 1.5: Fetching statement transactions...`);
  const statementResults = await processBatch(
    statements,
    async (statement) => {
      try {
        const result = await fetchStatementTransactions(
          statement.platformStatementId,
          accessToken,
          shopCipher,
          appKey,
          appSecret
        );
        return { statementId: statement.platformStatementId, ...result };
      } catch (error) {
        console.error(
          `[Settlement] Failed to fetch statement ${statement.platformStatementId}:`,
          error
        );
        errors.push({
          statementId: statement.platformStatementId,
          message: error instanceof Error ? error.message : String(error),
        });
        return { statementId: statement.platformStatementId, orderIds: [], orderCount: 0 };
      }
    },
    5 // Process 5 statements concurrently
  );

  // Collect results and unique order IDs
  for (const result of statementResults) {
    statementOrderCounts.push({
      platformStatementId: result.statementId,
      orderCount: result.orderCount,
    });

    for (const orderId of result.orderIds) {
      allOrderIds.add(orderId);
      orderToStatementMap.set(orderId, result.statementId);
    }
  }

  console.log(`[Settlement] Found ${allOrderIds.size} unique orders across ${statements.length} statements`);

  // Stage 1.6: Fetch order settlements in parallel batches (concurrency: 10)
  console.log(`[Settlement] Stage 1.6: Fetching order settlement details...`);
  const uniqueOrderIds = Array.from(allOrderIds);
  let processedCount = 0;
  const batchSize = 50;

  const orderSettlements: OrderSettlement[] = [];

  for (let i = 0; i < uniqueOrderIds.length; i += batchSize) {
    const batch = uniqueOrderIds.slice(i, i + batchSize);

    const batchResults = await Promise.all(
      batch.map(async (orderId) => {
        const settlement = await fetchOrderSettlement(
          orderId,
          accessToken,
          shopCipher,
          appKey,
          appSecret
        );

        if (settlement) {
          settlement.statementId = orderToStatementMap.get(orderId) || "";
          return settlement;
        } else {
          errors.push({
            statementId: orderToStatementMap.get(orderId) || "",
            orderId,
            message: "Failed to fetch order settlement",
          });
          return null;
        }
      })
    );

    // Filter out nulls and add to results
    orderSettlements.push(...batchResults.filter((s): s is OrderSettlement => s !== null));

    processedCount += batch.length;
    console.log(`[Settlement] Progress: ${processedCount}/${uniqueOrderIds.length} orders (${Math.round(processedCount/uniqueOrderIds.length*100)}%)`);

    // Small delay between batches
    if (i + batchSize < uniqueOrderIds.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(
    `[Settlement] Completed: ${orderSettlements.length} settlements fetched, ${errors.length} errors in ${duration}s`
  );

  return {
    orderSettlements,
    statementOrderCounts,
    fetched: orderSettlements.length,
    errors,
  };
}
