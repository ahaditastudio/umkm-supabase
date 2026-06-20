import { createClient } from "@/lib/supabase/client";
import { defaultAccounts, defaultCategories, defaultCashAccounts, defaultTaxSettings, defaultAccountingPeriod } from "@/lib/accounting";
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
  const supabase = createClient();
  const companyId = companyIdFromUid(uid);
  const now = new Date().toISOString();
  const role: UserRole = "owner";

  // Create business profile
  const profile: BusinessProfile = {
    id: companyId,
    businessName: businessName || "Bisnis Baru",
    ownerName: email ?? "Owner",
    businessType: "retail",
    taxNumber: "",
    currency: "IDR",
  };

  const { error: profileError } = await supabase
    .from("business_profiles")
    .insert({
      id: companyId,
      business_name: profile.businessName,
      owner_name: profile.ownerName,
      business_type: profile.businessType,
      tax_number: profile.taxNumber,
      currency: profile.currency,
      created_at: now,
      updated_at: now,
    });

  if (profileError) throw profileError;

  // Create user record
  const { error: userError } = await supabase
    .from("users")
    .insert({
      uid,
      email,
      company_id: companyId,
      role,
      created_at: now,
      updated_at: now,
    });

  if (userError) throw userError;

  // Insert default accounts
  const accountsData = defaultAccounts.map((account) => ({
    id: `${companyId}_${account.id}`,
    company_id: companyId,
    code: account.code,
    name: account.name,
    type: account.type,
    sub_type: account.subType || null,
    normal_balance: account.normalBalance,
    parent_id: account.parentId ? `${companyId}_${account.parentId}` : null,
    is_cash: account.isCash || false,
    is_active: account.isActive,
    neraca_section: account.neracaSection || null,
    created_at: now,
    updated_at: now,
  }));

  const { error: accountsError } = await supabase.from("accounts").insert(accountsData);
  if (accountsError) throw accountsError;

  // Insert default categories (including marketplace categories)
  const marketplaceCategories = [
    { id: "cat_tiktok_sales", name: "Penjualan TikTok", type: "income" as const, accountId: "4100", isActive: true },
    { id: "cat_tiktok_fee", name: "Fee Platform TikTok", type: "expense" as const, accountId: "5100", isActive: true },
    { id: "cat_shopee_sales", name: "Penjualan Shopee", type: "income" as const, accountId: "4100", isActive: true },
    { id: "cat_shopee_fee", name: "Fee Platform Shopee", type: "expense" as const, accountId: "5100", isActive: true },
    { id: "cat_tokopedia_sales", name: "Penjualan Tokopedia", type: "income" as const, accountId: "4100", isActive: true },
    { id: "cat_tokopedia_fee", name: "Fee Platform Tokopedia", type: "expense" as const, accountId: "5100", isActive: true },
  ];

  const allCategories = [...defaultCategories, ...marketplaceCategories];
  const categoriesData = allCategories.map((category) => ({
    id: `${companyId}_${category.id}`,
    company_id: companyId,
    name: category.name,
    type: category.type,
    account_id: `${companyId}_${category.accountId}`,
    is_active: category.isActive,
    created_at: now,
    updated_at: now,
  }));

  const { error: categoriesError } = await supabase.from("account_categories").insert(categoriesData);
  if (categoriesError) throw categoriesError;

  // Insert default cash accounts
  const cashAccountsData = defaultCashAccounts.map((cashAccount) => ({
    id: `${companyId}_${cashAccount.id}`,
    company_id: companyId,
    name: cashAccount.name,
    type: cashAccount.type,
    account_id: `${companyId}_${cashAccount.accountId}`,
    is_active: cashAccount.isActive,
    created_at: now,
    updated_at: now,
  }));

  const { error: cashAccountsError } = await supabase.from("cash_accounts").insert(cashAccountsData);
  if (cashAccountsError) throw cashAccountsError;

  // Insert default tax settings
  const { error: taxError } = await supabase.from("tax_settings").insert({
    id: `${companyId}_${defaultTaxSettings.id}`,
    company_id: companyId,
    name: defaultTaxSettings.name,
    rate: defaultTaxSettings.rate,
    base: defaultTaxSettings.base,
    due_day: defaultTaxSettings.dueDay,
    enabled: defaultTaxSettings.enabled,
    created_at: now,
    updated_at: now,
  });

  if (taxError) throw taxError;

  // Insert default accounting period
  const { error: periodError } = await supabase.from("accounting_periods").insert({
    id: `${companyId}_period_current`,
    company_id: companyId,
    start_date: defaultAccountingPeriod.startDate,
    end_date: defaultAccountingPeriod.endDate,
    status: defaultAccountingPeriod.status,
    closed_at: null,
    created_at: now,
    updated_at: now,
  });

  if (periodError) throw periodError;

  // Create audit log
  await supabase.from("audit_logs").insert({
    id: `audit_${uid}_bootstrap`,
    company_id: companyId,
    user: email ?? uid,
    action: "create",
    module: "bootstrap_company",
    new_value: { companyId, businessName: profile.businessName },
    timestamp: now,
  });

  return { companyId, role, profile };
}
