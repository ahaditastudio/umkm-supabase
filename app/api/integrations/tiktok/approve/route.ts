// ============================================================
// APPROVE MARKETPLACE STATEMENTS
// ============================================================
// Manually approve marketplace statements and create KasFlow transactions
// with journal entries (ledger-first architecture).
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createTransactionsFromStatement } from "@/lib/marketplace/tiktok/create-transactions";
import { generateJournalFromTransaction } from "@/lib/accounting";
import type { MarketplaceStatement, MarketplaceAccountMapping, Category, CashAccount, Transaction } from "@/lib/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Convert snake_case DB rows to camelCase (matches KasFlow frontend types)
function snakeToCamel(obj: any): any {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(snakeToCamel);
  const result: any = {};
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
    result[camelKey] = obj[key];
  }
  return result;
}

// Convert camelCase to snake_case for DB insert
function camelToSnake(obj: any): any {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(camelToSnake);
  const result: any = {};
  for (const key in obj) {
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    result[snakeKey] = obj[key];
  }
  return result;
}

// Insert a transaction + its journal entry into Supabase
async function insertTransactionWithJournal(
  supabase: any,
  companyId: string,
  txn: Transaction,
  categories: Category[],
  cashAccounts: CashAccount[],
): Promise<boolean> {
  // Insert transaction
  const txnRow = camelToSnake(txn);
  const { error: txnError } = await supabase
    .from("transactions")
    .insert(txnRow);

  if (txnError) {
    console.error(`[Approve] Failed to insert transaction ${txn.id}:`, txnError.message);
    return false;
  }

  // Generate and insert journal entry (ledger-first!)
  try {
    const journal = generateJournalFromTransaction(txn, categories, cashAccounts, []);
    const journalRow: any = camelToSnake(journal);
    journalRow.lines = JSON.stringify(journal.lines);

    const { error: jError } = await supabase
      .from("journal_entries")
      .insert(journalRow);

    if (jError) {
      console.error(`[Approve] Failed to insert journal for txn ${txn.id}:`, jError.message);
      // Transaction is saved, journal can be retried — don't fail the whole flow
    }
  } catch (jErr) {
    console.error(`[Approve] Journal generation failed for txn ${txn.id}:`, jErr);
  }

  return true;
}

export async function POST(request: NextRequest) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await request.json();
    const { statementIds, companyId, userId } = body;

    if (!statementIds || !Array.isArray(statementIds) || statementIds.length === 0) {
      return NextResponse.json(
        { error: "statementIds array is required" },
        { status: 400 }
      );
    }

    if (!companyId) {
      return NextResponse.json(
        { error: "companyId is required" },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    console.log(`[Approve] Approving ${statementIds.length} statements for company ${companyId}`);

    // Fetch statements to approve
    const { data: statements, error: fetchError } = await supabase
      .from("marketplace_statements")
      .select("*")
      .in("id", statementIds)
      .eq("company_id", companyId)
      .eq("approval_status", "pending_approval");

    if (fetchError) {
      console.error("[Approve] Failed to fetch statements:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch statements", details: fetchError.message },
        { status: 500 }
      );
    }

    if (!statements || statements.length === 0) {
      return NextResponse.json(
        { error: "No pending statements found" },
        { status: 404 }
      );
    }

    console.log(`[Approve] Found ${statements.length} pending statements`);

    // Get account mappings for transaction creation
    const { data: mappings } = await supabase
      .from("marketplace_account_mapping")
      .select("*")
      .in("connection_id", statements.map((s: any) => s.connection_id));

    // Get categories and cash accounts — convert ALL to camelCase
    const [{ data: categoriesRaw }, { data: cashAccountsRaw }] = await Promise.all([
      supabase
        .from("account_categories")
        .select("*")
        .eq("company_id", companyId)
        .eq("is_active", true),
      supabase
        .from("cash_accounts")
        .select("*")
        .eq("company_id", companyId)
        .eq("is_active", true),
    ]);

    // ⚡ CRITICAL: Convert all DB data from snake_case to camelCase
    // createTransactionsFromStatement expects camelCase properties
    const categories: Category[] = (categoriesRaw || []).map((c: any) => ({
      id: c.id,
      companyId: c.company_id,
      name: c.name,
      type: c.type,
      accountId: c.account_id,
      isActive: c.is_active,
    }));

    const cashAccounts: CashAccount[] = (cashAccountsRaw || []).map((c: any) => ({
      id: c.id,
      companyId: c.company_id,
      name: c.name,
      type: c.type,
      accountId: c.account_id,
      isActive: c.is_active,
    }));

    const camelMappings: MarketplaceAccountMapping[] = (mappings || []).map((m: any) => ({
      id: m.id,
      connectionId: m.connection_id,
      companyId: m.company_id,
      mappingType: m.mapping_type,
      kasflowAccountId: m.kasflow_account_id,
      kasflowCashAccountId: m.kasflow_cash_account_id,
      kasflowCategoryId: m.kasflow_category_id,
      createdAt: m.created_at,
      updatedAt: m.updated_at,
    }));

    const approvedIds: string[] = [];
    const failedIds: string[] = [];
    let transactionsCreated = 0;

    // Process each statement
    for (const stmtRaw of statements) {
      try {
        // Convert statement from snake_case to camelCase
        const stmt: MarketplaceStatement = {
          id: stmtRaw.id,
          connectionId: stmtRaw.connection_id,
          companyId: stmtRaw.company_id,
          platformStatementId: stmtRaw.platform_statement_id,
          statementTime: stmtRaw.statement_time,
          currency: stmtRaw.currency || "IDR",
          settlementAmount: parseFloat(stmtRaw.settlement_amount) || 0,
          revenueAmount: parseFloat(stmtRaw.revenue_amount) || 0,
          feeAmount: parseFloat(stmtRaw.fee_amount) || 0,
          adjustmentAmount: parseFloat(stmtRaw.adjustment_amount) || 0,
          netSalesAmount: parseFloat(stmtRaw.net_sales_amount) || 0,
          shippingCostAmount: parseFloat(stmtRaw.shipping_cost_amount) || 0,
          paymentStatus: stmtRaw.payment_status,
          paymentId: stmtRaw.payment_id,
          paymentTime: stmtRaw.payment_time,
          reconciled: stmtRaw.reconciled || false,
          kasflowIncomeTxnId: stmtRaw.kasflow_income_txn_id,
          kasflowExpenseTxnId: stmtRaw.kasflow_expense_txn_id,
          kasflowTransferTxnId: stmtRaw.kasflow_transfer_txn_id,
          orderCount: stmtRaw.order_count || 0,
          approvalStatus: 'approved',
          createdAt: stmtRaw.created_at,
          updatedAt: stmtRaw.updated_at,
        };

        console.log(`[Approve] Processing statement ${stmt.id}: revenue=${stmt.revenueAmount}, fee=${stmt.feeAmount}, settlement=${stmt.settlementAmount}, payment=${stmt.paymentStatus}`);

        const connectionMappings = camelMappings.filter(
          (m) => m.connectionId === stmt.connectionId
        );

        // Create transactions from statement (now with proper camelCase data)
        const txnResult = createTransactionsFromStatement(
          stmt,
          connectionMappings,
          categories,
          cashAccounts,
        );

        console.log(`[Approve] Statement ${stmt.id}: transactionsCreated=${txnResult.transactionsCreated}, income=${!!txnResult.incomeTxn}, expense=${!!txnResult.expenseTxn}, transfer=${!!txnResult.transferTxn}`);

        let incomeTxnId: string | null = null;
        let expenseTxnId: string | null = null;
        let transferTxnId: string | null = null;

        // Insert income transaction + journal
        if (txnResult.incomeTxn) {
          const ok = await insertTransactionWithJournal(
            supabase, companyId, txnResult.incomeTxn, categories, cashAccounts
          );
          if (ok) {
            incomeTxnId = txnResult.incomeTxn.id;
            transactionsCreated++;
          }
        }

        // Insert expense transaction + journal
        if (txnResult.expenseTxn) {
          const ok = await insertTransactionWithJournal(
            supabase, companyId, txnResult.expenseTxn, categories, cashAccounts
          );
          if (ok) {
            expenseTxnId = txnResult.expenseTxn.id;
            transactionsCreated++;
          }
        }

        // Insert transfer transaction + journal
        if (txnResult.transferTxn) {
          // Fix: transfer txn sourceAccountId/destinationAccountId use COA codes,
          // but generateJournalFromTransaction needs cash account wrapper IDs.
          // Resolve back to cash account IDs for journal generation.
          const srcCash = cashAccounts.find((ca) => ca.accountId === txnResult.transferTxn?.sourceAccountId);
          const destCash = cashAccounts.find((ca) => ca.accountId === txnResult.transferTxn?.destinationAccountId);

          if (srcCash) txnResult.transferTxn.sourceAccountId = srcCash.id;
          if (destCash) txnResult.transferTxn.destinationAccountId = destCash.id;

          const ok = await insertTransactionWithJournal(
            supabase, companyId, txnResult.transferTxn, categories, cashAccounts
          );
          if (ok) {
            transferTxnId = txnResult.transferTxn.id;
            transactionsCreated++;
          }
        }

        // Update statement with approval info and transaction links
        const { error: updateError } = await supabase
          .from("marketplace_statements")
          .update({
            approval_status: "approved",
            approved_by: userId,
            approved_at: new Date().toISOString(),
            kasflow_income_txn_id: incomeTxnId,
            kasflow_expense_txn_id: expenseTxnId,
            kasflow_transfer_txn_id: transferTxnId,
            reconciled: !!(incomeTxnId || expenseTxnId || transferTxnId),
            updated_at: new Date().toISOString(),
          })
          .eq("id", stmt.id);

        if (updateError) {
          console.error(`[Approve] Failed to update statement ${stmt.id}:`, updateError);
          failedIds.push(stmt.id);
        } else {
          approvedIds.push(stmt.id);
          console.log(`[Approve] ✅ Statement ${stmt.id} approved: income=${incomeTxnId}, expense=${expenseTxnId}, transfer=${transferTxnId}`);
        }
      } catch (error) {
        console.error(`[Approve] Error processing statement ${stmtRaw.id}:`, error);
        failedIds.push(stmtRaw.id);
      }
    }

    console.log(`[Approve] Completed: ${approvedIds.length} approved, ${failedIds.length} failed, ${transactionsCreated} transactions created`);

    return NextResponse.json({
      success: true,
      summary: {
        approved: approvedIds.length,
        failed: failedIds.length,
        transactionsCreated,
      },
      approvedIds,
      failedIds,
    });
  } catch (error) {
    console.error("[Approve] Error:", error);
    return NextResponse.json(
      { error: "Failed to approve statements", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
