import {
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  createDemoCustomers,
  createDemoSuppliers,
  createOpeningBalanceJournal,
  createSeedTransactions,
  generateJournalFromTransaction,
} from "@/lib/accounting";
import {
  cleanForFirestore,
  commitInChunks,
  companyQuery,
  requireDb,
  scopedDocId,
  setCompanyDoc,
} from "@/lib/firestore/helpers";
import type {
  Account,
  AccountingPeriod,
  AccountType,
  BusinessProfile,
  CashAccount,
  Category,
  Customer,
  JournalEntry,
  NormalBalance,
  Supplier,
  TaxSettings,
  Transaction,
} from "@/lib/types";
import type { TransactionFormValues } from "@/lib/validation";
import { uid } from "@/lib/utils";

function now() {
  return new Date().toISOString();
}

function auditDoc(
  companyId: string,
  module: string,
  action: string,
  newValue?: unknown,
) {
  const id = uid("audit");
  return {
    id,
    companyId,
    user: "Firebase User",
    action,
    module,
    newValue,
    timestamp: now(),
  };
}

export async function updateBusinessProfileFirestore(
  companyId: string,
  profile: Partial<BusinessProfile>,
) {
  await setCompanyDoc("business_profiles", companyId, {
    ...profile,
    id: companyId,
    updatedAt: now(),
  });
}

export async function updateTaxSettingsFirestore(
  companyId: string,
  settings: TaxSettings,
) {
  const firestore = requireDb();
  const batch = writeBatch(firestore);
  batch.set(
    doc(firestore, "tax_settings", scopedDocId(companyId, settings.id)),
    cleanForFirestore({ ...settings, companyId, updatedAt: now() }),
    { merge: true },
  );
  const audit = auditDoc(companyId, "tax_settings", "update", settings);
  batch.set(doc(firestore, "audit_logs", audit.id), cleanForFirestore(audit));
  await batch.commit();
}

export async function createTransactionFirestore({
  companyId,
  values,
  categories,
  cashAccounts,
}: {
  companyId: string;
  values: TransactionFormValues;
  categories: Category[];
  cashAccounts: CashAccount[];
}) {
  const firestore = requireDb();
  const timestamp = now();
  const transaction: Transaction = {
    id: uid("tx"),
    companyId,
    type: values.type,
    date: values.date,
    categoryId: values.categoryId,
    cashAccountId: values.cashAccountId,
    sourceAccountId: values.sourceAccountId,
    destinationAccountId: values.destinationAccountId,
    amount: values.amount,
    description: values.description,
    status: "posted",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const journal = generateJournalFromTransaction(
    transaction,
    categories,
    cashAccounts,
  );
  const audit = auditDoc(companyId, "transactions", "create", {
    transactionId: transaction.id,
    journalId: journal.id,
  });
  const batch = writeBatch(firestore);

  batch.set(
    doc(firestore, "transactions", transaction.id),
    cleanForFirestore(transaction),
  );
  batch.set(
    doc(firestore, "journal_entries", journal.id),
    cleanForFirestore(journal),
  );
  batch.set(doc(firestore, "audit_logs", audit.id), cleanForFirestore(audit));
  await batch.commit();
}

export async function softDeleteTransactionFirestore(
  companyId: string,
  transactionId: string,
) {
  const firestore = requireDb();
  const timestamp = now();
  const journalId = `jr_${transactionId}`;
  const audit = auditDoc(companyId, "transactions", "delete", {
    transactionId,
  });
  const batch = writeBatch(firestore);
  batch.set(
    doc(firestore, "transactions", transactionId),
    { deletedAt: timestamp, updatedAt: timestamp },
    { merge: true },
  );
  batch.set(
    doc(firestore, "journal_entries", journalId),
    { deletedAt: timestamp, updatedAt: timestamp },
    { merge: true },
  );
  batch.set(doc(firestore, "audit_logs", audit.id), cleanForFirestore(audit));
  await batch.commit();
}

export async function restoreTransactionFirestore(
  companyId: string,
  transactionId: string,
) {
  const firestore = requireDb();
  const timestamp = now();
  const transaction = {
    id: transactionId,
    deletedAt: null,
    updatedAt: timestamp,
  };
  const journal = {
    id: `jr_${transactionId}`,
    deletedAt: null,
    updatedAt: timestamp,
  };
  const audit = auditDoc(companyId, "recycle_bin", "restore", {
    transactionId,
  });
  const batch = writeBatch(firestore);
  batch.set(doc(firestore, "transactions", transactionId), transaction, {
    merge: true,
  });
  batch.set(doc(firestore, "journal_entries", `jr_${transactionId}`), journal, {
    merge: true,
  });
  batch.set(doc(firestore, "audit_logs", audit.id), cleanForFirestore(audit));
  await batch.commit();
}

export async function addCustomerFirestore(
  companyId: string,
  name: string,
  phone?: string,
  email?: string,
) {
  const firestore = requireDb();
  const customer: Customer = { id: uid("cust"), companyId, name, phone, email };
  const audit = auditDoc(companyId, "customers", "create", customer);
  const batch = writeBatch(firestore);
  batch.set(
    doc(firestore, "customers", customer.id),
    cleanForFirestore(customer),
  );
  batch.set(doc(firestore, "audit_logs", audit.id), cleanForFirestore(audit));
  await batch.commit();
}

export async function addSupplierFirestore(
  companyId: string,
  name: string,
  phone?: string,
  email?: string,
) {
  const firestore = requireDb();
  const supplier: Supplier = { id: uid("sup"), companyId, name, phone, email };
  const audit = auditDoc(companyId, "suppliers", "create", supplier);
  const batch = writeBatch(firestore);
  batch.set(
    doc(firestore, "suppliers", supplier.id),
    cleanForFirestore(supplier),
  );
  batch.set(doc(firestore, "audit_logs", audit.id), cleanForFirestore(audit));
  await batch.commit();
}

export async function softDeleteCustomerFirestore(
  companyId: string,
  customerId: string,
) {
  const firestore = requireDb();
  const audit = auditDoc(companyId, "customers", "delete", { customerId });
  const batch = writeBatch(firestore);
  batch.set(
    doc(firestore, "customers", customerId),
    { deletedAt: now() },
    { merge: true },
  );
  batch.set(doc(firestore, "audit_logs", audit.id), cleanForFirestore(audit));
  await batch.commit();
}

export async function softDeleteSupplierFirestore(
  companyId: string,
  supplierId: string,
) {
  const firestore = requireDb();
  const audit = auditDoc(companyId, "suppliers", "delete", { supplierId });
  const batch = writeBatch(firestore);
  batch.set(
    doc(firestore, "suppliers", supplierId),
    { deletedAt: now() },
    { merge: true },
  );
  batch.set(doc(firestore, "audit_logs", audit.id), cleanForFirestore(audit));
  await batch.commit();
}

export async function createOpeningBalanceFirestore(
  companyId: string,
  accountId: string,
  balance: number,
  side: "debit" | "credit",
) {
  const firestore = requireDb();
  const timestamp = now();
  const contraAccountId = "3100";
  const journal: JournalEntry = {
    id: uid("opening"),
    companyId,
    date: timestamp.slice(0, 10),
    description: "Input saldo awal",
    lines:
      side === "debit"
        ? [
            { accountId, debit: balance, credit: 0, description: "Saldo awal" },
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
            { accountId, debit: 0, credit: balance, description: "Saldo awal" },
          ],
    status: "posted",
    source: "opening_balance",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const audit = auditDoc(companyId, "opening_balance", "create", journal);
  const batch = writeBatch(firestore);
  batch.set(
    doc(firestore, "journal_entries", journal.id),
    cleanForFirestore(journal),
  );
  batch.set(doc(firestore, "audit_logs", audit.id), cleanForFirestore(audit));
  await batch.commit();
}

export async function closeCurrentPeriodFirestore(
  companyId: string,
  periodId: string,
  startDate: string,
  endDate: string,
) {
  const firestore = requireDb();
  const timestamp = now();
  const periodDocId = scopedDocId(companyId, periodId);
  const journalsSnapshot = await getDocs(
    query(
      collection(firestore, "journal_entries"),
      where("companyId", "==", companyId),
      where("date", ">=", startDate),
      where("date", "<=", endDate),
    ),
  );
  const audit = auditDoc(companyId, "closing_history", "close_period", {
    periodId,
    startDate,
    endDate,
  });
  const operations = [
    (batch: ReturnType<typeof writeBatch>) =>
      batch.set(
        doc(firestore, "accounting_periods", periodDocId),
        { status: "closed", closedAt: timestamp, updatedAt: timestamp },
        { merge: true },
      ),
    (batch: ReturnType<typeof writeBatch>) =>
      batch.set(
        doc(firestore, "audit_logs", audit.id),
        cleanForFirestore(audit),
      ),
    ...journalsSnapshot.docs.map(
      (journalDoc) => (batch: ReturnType<typeof writeBatch>) =>
        batch.set(
          journalDoc.ref,
          { status: "locked", updatedAt: timestamp },
          { merge: true },
        ),
    ),
  ];
  await commitInChunks(operations);
}

export async function generateDummyDataFirestore(
  companyId: string,
  count: number,
  categories: Category[],
  cashAccounts: CashAccount[],
) {
  const firestore = requireDb();
  const suffix = Date.now();
  const transactions = createSeedTransactions(count).map(
    (transaction, index) => ({
      ...transaction,
      id: uid(`dummy_${index}`),
      companyId,
      description: `${transaction.description} #${suffix}-${index + 1}`,
    }),
  );
  const journals = transactions.map((transaction) =>
    generateJournalFromTransaction(transaction, categories, cashAccounts),
  );
  const audit = auditDoc(companyId, "dummy_generator", "create", { count });
  const operations = [
    ...transactions.map(
      (transaction) => (batch: ReturnType<typeof writeBatch>) =>
        batch.set(
          doc(firestore, "transactions", transaction.id),
          cleanForFirestore(transaction),
        ),
    ),
    ...journals.map(
      (journal) => (batch: ReturnType<typeof writeBatch>) =>
        batch.set(
          doc(firestore, "journal_entries", journal.id),
          cleanForFirestore(journal),
        ),
    ),
    (batch: ReturnType<typeof writeBatch>) =>
      batch.set(
        doc(firestore, "audit_logs", audit.id),
        cleanForFirestore(audit),
      ),
  ];
  await commitInChunks(operations);
}

export async function seedDemoCompanyFirestore(
  companyId: string,
  categories: Category[],
  cashAccounts: CashAccount[],
) {
  const firestore = requireDb();
  const suffix = Date.now();
  const profile: Partial<BusinessProfile> = {
    id: companyId,
    businessName: "Toko Maju Jaya",
    ownerName: "Dita Ramadhani",
    businessType: "retail",
    taxNumber: "09.123.456.7-890.000",
    currency: "IDR",
  };
  const opening = {
    ...createOpeningBalanceJournal(15_000_000),
    id: uid("opening"),
    companyId,
  };
  const transactions = createSeedTransactions(300, 6).map(
    (transaction, index) => ({
      ...transaction,
      id: uid(`seed_${index}`),
      companyId,
      description: `${transaction.description} demo ${suffix}-${index + 1}`,
    }),
  );
  const journals = [
    opening,
    ...transactions.map((transaction) =>
      generateJournalFromTransaction(transaction, categories, cashAccounts),
    ),
  ];
  const customers = createDemoCustomers(100).map((customer) => ({
    ...customer,
    id: uid("cust"),
    companyId,
  }));
  const suppliers = createDemoSuppliers(25).map((supplier) => ({
    ...supplier,
    id: uid("sup"),
    companyId,
  }));
  const audit = auditDoc(companyId, "seed_demo_company", "create", {
    transactions: transactions.length,
    journals: journals.length,
  });
  const operations = [
    (batch: ReturnType<typeof writeBatch>) =>
      batch.set(
        doc(firestore, "business_profiles", companyId),
        cleanForFirestore({ ...profile, updatedAt: now() }),
        { merge: true },
      ),
    ...transactions.map(
      (transaction) => (batch: ReturnType<typeof writeBatch>) =>
        batch.set(
          doc(firestore, "transactions", transaction.id),
          cleanForFirestore(transaction),
        ),
    ),
    ...journals.map(
      (journal) => (batch: ReturnType<typeof writeBatch>) =>
        batch.set(
          doc(firestore, "journal_entries", journal.id),
          cleanForFirestore(journal),
        ),
    ),
    ...customers.map(
      (customer) => (batch: ReturnType<typeof writeBatch>) =>
        batch.set(
          doc(firestore, "customers", customer.id),
          cleanForFirestore(customer),
        ),
    ),
    ...suppliers.map(
      (supplier) => (batch: ReturnType<typeof writeBatch>) =>
        batch.set(
          doc(firestore, "suppliers", supplier.id),
          cleanForFirestore(supplier),
        ),
    ),
    (batch: ReturnType<typeof writeBatch>) =>
      batch.set(
        doc(firestore, "audit_logs", audit.id),
        cleanForFirestore(audit),
      ),
  ];
  await commitInChunks(operations);
}

export async function addCategoryFirestore(
  companyId: string,
  name: string,
  type: "income" | "expense",
  accountId: string,
) {
  const firestore = requireDb();
  const category: Category = {
    id: uid("cat"),
    companyId,
    name,
    type,
    accountId,
    isActive: true,
  };
  const audit = auditDoc(companyId, "account_categories", "create", category);
  const batch = writeBatch(firestore);
  batch.set(
    doc(firestore, "account_categories", category.id),
    cleanForFirestore(category),
  );
  batch.set(doc(firestore, "audit_logs", audit.id), cleanForFirestore(audit));
  await batch.commit();
}

export async function deleteCategoryFirestore(
  companyId: string,
  categoryId: string,
) {
  const firestore = requireDb();
  const audit = auditDoc(companyId, "account_categories", "delete", {
    categoryId,
  });
  const batch = writeBatch(firestore);
  batch.delete(doc(firestore, "account_categories", categoryId));
  batch.set(doc(firestore, "audit_logs", audit.id), cleanForFirestore(audit));
  await batch.commit();
}

export async function addCashAccountFirestore(
  companyId: string,
  name: string,
  type: "cash" | "bank" | "ewallet",
  accountId: string,
) {
  const firestore = requireDb();
  const cashAccount: CashAccount = {
    id: uid("ca"),
    companyId,
    name,
    type,
    accountId,
    isActive: true,
  };
  const audit = auditDoc(companyId, "cash_accounts", "create", cashAccount);
  const batch = writeBatch(firestore);
  batch.set(
    doc(firestore, "cash_accounts", cashAccount.id),
    cleanForFirestore(cashAccount),
  );
  batch.set(doc(firestore, "audit_logs", audit.id), cleanForFirestore(audit));
  await batch.commit();
}

export async function deleteCashAccountFirestore(
  companyId: string,
  cashAccountId: string,
) {
  const firestore = requireDb();
  const audit = auditDoc(companyId, "cash_accounts", "delete", {
    cashAccountId,
  });
  const batch = writeBatch(firestore);
  batch.delete(doc(firestore, "cash_accounts", cashAccountId));
  batch.set(doc(firestore, "audit_logs", audit.id), cleanForFirestore(audit));
  await batch.commit();
}

export async function addAccountFirestore(
  companyId: string,
  code: string,
  name: string,
  type: AccountType,
  normalBalance: NormalBalance,
) {
  const firestore = requireDb();
  const account: Account = {
    id: uid("acc"),
    companyId,
    code,
    name,
    type,
    normalBalance,
    isActive: true,
  };
  const audit = auditDoc(companyId, "accounts", "create", account);
  const batch = writeBatch(firestore);
  batch.set(doc(firestore, "accounts", account.id), cleanForFirestore(account));
  batch.set(doc(firestore, "audit_logs", audit.id), cleanForFirestore(audit));
  await batch.commit();
}

export async function addAccountingPeriodFirestore(
  companyId: string,
  startDate: string,
  endDate: string,
) {
  const firestore = requireDb();
  const period: AccountingPeriod = {
    id: uid("period"),
    companyId,
    startDate,
    endDate,
    status: "open",
  };
  const audit = auditDoc(companyId, "accounting_periods", "create", period);
  const batch = writeBatch(firestore);
  batch.set(
    doc(firestore, "accounting_periods", period.id),
    cleanForFirestore(period),
  );
  batch.set(doc(firestore, "audit_logs", audit.id), cleanForFirestore(audit));
  await batch.commit();
}

export async function restoreCustomerFirestore(
  companyId: string,
  customerId: string,
) {
  const firestore = requireDb();
  const audit = auditDoc(companyId, "recycle_bin", "restore", { customerId });
  const batch = writeBatch(firestore);
  batch.set(
    doc(firestore, "customers", customerId),
    { deletedAt: null },
    { merge: true },
  );
  batch.set(doc(firestore, "audit_logs", audit.id), cleanForFirestore(audit));
  await batch.commit();
}

export async function restoreSupplierFirestore(
  companyId: string,
  supplierId: string,
) {
  const firestore = requireDb();
  const audit = auditDoc(companyId, "recycle_bin", "restore", { supplierId });
  const batch = writeBatch(firestore);
  batch.set(
    doc(firestore, "suppliers", supplierId),
    { deletedAt: null },
    { merge: true },
  );
  batch.set(doc(firestore, "audit_logs", audit.id), cleanForFirestore(audit));
  await batch.commit();
}

export async function restoreFromBackupFirestore(
  companyId: string,
  backup: Record<string, unknown[]>,
) {
  const firestore = requireDb();
  const COLLECTIONS: Record<string, string> = {
    accounts: "accounts",
    categories: "account_categories",
    cashAccounts: "cash_accounts",
    customers: "customers",
    suppliers: "suppliers",
    transactions: "transactions",
    journalEntries: "journal_entries",
    accountingPeriods: "accounting_periods",
  };
  const operations: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];

  for (const [key, collectionName] of Object.entries(COLLECTIONS)) {
    const items = backup[key];
    if (!Array.isArray(items)) continue;
    for (const item of items as Record<string, unknown>[]) {
      if (!item.id || typeof item.id !== "string") continue;
      const itemWithCompany = { ...item, companyId };
      operations.push((batch) =>
        batch.set(
          doc(firestore, collectionName, item.id as string),
          cleanForFirestore(itemWithCompany),
          { merge: true },
        ),
      );
    }
  }

  if (backup.businessProfile && typeof backup.businessProfile === "object") {
    operations.push((batch) =>
      batch.set(
        doc(firestore, "business_profiles", companyId),
        cleanForFirestore({
          ...(backup.businessProfile as object),
          id: companyId,
          updatedAt: now(),
        }),
        { merge: true },
      ),
    );
  }

  const audit = auditDoc(companyId, "backup_history", "restore", {
    source: "json_backup",
    items: operations.length,
  });
  operations.push((batch) =>
    batch.set(doc(firestore, "audit_logs", audit.id), cleanForFirestore(audit)),
  );

  await commitInChunks(operations);
}

export async function resetBusinessDataFirestore(companyId: string) {
  const firestore = requireDb();
  const collectionsToDelete = [
    "transactions",
    "journal_entries",
    "ledger_entries",
    "customers",
    "suppliers",
    "attachments",
  ];
  const operations = [];

  for (const collectionName of collectionsToDelete) {
    const snapshot = await getDocs(companyQuery(collectionName, companyId));
    operations.push(
      ...snapshot.docs.map(
        (document) => (batch: ReturnType<typeof writeBatch>) =>
          batch.delete(document.ref),
      ),
    );
  }

  const audit = auditDoc(companyId, "reset_data", "reset", {
    preserved: [
      "users",
      "business_profiles",
      "coa",
      "categories",
      "cash_accounts",
      "tax_settings",
    ],
  });
  operations.push((batch: ReturnType<typeof writeBatch>) =>
    batch.set(doc(firestore, "audit_logs", audit.id), cleanForFirestore(audit)),
  );
  await commitInChunks(operations);
}
