import { useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth-provider";
import { buildLedgerEntries, defaultTaxSettings } from "@/lib/accounting";
import type {
  Account,
  AccountingPeriod,
  AuditLog,
  BusinessProfile,
  CashAccount,
  Category,
  Customer,
  JournalEntry,
  Supplier,
  TaxSettings,
  Transaction,
} from "@/lib/types";
import { useKasFlowStore } from "@/store/use-kasflow-store";

// Helper: convert snake_case row from DB to camelCase
function toCamel(obj: any): any {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(toCamel);
  const out: any = {};
  for (const key in obj) {
    const camel = key.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
    out[camel] = obj[key];
  }
  return out;
}

function sortByDateDesc<T extends { date?: string; timestamp?: string; createdAt?: string }>(items: T[]) {
  return items.sort((a, b) =>
    String(b.date ?? b.timestamp ?? b.createdAt ?? "").localeCompare(
      String(a.date ?? a.timestamp ?? a.createdAt ?? ""),
    ),
  );
}

function refreshLedger() {
  const state = useKasFlowStore.getState();
  useKasFlowStore.setState({
    ledgerEntries: buildLedgerEntries(state.journalEntries, state.accounts),
  });
}

async function fetchTable<T>(companyId: string, table: string): Promise<T[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("company_id", companyId);
  if (error) {
    console.error(`Supabase fetch error on ${table}`, error);
    return [];
  }
  return (data || []).map(toCamel);
}

// Specialized fetch for journal entries: filters soft-deleted & parses JSONB lines
async function fetchJournalEntries(companyId: string): Promise<JournalEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("date", { ascending: false });
  if (error) {
    console.error("Supabase fetch error on journal_entries", error);
    return [];
  }
  return (data || []).map((row: any) => {
    const converted = toCamel(row);
    if (typeof converted.lines === "string") {
      converted.lines = JSON.parse(converted.lines);
    }
    if (Array.isArray(converted.lines)) {
      converted.lines = converted.lines.map(toCamel);
    }
    return converted as JournalEntry;
  });
}

export function useCompanySync() {
  const { appUser } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  // Use companyId string as dependency instead of appUser object reference.
  // This prevents re-fetching all 11 tables when appUser reference changes
  // but the actual company ID stays the same (e.g., during auth refresh).
  const companyId = appUser?.companyId ?? null;

  useEffect(() => {
    if (!companyId) return;

    useKasFlowStore.setState({ companyId });

    // Initial fetch of all tables — run in parallel for speed
    const loadAll = async () => {

      // Business profile — use maybeSingle to avoid throwing when profile missing
      const profilePromise = supabase
        .from("business_profiles")
        .select("*")
        .eq("id", companyId)
        .maybeSingle();

      // Fetch CRITICAL tables in parallel (needed for core app functionality)
      const [
        _profileResult,
        accounts,
        categories,
        cashAccounts,
        transactions,
        journalEntries,
        taxSettings,
        periods,
      ] = await Promise.all([
        profilePromise,
        fetchTable<Account>(companyId, "accounts"),
        fetchTable<Category>(companyId, "account_categories"),
        fetchTable<CashAccount>(companyId, "cash_accounts"),
        fetchTable<Transaction>(companyId, "transactions"),
        fetchJournalEntries(companyId),
        fetchTable<TaxSettings>(companyId, "tax_settings"),
        fetchTable<AccountingPeriod>(companyId, "accounting_periods"),
      ]);

      // Sort accounts once — used for both state and ledger computation
      const sortedAccounts = accounts.sort((a, b) => a.code.localeCompare(b.code));

      // Apply CRITICAL state updates immediately
      const { data: profileData } = _profileResult;
      useKasFlowStore.setState({
        ...(profileData ? { profile: toCamel(profileData) as BusinessProfile } : {}),
        accounts: sortedAccounts,
        categories: categories.sort((a, b) => a.name.localeCompare(b.name)),
        cashAccounts: cashAccounts.sort((a, b) => a.name.localeCompare(b.name)),
        transactions: sortByDateDesc(transactions),
        journalEntries,
        journalEntriesLoaded: true,
        ledgerEntries: buildLedgerEntries(journalEntries, sortedAccounts),
        taxSettings: taxSettings[0] ?? { ...defaultTaxSettings, companyId },
        accountingPeriods: periods.sort((a, b) => b.startDate.localeCompare(a.startDate)),
      });

      // Fetch DEFERRED tables in parallel (loaded on-demand when needed)
      const [customers, suppliers, auditLogs] = await Promise.all([
        fetchTable<Customer>(companyId, "customers"),
        fetchTable<Supplier>(companyId, "suppliers"),
        fetchTable<AuditLog>(companyId, "audit_logs"),
      ]);

      // Apply DEFERRED state updates
      useKasFlowStore.setState({
        customers: customers.filter((c: any) => !c.deletedAt).sort((a, b) => a.name.localeCompare(b.name)),
        suppliers: suppliers.filter((s: any) => !s.deletedAt).sort((a, b) => a.name.localeCompare(b.name)),
        auditLogs: sortByDateDesc(auditLogs).slice(0, 100),
      });
    };

    loadAll().catch((err) => {
      console.error("[useCompanySync] loadAll FAILED:", err);
    });

    // Subscribe to realtime changes

    // Debounce timer for audit logs (low priority, can batch)
    let auditDebounce: ReturnType<typeof setTimeout> | null = null;

    const debouncedRefetchAuditLogs = () => {
      if (auditDebounce) clearTimeout(auditDebounce);
      auditDebounce = setTimeout(async () => {
        const logs = await fetchTable<AuditLog>(companyId, "audit_logs");
        useKasFlowStore.setState({ auditLogs: sortByDateDesc(logs).slice(0, 100) });
      }, 500);
    };

    const channel = supabase
      .channel(`kasflow-sync-${companyId}`)
      // Business profile
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "business_profiles", filter: `id=eq.${companyId}` },
        (payload) => {
          if (payload.new) useKasFlowStore.setState({ profile: toCamel(payload.new) });
        },
      )
      // Accounts
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "accounts", filter: `company_id=eq.${companyId}` },
        async () => {
          const accounts = await fetchTable<Account>(companyId, "accounts");
          useKasFlowStore.setState({ accounts: accounts.sort((a, b) => a.code.localeCompare(b.code)) });
          refreshLedger();
        },
      )
      // Categories
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "account_categories", filter: `company_id=eq.${companyId}` },
        async () => {
          const cats = await fetchTable<Category>(companyId, "account_categories");
          useKasFlowStore.setState({ categories: cats.sort((a, b) => a.name.localeCompare(b.name)) });
        },
      )
      // Cash Accounts
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cash_accounts", filter: `company_id=eq.${companyId}` },
        async () => {
          const cas = await fetchTable<CashAccount>(companyId, "cash_accounts");
          useKasFlowStore.setState({ cashAccounts: cas.sort((a, b) => a.name.localeCompare(b.name)) });
        },
      )
      // Customers
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "customers", filter: `company_id=eq.${companyId}` },
        async () => {
          const custs = await fetchTable<Customer>(companyId, "customers");
          useKasFlowStore.setState({
            customers: custs.filter((c: any) => !c.deletedAt).sort((a, b) => a.name.localeCompare(b.name)),
          });
        },
      )
      // Suppliers
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "suppliers", filter: `company_id=eq.${companyId}` },
        async () => {
          const sups = await fetchTable<Supplier>(companyId, "suppliers");
          useKasFlowStore.setState({
            suppliers: sups.filter((s: any) => !s.deletedAt).sort((a, b) => a.name.localeCompare(b.name)),
          });
        },
      )
      // Transactions — in-place patching for all events
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions", filter: `company_id=eq.${companyId}` },
        async (payload) => {
          if (!payload) return;

          if (payload.eventType === "INSERT" && payload.new) {
            const newTx = toCamel(payload.new) as Transaction;
            useKasFlowStore.setState((state) => {
              if (state.transactions.some((t) => t.id === newTx.id)) return {};
              return {
                transactions: sortByDateDesc([...state.transactions, newTx]),
              };
            });
          } else if (payload.eventType === "UPDATE" && payload.new) {
            const updatedTx = toCamel(payload.new) as Transaction;
            useKasFlowStore.setState((state) => ({
              transactions: sortByDateDesc(
                state.transactions.map((t) => (t.id === updatedTx.id ? updatedTx : t))
              ),
            }));
          } else if (payload.eventType === "DELETE" && payload.old) {
            const deletedId = (payload.old as any).id;
            useKasFlowStore.setState((state) => ({
              transactions: state.transactions.filter((t) => t.id !== deletedId),
            }));
          }
        },
      )
      // Journal Entries — in-place patching for all events
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "journal_entries", filter: `company_id=eq.${companyId}` },
        async (payload) => {
          if (!payload) return;

          // Only process realtime updates if journal entries have been loaded
          const journalEntriesLoaded = useKasFlowStore.getState().journalEntriesLoaded;
          if (!journalEntriesLoaded) return;

          if (payload.eventType === "INSERT" && payload.new) {
            const newJe = toCamel(payload.new) as any;
            if (typeof newJe.lines === "string") newJe.lines = JSON.parse(newJe.lines);
            if (Array.isArray(newJe.lines)) newJe.lines = newJe.lines.map(toCamel);
            useKasFlowStore.setState((state) => {
              if (state.journalEntries.some((j) => j.id === newJe.id)) return {};
              return {
                journalEntries: sortByDateDesc([...state.journalEntries, newJe as JournalEntry]),
              };
            });
            refreshLedger();
          } else if (payload.eventType === "UPDATE" && payload.new) {
            const updatedJe = toCamel(payload.new) as any;
            if (typeof updatedJe.lines === "string") updatedJe.lines = JSON.parse(updatedJe.lines);
            if (Array.isArray(updatedJe.lines)) updatedJe.lines = updatedJe.lines.map(toCamel);
            useKasFlowStore.setState((state) => ({
              journalEntries: sortByDateDesc(
                state.journalEntries.map((j) => (j.id === updatedJe.id ? updatedJe as JournalEntry : j))
              ),
            }));
            refreshLedger();
          } else if (payload.eventType === "DELETE" && payload.old) {
            const deletedId = (payload.old as any).id;
            useKasFlowStore.setState((state) => ({
              journalEntries: state.journalEntries.filter((j) => j.id !== deletedId),
            }));
            refreshLedger();
          }
        },
      )
      // Tax Settings
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tax_settings", filter: `company_id=eq.${companyId}` },
        async () => {
          const ts = await fetchTable<TaxSettings>(companyId, "tax_settings");
          useKasFlowStore.setState({
            taxSettings: ts[0] ?? { ...defaultTaxSettings, companyId },
          });
        },
      )
      // Accounting Periods
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "accounting_periods", filter: `company_id=eq.${companyId}` },
        async () => {
          const aps = await fetchTable<AccountingPeriod>(companyId, "accounting_periods");
          useKasFlowStore.setState({
            accountingPeriods: aps.sort((a, b) => b.startDate.localeCompare(a.startDate)),
          });
        },
      )
      // Audit Logs — debounced to prevent refetch storms
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "audit_logs", filter: `company_id=eq.${companyId}` },
        () => {
          debouncedRefetchAuditLogs();
        },
      )
      .subscribe();

    return () => {
      // Clean up debounce timers
      if (auditDebounce) clearTimeout(auditDebounce);
      supabase.removeChannel(channel);
    };
  }, [companyId, supabase]);
}
