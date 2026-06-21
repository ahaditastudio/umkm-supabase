export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";

export type NeracaSection =
  | "aset_lancar"
  | "aset_tetap"
  | "akumulasi_penyusutan"
  | "kewajiban_lancar"
  | "kewajiban_jangka_panjang"
  | "ekuitas";

export type ExpenseSubType =
  | "cogs"              // Cost of Goods Sold / HPP
  | "selling"           // Beban Penjualan
  | "admin"             // Beban Administrasi & Umum
  | "operating_other"   // Beban Operasional Lainnya
  | "non_operating"     // Pendapatan/Beban di Luar Usaha
  | "tax";              // Pajak Penghasilan

export type NormalBalance = "debit" | "credit";
export type TransactionType = "income" | "expense" | "transfer" | "capital";
export type CapitalType = "setoran" | "prive" | "dividen";
export type CashAccountType = "cash" | "bank" | "ewallet";
export type PeriodStatus = "open" | "closed";
export type UserRole = "owner" | "accountant" | "staff";

export type Account = {
  id: string;
  companyId?: string;
  code: string;
  name: string;
  type: AccountType;
  subType?: ExpenseSubType;
  normalBalance: NormalBalance;
  parentId?: string;
  isCash?: boolean;
  isActive: boolean;
  neracaSection?: NeracaSection;
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
  capitalType?: CapitalType;
  marketplaceConnectionId?: string;
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
  source: "transaction" | "opening_balance" | "closing" | "manual" | "seed" | "marketplace";
  marketplaceConnectionId?: string;
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
  cogs: number;
  grossProfit: number;
  sellingExpenses: number;
  adminExpenses: number;
  otherOperatingExpenses: number;
  totalOperatingExpenses: number;
  ebit: number; // Earnings Before Interest & Tax
  nonOperatingIncome: number;
  nonOperatingExpense: number;
  nonOperatingNet: number;
  ebt: number; // Earnings Before Tax
  taxExpense: number; // explicit journal entries only (account 5800)
  estimatedTax: number; // estimasi PPh Final 0.5% — informational; NOT included in taxExpense
  netProfit: number;
  // By-account breakdowns
  revenueByAccount: Record<string, number>;
  cogsByAccount: Record<string, number>;
  sellingByAccount: Record<string, number>;
  adminByAccount: Record<string, number>;
  otherOperatingByAccount: Record<string, number>;
  nonOperatingIncomeByAccount: Record<string, number>;
  nonOperatingExpenseByAccount: Record<string, number>;
  taxByAccount: Record<string, number>;
  /** Detail: for each account, breakdown by category */
  revenueByAccountAndCategory: Record<string, Record<string, number>>;
  expenseByAccountAndCategory: Record<string, Record<string, number>>;
};

export type NeracaAccountDetail = {
  accountId: string;
  accountCode: string;
  accountName: string;
  balance: number;
};

export type BalanceSheetReport = {
  // Section totals
  asetLancar: number;
  asetTetap: number;
  totalAset: number;
  kewajibanLancar: number;
  kewajibanJangkaPanjang: number;
  totalKewajiban: number;
  totalEkuitas: number;

  // Per-account details
  asetLancarDetails: NeracaAccountDetail[];
  asetTetapDetails: NeracaAccountDetail[];
  akumulasiPenyusutanDetails: NeracaAccountDetail[];
  kewajibanLancarDetails: NeracaAccountDetail[];
  kewajibanJangkaPanjangDetails: NeracaAccountDetail[];
  ekuitasDetails: NeracaAccountDetail[];

  // Equity components (for validation)
  labaDitahan: number;
  labaBersihPeriodeBerjalan: number;

  // Legacy fields (backward compat)
  assets: number;
  liabilities: number;
  equity: number;
  isBalanced: boolean;
};

export type CashFlowPoint = {
  period: string;
  income: number;
  expense: number;
  net: number;
};

// ============================================================
// MARKETPLACE TYPES
// ============================================================

export type MarketplacePlatform = "tiktok_shop" | "shopee" | "tokopedia";
export type MarketplaceConnectionStatus = "active" | "disconnected" | "expired" | "error";
export type MarketplaceMappingType =
  | "revenue"
  | "platform_fee"
  | "shipping_fee"
  | "adjustment"
  | "receivable"
  | "settlement_bank";
export type MarketplaceSettlementStatus = "settled" | "unsettled" | "processing" | "failed";
export type MarketplaceOrderSyncStatus = "pending" | "synced" | "error" | "skipped";
export type MarketplacePaymentStatus = "PAID" | "FAILED" | "PROCESSING";
export type MarketplaceSyncType = "orders" | "statements" | "unsettled" | "full" | "backfill" | "incremental";
export type MarketplaceSyncLogStatus = "running" | "success" | "error" | "partial";

export type MarketplaceConnection = {
  id: string;
  companyId: string;
  platform: MarketplacePlatform;
  shopId?: string;
  shopName?: string;
  displayName?: string;
  shopCipher?: string;
  region?: string;
  sellerType?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
  refreshTokenExpiresAt?: string;
  lastSyncAt?: string;
  syncStartDate?: string;
  status: MarketplaceConnectionStatus;
  config?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
};

export type MarketplaceAccountMapping = {
  id: string;
  connectionId: string;
  companyId: string;
  mappingType: MarketplaceMappingType;
  kasflowAccountId?: string;
  kasflowCashAccountId?: string;
  kasflowCategoryId?: string;
  createdAt: string;
  updatedAt: string;
};

export type MarketplaceOrder = {
  id: string;
  connectionId: string;
  companyId: string;
  platformOrderId: string;
  platformStatus?: string;
  orderCreateTime?: string;
  orderUpdateTime?: string;
  currency: string;
  subtotal: number;
  shippingFee: number;
  sellerDiscount: number;
  platformDiscount: number;
  totalAmount: number;
  settlementStatus: MarketplaceSettlementStatus;
  statementId?: string;
  settlementAmount: number;
  revenueAmount: number;
  feeAmount: number;
  adjustmentAmount: number;
  shippingCostAmount: number;
  syncStatus: MarketplaceOrderSyncStatus;
  kasflowTransactionId?: string;
  kasflowJournalId?: string;
  syncedAt?: string;
  rawData?: Record<string, unknown>;
  cancellationInitiator?: string;
  shippingProvider?: string;
  buyerUserId?: string;
  createdAt: string;
  updatedAt: string;
};

export type MarketplaceOrderItem = {
  id: string;
  orderId: string;
  companyId: string;
  skuId?: string;
  skuName?: string;
  productName?: string;
  quantity: number;
  unitPrice: number;
  settlementAmount: number;
  revenueAmount: number;
  rawData?: Record<string, unknown>;
  createdAt: string;
};

export type MarketplaceStatement = {
  id: string;
  connectionId: string;
  companyId: string;
  platformStatementId: string;
  statementTime?: string;
  currency: string;
  settlementAmount: number;
  revenueAmount: number;
  feeAmount: number;
  adjustmentAmount: number;
  netSalesAmount: number;
  shippingCostAmount: number;
  paymentStatus: MarketplacePaymentStatus;
  paymentId?: string;
  paymentTime?: string;
  reconciled: boolean;
  kasflowIncomeTxnId?: string;
  kasflowExpenseTxnId?: string;
  kasflowTransferTxnId?: string;
  orderCount: number;
  approvalStatus: 'pending_approval' | 'approved' | 'rejected' | 'auto_approved';
  approvedBy?: string;
  approvedAt?: string;
  rejectedReason?: string;
  createdAt: string;
  updatedAt: string;
};

export type MarketplaceSyncLog = {
  id: string;
  connectionId: string;
  companyId: string;
  syncType: MarketplaceSyncType;
  status: MarketplaceSyncLogStatus;
  recordsFetched: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsSkipped: number;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
  createdAt: string;
};

export type MarketplaceSyncResult = {
  statementsProcessed: number;
  ordersCached: number;
  transactionsCreated: number;
  skipped: number;
  errors: number;
  durationMs: number;
};
