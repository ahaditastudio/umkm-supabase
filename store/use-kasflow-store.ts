"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  buildLedgerEntries,
  appendLedgerEntries,
  createDemoCustomers,
  createDemoSuppliers,
  createOpeningBalanceJournal,
  createSeedJournals,
  createSeedTransactions,
  defaultAccountingPeriod,
  defaultAccounts,
  defaultCashAccounts,
  defaultCategories,
  defaultTaxSettings,
  DEMO_COMPANY_ID,
  generateClosingEntries,
  generateJournalFromTransaction,
  isDateInClosedPeriod,
} from "@/lib/accounting";
import type {
  Account,
  AccountingPeriod,
  AccountType,
  AuditLog,
  BusinessProfile,
  CashAccount,
  Category,
  Customer,
  JournalEntry,
  LedgerEntry,
  NormalBalance,
  Supplier,
  TaxSettings,
  Transaction,
  MarketplaceConnection,
  MarketplaceAccountMapping,
  MarketplaceOrder,
  MarketplaceStatement,
  MarketplaceSyncLog,
} from "@/lib/types";
import type { TransactionFormValues } from "@/lib/validation";
import { uid } from "@/lib/utils";

const defaultProfile: BusinessProfile = {
  id: DEMO_COMPANY_ID,
  businessName: "KasFlow Demo UMKM",
  ownerName: "Owner UMKM",
  businessType: "retail",
  taxNumber: "",
  currency: "IDR",
};

function audit(
  action: AuditLog["action"],
  module: string,
  newValue?: unknown,
  oldValue?: unknown,
): AuditLog {
  return {
    id: uid("audit"),
    companyId: DEMO_COMPANY_ID,
    user: "Local Demo User",
    action,
    module,
    oldValue,
    newValue,
    timestamp: new Date().toISOString(),
  };
}

function refreshLedger(journals: JournalEntry[], accounts: Account[]) {
  return buildLedgerEntries(journals, accounts);
}

export type KasFlowState = {
  companyId: string;
  sidebarCollapsed: boolean;
  profile: BusinessProfile;
  accounts: Account[];
  categories: Category[];
  cashAccounts: CashAccount[];
  customers: Customer[];
  suppliers: Supplier[];
  transactions: Transaction[];
  journalEntries: JournalEntry[];
  journalEntriesLoaded: boolean;
  ledgerEntries: LedgerEntry[];
  taxSettings: TaxSettings;
  accountingPeriods: AccountingPeriod[];
  auditLogs: AuditLog[];
  // Marketplace state
  marketplaceConnections: MarketplaceConnection[];
  marketplaceAccountMappings: MarketplaceAccountMapping[];
  marketplaceOrders: MarketplaceOrder[];
  marketplaceStatements: MarketplaceStatement[];
  marketplaceSyncLogs: MarketplaceSyncLog[];
  loadJournalEntries: () => Promise<void>;
  setSidebarCollapsed: (value: boolean) => void;
  updateProfile: (profile: Partial<BusinessProfile>) => void;
  updateTaxSettings: (settings: Partial<TaxSettings>) => void;
  addCustomer: (name: string, phone?: string, email?: string) => void;
  addSupplier: (name: string, phone?: string, email?: string) => void;
  softDeleteCustomer: (customerId: string) => void;
  softDeleteSupplier: (supplierId: string) => void;
  addTransaction: (values: TransactionFormValues) => void;
  softDeleteTransaction: (transactionId: string) => void;
  restoreTransaction: (transactionId: string) => void;
  generateDummyData: (count: number) => {
    transactions: Transaction[];
    journalEntries: JournalEntry[];
  };
  seedDemoCompany: () => {
    transactions: Transaction[];
    journalEntries: JournalEntry[];
    customers: Customer[];
    suppliers: Supplier[];
  };
  resetBusinessData: () => void;
  createOpeningBalance: (
    accountId: string,
    balance: number,
    side: "debit" | "credit",
  ) => void;
  closeCurrentPeriod: (confirmation: string) => void;
  addCategory: (
    name: string,
    type: "income" | "expense",
    accountId: string,
  ) => void;
  deleteCategory: (categoryId: string) => void;
  addCashAccount: (
    name: string,
    type: "cash" | "bank" | "ewallet",
    accountId: string,
  ) => void;
  deleteCashAccount: (cashAccountId: string) => void;
  addAccount: (
    code: string,
    name: string,
    type: AccountType,
    normalBalance: NormalBalance,
  ) => void;
  addAccountingPeriod: (startDate: string, endDate: string) => void;
  restoreCustomer: (customerId: string) => void;
  restoreSupplier: (supplierId: string) => void;
  restoreFromBackup: (data: Partial<KasFlowState>) => void;
  updateCategory: (
    categoryId: string,
    data: Partial<Pick<Category, "name" | "type" | "accountId">>,
  ) => void;
  updateCashAccount: (
    cashAccountId: string,
    data: Partial<Pick<CashAccount, "name" | "type" | "accountId">>,
  ) => void;
  updateCustomer: (
    customerId: string,
    data: Partial<Pick<Customer, "name" | "phone" | "email">>,
  ) => void;
  updateSupplier: (
    supplierId: string,
    data: Partial<Pick<Supplier, "name" | "phone" | "email">>,
  ) => void;
  updateAccount: (
    accountId: string,
    data: Partial<Pick<Account, "code" | "name" | "type" | "normalBalance">>,
  ) => void;
  updateAccountingPeriod: (
    periodId: string,
    data: Partial<Pick<AccountingPeriod, "startDate" | "endDate">>,
  ) => void;
  // Marketplace actions
  addMarketplaceConnection: (
    connection: Omit<MarketplaceConnection, "id" | "createdAt" | "updatedAt">,
  ) => MarketplaceConnection;
  updateMarketplaceConnection: (
    connectionId: string,
    data: Partial<MarketplaceConnection>,
  ) => void;
  disconnectMarketplace: (connectionId: string) => void;
  addMarketplaceAccountMapping: (
    mapping: Omit<MarketplaceAccountMapping, "id" | "createdAt" | "updatedAt">,
  ) => MarketplaceAccountMapping;
  updateMarketplaceAccountMapping: (
    mappingId: string,
    data: Partial<MarketplaceAccountMapping>,
  ) => void;
  addMarketplaceOrder: (order: MarketplaceOrder) => void;
  bulkAddMarketplaceOrders: (orders: MarketplaceOrder[]) => void;
  addMarketplaceStatement: (statement: MarketplaceStatement) => void;
  bulkAddMarketplaceStatements: (statements: MarketplaceStatement[]) => void;
  addMarketplaceSyncLog: (log: MarketplaceSyncLog) => void;
  updateMarketplaceSyncLog: (logId: string, data: Partial<MarketplaceSyncLog>) => void;
  addMarketplaceTransaction: (
    transaction: Omit<Transaction, "id" | "createdAt" | "updatedAt">,
  ) => Transaction;
  clearMarketplaceData: (connectionId: string) => void;
};

const openingJournal = createOpeningBalanceJournal();

export const useKasFlowStore = create<KasFlowState>()(
  persist(
    (set, get) => ({
      companyId: DEMO_COMPANY_ID,
      sidebarCollapsed: false,
      profile: defaultProfile,
      accounts: defaultAccounts,
      categories: defaultCategories,
      cashAccounts: defaultCashAccounts,
      customers: [],
      suppliers: [],
      transactions: [],
      journalEntries: [],
      journalEntriesLoaded: false,
      ledgerEntries: [],
      taxSettings: defaultTaxSettings,
      accountingPeriods: [defaultAccountingPeriod],
      auditLogs: [audit("create", "opening_balance", openingJournal)],
      marketplaceConnections: [],
      marketplaceAccountMappings: [],
      marketplaceOrders: [],
      marketplaceStatements: [],
      marketplaceSyncLogs: [],
      loadJournalEntries: async () => {
        const state = get();
        console.log('[loadJournalEntries] Called, already loaded:', state.journalEntriesLoaded);

        if (state.journalEntriesLoaded) return;

        // Validate companyId
        if (!state.companyId) {
          console.warn('[loadJournalEntries] companyId not available yet, skipping');
          return;
        }

        try {
          console.log('[loadJournalEntries] Loading journal entries for company:', state.companyId);
          const { getJournalEntries } = await import("@/lib/supabase/company-service");
          const journals = await getJournalEntries(state.companyId);
          console.log('[loadJournalEntries] Loaded', journals.length, 'journal entries');

          set({
            journalEntries: journals,
            journalEntriesLoaded: true,
            ledgerEntries: refreshLedger(journals, state.accounts),
          });
          console.log('[loadJournalEntries] State updated successfully');
        } catch (error) {
          console.error("Failed to load journal entries:", error);
        }
      },
      setSidebarCollapsed: (value) => set({ sidebarCollapsed: value }),
      updateProfile: (profile) =>
        set((state) => ({
          profile: { ...state.profile, ...profile },
          auditLogs: [
            audit("update", "business_profiles", profile, state.profile),
            ...state.auditLogs,
          ],
        })),
      updateTaxSettings: (settings) =>
        set((state) => ({
          taxSettings: { ...state.taxSettings, ...settings },
          auditLogs: [
            audit("update", "tax_settings", settings, state.taxSettings),
            ...state.auditLogs,
          ],
        })),
      addCustomer: (name, phone, email) =>
        set((state) => {
          const customer: Customer = {
            id: uid("cust"),
            companyId: state.companyId,
            name,
            phone,
            email,
          };
          return {
            customers: [customer, ...state.customers],
            auditLogs: [
              audit("create", "customers", customer),
              ...state.auditLogs,
            ],
          };
        }),
      addSupplier: (name, phone, email) =>
        set((state) => {
          const supplier: Supplier = {
            id: uid("sup"),
            companyId: state.companyId,
            name,
            phone,
            email,
          };
          return {
            suppliers: [supplier, ...state.suppliers],
            auditLogs: [
              audit("create", "suppliers", supplier),
              ...state.auditLogs,
            ],
          };
        }),
      softDeleteCustomer: (customerId) =>
        set((state) => ({
          customers: state.customers.map((customer) =>
            customer.id === customerId
              ? { ...customer, deletedAt: new Date().toISOString() }
              : customer,
          ),
          auditLogs: [
            audit("delete", "customers", { customerId }),
            ...state.auditLogs,
          ],
        })),
      softDeleteSupplier: (supplierId) =>
        set((state) => ({
          suppliers: state.suppliers.map((supplier) =>
            supplier.id === supplierId
              ? { ...supplier, deletedAt: new Date().toISOString() }
              : supplier,
          ),
          auditLogs: [
            audit("delete", "suppliers", { supplierId }),
            ...state.auditLogs,
          ],
        })),
      addTransaction: (values) => {
        const state = get();
        if (isDateInClosedPeriod(state.accountingPeriods, values.date)) {
          throw new Error(
            "Periode akuntansi sudah ditutup. Transaksi tidak dapat ditambahkan.",
          );
        }

        const now = new Date().toISOString();
        const transaction: Transaction = {
          id: uid("tx"),
          companyId: state.companyId,
          type: values.type,
          date: values.date,
          categoryId: values.categoryId,
          cashAccountId: values.cashAccountId,
          sourceAccountId: values.sourceAccountId,
          destinationAccountId: values.destinationAccountId,
          amount: values.amount,
          description: values.description,
          status: "posted",
          createdAt: now,
          updatedAt: now,
        };
        const journal = generateJournalFromTransaction(
          transaction,
          state.categories,
          state.cashAccounts,
          state.accounts,
        );
        const journalEntries = [journal, ...state.journalEntries];

        // Try incremental ledger computation first (faster)
        const incrementalLedger = appendLedgerEntries(
          journal,
          state.ledgerEntries,
          state.accounts
        );

        // Fallback to full rebuild if incremental fails (e.g., backdated transaction)
        const ledgerEntries = incrementalLedger
          ? [...state.ledgerEntries, ...incrementalLedger]
          : refreshLedger(journalEntries, state.accounts);

        set({
          transactions: [transaction, ...state.transactions],
          journalEntries,
          journalEntriesLoaded: true,
          ledgerEntries,
          auditLogs: [
            audit("create", "transactions", { transaction, journal }),
            ...state.auditLogs,
          ],
        });
      },
      softDeleteTransaction: (transactionId) =>
        set((state) => {
          const now = new Date().toISOString();
          const transaction = state.transactions.find(
            (item) => item.id === transactionId,
          );
          const transactions = state.transactions.map((item) =>
            item.id === transactionId
              ? { ...item, deletedAt: now, updatedAt: now }
              : item,
          );
          const journalEntries = state.journalEntries.map((journal) =>
            journal.transactionId === transactionId
              ? { ...journal, deletedAt: now, updatedAt: now }
              : journal,
          );
          return {
            transactions,
            journalEntries,
            journalEntriesLoaded: true,
            ledgerEntries: refreshLedger(journalEntries, state.accounts),
            auditLogs: [
              audit("delete", "transactions", { transactionId }, transaction),
              ...state.auditLogs,
            ],
          };
        }),
      restoreTransaction: (transactionId) =>
        set((state) => {
          const transactions = state.transactions.map((item) =>
            item.id === transactionId
              ? {
                  ...item,
                  deletedAt: undefined,
                  updatedAt: new Date().toISOString(),
                }
              : item,
          );
          const journalEntries = state.journalEntries.map((journal) =>
            journal.transactionId === transactionId
              ? {
                  ...journal,
                  deletedAt: undefined,
                  updatedAt: new Date().toISOString(),
                }
              : journal,
          );
          return {
            transactions,
            journalEntries,
            journalEntriesLoaded: true,
            ledgerEntries: refreshLedger(journalEntries, state.accounts),
            auditLogs: [
              audit("restore", "recycle_bin", { transactionId }),
              ...state.auditLogs,
            ],
          };
        }),
      generateDummyData: (count) =>
        // @ts-expect-error -- zustand partial return inference
        set((state) => {
          const generatedTransactions = createSeedTransactions(count, 6, state.companyId);
          const existingIds = new Set(
            state.transactions.map((transaction) => transaction.id),
          );
          const transactions = generatedTransactions.map(
            (transaction, index) => ({
              ...transaction,
              id: uid(`dummy_${index}`),
              description: `${transaction.description} #${state.transactions.length + index + 1}`,
            }),
          );
          const filteredTransactions = transactions.filter(
            (transaction) => !existingIds.has(transaction.id),
          );
          const journals = filteredTransactions.map((transaction) =>
            generateJournalFromTransaction(
              transaction,
              state.categories,
              state.cashAccounts,
              state.accounts,
            ),
          );
          const journalEntries = [...journals, ...state.journalEntries];

          return {
            transactions: [...filteredTransactions, ...state.transactions],
            journalEntries,
            journalEntriesLoaded: true,
            ledgerEntries: refreshLedger(journalEntries, state.accounts),
            auditLogs: [
              audit("create", "dummy_generator", { count }),
              ...state.auditLogs,
            ],
          };
        }),
      seedDemoCompany: () =>
        // @ts-expect-error -- zustand partial return inference
        set((state) => {
          const opening = createOpeningBalanceJournal(state.companyId, 15_000_000);
          const transactions = createSeedTransactions(300, 6, state.companyId);
          const journals = [opening, ...createSeedJournals(transactions)];

          return {
            profile: {
              ...state.profile,
              businessName: "Toko Maju Jaya",
              ownerName: "Dita Ramadhani",
              businessType: "retail",
              taxNumber: "09.123.456.7-890.000",
            },
            transactions,
            journalEntries: journals,
            journalEntriesLoaded: true,
            ledgerEntries: refreshLedger(journals, state.accounts),
            customers: createDemoCustomers(100, state.companyId),
            suppliers: createDemoSuppliers(25, state.companyId),
            auditLogs: [
              audit("create", "seed_demo_company", {
                transactions: 300,
                journals: journals.length,
              }),
              ...state.auditLogs,
            ],
          };
        }),
      resetBusinessData: () =>
        set((state) => ({
          transactions: [],
          journalEntries: [],
          journalEntriesLoaded: true,
          ledgerEntries: [],
          customers: [],
          suppliers: [],
          auditLogs: [
            audit("reset", "reset_data", {
              preserved: [
                "users",
                "business_profiles",
                "coa",
                "categories",
                "cash_accounts",
                "tax_settings",
              ],
            }),
            ...state.auditLogs,
          ],
        })),
      createOpeningBalance: (accountId, balance, side) =>
        set((state) => {
          const now = new Date().toISOString();
          const contraAccountId = "3100";
          const journal: JournalEntry = {
            id: uid("opening"),
            companyId: state.companyId,
            date: new Date().toISOString().slice(0, 10),
            description: "Input saldo awal",
            lines:
              side === "debit"
                ? [
                    {
                      accountId,
                      debit: balance,
                      credit: 0,
                      description: "Saldo awal",
                    },
                    {
                      accountId: contraAccountId,
                      debit: 0,
                      credit: balance,
                      description: "Modal pemilik",
                    },
                  ]
                : [
                    {
                      accountId: contraAccountId,
                      debit: balance,
                      credit: 0,
                      description: "Saldo awal",
                    },
                    {
                      accountId,
                      debit: 0,
                      credit: balance,
                      description: "Saldo awal",
                    },
                  ],
            status: "posted",
            source: "opening_balance",
            createdAt: now,
            updatedAt: now,
          };
          const journalEntries = [journal, ...state.journalEntries];

          // Try incremental ledger computation first
          const incrementalLedger = appendLedgerEntries(
            journal,
            state.ledgerEntries,
            state.accounts
          );

          const ledgerEntries = incrementalLedger
            ? [...state.ledgerEntries, ...incrementalLedger]
            : refreshLedger(journalEntries, state.accounts);

          return {
            journalEntries,
            journalEntriesLoaded: true,
            ledgerEntries,
            auditLogs: [
              audit("create", "opening_balance", journal),
              ...state.auditLogs,
            ],
          };
        }),
      closeCurrentPeriod: (confirmation) => {
        if (confirmation !== "TUTUP BUKU") {
          throw new Error("Konfirmasi harus mengetik TUTUP BUKU.");
        }

        set((state) => {
          const now = new Date().toISOString();
          const closedPeriod = state.accountingPeriods[0];

          // Generate closing entries for this period
          const closingEntries = generateClosingEntries(
            state.companyId,
            closedPeriod.startDate,
            closedPeriod.endDate,
            state.journalEntries,
            state.accounts
          );

          // Close the current period
          const accountingPeriods = state.accountingPeriods.map(
            (period, index) =>
              index === 0
                ? { ...period, status: "closed" as const, closedAt: now }
                : period,
          );

          // Lock journal entries in the closed period
          const lockedJournals = state.journalEntries.map((journal) =>
            journal.date >= closedPeriod.startDate &&
            journal.date <= closedPeriod.endDate
              ? { ...journal, status: "locked" as const, updatedAt: now }
              : journal,
          );

          // Add closing entries to journals
          const journalEntries = [...closingEntries, ...lockedJournals];

          // Auto-create new open period starting from next day
          const endDateObj = new Date(closedPeriod.endDate);
          const newStartDate = new Date(endDateObj.getTime() + 86400000); // +1 day
          const newEndDate = new Date(newStartDate.getFullYear(), newStartDate.getMonth() + 1, 0); // end of next month

          const newPeriod: AccountingPeriod = {
            id: uid("period"),
            companyId: state.companyId,
            startDate: newStartDate.toISOString().split('T')[0],
            endDate: newEndDate.toISOString().split('T')[0],
            status: "open" as const,
          };

          return {
            accountingPeriods: [newPeriod, ...accountingPeriods],
            journalEntries,
            journalEntriesLoaded: true,
            ledgerEntries: refreshLedger(journalEntries, state.accounts),
            auditLogs: [
              audit("close_period", "closing_history", {
                closedPeriod,
                newPeriod,
                closingEntries: closingEntries.length
              }),
              ...state.auditLogs,
            ],
          };
        });
      },
      addCategory: (name, type, accountId) =>
        set((state) => {
          const category: Category = {
            id: uid("cat"),
            companyId: state.companyId,
            name,
            type,
            accountId,
            isActive: true,
          };
          return {
            categories: [...state.categories, category],
            auditLogs: [
              audit("create", "account_categories", category),
              ...state.auditLogs,
            ],
          };
        }),
      deleteCategory: (categoryId) =>
        set((state) => ({
          categories: state.categories.filter((c) => c.id !== categoryId),
          auditLogs: [
            audit("delete", "account_categories", { categoryId }),
            ...state.auditLogs,
          ],
        })),
      addCashAccount: (name, type, accountId) =>
        set((state) => {
          const cashAccount: CashAccount = {
            id: uid("ca"),
            companyId: state.companyId,
            name,
            type,
            accountId,
            isActive: true,
          };
          return {
            cashAccounts: [...state.cashAccounts, cashAccount],
            auditLogs: [
              audit("create", "cash_accounts", cashAccount),
              ...state.auditLogs,
            ],
          };
        }),
      deleteCashAccount: (cashAccountId) =>
        set((state) => ({
          cashAccounts: state.cashAccounts.filter(
            (c) => c.id !== cashAccountId,
          ),
          auditLogs: [
            audit("delete", "cash_accounts", { cashAccountId }),
            ...state.auditLogs,
          ],
        })),
      addAccount: (code, name, type, normalBalance) =>
        set((state) => {
          const account: Account = {
            id: uid("acc"),
            code,
            name,
            type,
            normalBalance,
            isActive: true,
          };
          return {
            accounts: [...state.accounts, account],
            auditLogs: [
              audit("create", "accounts", account),
              ...state.auditLogs,
            ],
          };
        }),
      addAccountingPeriod: (startDate, endDate) =>
        set((state) => {
          const period: AccountingPeriod = {
            id: uid("period"),
            companyId: state.companyId,
            startDate,
            endDate,
            status: "open",
          };
          return {
            accountingPeriods: [period, ...state.accountingPeriods],
            auditLogs: [
              audit("create", "accounting_periods", period),
              ...state.auditLogs,
            ],
          };
        }),
      restoreCustomer: (customerId) =>
        set((state) => ({
          customers: state.customers.map((c) =>
            c.id === customerId ? { ...c, deletedAt: undefined } : c,
          ),
          auditLogs: [
            audit("restore", "recycle_bin", { customerId }),
            ...state.auditLogs,
          ],
        })),
      restoreSupplier: (supplierId) =>
        set((state) => ({
          suppliers: state.suppliers.map((s) =>
            s.id === supplierId ? { ...s, deletedAt: undefined } : s,
          ),
          auditLogs: [
            audit("restore", "recycle_bin", { supplierId }),
            ...state.auditLogs,
          ],
        })),
      updateCategory: (categoryId, data) =>
        set((state) => ({
          categories: state.categories.map((c) =>
            c.id === categoryId ? { ...c, ...data } : c,
          ),
          auditLogs: [
            audit("update", "account_categories", data, {
              categoryId,
            }),
            ...state.auditLogs,
          ],
        })),
      updateCashAccount: (cashAccountId, data) =>
        set((state) => ({
          cashAccounts: state.cashAccounts.map((c) =>
            c.id === cashAccountId ? { ...c, ...data } : c,
          ),
          auditLogs: [
            audit("update", "cash_accounts", data, { cashAccountId }),
            ...state.auditLogs,
          ],
        })),
      updateCustomer: (customerId, data) =>
        set((state) => ({
          customers: state.customers.map((c) =>
            c.id === customerId ? { ...c, ...data } : c,
          ),
          auditLogs: [
            audit("update", "customers", data, { customerId }),
            ...state.auditLogs,
          ],
        })),
      updateSupplier: (supplierId, data) =>
        set((state) => ({
          suppliers: state.suppliers.map((s) =>
            s.id === supplierId ? { ...s, ...data } : s,
          ),
          auditLogs: [
            audit("update", "suppliers", data, { supplierId }),
            ...state.auditLogs,
          ],
        })),
      updateAccount: (accountId, data) =>
        set((state) => ({
          accounts: state.accounts.map((a) =>
            a.id === accountId ? { ...a, ...data } : a,
          ),
          auditLogs: [
            audit("update", "accounts", data, { accountId }),
            ...state.auditLogs,
          ],
        })),
      updateAccountingPeriod: (periodId, data) =>
        set((state) => ({
          accountingPeriods: state.accountingPeriods.map((p) =>
            p.id === periodId ? { ...p, ...data } : p,
          ),
          auditLogs: [
            audit("update", "accounting_periods", data, { periodId }),
            ...state.auditLogs,
          ],
        })),
      restoreFromBackup: (data) =>
        set((state) => {
          const journalEntries = data.journalEntries ?? state.journalEntries;
          const accounts = data.accounts ?? state.accounts;
          return {
            ...(data.profile ? { profile: data.profile } : {}),
            ...(data.accounts ? { accounts: data.accounts } : {}),
            ...(data.categories ? { categories: data.categories } : {}),
            ...(data.cashAccounts ? { cashAccounts: data.cashAccounts } : {}),
            ...(data.customers ? { customers: data.customers } : {}),
            ...(data.suppliers ? { suppliers: data.suppliers } : {}),
            ...(data.transactions ? { transactions: data.transactions } : {}),
            ...(data.taxSettings ? { taxSettings: data.taxSettings } : {}),
            ...(data.accountingPeriods
              ? { accountingPeriods: data.accountingPeriods }
              : {}),
            journalEntries,
            journalEntriesLoaded: true,
            ledgerEntries: refreshLedger(journalEntries, accounts),
            auditLogs: [
              audit("restore", "backup_history", { source: "json_backup" }),
              ...state.auditLogs,
            ],
          };
        }),
      // Marketplace actions
      addMarketplaceConnection: (connection) => {
        const now = new Date().toISOString();
        const newConnection: MarketplaceConnection = {
          ...connection,
          id: uid("mkp_conn"),
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          marketplaceConnections: [newConnection, ...state.marketplaceConnections],
          auditLogs: [
            audit("create", "marketplace_connections", newConnection),
            ...state.auditLogs,
          ],
        }));
        return newConnection;
      },
      updateMarketplaceConnection: (connectionId, data) =>
        set((state) => ({
          marketplaceConnections: state.marketplaceConnections.map((c) =>
            c.id === connectionId ? { ...c, ...data, updatedAt: new Date().toISOString() } : c,
          ),
          auditLogs: [
            audit("update", "marketplace_connections", data, { connectionId }),
            ...state.auditLogs,
          ],
        })),
      disconnectMarketplace: (connectionId) =>
        set((state) => ({
          marketplaceConnections: state.marketplaceConnections.map((c) =>
            c.id === connectionId
              ? { ...c, status: "disconnected" as const, deletedAt: new Date().toISOString() }
              : c,
          ),
          auditLogs: [
            audit("delete", "marketplace_connections", { connectionId }),
            ...state.auditLogs,
          ],
        })),
      addMarketplaceAccountMapping: (mapping) => {
        const now = new Date().toISOString();
        const newMapping: MarketplaceAccountMapping = {
          ...mapping,
          id: uid("mkp_map"),
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          marketplaceAccountMappings: [newMapping, ...state.marketplaceAccountMappings],
          auditLogs: [
            audit("create", "marketplace_account_mapping", newMapping),
            ...state.auditLogs,
          ],
        }));
        return newMapping;
      },
      updateMarketplaceAccountMapping: (mappingId, data) =>
        set((state) => ({
          marketplaceAccountMappings: state.marketplaceAccountMappings.map((m) =>
            m.id === mappingId ? { ...m, ...data, updatedAt: new Date().toISOString() } : m,
          ),
          auditLogs: [
            audit("update", "marketplace_account_mapping", data, { mappingId }),
            ...state.auditLogs,
          ],
        })),
      addMarketplaceOrder: (order) =>
        set((state) => ({
          marketplaceOrders: [order, ...state.marketplaceOrders],
        })),
      bulkAddMarketplaceOrders: (orders) =>
        set((state) => ({
          marketplaceOrders: orders,
        })),
      addMarketplaceStatement: (statement) =>
        set((state) => ({
          marketplaceStatements: [statement, ...state.marketplaceStatements],
        })),
      bulkAddMarketplaceStatements: (statements) =>
        set((state) => ({
          marketplaceStatements: statements,
        })),
      addMarketplaceSyncLog: (log) =>
        set((state) => ({
          marketplaceSyncLogs: [log, ...state.marketplaceSyncLogs],
        })),
      updateMarketplaceSyncLog: (logId, data) =>
        set((state) => ({
          marketplaceSyncLogs: state.marketplaceSyncLogs.map((l) =>
            l.id === logId ? { ...l, ...data } : l,
          ),
        })),
      addMarketplaceTransaction: (transaction) => {
        const state = get();
        const now = new Date().toISOString();
        const newTransaction: Transaction = {
          ...transaction,
          id: uid("tx"),
          createdAt: now,
          updatedAt: now,
        };
        const journal = generateJournalFromTransaction(
          newTransaction,
          state.categories,
          state.cashAccounts,
          state.accounts,
        );
        const journalEntries = [journal, ...state.journalEntries];

        // Try incremental ledger computation first (faster)
        const incrementalLedger = appendLedgerEntries(
          journal,
          state.ledgerEntries,
          state.accounts
        );

        const ledgerEntries = incrementalLedger
          ? [...state.ledgerEntries, ...incrementalLedger]
          : refreshLedger(journalEntries, state.accounts);

        set({
          transactions: [newTransaction, ...state.transactions],
          journalEntries,
          journalEntriesLoaded: true,
          ledgerEntries,
          auditLogs: [
            audit("create", "transactions", { transaction: newTransaction, journal }),
            ...state.auditLogs,
          ],
        });
        return newTransaction;
      },
      clearMarketplaceData: (connectionId) =>
        set((state) => ({
          marketplaceOrders: state.marketplaceOrders.filter(
            (o) => o.connectionId !== connectionId,
          ),
          marketplaceStatements: state.marketplaceStatements.filter(
            (s) => s.connectionId !== connectionId,
          ),
          marketplaceSyncLogs: state.marketplaceSyncLogs.filter(
            (l) => l.connectionId !== connectionId,
          ),
          auditLogs: [
            audit("delete", "marketplace_data", { connectionId }),
            ...state.auditLogs,
          ],
        })),
    }),
    {
      name: "kasflow-ledger-store",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (state) => {
        // Exclude large arrays from localStorage persistence to improve performance
        // These are always fetched fresh from Supabase anyway
        const {
          transactions,
          journalEntries,
          ledgerEntries,
          auditLogs,
          marketplaceOrders,
          marketplaceStatements,
          marketplaceSyncLogs,
          ...rest
        } = state;
        return rest;
      },
    },
  ),
);
