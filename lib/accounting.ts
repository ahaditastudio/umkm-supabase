import type {
  Account,
  AccountingPeriod,
  BalanceSheetReport,
  CashAccount,
  CashFlowPoint,
  Category,
  Customer,
  JournalEntry,
  LedgerEntry,
  ProfitLossReport,
  ReportSummary,
  Supplier,
  TaxReport,
  TaxSettings,
  Transaction,
  TransactionType,
} from "@/lib/types";
import { monthKey, toInputDate, uid } from "@/lib/utils";

export const DEMO_COMPANY_ID = "demo_company";

export const defaultAccounts: Account[] = [
  { id: "1100", code: "1100", name: "Cash", type: "asset", normalBalance: "debit", isCash: true, isActive: true },
  { id: "1110", code: "1110", name: "Cash Main", type: "asset", normalBalance: "debit", parentId: "1100", isCash: true, isActive: true },
  { id: "1120", code: "1120", name: "Bank BCA", type: "asset", normalBalance: "debit", parentId: "1100", isCash: true, isActive: true },
  { id: "1130", code: "1130", name: "Bank Mandiri", type: "asset", normalBalance: "debit", parentId: "1100", isCash: true, isActive: true },
  { id: "1200", code: "1200", name: "Accounts Receivable", type: "asset", normalBalance: "debit", isActive: true },
  { id: "1300", code: "1300", name: "Inventory", type: "asset", normalBalance: "debit", isActive: true },
  { id: "2100", code: "2100", name: "Accounts Payable", type: "liability", normalBalance: "credit", isActive: true },
  { id: "2200", code: "2200", name: "Tax Payable", type: "liability", normalBalance: "credit", isActive: true },
  { id: "3100", code: "3100", name: "Owner Capital", type: "equity", normalBalance: "credit", isActive: true },
  { id: "3200", code: "3200", name: "Drawings", type: "equity", normalBalance: "debit", isActive: true },
  { id: "3300", code: "3300", name: "Retained Earnings", type: "equity", normalBalance: "credit", isActive: true },
  { id: "4100", code: "4100", name: "Sales Revenue", type: "revenue", normalBalance: "credit", isActive: true },
  { id: "4200", code: "4200", name: "Service Revenue", type: "revenue", normalBalance: "credit", isActive: true },
  { id: "4300", code: "4300", name: "Other Income", type: "revenue", normalBalance: "credit", isActive: true },
  { id: "5100", code: "5100", name: "Operational Expense", type: "expense", normalBalance: "debit", isActive: true },
  { id: "5200", code: "5200", name: "Transportation Expense", type: "expense", normalBalance: "debit", isActive: true },
  { id: "5300", code: "5300", name: "Marketing Expense", type: "expense", normalBalance: "debit", isActive: true },
  { id: "5400", code: "5400", name: "Salary Expense", type: "expense", normalBalance: "debit", isActive: true },
  { id: "5500", code: "5500", name: "Internet Expense", type: "expense", normalBalance: "debit", isActive: true },
  { id: "5600", code: "5600", name: "Administrative Expense", type: "expense", normalBalance: "debit", isActive: true },
  { id: "5700", code: "5700", name: "Tax Expense", type: "expense", normalBalance: "debit", isActive: true },
];

export const defaultCashAccounts: CashAccount[] = [
  { id: "cash_main", name: "Kas Utama", type: "cash", accountId: "1110", isActive: true },
  { id: "bank_bca", name: "Bank BCA", type: "bank", accountId: "1120", isActive: true },
  { id: "bank_mandiri", name: "Bank Mandiri", type: "bank", accountId: "1130", isActive: true },
];

export const defaultCategories: Category[] = [
  { id: "cat_sales", name: "Penjualan", type: "income", accountId: "4100", isActive: true },
  { id: "cat_service", name: "Jasa", type: "income", accountId: "4200", isActive: true },
  { id: "cat_other_income", name: "Pendapatan Lain", type: "income", accountId: "4300", isActive: true },
  { id: "cat_operational", name: "Operasional", type: "expense", accountId: "5100", isActive: true },
  { id: "cat_transport", name: "Transportasi", type: "expense", accountId: "5200", isActive: true },
  { id: "cat_marketing", name: "Marketing", type: "expense", accountId: "5300", isActive: true },
  { id: "cat_salary", name: "Gaji", type: "expense", accountId: "5400", isActive: true },
  { id: "cat_internet", name: "Internet", type: "expense", accountId: "5500", isActive: true },
  { id: "cat_admin", name: "Administrasi", type: "expense", accountId: "5600", isActive: true },
  { id: "cat_tax", name: "Pajak", type: "expense", accountId: "5700", isActive: true },
];

export const defaultTaxSettings: TaxSettings = {
  id: "tax_default",
  name: "Pajak UMKM Dinamis",
  rate: 0.005,
  base: "gross_revenue",
  dueDay: 15,
  enabled: true,
};

export const defaultAccountingPeriod: AccountingPeriod = {
  id: "period_current",
  companyId: DEMO_COMPANY_ID,
  startDate: toInputDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
  endDate: toInputDate(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)),
  status: "open",
};

export function accountLabel(account: Account) {
  return `${account.code} ${account.name}`;
}

export function getAccount(accounts: Account[], accountId?: string) {
  return accounts.find((account) => account.id === accountId);
}

export function getCashLedgerAccount(cashAccounts: CashAccount[], cashAccountId?: string) {
  const cashAccount = cashAccounts.find((item) => item.id === cashAccountId);
  return cashAccount?.accountId ?? cashAccountId;
}

export function isDateInClosedPeriod(periods: AccountingPeriod[], date: string) {
  const value = new Date(date).getTime();
  return periods.some((period) => {
    if (period.status !== "closed") return false;
    return value >= new Date(period.startDate).getTime() && value <= new Date(period.endDate).getTime();
  });
}

export function generateJournalFromTransaction(
  transaction: Transaction,
  categories: Category[],
  cashAccounts: CashAccount[],
): JournalEntry {
  const now = new Date().toISOString();
  const lines = [];

  if (transaction.type === "income") {
    const category = categories.find((item) => item.id === transaction.categoryId);
    const cashAccountId = getCashLedgerAccount(cashAccounts, transaction.cashAccountId);

    if (!category || !cashAccountId) {
      throw new Error("Transaksi pemasukan harus memiliki kategori dan akun kas yang valid.");
    }

    lines.push(
      { accountId: cashAccountId, debit: transaction.amount, credit: 0, description: transaction.description },
      { accountId: category.accountId, debit: 0, credit: transaction.amount, description: transaction.description },
    );
  }

  if (transaction.type === "expense") {
    const category = categories.find((item) => item.id === transaction.categoryId);
    const cashAccountId = getCashLedgerAccount(cashAccounts, transaction.cashAccountId);

    if (!category || !cashAccountId) {
      throw new Error("Transaksi pengeluaran harus memiliki kategori dan akun kas yang valid.");
    }

    lines.push(
      { accountId: category.accountId, debit: transaction.amount, credit: 0, description: transaction.description },
      { accountId: cashAccountId, debit: 0, credit: transaction.amount, description: transaction.description },
    );
  }

  if (transaction.type === "transfer") {
    const sourceAccountId = getCashLedgerAccount(cashAccounts, transaction.sourceAccountId);
    const destinationAccountId = getCashLedgerAccount(cashAccounts, transaction.destinationAccountId);

    if (!sourceAccountId || !destinationAccountId || sourceAccountId === destinationAccountId) {
      throw new Error("Transfer harus memiliki akun sumber dan tujuan yang berbeda.");
    }

    lines.push(
      { accountId: destinationAccountId, debit: transaction.amount, credit: 0, description: transaction.description },
      { accountId: sourceAccountId, debit: 0, credit: transaction.amount, description: transaction.description },
    );
  }

  const debitTotal = lines.reduce((total, line) => total + line.debit, 0);
  const creditTotal = lines.reduce((total, line) => total + line.credit, 0);

  if (debitTotal !== creditTotal) {
    throw new Error("Jurnal tidak balance. Debit dan kredit harus sama.");
  }

  return {
    id: `jr_${transaction.id}`,
    companyId: transaction.companyId,
    transactionId: transaction.id,
    date: transaction.date,
    description: transaction.description,
    lines,
    status: "posted",
    source: transaction.id.startsWith("seed") ? "seed" : "transaction",
    createdAt: now,
    updatedAt: now,
  };
}

export function buildLedgerEntries(journals: JournalEntry[], accounts: Account[]): LedgerEntry[] {
  const sortedJournals = journals
    .filter((journal) => !journal.deletedAt && journal.status !== "draft")
    .slice()
    .sort((a, b) => `${a.date}${a.id}`.localeCompare(`${b.date}${b.id}`));
  const runningBalance = new Map<string, number>();
  const ledgers: LedgerEntry[] = [];

  for (const journal of sortedJournals) {
    for (const [index, line] of journal.lines.entries()) {
      const account = getAccount(accounts, line.accountId);
      const normalBalance = account?.normalBalance ?? "debit";
      const previous = runningBalance.get(line.accountId) ?? 0;
      const movement = normalBalance === "debit" ? line.debit - line.credit : line.credit - line.debit;
      const balance = previous + movement;
      runningBalance.set(line.accountId, balance);
      ledgers.push({
        id: `${journal.id}_${index}`,
        companyId: journal.companyId,
        journalEntryId: journal.id,
        accountId: line.accountId,
        date: journal.date,
        debit: line.debit,
        credit: line.credit,
        balance,
        description: line.description ?? journal.description,
      });
    }
  }

  return ledgers;
}

export function calculateAccountBalances(journals: JournalEntry[], accounts: Account[]) {
  const balances: Record<string, number> = {};
  const activeJournals = journals.filter((journal) => !journal.deletedAt && journal.status !== "draft");

  for (const journal of activeJournals) {
    for (const line of journal.lines) {
      const account = getAccount(accounts, line.accountId);
      if (!account) continue;
      const movement = account.normalBalance === "debit" ? line.debit - line.credit : line.credit - line.debit;
      balances[line.accountId] = (balances[line.accountId] ?? 0) + movement;
    }
  }

  return balances;
}

function inRange(date: string, from?: string, to?: string) {
  const value = new Date(date).getTime();
  if (from && value < new Date(from).getTime()) return false;
  if (to && value > new Date(to).getTime()) return false;
  return true;
}

export function calculateProfitLoss(
  journals: JournalEntry[],
  accounts: Account[],
  from?: string,
  to?: string,
): ProfitLossReport {
  const revenueByAccount: Record<string, number> = {};
  const expenseByAccount: Record<string, number> = {};

  for (const journal of journals.filter((item) => !item.deletedAt && item.status !== "draft" && inRange(item.date, from, to))) {
    for (const line of journal.lines) {
      const account = getAccount(accounts, line.accountId);
      if (!account) continue;

      if (account.type === "revenue") {
        revenueByAccount[account.id] = (revenueByAccount[account.id] ?? 0) + line.credit - line.debit;
      }

      if (account.type === "expense") {
        expenseByAccount[account.id] = (expenseByAccount[account.id] ?? 0) + line.debit - line.credit;
      }
    }
  }

  const revenue = Object.values(revenueByAccount).reduce((total, value) => total + value, 0);
  const expenses = Object.values(expenseByAccount).reduce((total, value) => total + value, 0);

  return {
    revenue,
    expenses,
    netProfit: revenue - expenses,
    revenueByAccount,
    expenseByAccount,
  };
}

export function calculateBalanceSheet(journals: JournalEntry[], accounts: Account[]): BalanceSheetReport {
  const balances = calculateAccountBalances(journals, accounts);
  const profitLoss = calculateProfitLoss(journals, accounts);
  const assets = accounts
    .filter((account) => account.type === "asset")
    .reduce((total, account) => total + (balances[account.id] ?? 0), 0);
  const liabilities = accounts
    .filter((account) => account.type === "liability")
    .reduce((total, account) => total + (balances[account.id] ?? 0), 0);
  const baseEquity = accounts
    .filter((account) => account.type === "equity")
    .reduce((total, account) => total + (balances[account.id] ?? 0), 0);
  const equity = baseEquity + profitLoss.netProfit;

  return {
    assets,
    liabilities,
    equity,
    retainedEarnings: profitLoss.netProfit,
    isBalanced: Math.abs(assets - (liabilities + equity)) < 1,
  };
}

export function calculateTaxReport(
  journals: JournalEntry[],
  accounts: Account[],
  taxSettings: TaxSettings,
  period = monthKey(new Date()),
): TaxReport {
  const [year, month] = period.split("-").map(Number);
  const from = toInputDate(new Date(year, month - 1, 1));
  const to = toInputDate(new Date(year, month, 0));
  const profitLoss = calculateProfitLoss(journals, accounts, from, to);
  const base = taxSettings.base === "gross_revenue" ? profitLoss.revenue : Math.max(profitLoss.netProfit, 0);
  const estimatedTax = taxSettings.enabled ? base * taxSettings.rate : 0;
  const dueDate = toInputDate(new Date(year, month, taxSettings.dueDay));

  return {
    id: `tax_${period}`,
    companyId: DEMO_COMPANY_ID,
    period,
    grossRevenue: profitLoss.revenue,
    netProfit: profitLoss.netProfit,
    estimatedTax,
    dueDate,
    status: "estimated",
  };
}

export function calculateCashFlow(journals: JournalEntry[], accounts: Account[]): CashFlowPoint[] {
  const byPeriod = new Map<string, CashFlowPoint>();

  for (const journal of journals.filter((item) => !item.deletedAt && item.status !== "draft")) {
    const period = monthKey(journal.date);
    const current = byPeriod.get(period) ?? { period, income: 0, expense: 0, net: 0 };

    for (const line of journal.lines) {
      const account = getAccount(accounts, line.accountId);
      if (account?.type === "revenue") current.income += line.credit - line.debit;
      if (account?.type === "expense") current.expense += line.debit - line.credit;
    }

    current.net = current.income - current.expense;
    byPeriod.set(period, current);
  }

  return Array.from(byPeriod.values()).sort((a, b) => a.period.localeCompare(b.period));
}

export function calculateReportSummary(
  journals: JournalEntry[],
  accounts: Account[],
  cashAccounts: CashAccount[],
  taxSettings: TaxSettings,
): ReportSummary {
  const now = new Date();
  const from = toInputDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const to = toInputDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const balances = calculateAccountBalances(journals, accounts);
  const monthlyProfitLoss = calculateProfitLoss(journals, accounts, from, to);
  const balanceSheet = calculateBalanceSheet(journals, accounts);
  const taxReport = calculateTaxReport(journals, accounts, taxSettings, monthKey(now));
  const totalCash = cashAccounts
    .filter((cashAccount) => cashAccount.type === "cash")
    .reduce((total, cashAccount) => total + (balances[cashAccount.accountId] ?? 0), 0);
  const totalBank = cashAccounts
    .filter((cashAccount) => cashAccount.type === "bank")
    .reduce((total, cashAccount) => total + (balances[cashAccount.accountId] ?? 0), 0);

  return {
    totalCash,
    totalBank,
    monthlyRevenue: monthlyProfitLoss.revenue,
    monthlyExpenses: monthlyProfitLoss.expenses,
    netProfit: monthlyProfitLoss.netProfit,
    estimatedTax: taxReport.estimatedTax,
    totalAssets: balanceSheet.assets,
    totalLiabilities: balanceSheet.liabilities,
    totalEquity: balanceSheet.equity,
  };
}

export function topAccountsByType(
  journals: JournalEntry[],
  accounts: Account[],
  type: "revenue" | "expense",
  limit = 5,
) {
  const profitLoss = calculateProfitLoss(journals, accounts);
  const values = type === "revenue" ? profitLoss.revenueByAccount : profitLoss.expenseByAccount;

  return Object.entries(values)
    .map(([accountId, value]) => ({ account: getAccount(accounts, accountId), value }))
    .filter((item) => item.account && item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

const expenseCategoryIds = defaultCategories.filter((category) => category.type === "expense").map((category) => category.id);
const incomeCategoryIds = defaultCategories.filter((category) => category.type === "income").map((category) => category.id);
const seedDescriptions: Record<TransactionType, string[]> = {
  income: ["Penjualan produk", "Pembayaran invoice", "Order marketplace", "Pendapatan jasa"],
  expense: ["Belanja operasional", "Ongkos kirim", "Iklan digital", "Biaya internet", "ATK dan administrasi"],
  transfer: ["Setor kas ke bank", "Tarik tunai operasional", "Pindah saldo antar bank"],
};

function pick<T>(items: T[], index: number) {
  return items[index % items.length];
}

export function createSeedTransactions(count: number, months = 6): Transaction[] {
  const transactions: Transaction[] = [];
  const today = new Date();

  for (let index = 0; index < count; index += 1) {
    const date = new Date(today.getFullYear(), today.getMonth() - (index % months), 1 + (index % 26));
    const type: TransactionType = index % 9 === 0 ? "transfer" : index % 3 === 0 ? "expense" : "income";
    const amount = type === "income" ? 250_000 + (index % 17) * 85_000 : type === "expense" ? 35_000 + (index % 11) * 45_000 : 100_000 + (index % 7) * 50_000;
    const cashAccount = pick(defaultCashAccounts, index);
    const destination = pick(defaultCashAccounts.filter((item) => item.id !== cashAccount.id), index + 1);
    transactions.push({
      id: `seed_tx_${index + 1}`,
      companyId: DEMO_COMPANY_ID,
      type,
      date: toInputDate(date),
      categoryId: type === "income" ? pick(incomeCategoryIds, index) : type === "expense" ? pick(expenseCategoryIds, index) : undefined,
      cashAccountId: type === "transfer" ? undefined : cashAccount.id,
      sourceAccountId: type === "transfer" ? cashAccount.id : undefined,
      destinationAccountId: type === "transfer" ? destination.id : undefined,
      amount,
      description: pick(seedDescriptions[type], index),
      status: "posted",
      createdAt: date.toISOString(),
      updatedAt: date.toISOString(),
    });
  }

  return transactions;
}

export function createSeedJournals(transactions: Transaction[]) {
  return transactions.map((transaction) => generateJournalFromTransaction(transaction, defaultCategories, defaultCashAccounts));
}

export function createDemoCustomers(count = 100): Customer[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `cust_${index + 1}`,
    companyId: DEMO_COMPANY_ID,
    name: `Pelanggan ${index + 1}`,
    phone: `08${String(1200000000 + index).slice(0, 10)}`,
    email: `pelanggan${index + 1}@contoh.id`,
  }));
}

export function createDemoSuppliers(count = 25): Supplier[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `sup_${index + 1}`,
    companyId: DEMO_COMPANY_ID,
    name: `Supplier ${index + 1}`,
    phone: `08${String(8800000000 + index).slice(0, 10)}`,
    email: `supplier${index + 1}@contoh.id`,
  }));
}

export function createOpeningBalanceJournal(amount = 5_000_000): JournalEntry {
  const now = new Date().toISOString();
  return {
    id: uid("opening"),
    companyId: DEMO_COMPANY_ID,
    date: toInputDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
    description: "Saldo awal modal pemilik",
    lines: [
      { accountId: "1110", debit: amount, credit: 0, description: "Saldo awal kas" },
      { accountId: "3100", debit: 0, credit: amount, description: "Modal pemilik" },
    ],
    status: "posted",
    source: "opening_balance",
    createdAt: now,
    updatedAt: now,
  };
}
