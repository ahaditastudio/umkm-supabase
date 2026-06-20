// ============================================================
// TIKTOK SYNC ENGINE
// ============================================================
// Main orchestrator for syncing TikTok Shop data to KasFlow.
// Coordinates: statements, orders, unsettled transactions
//
// Flow:
// 1. Sync statements (creates KasFlow transactions)
// 2. Sync orders (cache only for analytics)
// 3. Sync unsettled (update order settlement status)
// ============================================================

import type {
  MarketplaceConnection,
  MarketplaceAccountMapping,
  MarketplaceStatement,
  MarketplaceOrder,
  MarketplaceSyncLog,
  Category,
  CashAccount,
} from "@/lib/types";
import {
  syncStatements,
  type SyncStatementsResult,
} from "./sync-statements";
import { syncOrders, type SyncOrdersResult } from "./sync-orders";
import { syncUnsettled, type SyncUnsettledResult } from "./sync-unsettled";
import { uid } from "@/lib/utils";

export type SyncEngineParams = {
  connection: MarketplaceConnection;
  mappings: MarketplaceAccountMapping[];
  categories: Category[];
  cashAccounts: CashAccount[];
  companyId: string;
  appKey: string;
  appSecret: string;
  mode: "full" | "incremental" | "backfill";
  startDate?: string; // ISO date string for backfill
  endDate?: string; // ISO date string for filtering orders
};

export type SyncEngineResult = {
  syncLogId: string;
  status: "success" | "error" | "partial";
  startedAt: string;
  completedAt: string;
  duration: number; // milliseconds
  statements: {
    fetched: number;
    created: number;
    updated: number;
  };
  orders: {
    fetched: number;
    created: number;
    updated: number;
  };
  unsettled: {
    fetched: number;
  };
  transactions: {
    created: number;
  };
  errors: Array<{
    stage: string;
    message: string;
  }>;
  data: {
    statements: MarketplaceStatement[];
    orders: MarketplaceOrder[];
    statementLinks: SyncStatementsResult["statementLinks"];
  };
};

/**
 * Determine sync start date based on mode
 *
 * Priority: customStartDate > mode logic
 * If user explicitly provides a startDate, it ALWAYS takes precedence.
 */
function getSyncStartDate(
  mode: "full" | "incremental" | "backfill",
  connection: MarketplaceConnection,
  customStartDate?: string
): string | undefined {
  // If user explicitly provides a start date, always use it
  if (customStartDate) {
    return customStartDate;
  }

  if (mode === "incremental" && connection.lastSyncAt) {
    // Start from last sync date
    return connection.lastSyncAt.split("T")[0];
  }

  if (mode === "full" || mode === "backfill" || !connection.lastSyncAt) {
    // Use sync_start_date from connection, or default to 30 days ago
    return connection.syncStartDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  }

  return undefined;
}

/**
 * Main sync orchestrator
 *
 * This function coordinates all sync operations and returns
 * the results. The caller is responsible for:
 * - Creating sync log in database
 * - Upserting statements and orders
 * - Creating KasFlow transactions
 * - Updating connection last_sync_at
 */
export async function runSync(params: SyncEngineParams): Promise<SyncEngineResult> {
  const {
    connection,
    mappings,
    categories,
    cashAccounts,
    companyId,
    appKey,
    appSecret,
    mode,
    startDate: customStartDate,
    endDate: customEndDate,
  } = params;

  const syncLogId = uid("mkp_sync");
  const startedAt = new Date().toISOString();
  const errors: SyncEngineResult["errors"] = [];

  // Validate connection
  if (!connection.accessToken || !connection.shopCipher) {
    throw new Error("Connection missing access token or shop cipher");
  }

  // Determine sync start date
  const syncStartDate = getSyncStartDate(mode, connection, customStartDate);

  // Initialize result
  const result: SyncEngineResult = {
    syncLogId,
    status: "success",
    startedAt,
    completedAt: "",
    duration: 0,
    statements: { fetched: 0, created: 0, updated: 0 },
    orders: { fetched: 0, created: 0, updated: 0 },
    unsettled: { fetched: 0 },
    transactions: { created: 0 },
    errors,
    data: {
      statements: [],
      orders: [],
      statementLinks: [],
    },
  };

  // Common API params
  const apiParams = {
    accessToken: connection.accessToken,
    shopCipher: connection.shopCipher,
    appKey,
    appSecret,
    companyId,
    connectionId: connection.id,
  };

  // ── STAGE 1: SYNC STATEMENTS ──
  try {
    console.log("[SyncEngine] Stage 1: Syncing statements...");
    const statementsResult = await syncStatements({
      ...apiParams,
      startDate: syncStartDate,
      mappings,
      categories,
      cashAccounts,
    });

    result.data.statements = statementsResult.statements;
    result.data.statementLinks = statementsResult.statementLinks;
    result.statements.fetched = statementsResult.statements.length;
    result.statements.created = statementsResult.newStatements.length;
    result.statements.updated = statementsResult.updatedStatements.length;
    result.transactions.created = statementsResult.transactionsCreated;

    console.log(`[SyncEngine] Statements: ${result.statements.fetched} fetched, ${result.statements.created} new, ${result.transactions.created} transactions`);
  } catch (error) {
    console.error("[SyncEngine] Statement sync failed:", error);
    errors.push({
      stage: "statements",
      message: error instanceof Error ? error.message : String(error),
    });
    result.status = "partial";
  }

  // ── STAGE 2: SYNC ORDERS ──
  try {
    console.log("[SyncEngine] Stage 2: Syncing orders...");
    const ordersResult = await syncOrders({
      ...apiParams,
      startDate: syncStartDate,
      endDate: customEndDate,
    });

    result.data.orders = ordersResult.orders;
    result.orders.fetched = ordersResult.fetched;
    result.orders.created = ordersResult.created;
    result.orders.updated = ordersResult.updated;

    console.log(`[SyncEngine] Orders: ${result.orders.fetched} fetched`);
  } catch (error) {
    console.error("[SyncEngine] Order sync failed:", error);
    errors.push({
      stage: "orders",
      message: error instanceof Error ? error.message : String(error),
    });
    result.status = "partial";
  }

  // ── STAGE 3: SYNC UNSETTLED ──
  try {
    console.log("[SyncEngine] Stage 3: Syncing unsettled transactions...");
    const unsettledResult = await syncUnsettled({
      ...apiParams,
      startDate: syncStartDate,
    });

    result.unsettled.fetched = unsettledResult.totalCount;

    console.log(`[SyncEngine] Unsettled: ${result.unsettled.fetched} fetched`);
  } catch (error) {
    console.error("[SyncEngine] Unsettled sync failed:", error);
    errors.push({
      stage: "unsettled",
      message: error instanceof Error ? error.message : String(error),
    });
    // Unsettled is optional, don't change status
  }

  // Finalize
  const completedAt = new Date().toISOString();
  result.completedAt = completedAt;
  result.duration = new Date(completedAt).getTime() - new Date(startedAt).getTime();

  if (errors.length > 0 && result.statements.fetched === 0 && result.orders.fetched === 0) {
    result.status = "error";
  }

  console.log(`[SyncEngine] Completed in ${result.duration}ms with status: ${result.status}`);

  return result;
}

/**
 * Create sync log entry from sync result
 */
export function createSyncLogFromResult(
  result: SyncEngineResult,
  connectionId: string,
  companyId: string,
  syncType: "full" | "incremental" | "backfill"
): MarketplaceSyncLog {
  return {
    id: result.syncLogId,
    connectionId,
    companyId,
    syncType,
    status: result.status,
    recordsFetched: result.statements.fetched + result.orders.fetched + result.unsettled.fetched,
    recordsCreated: result.statements.created + result.orders.created,
    recordsUpdated: result.statements.updated + result.orders.updated,
    recordsSkipped: 0,
    errorMessage: result.errors.length > 0 ? result.errors.map((e) => e.message).join("; ") : undefined,
    startedAt: result.startedAt,
    completedAt: result.completedAt,
    createdAt: result.startedAt,
  };
}
