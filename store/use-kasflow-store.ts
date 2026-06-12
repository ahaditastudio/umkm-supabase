"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  buildLedgerEntries,
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
  ledgerEntries: LedgerEntry[];
  taxSettings: TaxSettings;
  accountingPeriods: AccountingPeriod[];
  auditLogs: AuditLog[];
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
  generateDummyData: (count: number) => void;
  seedDemoCompany: () => void;
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
      journalEntries: [openingJournal],
      ledgerEntries: refreshLedger([openingJournal], defaultAccounts),
      taxSettings: defaultTaxSettings,
      accountingPeriods: [defaultAccountingPeriod],
      auditLogs: [audit("create", "opening_balance", openingJournal)],
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
        );
        const journalEntries = [journal, ...state.journalEntries];

        set({
          transactions: [transaction, ...state.transactions],
          journalEntries,
          ledgerEntries: refreshLedger(journalEntries, state.accounts),
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
            ledgerEntries: refreshLedger(journalEntries, state.accounts),
            auditLogs: [
              audit("restore", "recycle_bin", { transactionId }),
              ...state.auditLogs,
            ],
          };
        }),
      generateDummyData: (count) =>
        set((state) => {
          const generatedTransactions = createSeedTransactions(count);
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
            ),
          );
          const journalEntries = [...journals, ...state.journalEntries];

          return {
            transactions: [...filteredTransactions, ...state.transactions],
            journalEntries,
            ledgerEntries: refreshLedger(journalEntries, state.accounts),
            auditLogs: [
              audit("create", "dummy_generator", { count }),
              ...state.auditLogs,
            ],
          };
        }),
      seedDemoCompany: () =>
        set((state) => {
          const opening = createOpeningBalanceJournal(15_000_000);
          const transactions = createSeedTransactions(300, 6);
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
            ledgerEntries: refreshLedger(journals, state.accounts),
            customers: createDemoCustomers(100),
            suppliers: createDemoSuppliers(25),
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

          return {
            journalEntries,
            ledgerEntries: refreshLedger(journalEntries, state.accounts),
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
          const accountingPeriods = state.accountingPeriods.map(
            (period, index) =>
              index === 0
                ? { ...period, status: "closed" as const, closedAt: now }
                : period,
          );
          const journalEntries = state.journalEntries.map((journal) =>
            journal.date >= state.accountingPeriods[0].startDate &&
            journal.date <= state.accountingPeriods[0].endDate
              ? { ...journal, status: "locked" as const, updatedAt: now }
              : journal,
          );

          return {
            accountingPeriods,
            journalEntries,
            ledgerEntries: refreshLedger(journalEntries, state.accounts),
            auditLogs: [
              audit("close_period", "closing_history", accountingPeriods[0]),
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
            ledgerEntries: refreshLedger(journalEntries, accounts),
            auditLogs: [
              audit("restore", "backup_history", { source: "json_backup" }),
              ...state.auditLogs,
            ],
          };
        }),
    }),
    {
      name: "kasflow-ledger-store",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);
