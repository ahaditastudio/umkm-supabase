export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";
export type NormalBalance = "debit" | "credit";
export type TransactionType = "income" | "expense" | "transfer";
export type CashAccountType = "cash" | "bank" | "ewallet";
export type PeriodStatus = "open" | "closed";
export type UserRole = "owner" | "accountant" | "staff";

export type Account = {
  id: string;
  companyId?: string;
  code: string;
  name: string;
  type: AccountType;
  normalBalance: NormalBalance;
  parentId?: string;
  isCash?: boolean;
  isActive: boolean;
};

export type CashAccount = {
  id: string;
  companyId?: string;
  name: string;
  type: CashAccountType;
  accountId: string;
  isActive: boolean;
};

export type Category = {
  id: string;
  companyId?: string;
  name: string;
  type: Extract<TransactionType, "income" | "expense">;
  accountId: string;
  isActive: boolean;
};

export type BusinessProfile = {
  id: string;
  businessName: string;
  ownerName: string;
  businessType: "retail" | "service" | "online_shop" | "distributor" | "freelancer";
  taxNumber?: string;
  currency: "IDR";
};

export type Customer = {
  id: string;
  companyId?: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  deletedAt?: string;
};

export type Supplier = {
  id: string;
  companyId?: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  deletedAt?: string;
};

export type Transaction = {
  id: string;
  companyId: string;
  type: TransactionType;
  date: string;
  categoryId?: string;
  cashAccountId?: string;
  sourceAccountId?: string;
  destinationAccountId?: string;
  amount: number;
  description: string;
  attachmentUrl?: string;
  status: "posted" | "void";
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
};

export type JournalLine = {
  accountId: string;
  debit: number;
  credit: number;
  description?: string;
};

export type JournalEntry = {
  id: string;
  companyId: string;
  transactionId?: string;
  date: string;
  description: string;
  lines: JournalLine[];
  status: "draft" | "posted" | "locked";
  source: "transaction" | "opening_balance" | "closing" | "manual" | "seed";
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
};

export type LedgerEntry = {
  id: string;
  companyId: string;
  journalEntryId: string;
  accountId: string;
  date: string;
  debit: number;
  credit: number;
  balance: number;
  description: string;
};

export type TaxSettings = {
  id: string;
  companyId?: string;
  name: string;
  rate: number;
  base: "gross_revenue" | "net_profit";
  dueDay: number;
  enabled: boolean;
};

export type TaxReport = {
  id: string;
  companyId: string;
  period: string;
  grossRevenue: number;
  netProfit: number;
  estimatedTax: number;
  dueDate: string;
  status: "estimated" | "filed" | "paid";
};

export type AccountingPeriod = {
  id: string;
  companyId: string;
  startDate: string;
  endDate: string;
  status: PeriodStatus;
  closedAt?: string;
};

export type AuditLog = {
  id: string;
  companyId: string;
  user: string;
  action: "create" | "update" | "delete" | "export" | "reset" | "restore" | "close_period";
  module: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
  timestamp: string;
};

export type ReportSummary = {
  totalCash: number;
  totalBank: number;
  monthlyRevenue: number;
  monthlyExpenses: number;
  netProfit: number;
  estimatedTax: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
};

export type ProfitLossReport = {
  revenue: number;
  expenses: number;
  netProfit: number;
  revenueByAccount: Record<string, number>;
  expenseByAccount: Record<string, number>;
};

export type BalanceSheetReport = {
  assets: number;
  liabilities: number;
  equity: number;
  retainedEarnings: number;
  isBalanced: boolean;
};

export type CashFlowPoint = {
  period: string;
  income: number;
  expense: number;
  net: number;
};
