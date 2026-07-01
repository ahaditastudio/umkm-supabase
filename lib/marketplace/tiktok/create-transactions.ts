// ============================================================
// CREATE MARKETPLACE TRANSACTIONS
// ============================================================
// Converts a settled statement into max 3 KasFlow transactions:
// 1. INCOME  — daily revenue (and positive adjustment)
// 2. EXPENSE — daily platform fee (and negative adjustment)
// 3. TRANSFER — payout to bank (if payment_status = PAID)
//
// Idempotency: only creates transactions when statement links are NULL.
// ============================================================

import type {
  MarketplaceStatement,
  MarketplaceAccountMapping,
  Transaction,
  MarketplaceMappingType,
  Category,
  CashAccount,
} from "@/lib/types";
import { uid } from "@/lib/utils";

export type CreateTransactionResult = {
  incomeTxn?: Transaction;
  expenseTxn?: Transaction;
  transferTxn?: Transaction;
  transactionsCreated: number;
};

/**
 * Find account mapping by type from an array of mappings
 */
function findMapping(
  mappings: MarketplaceAccountMapping[],
  type: MarketplaceMappingType
): MarketplaceAccountMapping | undefined {
  return mappings.find((m) => m.mappingType === type);
}

/**
 * Resolve category from mapping → falls back to finding by type
 */
function resolveCategoryFromMapping(
  mapping: MarketplaceAccountMapping | undefined,
  categories: Category[],
  type: "income" | "expense"
): Category | undefined {
  if (mapping?.kasflowCategoryId) {
    return categories.find((c) => c.id === mapping.kasflowCategoryId);
  }
  // Fallback: find first category of matching type
  return categories.find((c) => c.type === type);
}

/**
 * Resolve cash account from mapping → falls back to first bank account
 * @param preferType — preferred cash account type for fallback (bank for settlement, cash/ewallet for receivable)
 */
function resolveCashAccountFromMapping(
  mapping: MarketplaceAccountMapping | undefined,
  cashAccounts: CashAccount[],
  preferType: "cash" | "bank" | "ewallet" = "bank"
): CashAccount | undefined {
  if (mapping?.kasflowCashAccountId) {
    return cashAccounts.find((ca) => ca.id === mapping.kasflowCashAccountId);
  }
  // Fallback: prefer specific type, then any other, then first available
  return cashAccounts.find((ca) => ca.type === preferType) || cashAccounts[0];
}

/**
 * Format date string for transaction
 */
function formatStatementDate(statementTime: string | undefined): string {
  if (!statementTime) return new Date().toISOString().split("T")[0];
  return statementTime.split("T")[0];
}

/**
 * Create transactions from a settled statement.
 * Returns the created transactions (does NOT save to DB — caller handles persistence).
 */
export function createTransactionsFromStatement(
  statement: MarketplaceStatement,
  mappings: MarketplaceAccountMapping[],
  categories: Category[],
  cashAccounts: CashAccount[]
): CreateTransactionResult {
  const result: CreateTransactionResult = { transactionsCreated: 0 };
  const date = formatStatementDate(statement.statementTime);
  const connectionId = statement.connectionId;
  const companyId = statement.companyId;

  // Resolve mappings
  const revenueMapping = findMapping(mappings, "revenue");
  const feeMapping = findMapping(mappings, "platform_fee");

  // Resolve accounts
  // Cash account is stored on revenue/fee mapping by the frontend payment settings page.
  // Both share the same cash account selector, so we pick from whichever is available.
  const revenueCategory = resolveCategoryFromMapping(revenueMapping, categories, "income");
  const feeCategory = resolveCategoryFromMapping(feeMapping, categories, "expense");
  const cashAccount = resolveCashAccountFromMapping(revenueMapping ?? feeMapping, cashAccounts);

  // ── TXN 1: INCOME (revenue + positive adjustment) ──
  const positiveAdjustment = statement.adjustmentAmount > 0 ? statement.adjustmentAmount : 0;
  const incomeAmount = statement.revenueAmount + positiveAdjustment;

  if (incomeAmount > 0 && revenueCategory && cashAccount) {
    const now = new Date().toISOString();
    const hasAdjustment = positiveAdjustment > 0;
    const desc = hasAdjustment
      ? `Penjualan TikTok - ${date} (${statement.orderCount} order, termasuk Penyesuaian Rp ${positiveAdjustment.toLocaleString("id-ID")})`
      : `Penjualan TikTok - ${date} (${statement.orderCount} order)`;

    result.incomeTxn = {
      id: uid("tx"),
      companyId,
      type: "income",
      date,
      categoryId: revenueCategory.id,
      cashAccountId: cashAccount.id,
      amount: incomeAmount,
      description: desc,
      status: "posted",
      marketplaceConnectionId: connectionId,
      createdAt: now,
      updatedAt: now,
    };
    result.transactionsCreated++;
  }

  // ── TXN 2: EXPENSE (platform fee + negative adjustment) ──
  const negativeAdjustment = statement.adjustmentAmount < 0 ? Math.abs(statement.adjustmentAmount) : 0;
  const expenseAmount = Math.abs(statement.feeAmount) + negativeAdjustment;

  if (expenseAmount !== 0 && feeCategory && cashAccount) {
    const now = new Date().toISOString();
    const feePart = Math.abs(statement.feeAmount) > 0 ? "Biaya Platform" : "";
    const adjPart = negativeAdjustment > 0 ? `Penyesuaian (Minus) Rp ${negativeAdjustment.toLocaleString("id-ID")}` : "";
    const descParts = [feePart, adjPart].filter(Boolean);
    const desc = `Potongan TikTok - ${date} (${descParts.join(" & ")})`;

    result.expenseTxn = {
      id: uid("tx"),
      companyId,
      type: "expense",
      date,
      categoryId: feeCategory.id,
      cashAccountId: cashAccount.id,
      amount: expenseAmount,
      description: desc,
      status: "posted",
      marketplaceConnectionId: connectionId,
      createdAt: now,
      updatedAt: now,
    };
    result.transactionsCreated++;
  }

  // No transfer — statement PAID means money already in bank
  // Income goes directly to bank, expense directly from bank

  return result;
}
