import { doc, setDoc, writeBatch } from "firebase/firestore";
import {
  createOpeningBalanceJournal,
  defaultAccountingPeriod,
  defaultAccounts,
  defaultCashAccounts,
  defaultCategories,
  defaultTaxSettings,
} from "@/lib/accounting";
import { requireDb, scopedDocId } from "@/lib/firestore/helpers";
import type { BusinessProfile, UserRole } from "@/lib/types";

export function companyIdFromUid(uid: string) {
  return `company_${uid}`;
}

export async function bootstrapCompanyForUser({
  uid,
  email,
  businessName,
}: {
  uid: string;
  email: string | null;
  businessName: string;
}) {
  const firestore = requireDb();
  const companyId = companyIdFromUid(uid);
  const now = new Date().toISOString();
  const role: UserRole = "owner";

  await setDoc(doc(firestore, "users", uid), {
    uid,
    email,
    companyId,
    role,
    createdAt: now,
    updatedAt: now,
  });

  const profile: BusinessProfile = {
    id: companyId,
    businessName: businessName || "Bisnis Baru",
    ownerName: email ?? "Owner",
    businessType: "retail",
    taxNumber: "",
    currency: "IDR",
  };
  const openingJournal = { ...createOpeningBalanceJournal(0), companyId };
  const currentPeriod = { ...defaultAccountingPeriod, id: "period_current", companyId };
  const batch = writeBatch(firestore);

  batch.set(doc(firestore, "business_profiles", companyId), {
    ...profile,
    createdAt: now,
    updatedAt: now,
  });

  defaultAccounts.forEach((account) => {
    batch.set(doc(firestore, "accounts", scopedDocId(companyId, account.id)), {
      ...account,
      companyId,
      createdAt: now,
      updatedAt: now,
    });
  });

  defaultCategories.forEach((category) => {
    batch.set(doc(firestore, "account_categories", scopedDocId(companyId, category.id)), {
      ...category,
      companyId,
      createdAt: now,
      updatedAt: now,
    });
  });

  defaultCashAccounts.forEach((cashAccount) => {
    batch.set(doc(firestore, "cash_accounts", scopedDocId(companyId, cashAccount.id)), {
      ...cashAccount,
      companyId,
      createdAt: now,
      updatedAt: now,
    });
  });

  batch.set(doc(firestore, "tax_settings", scopedDocId(companyId, defaultTaxSettings.id)), {
    ...defaultTaxSettings,
    companyId,
    createdAt: now,
    updatedAt: now,
  });

  batch.set(doc(firestore, "accounting_periods", scopedDocId(companyId, currentPeriod.id)), {
    ...currentPeriod,
    createdAt: now,
    updatedAt: now,
  });

  batch.set(doc(firestore, "journal_entries", openingJournal.id), {
    ...openingJournal,
    createdAt: now,
    updatedAt: now,
  });

  batch.set(doc(firestore, "audit_logs", `audit_${uid}_bootstrap`), {
    id: `audit_${uid}_bootstrap`,
    companyId,
    user: email ?? uid,
    action: "create",
    module: "bootstrap_company",
    newValue: { companyId, businessName: profile.businessName },
    timestamp: now,
  });

  await batch.commit();

  return { companyId, role, profile };
}
