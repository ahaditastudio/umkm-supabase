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
  NeracaAccountDetail,
  NeracaSection,
  ProfitLossReport,
  ReportSummary,
  Supplier,
  TaxReport,
  TaxSettings,
  Transaction,
  TransactionType,
} from "@/lib/types";
import { monthKey, toInputDate, uid } from "@/lib/utils";
import { memoize } from "@/lib/memoize";

export const DEMO_COMPANY_ID = "demo_company";

export const defaultAccounts: Account[] = [
  { id: "1100", code: "1100", name: "Kas", type: "asset", normalBalance: "debit", isCash: true, isActive: true, neracaSection: "aset_lancar" },
  { id: "1110", code: "1110", name: "Kas Utama", type: "asset", normalBalance: "debit", parentId: "1100", isCash: true, isActive: true, neracaSection: "aset_lancar" },
  { id: "1120", code: "1120", name: "Bank BCA", type: "asset", normalBalance: "debit", parentId: "1100", isCash: true, isActive: true, neracaSection: "aset_lancar" },
  { id: "1130", code: "1130", name: "Bank Mandiri", type: "asset", normalBalance: "debit", parentId: "1100", isCash: true, isActive: true, neracaSection: "aset_lancar" },
  { id: "1200", code: "1200", name: "Piutang Usaha", type: "asset", normalBalance: "debit", isActive: true, neracaSection: "aset_lancar" },
  { id: "1300", code: "1300", name: "Persediaan", type: "asset", normalBalance: "debit", isActive: true, neracaSection: "aset_lancar" },
  // Aset Tetap
  { id: "1400", code: "1400", name: "Aset Tetap", type: "asset", normalBalance: "debit", isActive: true, neracaSection: "aset_tetap" },
  { id: "1410", code: "1410", name: "Peralatan & Inventaris", type: "asset", normalBalance: "debit", parentId: "1400", isActive: true, neracaSection: "aset_tetap" },
  { id: "1420", code: "1420", name: "Kendaraan", type: "asset", normalBalance: "debit", parentId: "1400", isActive: true, neracaSection: "aset_tetap" },
  // Akumulasi Penyusutan (contra-asset)
  { id: "1500", code: "1500", name: "Akumulasi Penyusutan", type: "asset", normalBalance: "credit", isActive: true, neracaSection: "akumulasi_penyusutan" },
  { id: "2100", code: "2100", name: "Hutang Usaha", type: "liability", normalBalance: "credit", isActive: true, neracaSection: "kewajiban_lancar" },
  { id: "2200", code: "2200", name: "Hutang Pajak", type: "liability", normalBalance: "credit", isActive: true, neracaSection: "kewajiban_lancar" },
  { id: "2300", code: "2300", name: "Utang Bank", type: "liability", normalBalance: "credit", isActive: true, neracaSection: "kewajiban_jangka_panjang" },
  { id: "3100", code: "3100", name: "Modal Pemilik", type: "equity", normalBalance: "credit", isActive: true, neracaSection: "ekuitas" },
  { id: "3200", code: "3200", name: "Prive", type: "equity", normalBalance: "debit", isActive: true, neracaSection: "ekuitas" },
  { id: "3300", code: "3300", name: "Dividen", type: "equity", normalBalance: "debit", isActive: true, neracaSection: "ekuitas" },
  { id: "3400", code: "3400", name: "Laba Ditahan", type: "equity", normalBalance: "credit", isActive: true, neracaSection: "ekuitas" },
  // Pendapatan usaha
  { id: "4100", code: "4100", name: "Pendapatan Penjualan", type: "revenue", normalBalance: "credit", isActive: true },
  { id: "4200", code: "4200", name: "Pendapatan Jasa", type: "revenue", normalBalance: "credit", isActive: true },
  { id: "4300", code: "4300", name: "Pendapatan Lain-lain", type: "revenue", normalBalance: "credit", isActive: true },
  // Pendapatan di luar usaha
  { id: "4400", code: "4400", name: "Pendapatan Bunga", type: "revenue", subType: "non_operating", normalBalance: "credit", isActive: true },
  { id: "4500", code: "4500", name: "Keuntungan Penjualan Aset", type: "revenue", subType: "non_operating", normalBalance: "credit", isActive: true },
  // HPP (Harga Pokok Penjualan)
  { id: "5000", code: "5000", name: "Harga Pokok Penjualan", type: "expense", subType: "cogs", normalBalance: "debit", isActive: true },
  { id: "5010", code: "5010", name: "Pembelian Bahan Baku", type: "expense", subType: "cogs", normalBalance: "debit", parentId: "5000", isActive: true },
  { id: "5020", code: "5020", name: "Biaya Tenaga Kerja Langsung", type: "expense", subType: "cogs", normalBalance: "debit", parentId: "5000", isActive: true },
  { id: "5030", code: "5030", name: "Biaya Overhead", type: "expense", subType: "cogs", normalBalance: "debit", parentId: "5000", isActive: true },
  // Beban penjualan
  { id: "5100", code: "5100", name: "Beban Operasional", type: "expense", subType: "selling", normalBalance: "debit", isActive: true },
  { id: "5200", code: "5200", name: "Beban Transportasi", type: "expense", subType: "selling", normalBalance: "debit", isActive: true },
  { id: "5300", code: "5300", name: "Beban Pemasaran", type: "expense", subType: "selling", normalBalance: "debit", isActive: true },
  // Beban administrasi & umum
  { id: "5400", code: "5400", name: "Beban Gaji", type: "expense", subType: "admin", normalBalance: "debit", isActive: true },
  { id: "5500", code: "5500", name: "Beban Internet", type: "expense", subType: "admin", normalBalance: "debit", isActive: true },
  { id: "5600", code: "5600", name: "Beban Administrasi", type: "expense", subType: "admin", normalBalance: "debit", isActive: true },
  // Beban operasional lainnya
  { id: "5700", code: "5700", name: "Beban Penyusutan", type: "expense", subType: "operating_other", normalBalance: "debit", isActive: true },
  // Beban pajak
  { id: "5800", code: "5800", name: "Beban Pajak Penghasilan", type: "expense", subType: "tax", normalBalance: "debit", isActive: true },
  // Beban di luar usaha
  { id: "5900", code: "5900", name: "Beban Bunga", type: "expense", subType: "non_operating", normalBalance: "debit", isActive: true },
  { id: "5910", code: "5910", name: "Kerugian Penjualan Aset", type: "expense", subType: "non_operating", normalBalance: "debit", isActive: true },
];

export const defaultCashAccounts: CashAccount[] = [
  { id: "cash_main", name: "Kas Utama", type: "cash", accountId: "1110", isActive: true },
  { id: "bank_bca", name: "Bank BCA", type: "bank", accountId: "1120", isActive: true },
  { id: "bank_mandiri", name: "Bank Mandiri", type: "bank", accountId: "1130", isActive: true },
];

export const defaultCategories: Category[] = [
  // Income categories
  { id: "cat_sales", name: "Penjualan", type: "income", accountId: "4100", isActive: true },
  { id: "cat_service", name: "Jasa", type: "income", accountId: "4200", isActive: true },
  { id: "cat_other_income", name: "Pendapatan Lain", type: "income", accountId: "4300", isActive: true },
  { id: "cat_interest_income", name: "Pendapatan Bunga", type: "income", accountId: "4400", isActive: true },
  { id: "cat_gain_assets", name: "Keuntungan Penjualan Aset", type: "income", accountId: "4500", isActive: true },
  // COGS categories
  { id: "cat_raw_materials", name: "Pembelian Bahan Baku", type: "expense", accountId: "5010", isActive: true },
  { id: "cat_direct_labor", name: "Biaya Tenaga Kerja Langsung", type: "expense", accountId: "5020", isActive: true },
  { id: "cat_overhead", name: "Biaya Overhead", type: "expense", accountId: "5030", isActive: true },
  // Selling expense categories
  { id: "cat_operational", name: "Operasional", type: "expense", accountId: "5100", isActive: true },
  { id: "cat_transport", name: "Transportasi", type: "expense", accountId: "5200", isActive: true },
  { id: "cat_marketing", name: "Marketing", type: "expense", accountId: "5300", isActive: true },
  // Admin expense categories
  { id: "cat_salary", name: "Gaji", type: "expense", accountId: "5400", isActive: true },
  { id: "cat_internet", name: "Internet", type: "expense", accountId: "5500", isActive: true },
  { id: "cat_admin", name: "Administrasi", type: "expense", accountId: "5600", isActive: true },
  // Other operating
  { id: "cat_depreciation", name: "Penyusutan", type: "expense", accountId: "5700", isActive: true },
  // Tax
  { id: "cat_income_tax", name: "Pajak Penghasilan", type: "expense", accountId: "5800", isActive: true },
  // Non-operating
  { id: "cat_interest_expense", name: "Beban Bunga", type: "expense", accountId: "5900", isActive: true },
  { id: "cat_loss_assets", name: "Kerugian Penjualan Aset", type: "expense", accountId: "5910", isActive: true },
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

export function getAccountByCode(accounts: Account[], code: string) {
  const account = accounts.find((item) => item.code === code);
  return account?.id;
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
  accounts: Account[] = [],
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

  if (transaction.type === "capital") {
    const cashAccountId = getCashLedgerAccount(cashAccounts, transaction.cashAccountId);
    if (!cashAccountId) {
      throw new Error("Transaksi modal harus memiliki akun kas yang valid.");
    }

    // Resolve account IDs using getAccountByCode to handle prefixed IDs in DB
    const modalPemilikId = getAccountByCode(accounts, "3100") ?? "3100";
    const priveId = getAccountByCode(accounts, "3200") ?? "3200";
    const labaDitahanId = getAccountByCode(accounts, "3300") ?? "3300";

    if (transaction.capitalType === "setoran") {
      // Setoran Modal: D Kas/Bank, K Modal Pemilik (3100)
      lines.push(
        { accountId: cashAccountId, debit: transaction.amount, credit: 0, description: transaction.description },
        { accountId: modalPemilikId, debit: 0, credit: transaction.amount, description: transaction.description },
      );
    } else if (transaction.capitalType === "prive") {
      // Prive: D Prive (3200), K Kas/Bank
      lines.push(
        { accountId: priveId, debit: transaction.amount, credit: 0, description: transaction.description },
        { accountId: cashAccountId, debit: 0, credit: transaction.amount, description: transaction.description },
      );
    } else if (transaction.capitalType === "dividen") {
      // Dividen: D Laba Ditahan (3300), K Kas/Bank
      lines.push(
        { accountId: labaDitahanId, debit: transaction.amount, credit: 0, description: transaction.description },
        { accountId: cashAccountId, debit: 0, credit: transaction.amount, description: transaction.description },
      );
    } else {
      throw new Error("Transaksi modal harus memiliki sub-jenis (setoran, prive, atau dividen).");
    }
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

/**
 * Incrementally append ledger entries for a new journal.
 * Returns null if the journal is not the latest (requires full rebuild).
 * This is much faster than rebuildLedgerEntries for the common case of adding new transactions.
 */
export function appendLedgerEntries(
  newJournal: JournalEntry,
  existingLedgerEntries: LedgerEntry[],
  accounts: Account[]
): LedgerEntry[] | null {
  if (newJournal.deletedAt || newJournal.status === "draft") {
    return [];
  }

  // Check if this journal is the latest
  const sortedKey = `${newJournal.date}${newJournal.id}`;
  const lastExistingKey = existingLedgerEntries.length > 0
    ? `${existingLedgerEntries[existingLedgerEntries.length - 1].date}${existingLedgerEntries[existingLedgerEntries.length - 1].journalEntryId}`
    : "";

  if (lastExistingKey && sortedKey < lastExistingKey) {
    // New journal is not the latest, need full rebuild
    return null;
  }

  // Build a map of last balances for each account (O(n) once)
  const lastBalances = new Map<string, number>();
  for (const entry of existingLedgerEntries) {
    lastBalances.set(entry.accountId, entry.balance);
  }

  // Calculate balances incrementally (O(m) where m is new lines)
  const newEntries: LedgerEntry[] = [];

  for (const [index, line] of newJournal.lines.entries()) {
    const account = getAccount(accounts, line.accountId);
    const normalBalance = account?.normalBalance ?? "debit";

    const previous = lastBalances.get(line.accountId) ?? 0;
    const movement = normalBalance === "debit" ? line.debit - line.credit : line.credit - line.debit;
    const balance = previous + movement;

    newEntries.push({
      id: `${newJournal.id}_${index}`,
      companyId: newJournal.companyId,
      journalEntryId: newJournal.id,
      accountId: line.accountId,
      date: newJournal.date,
      debit: line.debit,
      credit: line.credit,
      balance,
      description: line.description ?? newJournal.description,
    });
  }

  return newEntries;
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

// Hitung balance akun tertentu dari jurnal dalam range tanggal
function getAccountBalanceInRange(
  journals: JournalEntry[],
  accounts: Account[],
  accountCode: string,
  from?: string,
  to?: string,
): number {
  const account = accounts.find(a => a.code === accountCode);
  if (!account) return 0;

  let balance = 0;
  const activeJournals = journals.filter(j =>
    !j.deletedAt &&
    j.status !== "draft" &&
    inRange(j.date, from, to)
  );

  for (const journal of activeJournals) {
    for (const line of journal.lines) {
      if (line.accountId === account.id) {
        const movement = account.normalBalance === "debit"
          ? line.debit - line.credit
          : line.credit - line.debit;
        balance += movement;
      }
    }
  }

  return balance;
}

export function calculateProfitLoss(
  journals: JournalEntry[],
  accounts: Account[],
  from?: string,
  to?: string,
  transactions?: { id: string; categoryId: string; type: string }[],
  taxSettings?: TaxSettings,
): ProfitLossReport {
  // By-account breakdowns, grouped by subType
  const revenueByAccount: Record<string, number> = {};
  const nonOperatingIncomeByAccount: Record<string, number> = {};
  const cogsByAccount: Record<string, number> = {};
  const sellingByAccount: Record<string, number> = {};
  const adminByAccount: Record<string, number> = {};
  const otherOperatingByAccount: Record<string, number> = {};
  const taxByAccount: Record<string, number> = {};
  const nonOperatingExpenseByAccount: Record<string, number> = {};

  // Category-level detail (keyed by accountId)
  const revenueByAccountAndCategory: Record<string, Record<string, number>> = {};
  const expenseByAccountAndCategory: Record<string, Record<string, number>> = {};

  // Build txnId → categoryId map
  const txnCategoryMap = new Map<string, string>();
  if (transactions) {
    for (const t of transactions) {
      if (t.categoryId) txnCategoryMap.set(t.id, t.categoryId);
    }
  }

  // Helper to accumulate by account + category
  const addAmount = (
    byAccount: Record<string, number>,
    byAccountAndCat: Record<string, Record<string, number>>,
    accountId: string,
    categoryId: string | undefined,
    amt: number,
  ) => {
    byAccount[accountId] = (byAccount[accountId] ?? 0) + amt;
    const catKey = categoryId ?? "_uncategorized_";
    const bucket = byAccountAndCat[accountId] ?? {};
    bucket[catKey] = (bucket[catKey] ?? 0) + amt;
    byAccountAndCat[accountId] = bucket;
  };

  const sumRecord = (rec: Record<string, number>) =>
    Object.values(rec).reduce((s, v) => s + v, 0);

  for (const journal of journals.filter(
    (item) => !item.deletedAt && item.status !== "draft" && inRange(item.date, from, to),
  )) {
    const categoryId = journal.transactionId
      ? txnCategoryMap.get(journal.transactionId)
      : undefined;

    for (const line of journal.lines) {
      const account = getAccount(accounts, line.accountId);
      if (!account) continue;

      if (account.type === "revenue") {
        const amt = line.credit - line.debit;
        if (account.subType === "non_operating") {
          addAmount(nonOperatingIncomeByAccount, revenueByAccountAndCategory, account.id, categoryId, amt);
        } else {
          addAmount(revenueByAccount, revenueByAccountAndCategory, account.id, categoryId, amt);
        }
      } else if (account.type === "expense") {
        const amt = line.debit - line.credit;
        switch (account.subType) {
          case "cogs":
            addAmount(cogsByAccount, expenseByAccountAndCategory, account.id, categoryId, amt);
            break;
          case "selling":
            addAmount(sellingByAccount, expenseByAccountAndCategory, account.id, categoryId, amt);
            break;
          case "admin":
            addAmount(adminByAccount, expenseByAccountAndCategory, account.id, categoryId, amt);
            break;
          case "operating_other":
            addAmount(otherOperatingByAccount, expenseByAccountAndCategory, account.id, categoryId, amt);
            break;
          case "tax":
            addAmount(taxByAccount, expenseByAccountAndCategory, account.id, categoryId, amt);
            break;
          case "non_operating":
            addAmount(nonOperatingExpenseByAccount, expenseByAccountAndCategory, account.id, categoryId, amt);
            break;
          default:
            // Fallback: legacy expense accounts without subType → treat as admin
            addAmount(adminByAccount, expenseByAccountAndCategory, account.id, categoryId, amt);
            break;
        }
      }
    }
  }

  const revenue = sumRecord(revenueByAccount);
  const cogs = sumRecord(cogsByAccount);
  const grossProfit = revenue - cogs;

  const sellingExpenses = sumRecord(sellingByAccount);
  const adminExpenses = sumRecord(adminByAccount);
  const otherOperatingExpenses = sumRecord(otherOperatingByAccount);
  const totalOperatingExpenses = sellingExpenses + adminExpenses + otherOperatingExpenses;

  const ebit = grossProfit - totalOperatingExpenses;

  const nonOperatingIncome = sumRecord(nonOperatingIncomeByAccount);
  const nonOperatingExpense = sumRecord(nonOperatingExpenseByAccount);
  const nonOperatingNet = nonOperatingIncome - nonOperatingExpense;

  const ebt = ebit + nonOperatingNet;

  const explicitTax = sumRecord(taxByAccount);
  // Estimasi PPh Final 0.5% (UMKM) – untuk perhitungan Hutang Pajak di Neraca.
  const estimatedTax = taxSettings?.enabled
    ? (taxSettings.base === "gross_revenue" ? revenue : Math.max(ebt, 0)) * taxSettings.rate
    : 0;
  // Beban pajak = hanya jurnal eksplisit (pajak yang sudah dibayar)
  const taxExpense = explicitTax;

  const netProfit = ebt - taxExpense;

  return {
    revenue,
    cogs,
    grossProfit,
    sellingExpenses,
    adminExpenses,
    otherOperatingExpenses,
    totalOperatingExpenses,
    ebit,
    nonOperatingIncome,
    nonOperatingExpense,
    nonOperatingNet,
    ebt,
    taxExpense,
    estimatedTax,
    netProfit,
    revenueByAccount,
    cogsByAccount,
    sellingByAccount,
    adminByAccount,
    otherOperatingByAccount,
    nonOperatingIncomeByAccount,
    nonOperatingExpenseByAccount,
    taxByAccount,
    revenueByAccountAndCategory,
    expenseByAccountAndCategory,
  };
}

/**
 * Generate closing entries for a period
 * Creates journal entries that:
 *   1. Close revenue accounts → Laba Ditahan (3400)
 *   2. Close expense accounts → Laba Ditahan (3400)
 *   3. Close Prive (3200) → Laba Ditahan (3400)
 *   4. Close Dividen (3300) → Laba Ditahan (3400)
 *
 * Net effect on 3400 = Net Profit - Prive - Dividen
 */
export function generateClosingEntries(
  companyId: string,
  periodStartDate: string,
  periodEndDate: string,
  journals: JournalEntry[],
  accounts: Account[],
): JournalEntry[] {
  const closingEntries: JournalEntry[] = [];
  const now = new Date().toISOString();
  const suffix = periodEndDate.replace(/-/g, "");

  // Resolve target accounts by code
  const labaDitahanAccount = accounts.find(a => a.code === "3400");
  if (!labaDitahanAccount) {
    throw new Error("Akun Laba Ditahan (3400) tidak ditemukan");
  }

  // --- Step 1: Close revenue accounts to Laba Ditahan ---
  // Revenue has credit normal balance. To zero it out: Debit revenue, Credit Laba Ditahan.
  const revenueLines: Array<{ accountId: string; amount: number; name: string }> = [];
  for (const account of accounts) {
    if (account.type !== "revenue") continue;
    const balance = getAccountBalanceInRange(journals, accounts, account.code, periodStartDate, periodEndDate);
    if (balance !== 0) {
      revenueLines.push({ accountId: account.id, amount: balance, name: account.name });
    }
  }

  if (revenueLines.length > 0) {
    const totalRevenue = revenueLines.reduce((sum, r) => sum + r.amount, 0);
    closingEntries.push({
      id: `closing_rev_${companyId}_${suffix}`,
      companyId,
      date: periodEndDate,
      description: `Penutupan Pendapatan Periode ${periodStartDate} s/d ${periodEndDate}`,
      lines: [
        // Debit each revenue account to zero it out (since revenue is credit-normal)
        ...revenueLines.map(r => ({
          accountId: r.accountId,
          debit: r.amount,
          credit: 0,
          description: `Tutup ${r.name}`,
        })),
        // Credit Laba Ditahan with total revenue
        { accountId: labaDitahanAccount.id, debit: 0, credit: totalRevenue, description: "Penutupan pendapatan ke Laba Ditahan" },
      ],
      status: "posted",
      source: "closing",
      createdAt: now,
      updatedAt: now,
    } as JournalEntry);
  }

  // --- Step 2: Close expense accounts to Laba Ditahan ---
  // Expense has debit normal balance. To zero it out: Credit expense, Debit Laba Ditahan.
  const expenseLines: Array<{ accountId: string; amount: number; name: string }> = [];
  for (const account of accounts) {
    if (account.type !== "expense") continue;
    const balance = getAccountBalanceInRange(journals, accounts, account.code, periodStartDate, periodEndDate);
    if (balance !== 0) {
      expenseLines.push({ accountId: account.id, amount: balance, name: account.name });
    }
  }

  if (expenseLines.length > 0) {
    const totalExpense = expenseLines.reduce((sum, e) => sum + e.amount, 0);
    closingEntries.push({
      id: `closing_exp_${companyId}_${suffix}`,
      companyId,
      date: periodEndDate,
      description: `Penutupan Beban Periode ${periodStartDate} s/d ${periodEndDate}`,
      lines: [
        // Debit Laba Ditahan with total expenses
        { accountId: labaDitahanAccount.id, debit: totalExpense, credit: 0, description: "Penutupan beban ke Laba Ditahan" },
        // Credit each expense account to zero it out (since expense is debit-normal)
        ...expenseLines.map(e => ({
          accountId: e.accountId,
          debit: 0,
          credit: e.amount,
          description: `Tutup ${e.name}`,
        })),
      ],
      status: "posted",
      source: "closing",
      createdAt: now,
      updatedAt: now,
    } as JournalEntry);
  }

  // --- Step 3: Close Prive (3200) to Laba Ditahan (3400) ---
  // Prive has debit normal balance. To zero: Credit Prive, Debit Laba Ditahan.
  const priveBalance = getAccountBalanceInRange(journals, accounts, "3200", periodStartDate, periodEndDate);
  if (priveBalance !== 0) {
    const priveAccount = accounts.find(a => a.code === "3200");
    if (priveAccount) {
      closingEntries.push({
        id: `closing_prv_${companyId}_${suffix}`,
        companyId,
        date: periodEndDate,
        description: `Penutupan Prive Periode ${periodStartDate} s/d ${periodEndDate}`,
        lines: [
          { accountId: labaDitahanAccount.id, debit: priveBalance, credit: 0, description: "Penutupan prive ke Laba Ditahan" },
          { accountId: priveAccount.id, debit: 0, credit: priveBalance, description: "Reset saldo Prive" },
        ],
        status: "posted",
        source: "closing",
        createdAt: now,
        updatedAt: now,
      } as JournalEntry);
    }
  }

  // --- Step 4: Close Dividen (3300) to Laba Ditahan (3400) ---
  // Dividen has debit normal balance. To zero: Credit Dividen, Debit Laba Ditahan.
  const dividenBalance = getAccountBalanceInRange(journals, accounts, "3300", periodStartDate, periodEndDate);
  if (dividenBalance !== 0) {
    const dividenAccount = accounts.find(a => a.code === "3300");
    if (dividenAccount) {
      closingEntries.push({
        id: `closing_div_${companyId}_${suffix}`,
        companyId,
        date: periodEndDate,
        description: `Penutupan Dividen Periode ${periodStartDate} s/d ${periodEndDate}`,
        lines: [
          { accountId: labaDitahanAccount.id, debit: dividenBalance, credit: 0, description: "Penutupan dividen ke Laba Ditahan" },
          { accountId: dividenAccount.id, debit: 0, credit: dividenBalance, description: "Reset saldo Dividen" },
        ],
        status: "posted",
        source: "closing",
        createdAt: now,
        updatedAt: now,
      } as JournalEntry);
    }
  }

  return closingEntries;
}

// Fallback neracaSection classification for accounts without explicit section
function getNeracaSectionFallback(account: Account): NeracaSection | undefined {
  if (account.neracaSection) return account.neracaSection;
  if (account.type === "asset") return "aset_lancar";
  if (account.type === "liability") return "kewajiban_lancar";
  if (account.type === "equity") return "ekuitas";
  return undefined;
}

export function calculateBalanceSheet(
  journals: JournalEntry[],
  accounts: Account[],
  taxSettings?: TaxSettings,
  accountingPeriods?: AccountingPeriod[],
): BalanceSheetReport {
  const balances = calculateAccountBalances(journals, accounts);

  // Laba Ditahan = saldo akun 3400 (dari closing entries)
  // Ini adalah akumulasi (laba bersih - prive - dividen) dari semua periode closed
  const labaDitahanAccount = accounts.find(a => a.code === "3400");
  const labaDitahan = labaDitahanAccount ? (balances[labaDitahanAccount.id] ?? 0) : 0;

  // Laba Berjalan, Prive Berjalan, Dividen Berjalan = hanya dari periode open
  let labaBerjalan = 0;
  let priveBerjalan = 0;
  let dividenBerjalan = 0;

  if (accountingPeriods && accountingPeriods.length > 0) {
    const openPeriods = accountingPeriods.filter(p => p.status === "open");

    // Laba Berjalan = laba dari periode open
    for (const open of openPeriods) {
      const openPL = calculateProfitLoss(journals, accounts, open.startDate, open.endDate, undefined, taxSettings);
      labaBerjalan += openPL.netProfit;
    }

    // Prive Berjalan = prive dari periode open saja
    for (const open of openPeriods) {
      priveBerjalan += getAccountBalanceInRange(journals, accounts, "3200", open.startDate, open.endDate);
    }

    // Dividen Berjalan = dividen dari periode open saja
    for (const open of openPeriods) {
      dividenBerjalan += getAccountBalanceInRange(journals, accounts, "3300", open.startDate, open.endDate);
    }
  } else {
    // Fallback: jika tidak ada periode, semua = berjalan
    const allTimeProfitLoss = calculateProfitLoss(
      journals, accounts, undefined, undefined, undefined, taxSettings,
    );
    labaBerjalan = allTimeProfitLoss.netProfit;
    priveBerjalan = getAccountBalanceInRange(journals, accounts, "3200");
    dividenBerjalan = getAccountBalanceInRange(journals, accounts, "3300");
  }

  // --- Group accounts by neraca section ---
  const sectionBuckets: Record<NeracaSection, Account[]> = {
    aset_lancar: [],
    aset_tetap: [],
    akumulasi_penyusutan: [],
    kewajiban_lancar: [],
    kewajiban_jangka_panjang: [],
    ekuitas: [],
  };

  const parentIds = new Set(accounts.filter((a) => a.parentId).map((a) => a.parentId!));

  for (const account of accounts) {
    const section = getNeracaSectionFallback(account);
    if (!section) continue; // revenue/expense accounts have no section
    sectionBuckets[section].push(account);
  }

  // Helper: build detail array for a section (exclude parent headers with zero balance)
  const buildDetails = (section: NeracaSection): NeracaAccountDetail[] => {
    return sectionBuckets[section]
      .filter((a) => {
        if (parentIds.has(a.id) && (balances[a.id] ?? 0) === 0) return false;
        return true;
      })
      .map((a) => ({
        accountId: a.id,
        accountCode: a.code,
        accountName: a.name,
        balance: balances[a.id] ?? 0,
      }));
  };

  const sumSection = (section: NeracaSection) =>
    sectionBuckets[section].reduce((s, a) => s + (balances[a.id] ?? 0), 0);

  // --- Section totals ---
  const asetLancar = sumSection("aset_lancar");
  const asetTetapGross = sumSection("aset_tetap");
  const akumulasiPenyusutanTotal = sumSection("akumulasi_penyusutan"); // positive (credit normal)
  const asetTetap = asetTetapGross - akumulasiPenyusutanTotal;
  const totalAset = asetLancar + asetTetap;

  const kewajibanLancarFromAccounts = sumSection("kewajiban_lancar");
  const kewajibanJangkaPanjang = sumSection("kewajiban_jangka_panjang");

  // Equity calculation
  const modalPemilikAccount = accounts.find(a => a.code === "3100");
  const priveAccount = accounts.find(a => a.code === "3200");
  const dividenAccount = accounts.find(a => a.code === "3300");

  const modalPemilik = modalPemilikAccount ? (balances[modalPemilikAccount.id] ?? 0) : 0;

  // Total Ekuitas = Modal Pemilik + Laba Ditahan + Laba Berjalan - Prive Berjalan - Dividen Berjalan
  // Note: Prive & Dividen dari periode closed sudah masuk ke Laba Ditahan
  const equity = modalPemilik + labaDitahan + labaBerjalan - priveBerjalan - dividenBerjalan;
  const totalEkuitas = equity;

  const kewajibanLancar = kewajibanLancarFromAccounts;
  const totalKewajiban = kewajibanLancar + kewajibanJangkaPanjang;

  // --- Detail arrays ---
  const asetLancarDetails = buildDetails("aset_lancar");
  const asetTetapDetails = buildDetails("aset_tetap");
  const akumulasiPenyusutanDetails = buildDetails("akumulasi_penyusutan");

  const kewajibanLancarDetails = buildDetails("kewajiban_lancar");

  const kewajibanJangkaPanjangDetails = buildDetails("kewajiban_jangka_panjang");

  // Equity details: tampilkan semua komponen ekuitas secara transparan
  // Prive & Dividen yang ditampilkan = hanya dari periode berjalan (setelah tutup buku = 0)
  const ekuitasDetails: NeracaAccountDetail[] = [
    {
      accountId: modalPemilikAccount?.id ?? "3100",
      accountCode: "3100",
      accountName: "Modal Pemilik",
      balance: modalPemilik,
    },
    {
      accountId: priveAccount?.id ?? "3200",
      accountCode: "3200",
      accountName: "Prive",
      balance: -priveBerjalan, // negatif = mengurangi ekuitas (hanya periode berjalan)
    },
    {
      accountId: dividenAccount?.id ?? "3300",
      accountCode: "3300",
      accountName: "Dividen",
      balance: -dividenBerjalan, // negatif = mengurangi ekuitas (hanya periode berjalan)
    },
    {
      accountId: "_laba_ditahan",
      accountCode: "",
      accountName: "Laba Ditahan",
      balance: labaDitahan,
    },
    {
      accountId: "_laba_bersih_berjalan",
      accountCode: "",
      accountName: "Laba Bersih Periode Berjalan",
      balance: labaBerjalan,
    },
  ];

  return {
    // Section totals
    asetLancar,
    asetTetap,
    totalAset,
    kewajibanLancar,
    kewajibanJangkaPanjang,
    totalKewajiban,
    totalEkuitas,

    // Detail arrays
    asetLancarDetails,
    asetTetapDetails,
    akumulasiPenyusutanDetails,
    kewajibanLancarDetails,
    kewajibanJangkaPanjangDetails,
    ekuitasDetails,

    // Equity components (for validation)
    labaDitahan,
    labaBersihPeriodeBerjalan: labaBerjalan,

    // Legacy fields
    assets: totalAset,
    liabilities: totalKewajiban,
    equity,
    isBalanced: Math.abs(totalAset - (totalKewajiban + totalEkuitas)) < 1,
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
  const monthlyProfitLoss = calculateProfitLoss(journals, accounts, from, to, undefined, taxSettings);
  const balanceSheet = calculateBalanceSheet(journals, accounts, taxSettings);
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
    monthlyExpenses: monthlyProfitLoss.totalOperatingExpenses + monthlyProfitLoss.cogs,
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
  let values: Record<string, number>;
  if (type === "revenue") {
    values = profitLoss.revenueByAccount;
  } else {
    // Merge semua expense buckets jadi satu record
    values = {
      ...profitLoss.cogsByAccount,
      ...profitLoss.sellingByAccount,
      ...profitLoss.adminByAccount,
      ...profitLoss.otherOperatingByAccount,
      ...profitLoss.nonOperatingExpenseByAccount,
      ...profitLoss.taxByAccount,
    };
  }

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

export function createSeedTransactions(
  count: number,
  months = 6,
  companyId?: string,
  categories?: Category[],
  cashAccountList?: CashAccount[],
): Transaction[] {
  const transactions: Transaction[] = [];
  const today = new Date();
  const cid = companyId ?? DEMO_COMPANY_ID;

  // Use provided categories/cashAccounts (from DB with prefixed IDs) or fallback to defaults
  const cats = categories ?? defaultCategories;
  const cas = cashAccountList ?? defaultCashAccounts;
  const incomeIds = cats.filter((c) => c.type === "income").map((c) => c.id);
  const expenseIds = cats.filter((c) => c.type === "expense").map((c) => c.id);

  for (let index = 0; index < count; index += 1) {
    const date = new Date(today.getFullYear(), today.getMonth() - (index % months), 1 + (index % 26));
    const type: TransactionType = index % 9 === 0 ? "transfer" : index % 3 === 0 ? "expense" : "income";
    const amount = type === "income" ? 250_000 + (index % 17) * 85_000 : type === "expense" ? 35_000 + (index % 11) * 45_000 : 100_000 + (index % 7) * 50_000;
    const cashAccount = pick(cas, index);
    const destination = pick(cas.filter((item) => item.id !== cashAccount.id), index + 1);
    transactions.push({
      id: uid("seed"),
      companyId: cid,
      type,
      date: toInputDate(date),
      categoryId: type === "income" ? pick(incomeIds, index) : type === "expense" ? pick(expenseIds, index) : undefined,
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
  return transactions.map((transaction) => generateJournalFromTransaction(transaction, defaultCategories, defaultCashAccounts, defaultAccounts));
}

export function createDemoCustomers(count = 100, companyId?: string): Customer[] {
  const cid = companyId ?? DEMO_COMPANY_ID;
  return Array.from({ length: count }, (_, index) => ({
    id: uid("cust"),
    companyId: cid,
    name: `Pelanggan ${index + 1}`,
    phone: `08${String(1200000000 + index).slice(0, 10)}`,
    email: `pelanggan${index + 1}@contoh.id`,
  }));
}

export function createDemoSuppliers(count = 25, companyId?: string): Supplier[] {
  const cid = companyId ?? DEMO_COMPANY_ID;
  return Array.from({ length: count }, (_, index) => ({
    id: uid("sup"),
    companyId: cid,
    name: `Supplier ${index + 1}`,
    phone: `08${String(8800000000 + index).slice(0, 10)}`,
    email: `supplier${index + 1}@contoh.id`,
  }));
}

export function createOpeningBalanceJournal(companyId?: string, amount = 5_000_000, accounts?: Account[]): JournalEntry {
  const now = new Date().toISOString();
  const cid = companyId ?? DEMO_COMPANY_ID;

  // Find actual account IDs (may be prefixed with companyId in DB)
  const cashMainId = accounts?.find((a) => a.code === "1110")?.id ?? "1110";
  const ownerCapitalId = accounts?.find((a) => a.code === "3100")?.id ?? "3100";

  return {
    id: uid("opening"),
    companyId: cid,
    date: toInputDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
    description: "Saldo awal modal pemilik",
    lines: [
      { accountId: cashMainId, debit: amount, credit: 0, description: "Saldo awal kas" },
      { accountId: ownerCapitalId, debit: 0, credit: amount, description: "Modal pemilik" },
    ],
    status: "posted",
    source: "opening_balance",
    createdAt: now,
    updatedAt: now,
  };
}
