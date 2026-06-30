import { createClient } from "@/lib/supabase/client";
import type {
  BusinessProfile,
  Customer,
  Supplier,
  Transaction,
  JournalEntry,
  AuditLog,
  TaxSettings,
  Account,
  Category,
  CashAccount,
  AccountingPeriod,
  MarketplaceConnection,
  MarketplaceAccountMapping,
  MarketplaceOrder,
  MarketplaceOrderItem,
  MarketplaceStatement,
  MarketplaceSyncLog,
  MarketplaceSyncType,
  MarketplaceSyncLogStatus,
} from "@/lib/types";
import { generateJournalFromTransaction, generateClosingEntries } from "@/lib/accounting";

// Helper to convert snake_case from DB to camelCase
function snakeToCamel<T>(obj: any): T {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(snakeToCamel) as T;

  const converted: any = {};
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    converted[camelKey] = obj[key];
  }
  return converted;
}

// Helper to convert camelCase to snake_case for DB
function camelToSnake(obj: any): any {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(camelToSnake);

  const converted: any = {};
  for (const key in obj) {
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    converted[snakeKey] = obj[key];
  }
  return converted;
}

// Business Profile
export async function getBusinessProfile(companyId: string): Promise<BusinessProfile | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("business_profiles")
    .select("*")
    .eq("id", companyId)
    .single();

  if (error || !data) return null;
  return snakeToCamel<BusinessProfile>(data);
}

export async function updateBusinessProfile(
  companyId: string,
  updates: Partial<BusinessProfile>,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("business_profiles")
    .update(camelToSnake(updates))
    .eq("id", companyId);

  if (error) throw error;
}

// Customers
export async function getCustomers(companyId: string): Promise<Customer[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("name");

  if (error) throw error;
  return (data || []).map(snakeToCamel<Customer>);
}

export async function addCustomer(
  companyId: string,
  name: string,
  phone?: string,
  email?: string,
): Promise<Customer> {
  const supabase = createClient();
  const id = `customer_${Date.now()}`;
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("customers")
    .insert({
      id,
      company_id: companyId,
      name,
      phone,
      email,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) throw error;
  return snakeToCamel<Customer>(data);
}

export async function updateCustomer(
  companyId: string,
  customerId: string,
  updates: Partial<Customer>,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("customers")
    .update(camelToSnake(updates))
    .eq("id", customerId)
    .eq("company_id", companyId);

  if (error) throw error;
}

export async function softDeleteCustomer(companyId: string, customerId: string): Promise<void> {
  const supabase = createClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("customers")
    .update({ deleted_at: now, updated_at: now })
    .eq("id", customerId)
    .eq("company_id", companyId);

  if (error) throw error;

  await addAuditLog(companyId, "delete", "customers", { customerId });
}

export async function restoreCustomer(companyId: string, customerId: string): Promise<void> {
  const supabase = createClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("customers")
    .update({ deleted_at: null, updated_at: now })
    .eq("id", customerId)
    .eq("company_id", companyId);

  if (error) throw error;

  await addAuditLog(companyId, "restore", "customers", { customerId });
}

// Suppliers
export async function getSuppliers(companyId: string): Promise<Supplier[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("name");

  if (error) throw error;
  return (data || []).map(snakeToCamel<Supplier>);
}

export async function addSupplier(
  companyId: string,
  name: string,
  phone?: string,
  email?: string,
): Promise<Supplier> {
  const supabase = createClient();
  const id = `supplier_${Date.now()}`;
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("suppliers")
    .insert({
      id,
      company_id: companyId,
      name,
      phone,
      email,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) throw error;
  return snakeToCamel<Supplier>(data);
}

export async function updateSupplier(
  companyId: string,
  supplierId: string,
  updates: Partial<Supplier>,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("suppliers")
    .update(camelToSnake(updates))
    .eq("id", supplierId)
    .eq("company_id", companyId);

  if (error) throw error;
}

export async function softDeleteSupplier(companyId: string, supplierId: string): Promise<void> {
  const supabase = createClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("suppliers")
    .update({ deleted_at: now, updated_at: now })
    .eq("id", supplierId)
    .eq("company_id", companyId);

  if (error) throw error;

  await addAuditLog(companyId, "delete", "suppliers", { supplierId });
}

export async function restoreSupplier(companyId: string, supplierId: string): Promise<void> {
  const supabase = createClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("suppliers")
    .update({ deleted_at: null, updated_at: now })
    .eq("id", supplierId)
    .eq("company_id", companyId);

  if (error) throw error;

  await addAuditLog(companyId, "restore", "suppliers", { supplierId });
}

// Transactions
export async function getTransactions(companyId: string): Promise<Transaction[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("date", { ascending: false });

  if (error) throw error;
  return (data || []).map(snakeToCamel<Transaction>);
}

export interface TransactionFilters {
  type?: 'income' | 'expense' | 'transfer' | 'capital';
  accountId?: string;
  search?: string;
  includeDeleted?: boolean;
  year?: number;
}

export interface TransactionCursor {
  date: string;
  id: string;
}

export interface PaginatedTransactionsResponse {
  transactions: Transaction[];
  hasMore: boolean;
  nextCursor: TransactionCursor | null;
}

export async function getTransactionsPaginated(
  companyId: string,
  cursor: TransactionCursor | null = null,
  limit: number = 50,
  filters: TransactionFilters = {}
): Promise<PaginatedTransactionsResponse> {
  const supabase = createClient();

  let query = supabase
    .from("transactions")
    .select("*")
    .eq("company_id", companyId)
    .order("date", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1); // Fetch one extra to determine hasMore

  // Apply type filter
  if (filters.type) {
    query = query.eq("type", filters.type);
  }

  // Apply account filter
  if (filters.accountId) {
    query = query.or(`cash_account_id.eq.${filters.accountId},source_account_id.eq.${filters.accountId},destination_account_id.eq.${filters.accountId}`);
  }

  // Apply search filter
  if (filters.search) {
    query = query.ilike("description", `%${filters.search}%`);
  }

  // Apply year filter
  if (filters.year) {
    const startDate = `${filters.year}-01-01`;
    const endDate = `${filters.year}-12-31`;
    query = query.gte("date", startDate).lte("date", endDate);
  }

  // Apply cursor for pagination
  if (cursor) {
    query = query.or(
      `date.lt.${cursor.date},and(date.eq.${cursor.date},id.lt.${cursor.id})`
    );
  }

  const { data, error } = await query;

  if (error) throw error;

  const transactions = (data || []).map(snakeToCamel<Transaction>);
  const hasMore = transactions.length > limit;

  // Remove the extra item if we fetched more than limit
  if (hasMore) {
    transactions.pop();
  }

  const nextCursor: TransactionCursor | null = hasMore && transactions.length > 0
    ? { date: transactions[transactions.length - 1].date, id: transactions[transactions.length - 1].id }
    : null;

  return {
    transactions,
    hasMore,
    nextCursor,
  };
}

export async function addTransaction(
  companyId: string,
  transaction: Omit<Transaction, "id" | "createdAt" | "updatedAt">,
  categories: Category[],
  cashAccounts: CashAccount[],
  accounts?: Account[],
): Promise<Transaction> {
  const supabase = createClient();
  const id = `tx_${Date.now()}`;
  const now = new Date().toISOString();

  const transactionData: Transaction = {
    ...transaction,
    id,
    createdAt: now,
    updatedAt: now,
  };

  const { data, error } = await supabase
    .from("transactions")
    .insert(camelToSnake(transactionData))
    .select()
    .single();

  if (error) throw error;

  // Generate and save journal entry
  const journal = generateJournalFromTransaction(transactionData, categories, cashAccounts, accounts ?? []);
  try {
    await addJournalEntry(companyId, journal);
  } catch (journalError) {
    console.error("Failed to create journal entry for transaction:", journalError);
    // Transaction is already saved; journal can be retried via sync
  }

  try {
    await addAuditLog(companyId, "create", "transactions", { transactionId: id });
  } catch (auditError) {
    console.error("Failed to create audit log for transaction:", auditError);
    // Non-critical, don't fail the transaction
  }

  return snakeToCamel<Transaction>(data);
}

export async function softDeleteTransaction(companyId: string, transactionId: string): Promise<void> {
  const supabase = createClient();
  const now = new Date().toISOString();

  // Soft delete transaction
  const { error: txError } = await supabase
    .from("transactions")
    .update({ deleted_at: now, updated_at: now })
    .eq("id", transactionId)
    .eq("company_id", companyId);

  if (txError) throw txError;

  // Soft delete related journal entry
  const { error: journalError } = await supabase
    .from("journal_entries")
    .update({ deleted_at: now, updated_at: now })
    .eq("transaction_id", transactionId)
    .eq("company_id", companyId);

  if (journalError) throw journalError;

  await addAuditLog(companyId, "delete", "transactions", { transactionId });
}

// Bulk insert transactions for generate dummy data
export async function bulkInsertTransactions(
  companyId: string,
  transactions: Transaction[],
  journalEntries: JournalEntry[],
): Promise<void> {
  const supabase = createClient();

  // Insert transactions in batches
  const batchSize = 100;
  for (let i = 0; i < transactions.length; i += batchSize) {
    const batch = transactions.slice(i, i + batchSize).map(camelToSnake);
    const { error } = await supabase.from("transactions").insert(batch);
    if (error) {
      console.error("Transaction insert error:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        batch: batch.slice(0, 2), // Log first 2 items for debugging
      });
      throw error;
    }
  }

  // Insert journal entries in batches
  for (let i = 0; i < journalEntries.length; i += batchSize) {
    const batch = journalEntries.slice(i, i + batchSize).map((j) => {
      // Stringify lines FIRST (keep camelCase inside JSONB), then convert top-level keys
      const snakeObj = camelToSnake({ ...j, lines: undefined });
      // Lines is JSONB — Supabase accepts raw arrays; convert inner keys to snake_case
      snakeObj.lines = JSON.stringify(
        (j.lines || []).map((line: any) => camelToSnake(line))
      );
      return snakeObj;
    });
    const { error } = await supabase.from("journal_entries").insert(batch);
    if (error) {
      console.error("Journal entry insert error:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        batch: batch.slice(0, 2), // Log first 2 items for debugging
      });
      throw error;
    }
  }

  await addAuditLog(companyId, "create", "bulk_transactions", {
    transactionCount: transactions.length,
    journalCount: journalEntries.length,
  });
}

// Bulk insert customers and suppliers for seed demo
export async function bulkInsertContacts(
  companyId: string,
  customers: Customer[],
  suppliers: Supplier[],
): Promise<void> {
  const supabase = createClient();

  if (customers.length > 0) {
    const { error } = await supabase.from("customers").insert(customers.map(camelToSnake));
    if (error) throw error;
  }

  if (suppliers.length > 0) {
    const { error } = await supabase.from("suppliers").insert(suppliers.map(camelToSnake));
    if (error) throw error;
  }

  await addAuditLog(companyId, "create", "bulk_contacts", {
    customerCount: customers.length,
    supplierCount: suppliers.length,
  });
}

export async function restoreTransaction(companyId: string, transactionId: string): Promise<void> {
  const supabase = createClient();
  const now = new Date().toISOString();

  // Restore transaction
  const { error: txError } = await supabase
    .from("transactions")
    .update({ deleted_at: null, updated_at: now })
    .eq("id", transactionId)
    .eq("company_id", companyId);

  if (txError) throw txError;

  // Restore related journal entry
  const { error: journalError } = await supabase
    .from("journal_entries")
    .update({ deleted_at: null, updated_at: now })
    .eq("transaction_id", transactionId)
    .eq("company_id", companyId);

  if (journalError) throw journalError;

  await addAuditLog(companyId, "restore", "transactions", { transactionId });
}

// Journal Entries
export async function getJournalEntries(companyId: string): Promise<JournalEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("date", { ascending: false });

  if (error) throw error;
  return (data || []).map((row: any) => {
    const converted = snakeToCamel<any>(row);
    // Parse lines if it's a string
    if (typeof converted.lines === "string") {
      converted.lines = JSON.parse(converted.lines);
    }
    return converted as JournalEntry;
  });
}

export async function addJournalEntry(companyId: string, journal: JournalEntry): Promise<JournalEntry> {
  const supabase = createClient();
  const now = new Date().toISOString();

  const journalData = {
    ...journal,
    createdAt: now,
    updatedAt: now,
  };

  const dbData = camelToSnake(journalData);
  // Stringify lines array for JSONB
  dbData.lines = JSON.stringify(journalData.lines);

  const { data, error } = await supabase
    .from("journal_entries")
    .insert(dbData)
    .select()
    .single();

  if (error) throw error;
  return snakeToCamel<JournalEntry>(data);
}

// Accounts
export async function getAccounts(companyId: string): Promise<Account[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("code");

  if (error) throw error;
  return (data || []).map(snakeToCamel<Account>);
}

export async function addAccount(
  companyId: string,
  account: Omit<Account, "id" | "isActive" | "createdAt" | "updatedAt">,
): Promise<Account> {
  const supabase = createClient();
  const id = `acc_${Date.now()}`;
  const now = new Date().toISOString();

  const accountData = {
    ...account,
    id: `${companyId}_${id}`,
    is_active: true,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("accounts")
    .insert(camelToSnake(accountData))
    .select()
    .single();

  if (error) throw error;
  return snakeToCamel<Account>(data);
}

export async function updateAccount(
  companyId: string,
  accountId: string,
  updates: Partial<Account>,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("accounts")
    .update(camelToSnake(updates))
    .eq("id", accountId)
    .eq("company_id", companyId);

  if (error) throw error;
}

// Categories
export async function getCategories(companyId: string): Promise<Category[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("account_categories")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("name");

  if (error) throw error;
  return (data || []).map(snakeToCamel<Category>);
}

export async function addCategory(
  companyId: string,
  name: string,
  type: "income" | "expense",
  accountId: string,
): Promise<Category> {
  const supabase = createClient();
  const id = `cat_${Date.now()}`;
  const now = new Date().toISOString();

  const categoryData = {
    id: `${companyId}_${id}`,
    company_id: companyId,
    name,
    type,
    account_id: accountId,
    is_active: true,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("account_categories")
    .insert(categoryData)
    .select()
    .single();

  if (error) throw error;
  return snakeToCamel<Category>(data);
}

export async function updateCategory(
  companyId: string,
  categoryId: string,
  updates: Partial<Category>,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("account_categories")
    .update(camelToSnake(updates))
    .eq("id", categoryId)
    .eq("company_id", companyId);

  if (error) throw error;
}

export async function deleteCategory(companyId: string, categoryId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("account_categories")
    .delete()
    .eq("id", categoryId)
    .eq("company_id", companyId);

  if (error) throw error;

  await addAuditLog(companyId, "delete", "categories", { categoryId });
}

// Cash Accounts
export async function getCashAccounts(companyId: string): Promise<CashAccount[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cash_accounts")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("name");

  if (error) throw error;
  return (data || []).map(snakeToCamel<CashAccount>);
}

export async function addCashAccount(
  companyId: string,
  name: string,
  type: "cash" | "bank" | "ewallet",
  accountId: string,
): Promise<CashAccount> {
  const supabase = createClient();
  const id = `ca_${Date.now()}`;
  const now = new Date().toISOString();

  const cashAccountData = {
    id: `${companyId}_${id}`,
    company_id: companyId,
    name,
    type,
    account_id: accountId,
    is_active: true,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("cash_accounts")
    .insert(cashAccountData)
    .select()
    .single();

  if (error) throw error;
  return snakeToCamel<CashAccount>(data);
}

export async function updateCashAccount(
  companyId: string,
  cashAccountId: string,
  updates: Partial<CashAccount>,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("cash_accounts")
    .update(camelToSnake(updates))
    .eq("id", cashAccountId)
    .eq("company_id", companyId);

  if (error) throw error;
}

export async function deleteCashAccount(companyId: string, cashAccountId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("cash_accounts")
    .delete()
    .eq("id", cashAccountId)
    .eq("company_id", companyId);

  if (error) throw error;

  await addAuditLog(companyId, "delete", "cash_accounts", { cashAccountId });
}

// Tax Settings
export async function getTaxSettings(companyId: string): Promise<TaxSettings | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tax_settings")
    .select("*")
    .eq("company_id", companyId)
    .single();

  if (error || !data) return null;
  return snakeToCamel<TaxSettings>(data);
}

export async function updateTaxSettings(
  companyId: string,
  updates: Partial<TaxSettings>,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("tax_settings")
    .update(camelToSnake(updates))
    .eq("company_id", companyId);

  if (error) throw error;

  await addAuditLog(companyId, "update", "tax_settings", updates);
}

// Accounting Periods
export async function getAccountingPeriods(companyId: string): Promise<AccountingPeriod[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("accounting_periods")
    .select("*")
    .eq("company_id", companyId)
    .order("start_date", { ascending: false });

  if (error) throw error;
  return (data || []).map(snakeToCamel<AccountingPeriod>);
}

export async function addAccountingPeriod(
  companyId: string,
  startDate: string,
  endDate: string,
): Promise<AccountingPeriod> {
  const supabase = createClient();
  const id = `period_${Date.now()}`;
  const now = new Date().toISOString();

  const periodData = {
    id: `${companyId}_${id}`,
    company_id: companyId,
    start_date: startDate,
    end_date: endDate,
    status: "open",
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("accounting_periods")
    .insert(periodData)
    .select()
    .single();

  if (error) throw error;
  return snakeToCamel<AccountingPeriod>(data);
}

export async function closeAccountingPeriod(
  companyId: string,
  periodId: string,
  startDate: string,
  endDate: string,
): Promise<void> {
  const supabase = createClient();
  const now = new Date().toISOString();

  // Fetch journals and accounts for this period to generate closing entries
  const { data: journalsData } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .gte("date", startDate)
    .lte("date", endDate);

  const { data: accountsData } = await supabase
    .from("accounts")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true);

  const { data: taxSettingsData } = await supabase
    .from("tax_settings")
    .select("*")
    .eq("company_id", companyId)
    .single();

  // Generate closing entries
  const journals = (journalsData || []).map(snakeToCamel<JournalEntry>);
  const accounts = (accountsData || []).map(snakeToCamel<Account>);
  const taxSettings = taxSettingsData ? snakeToCamel<TaxSettings>(taxSettingsData) : undefined;

  const closingEntries = generateClosingEntries(companyId, startDate, endDate, journals, accounts, taxSettings);

  // Save closing entries to database
  for (const entry of closingEntries) {
    await addJournalEntry(companyId, entry);
  }

  // Close the period
  const { error: periodError } = await supabase
    .from("accounting_periods")
    .update({ status: "closed", closed_at: now, updated_at: now })
    .eq("id", periodId)
    .eq("company_id", companyId);

  if (periodError) throw periodError;

  // Lock all journal entries in this period
  const { error: journalError } = await supabase
    .from("journal_entries")
    .update({ status: "locked", updated_at: now })
    .eq("company_id", companyId)
    .gte("date", startDate)
    .lte("date", endDate);

  if (journalError) throw journalError;

  // Auto-create new open period starting from next day
  const endDateObj = new Date(endDate);
  const newStartDate = new Date(endDateObj.getTime() + 86400000); // +1 day
  const newEndDate = new Date(newStartDate.getFullYear(), newStartDate.getMonth() + 1, 0); // end of next month

  const newPeriodId = `period_${Date.now()}`;
  const { error: newPeriodError } = await supabase
    .from("accounting_periods")
    .insert({
      id: `${companyId}_${newPeriodId}`,
      company_id: companyId,
      start_date: newStartDate.toISOString().split('T')[0],
      end_date: newEndDate.toISOString().split('T')[0],
      status: "open",
      created_at: now,
      updated_at: now,
    });

  if (newPeriodError) {
    console.error("Failed to create new period:", newPeriodError);
    // Don't throw - period closed successfully, new period creation failed
  }

  await addAuditLog(companyId, "close_period", "accounting_periods", {
    periodId,
    startDate,
    endDate,
    newPeriodCreated: !newPeriodError,
    closingEntriesCreated: closingEntries.length,
  });
}

// Audit Logs
export async function getAuditLogs(companyId: string, limit = 100): Promise<AuditLog[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("company_id", companyId)
    .order("timestamp", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []).map(snakeToCamel<AuditLog>);
}

export async function addAuditLog(
  companyId: string,
  action: string,
  module: string,
  details: any,
): Promise<void> {
  const supabase = createClient();
  const id = `audit_${Date.now()}`;
  const now = new Date().toISOString();

  // Use getSession() instead of getUser() for performance — avoids blocking network call
  const { data: { session } } = await supabase.auth.getSession();
  const userEmail = session?.user?.email || "System";

  await supabase.from("audit_logs").insert({
    id,
    company_id: companyId,
    user: userEmail,
    action,
    module,
    new_value: details,
    timestamp: now,
  });
}

// Opening Balance
export async function createOpeningBalance(
  companyId: string,
  accountId: string,
  amount: number,
  side: 'debit' | 'credit',
): Promise<void> {
  const supabase = createClient();
  const now = new Date().toISOString();
  const date = now.split('T')[0];

  // Create journal entry for opening balance
  const journalId = `opening_${Date.now()}`;
  const lines = side === 'debit'
    ? [
        { account_id: accountId, debit: amount, credit: 0 },
        { account_id: 'opening_balance', debit: 0, credit: amount }
      ]
    : [
        { account_id: accountId, debit: 0, credit: amount },
        { account_id: 'opening_balance', debit: amount, credit: 0 }
      ];

  const { error: journalError } = await supabase.from('journal_entries').insert({
    id: journalId,
    company_id: companyId,
    date,
    description: 'Opening Balance',
    lines: JSON.stringify(lines),
    type: 'opening_balance',
    reference_id: null,
    created_at: now,
    updated_at: now,
  });

  if (journalError) throw journalError;

  await addAuditLog(companyId, 'create', 'opening_balance', { accountId, amount, side });
}

// Update Accounting Period
export async function updateAccountingPeriod(
  companyId: string,
  periodId: string,
  updates: Partial<{ start_date: string; end_date: string }>,
): Promise<void> {
  const supabase = createClient();
  const now = new Date().toISOString();

  const updateData = {
    ...updates,
    updated_at: now,
  };

  const { error } = await supabase
    .from('accounting_periods')
    .update(updateData)
    .eq('id', periodId)
    .eq('company_id', companyId);

  if (error) throw error;

  await addAuditLog(companyId, 'update', 'accounting_periods', { periodId, ...updates });
}

// Reset Company Data — HARD DELETE to fully clean the database
export async function resetCompanyData(companyId: string): Promise<void> {
  const supabase = createClient();

  // Hard delete all transactional data (preserves profile, COA, categories, etc.)
  await Promise.all([
    supabase
      .from('audit_logs')
      .delete()
      .eq('company_id', companyId),
    supabase
      .from('journal_entries')
      .delete()
      .eq('company_id', companyId),
    supabase
      .from('transactions')
      .delete()
      .eq('company_id', companyId),
    supabase
      .from('customers')
      .delete()
      .eq('company_id', companyId),
    supabase
      .from('suppliers')
      .delete()
      .eq('company_id', companyId),
    supabase
      .from('accounting_periods')
      .delete()
      .eq('company_id', companyId),
  ]);

  // Reset marketplace statements back to pending_approval so they can be re-approved
  // after transactions/journals have been deleted
  await supabase
    .from('marketplace_statements')
    .update({
      approval_status: 'pending_approval',
      approved_by: null,
      approved_at: null,
      rejected_reason: null,
      kasflow_income_txn_id: null,
      kasflow_expense_txn_id: null,
      kasflow_transfer_txn_id: null,
      reconciled: false,
      updated_at: new Date().toISOString(),
    })
    .eq('company_id', companyId)
    .in('approval_status', ['approved', 'rejected', 'auto_approved']);

  // Create new open accounting period starting today
  const today = new Date();
  const periodStart = today.toISOString().split('T')[0];
  const periodEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
  const periodId = `period_${Date.now()}`;

  await supabase.from('accounting_periods').insert({
    id: `${companyId}_${periodId}`,
    company_id: companyId,
    start_date: periodStart,
    end_date: periodEnd,
    status: 'open',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  await addAuditLog(companyId, 'reset', 'reset_data', {
    preserved: ['profile', 'coa', 'categories', 'cash_accounts', 'tax_settings'],
    newAccountingPeriodCreated: true,
    marketplaceStatementsReset: true,
  });
}

// ============================================================
// MARKETPLACE CONNECTIONS
// ============================================================

export async function getMarketplaceConnections(
  companyId: string
): Promise<MarketplaceConnection[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("marketplace_connections")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(snakeToCamel<MarketplaceConnection>);
}

export async function getMarketplaceConnection(
  companyId: string,
  connectionId: string
): Promise<MarketplaceConnection | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("marketplace_connections")
    .select("*")
    .eq("id", connectionId)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .single();

  if (error || !data) return null;
  return snakeToCamel<MarketplaceConnection>(data);
}

export async function addMarketplaceConnection(
  companyId: string,
  connection: Omit<MarketplaceConnection, "id" | "createdAt" | "updatedAt">
): Promise<MarketplaceConnection> {
  const supabase = createClient();
  const id = `mkp_conn_${Date.now()}`;
  const now = new Date().toISOString();

  const connectionData = {
    ...connection,
    id,
    companyId,
    createdAt: now,
    updatedAt: now,
  };

  const { data, error } = await supabase
    .from("marketplace_connections")
    .insert(camelToSnake(connectionData))
    .select()
    .single();

  if (error) throw error;

  await addAuditLog(companyId, "create", "marketplace_connections", {
    connectionId: id,
    platform: connection.platform,
    shopName: connection.shopName,
  });

  return snakeToCamel<MarketplaceConnection>(data);
}

export async function updateMarketplaceConnection(
  companyId: string,
  connectionId: string,
  updates: Partial<MarketplaceConnection>
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("marketplace_connections")
    .update(camelToSnake(updates))
    .eq("id", connectionId)
    .eq("company_id", companyId);

  if (error) throw error;
}

export async function softDeleteMarketplaceConnection(
  companyId: string,
  connectionId: string
): Promise<void> {
  const supabase = createClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("marketplace_connections")
    .update({ deleted_at: now, updated_at: now })
    .eq("id", connectionId)
    .eq("company_id", companyId);

  if (error) throw error;

  await addAuditLog(companyId, "delete", "marketplace_connections", {
    connectionId,
  });
}

// ============================================================
// MARKETPLACE ACCOUNT MAPPINGS
// ============================================================

export async function getMarketplaceAccountMappings(
  companyId: string,
  connectionId: string
): Promise<MarketplaceAccountMapping[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("marketplace_account_mapping")
    .select("*")
    .eq("company_id", companyId)
    .eq("connection_id", connectionId)
    .order("mapping_type");

  if (error) throw error;
  return (data || []).map(snakeToCamel<MarketplaceAccountMapping>);
}

export async function upsertMarketplaceAccountMapping(
  companyId: string,
  mapping: Omit<MarketplaceAccountMapping, "id" | "createdAt" | "updatedAt">
): Promise<MarketplaceAccountMapping> {
  const supabase = createClient();
  const id = `mkp_map_${Date.now()}`;
  const now = new Date().toISOString();

  const mappingData = {
    ...mapping,
    id,
    companyId,
    createdAt: now,
    updatedAt: now,
  };

  const { data, error } = await supabase
    .from("marketplace_account_mapping")
    .upsert(camelToSnake(mappingData), {
      onConflict: "connection_id,mapping_type",
    })
    .select()
    .single();

  if (error) throw error;

  await addAuditLog(companyId, "update", "marketplace_account_mapping", {
    mappingType: mapping.mappingType,
    connectionId: mapping.connectionId,
  });

  return snakeToCamel<MarketplaceAccountMapping>(data);
}

// ============================================================
// MARKETPLACE ORDERS
// ============================================================

export async function getMarketplaceOrders(
  companyId: string,
  connectionId?: string
): Promise<MarketplaceOrder[]> {
  const supabase = createClient();
  let query = supabase
    .from("marketplace_orders")
    .select("*")
    .eq("company_id", companyId)
    .order("order_create_time", { ascending: false });

  if (connectionId) {
    query = query.eq("connection_id", connectionId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(snakeToCamel<MarketplaceOrder>);
}

export async function upsertMarketplaceOrders(
  companyId: string,
  orders: MarketplaceOrder[]
): Promise<void> {
  const supabase = createClient();

  const ordersData = orders.map((order) => ({
    ...camelToSnake(order),
    company_id: companyId,
  }));

  const { error } = await supabase
    .from("marketplace_orders")
    .upsert(ordersData, {
      onConflict: "connection_id,platform_order_id",
    });

  if (error) throw error;
}

export async function updateMarketplaceOrderSettlement(
  companyId: string,
  orderId: string,
  settlementData: Partial<MarketplaceOrder>
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("marketplace_orders")
    .update(camelToSnake(settlementData))
    .eq("id", orderId)
    .eq("company_id", companyId);

  if (error) throw error;
}

// ============================================================
// MARKETPLACE ORDER ITEMS
// ============================================================

export async function getMarketplaceOrderItems(
  companyId: string,
  orderId: string
): Promise<MarketplaceOrderItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("marketplace_order_items")
    .select("*")
    .eq("company_id", companyId)
    .eq("order_id", orderId)
    .order("sku_name");

  if (error) throw error;
  return (data || []).map(snakeToCamel<MarketplaceOrderItem>);
}

export async function upsertMarketplaceOrderItems(
  companyId: string,
  items: MarketplaceOrderItem[]
): Promise<void> {
  const supabase = createClient();

  const itemsData = items.map((item) => ({
    ...camelToSnake(item),
    company_id: companyId,
  }));

  const { error } = await supabase.from("marketplace_order_items").upsert(itemsData, {
    onConflict: "order_id,sku_id",
  });

  if (error) throw error;
}

// ============================================================
// MARKETPLACE STATEMENTS
// ============================================================

export async function getMarketplaceStatements(
  companyId: string,
  connectionId?: string
): Promise<MarketplaceStatement[]> {
  const supabase = createClient();
  let query = supabase
    .from("marketplace_statements")
    .select("*")
    .eq("company_id", companyId)
    .order("statement_time", { ascending: false });

  if (connectionId) {
    query = query.eq("connection_id", connectionId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(snakeToCamel<MarketplaceStatement>);
}

export async function getMarketplaceStatement(
  companyId: string,
  statementId: string
): Promise<MarketplaceStatement | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("marketplace_statements")
    .select("*")
    .eq("id", statementId)
    .eq("company_id", companyId)
    .single();

  if (error || !data) return null;
  return snakeToCamel<MarketplaceStatement>(data);
}

export async function upsertMarketplaceStatements(
  companyId: string,
  statements: MarketplaceStatement[]
): Promise<void> {
  const supabase = createClient();

  const statementsData = statements.map((stmt) => ({
    ...camelToSnake(stmt),
    company_id: companyId,
  }));

  const { error } = await supabase.from("marketplace_statements").upsert(statementsData, {
    onConflict: "connection_id,platform_statement_id",
  });

  if (error) throw error;
}

export async function updateMarketplaceStatementKasflowLinks(
  companyId: string,
  statementId: string,
  links: {
    kasflowIncomeTxnId?: string;
    kasflowExpenseTxnId?: string;
    kasflowTransferTxnId?: string;
    reconciled?: boolean;
  }
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("marketplace_statements")
    .update(camelToSnake(links))
    .eq("id", statementId)
    .eq("company_id", companyId);

  if (error) throw error;
}

// ============================================================
// MARKETPLACE SYNC LOGS
// ============================================================

export async function getMarketplaceSyncLogs(
  companyId: string,
  connectionId?: string,
  limit = 50
): Promise<MarketplaceSyncLog[]> {
  const supabase = createClient();
  let query = supabase
    .from("marketplace_sync_logs")
    .select("*")
    .eq("company_id", companyId)
    .order("started_at", { ascending: false })
    .limit(limit);

  if (connectionId) {
    query = query.eq("connection_id", connectionId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(snakeToCamel<MarketplaceSyncLog>);
}

export async function createMarketplaceSyncLog(
  companyId: string,
  connectionId: string,
  syncType: MarketplaceSyncType
): Promise<MarketplaceSyncLog> {
  const supabase = createClient();
  const id = `mkp_sync_${Date.now()}`;
  const now = new Date().toISOString();

  const logData = {
    id,
    companyId,
    connectionId,
    syncType,
    status: "running" as MarketplaceSyncLogStatus,
    recordsFetched: 0,
    recordsCreated: 0,
    recordsUpdated: 0,
    recordsSkipped: 0,
    startedAt: now,
    createdAt: now,
  };

  const { data, error } = await supabase
    .from("marketplace_sync_logs")
    .insert(camelToSnake(logData))
    .select()
    .single();

  if (error) throw error;
  return snakeToCamel<MarketplaceSyncLog>(data);
}

export async function updateMarketplaceSyncLog(
  companyId: string,
  logId: string,
  updates: Partial<MarketplaceSyncLog>
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("marketplace_sync_logs")
    .update(camelToSnake(updates))
    .eq("id", logId)
    .eq("company_id", companyId);

  if (error) throw error;
}
