import { memoize } from "@/lib/memoize";
import type {
  Account,
  AccountingPeriod,
  BalanceSheetReport,
  CashAccount,
  CashFlowPoint,
  JournalEntry,
  ProfitLossReport,
  ReportSummary,
  TaxReport,
  TaxSettings,
  Transaction,
} from "@/lib/types";
import {
  calculateBalanceSheet,
  calculateCashFlow,
  calculateProfitLoss,
  calculateReportSummary,
  calculateTaxReport,
} from "@/lib/accounting";

/**
 * Memoized version of calculateBalanceSheet
 * Caches up to 10 different input combinations
 */
export const calculateBalanceSheetMemo = memoize<
  [JournalEntry[], Account[], TaxSettings | undefined, AccountingPeriod[] | undefined],
  BalanceSheetReport
>(calculateBalanceSheet, 10);

/**
 * Memoized version of calculateProfitLoss
 * Caches up to 15 different input combinations (more variety due to date ranges)
 */
export const calculateProfitLossMemo = memoize<
  [
    JournalEntry[],
    Account[],
    string | undefined,
    string | undefined,
    { id: string; categoryId: string; type: string }[] | undefined,
    TaxSettings | undefined
  ],
  ProfitLossReport
>(calculateProfitLoss, 15);

/**
 * Memoized version of calculateTaxReport
 * Important: called 12x in reports page (once per month)
 * Caches up to 15 combinations (12 months + extras)
 */
export const calculateTaxReportMemo = memoize<
  [JournalEntry[], Account[], TaxSettings, string],
  TaxReport
>(calculateTaxReport, 15);

/**
 * Memoized version of calculateCashFlow
 * Caches up to 5 combinations (rarely called with different inputs)
 */
export const calculateCashFlowMemo = memoize<
  [JournalEntry[], Account[]],
  CashFlowPoint[]
>(calculateCashFlow, 5);

/**
 * Memoized version of calculateReportSummary
 * Caches up to 5 combinations
 */
export const calculateReportSummaryMemo = memoize<
  [JournalEntry[], Account[], CashAccount[], TaxSettings, string?, string?],
  ReportSummary
>(calculateReportSummary, 5);
