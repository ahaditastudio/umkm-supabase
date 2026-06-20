"use client";

import {
  CheckCircle2,
  Download,
  Loader2,
  RotateCcw,
  Trash2,
  Upload,
  Wand2,
  XCircle,
  Receipt,
  Package,
  User,
} from "lucide-react";
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmModal } from "@/components/ui/modal";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  restoreCustomer,
  restoreSupplier,
  restoreTransaction,
  bulkInsertTransactions,
  bulkInsertContacts,
  updateBusinessProfile,
  resetCompanyData,
} from "@/lib/supabase/company-service";
import {
  createSeedTransactions,
  createDemoCustomers,
  createDemoSuppliers,
  createOpeningBalanceJournal,
  createSeedJournals,
  generateJournalFromTransaction,
} from "@/lib/accounting";
import { uid } from "@/lib/utils";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useKasFlowStore } from "@/store/use-kasflow-store";
import type { BusinessProfile } from "@/lib/types";

export default function UtilitiesPage() {
  const { appUser } = useAuth();
  const store = useKasFlowStore();
  const [dummyCount, setDummyCount] = useState(50);
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info";
    message: string;
    details?: string;
  } | null>(null);

  // Auto-dismiss notification after 8s
  const notify = useCallback(
    (type: "success" | "error" | "info", message: string, details?: string) => {
      setNotification({ type, message, details });
      setTimeout(() => setNotification(null), 8000);
    },
    [],
  );

  // Loading states per action
  const [generateLoading, setGenerateLoading] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);
  const [resetDataLoading, setResetDataLoading] = useState(false);

  // Backup restore state
  const [backupData, setBackupData] = useState<Record<string, unknown> | null>(
    null,
  );
  const [backupInfo, setBackupInfo] = useState<string | null>(null);

  // Lazy load journal entries when page mounts
  const loadJournalEntries = useKasFlowStore((state) => state.loadJournalEntries);
  const journalEntriesLoaded = useKasFlowStore((state) => state.journalEntriesLoaded);

  useEffect(() => {
    if (!journalEntriesLoaded) {
      loadJournalEntries();
    }
  }, [loadJournalEntries, journalEntriesLoaded]);

  const deletedTransactions = useMemo(
    () => store.transactions.filter((item) => item.deletedAt),
    [store.transactions],
  );
  const deletedCustomers = useMemo(
    () => store.customers.filter((item) => item.deletedAt),
    [store.customers],
  );
  const deletedSuppliers = useMemo(
    () => store.suppliers.filter((item) => item.deletedAt),
    [store.suppliers],
  );

  const handleBackup = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      businessProfile: store.profile,
      accounts: store.accounts,
      categories: store.categories,
      cashAccounts: store.cashAccounts,
      customers: store.customers,
      suppliers: store.suppliers,
      transactions: store.transactions,
      journalEntries: store.journalEntries,
      ledgerEntries: store.ledgerEntries,
      taxSettings: store.taxSettings,
      accountingPeriods: store.accountingPeriods,
      auditLogs: store.auditLogs,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `kasflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    notify(
      "success",
      "Backup JSON berhasil dibuat.",
      "ZIP restore disiapkan sebagai tahap berikutnya.",
    );
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string) as Record<
          string,
          unknown
        >;
        setBackupData(parsed);
        const txCount = Array.isArray(parsed.transactions)
          ? parsed.transactions.length
          : 0;
        const jrCount = Array.isArray(parsed.journalEntries)
          ? parsed.journalEntries.length
          : 0;
        const custCount = Array.isArray(parsed.customers)
          ? parsed.customers.length
          : 0;
        const suppCount = Array.isArray(parsed.suppliers)
          ? parsed.suppliers.length
          : 0;
        setBackupInfo(
          `Export: ${typeof parsed.exportedAt === "string" ? parsed.exportedAt.slice(0, 10) : "unknown"} · Transaksi: ${txCount} · Jurnal: ${jrCount} · Customer: ${custCount} · Supplier: ${suppCount}`,
        );
      } catch {
        setBackupInfo("File JSON tidak valid atau formatnya tidak dikenali.");
        setBackupData(null);
      }
    };
    reader.readAsText(file);
  };

  const handleRestore = () => {
    if (!backupData) return;
    setShowRestoreConfirm(true);
  };

  const doRestore = async () => {
    setShowRestoreConfirm(false);
    setRestoreLoading(true);
    setNotification(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const backupPayload = backupData as any;
      // Restore from backup now only works locally
      store.restoreFromBackup(backupPayload);
      notify("success", "Restore berhasil.", "Data telah dipulihkan dari file backup.");
      setBackupData(null);
      setBackupInfo(null);
    } catch (error) {
      notify(
        "error",
        "Gagal melakukan restore.",
        error instanceof Error ? error.message : "Unknown error",
      );
    } finally {
      setRestoreLoading(false);
    }
  };

  const handleReset = async () => {
    if (resetConfirmation !== "RESET DATA") {
      notify("error", "Konfirmasi harus mengetik RESET DATA.");
      return;
    }
    setResetDataLoading(true);
    setNotification(null);
    try {
      // Reset data di database (jika authenticated)
      if (appUser?.companyId) {
        await resetCompanyData(appUser.companyId);
        // Tunggu realtime sync untuk update store
        await new Promise((resolve) => setTimeout(resolve, 500));
      } else {
        // Reset lokal jika tidak authenticated
        store.resetBusinessData();
      }
      setResetConfirmation("");
      notify(
        "success",
        "Data bisnis berhasil di-reset.",
        "Profile, COA, kategori, cash accounts, dan tax settings dipertahankan.",
      );
    } catch (error) {
      notify(
        "error",
        "Gagal melakukan reset data.",
        error instanceof Error ? error.message : "Unknown error",
      );
    } finally {
      setResetDataLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Badge tone="blue">Utilities</Badge>
        <h2 className="mt-3 text-xl font-bold tracking-tight sm:text-2xl lg:text-3xl">
          Utilitas
        </h2>
        <p className="mt-1 text-muted-foreground">
          Generate dummy data, seed demo company, reset data, recycle bin,
          backup, dan restore.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Generate Dummy Data</CardTitle>
            <CardDescription>
              Options: 50, 100, 500, 1000 transaksi.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select
              value={dummyCount}
              onChange={(event) => setDummyCount(Number(event.target.value))}
            >
              <option value={50}>50 Transactions</option>
              <option value={100}>100 Transactions</option>
              <option value={500}>500 Transactions</option>
              <option value={1000}>1000 Transactions</option>
            </Select>
            <Button
              className="w-full"
              disabled={generateLoading}
              onClick={async () => {
                setGenerateLoading(true);
                setNotification(null);
                try {
                  const companyId = appUser?.companyId ?? store.companyId;

                  // Generate data langsung (bukan via store) agar bisa dikontrol
                  // Use store categories/cashAccounts (prefixed IDs from DB) for correct references
                  const rawTransactions = createSeedTransactions(dummyCount, 6, companyId, store.categories, store.cashAccounts);
                  // Override ID agar unik dan konsisten
                  const newTransactions = rawTransactions.map((t, i) => ({
                    ...t,
                    id: uid(`dummy_${i}`),
                    description: `${t.description} #${store.transactions.length + i + 1}`,
                  }));

                  // Generate journal entries dari transaksi baru
                  const newJournalEntries = newTransactions.map((tx) =>
                    generateJournalFromTransaction(tx, store.categories, store.cashAccounts, store.accounts),
                  );

                  if (appUser?.companyId) {
                    // Insert ke Supabase — data sudah pakai companyId yang benar
                    await bulkInsertTransactions(
                      appUser.companyId,
                      newTransactions,
                      newJournalEntries,
                    );
                    // Tunggu realtime sync untuk update store
                    await new Promise((resolve) => setTimeout(resolve, 500));
                    notify(
                      "success",
                      `${dummyCount} dummy transactions + journals berhasil dibuat!`,
                      `Data berhasil disimpan ke database Supabase (company: ${appUser.companyId.slice(0, 8)}…).`,
                    );
                  } else {
                    // Local only mode - update store langsung
                    store.generateDummyData(dummyCount);
                    notify(
                      "info",
                      `${dummyCount} dummy transactions + journals berhasil dibuat.`,
                      "Data disimpan secara lokal (tidak login ke Supabase).",
                    );
                  }
                } catch (error) {
                  console.error("Error generating dummy data:", error);
                  const errMsg = error instanceof Error ? error.message : "Unknown error";
                  const errDetail =
                    error && typeof error === "object" && "details" in error
                      ? String((error as any).details)
                      : undefined;
                  notify(
                    "error",
                    "Gagal generate dummy data.",
                    errDetail ?? errMsg,
                  );
                } finally {
                  setGenerateLoading(false);
                }
              }}
            >
              {generateLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}{" "}
              Generate
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Seed Demo Company</CardTitle>
            <CardDescription>
              6 bulan data, 300 transaksi/jurnal, 100 customer, 25 supplier.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
              Cocok untuk testing dashboard, laporan, dan demo product.
            </div>
            <Button
              className="w-full"
              disabled={seedLoading}
              onClick={async () => {
                setSeedLoading(true);
                setNotification(null);
                try {
                  const companyId = appUser?.companyId ?? store.companyId;

                  // Generate data langsung dengan companyId yang benar
                  // Use store categories/cashAccounts (prefixed IDs from DB) for journal generation
                  const dbCategories = store.categories;
                  const dbCashAccounts = store.cashAccounts;
                  const newTransactions = createSeedTransactions(300, 6, companyId, dbCategories, dbCashAccounts);
                  const openingJournal = createOpeningBalanceJournal(companyId, undefined, store.accounts);
                  const newJournalEntries = [
                    openingJournal,
                    ...newTransactions.map((tx) =>
                      generateJournalFromTransaction(tx, dbCategories, dbCashAccounts, store.accounts),
                    ),
                  ];
                  const newCustomers = createDemoCustomers(100, companyId);
                  const newSuppliers = createDemoSuppliers(25, companyId);

                  if (appUser?.companyId) {
                    // Insert ke Supabase
                    await bulkInsertTransactions(
                      appUser.companyId,
                      newTransactions,
                      newJournalEntries,
                    );
                    await bulkInsertContacts(
                      appUser.companyId,
                      newCustomers,
                      newSuppliers,
                    );

                    // Update profile di database
                    await updateBusinessProfile(appUser.companyId, {
                      businessName: "Demo Company",
                      businessType: "retail",
                      taxNumber: "09.123.456.7-890.000",
                    } as Partial<BusinessProfile>);

                    // Tunggu realtime sync
                    await new Promise((resolve) => setTimeout(resolve, 1000));

                    notify(
                      "success",
                      "Demo company berhasil dibuat!",
                      `300 transaksi, ${newJournalEntries.length} jurnal, 100 customer, 25 supplier disimpan ke Supabase.`,
                    );
                  } else {
                    // Local only mode - update store langsung
                    store.seedDemoCompany();
                    notify(
                      "info",
                      "Demo company berhasil dibuat.",
                      "Data disimpan secara lokal (tidak login ke Supabase).",
                    );
                  }
                } catch (error) {
                  console.error("Error seeding demo company:", error);
                  const errMsg = error instanceof Error ? error.message : "Unknown error";
                  const errDetail =
                    error && typeof error === "object" && "details" in error
                      ? String((error as any).details)
                      : undefined;
                  notify(
                    "error",
                    "Gagal seed demo company.",
                    errDetail ?? errMsg,
                  );
                } finally {
                  setSeedLoading(false);
                }
              }}
            >
              {seedLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}{" "}
              Seed Demo Company
            </Button>
          </CardContent>
        </Card>

        {/* ── Backup & Restore ── */}
        <Card>
          <CardHeader>
            <CardTitle>Backup & Restore</CardTitle>
            <CardDescription>
              Download JSON backup atau upload file untuk restore.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button className="w-full" variant="outline" onClick={handleBackup}>
              <Download className="h-4 w-4" /> Download JSON Backup
            </Button>

            <div className="space-y-3 rounded-xl border p-4">
              <p className="text-sm font-medium">Upload & Restore JSON</p>
              <div className="grid gap-2">
                <Label htmlFor="backup-file">File Backup (.json)</Label>
                <Input
                  id="backup-file"
                  type="file"
                  accept=".json"
                  onChange={handleFileChange}
                />
              </div>
              {backupInfo ? (
                <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                  {backupInfo}
                </p>
              ) : null}
              <Button
                className="w-full"
                variant="outline"
                onClick={handleRestore}
                disabled={!backupData || restoreLoading}
              >
                {restoreLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Upload & Restore
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reset Data</CardTitle>
          <CardDescription>
            Menghapus transaksi, jurnal, ledger, customer, supplier,
            attachments. Menjaga user, profile, COA, kategori, cash accounts,
            tax settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="grid gap-2">
            <Label>Konfirmasi</Label>
            <Input
              value={resetConfirmation}
              onChange={(event) => setResetConfirmation(event.target.value)}
              placeholder="Ketik RESET DATA"
            />
          </div>
          <Button
            variant="destructive"
            disabled={resetDataLoading}
            onClick={handleReset}
          >
            {resetDataLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}{" "}
            Reset Data
          </Button>
        </CardContent>
      </Card>

      {notification ? (
        <div
          className={cn(
            "flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-sm transition-all animate-in slide-in-from-top-2 duration-300",
            notification.type === "success" &&
              "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300",
            notification.type === "error" &&
              "border-red-200 bg-red-50 text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300",
            notification.type === "info" &&
              "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300",
          )}
        >
          {notification.type === "success" ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : notification.type === "error" ? (
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Badge
                tone={
                  notification.type === "success"
                    ? "green"
                    : notification.type === "error"
                      ? "red"
                      : "blue"
                }
              >
                {notification.type === "success"
                  ? "Sukses"
                  : notification.type === "error"
                    ? "Error"
                    : "Info"}
              </Badge>
              <p className="font-semibold">{notification.message}</p>
            </div>
            {notification.details ? (
              <p className="mt-1 text-xs opacity-80">{notification.details}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="shrink-0 rounded-md p-0.5 opacity-60 hover:opacity-100 transition"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {/* ── Recycle Bin ── */}
      <Card>
        <CardHeader>
          <CardTitle>Recycle Bin</CardTitle>
          <CardDescription>
            Soft deleted records bisa dipulihkan sebelum permanent delete di
            tahap lanjutan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-zinc-100 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/10">
              <p className="text-xs font-semibold text-muted-foreground">
                Transaksi Terhapus
              </p>
              <p className="mt-1.5 text-2xl font-bold tracking-tight">
                {deletedTransactions.length}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-100 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/10">
              <p className="text-xs font-semibold text-muted-foreground">Pelanggan Terhapus</p>
              <p className="mt-1.5 text-2xl font-bold tracking-tight">
                {deletedCustomers.length}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-100 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/10">
              <p className="text-xs font-semibold text-muted-foreground">Pemasok Terhapus</p>
              <p className="mt-1.5 text-2xl font-bold tracking-tight">
                {deletedSuppliers.length}
              </p>
            </div>
          </div>

          <div className="space-y-6 pt-2">
            {deletedTransactions.length === 0 && deletedCustomers.length === 0 && deletedSuppliers.length === 0 ? (
              <EmptyState
                title="Recycle Bin Kosong"
                description="Tidak ada data transaksi atau kontak yang dihapus baru-baru ini."
              />
            ) : (
              <>
                {/* 1. Transactions List */}
                {deletedTransactions.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5">
                      <Receipt className="h-3.5 w-3.5" /> Transaksi ({deletedTransactions.length})
                    </h3>
                    <div className="rounded-xl border border-zinc-200/60 dark:border-zinc-800/50 overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800/50">
                      {deletedTransactions.map((transaction) => (
                        <div key={transaction.id} className="group flex items-center justify-between p-3.5 transition hover:bg-zinc-50/30 dark:hover:bg-zinc-800/10">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-8 w-8 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center justify-center shrink-0">
                              <Receipt className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate line-through opacity-70">
                                {transaction.description}
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                                Dihapus: {transaction.deletedAt ? formatDate(transaction.deletedAt) : "-"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 shrink-0">
                            <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                              {formatCurrency(transaction.amount)}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-[10px] font-semibold tracking-wide gap-1 shadow-sm px-2.5"
                              onClick={async () => {
                                if (appUser) {
                                  await restoreTransaction(
                                    appUser.companyId,
                                    transaction.id,
                                  );
                                } else {
                                  store.restoreTransaction(transaction.id);
                                }
                              }}
                            >
                              <RotateCcw className="h-3 w-3" /> Restore
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. Customers List */}
                {deletedCustomers.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5" /> Pelanggan ({deletedCustomers.length})
                    </h3>
                    <div className="rounded-xl border border-zinc-200/60 dark:border-zinc-800/50 overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800/50">
                      {deletedCustomers.map((customer) => {
                        const initial = customer.name ? customer.name.trim().charAt(0).toUpperCase() : "?";
                        return (
                          <div key={customer.id} className="group flex items-center justify-between p-3.5 transition hover:bg-zinc-50/30 dark:hover:bg-zinc-800/10">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="h-8 w-8 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0">
                                {initial}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate line-through opacity-70">
                                  {customer.name}
                                </p>
                                <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                                  Dihapus: {customer.deletedAt ? formatDate(customer.deletedAt) : "-"}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-[10px] font-semibold tracking-wide gap-1 shadow-sm px-2.5 shrink-0"
                              onClick={async () => {
                                if (appUser) {
                                  await restoreCustomer(
                                    appUser.companyId,
                                    customer.id,
                                  );
                                } else {
                                  store.restoreCustomer(customer.id);
                                }
                              }}
                            >
                              <RotateCcw className="h-3 w-3" /> Restore
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3. Suppliers List */}
                {deletedSuppliers.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5">
                      <Package className="h-3.5 w-3.5" /> Pemasok ({deletedSuppliers.length})
                    </h3>
                    <div className="rounded-xl border border-zinc-200/60 dark:border-zinc-800/50 overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800/50">
                      {deletedSuppliers.map((supplier) => {
                        const initial = supplier.name ? supplier.name.trim().charAt(0).toUpperCase() : "?";
                        return (
                          <div key={supplier.id} className="group flex items-center justify-between p-3.5 transition hover:bg-zinc-50/30 dark:hover:bg-zinc-800/10">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="h-8 w-8 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center justify-center shrink-0">
                                {initial}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate line-through opacity-70">
                                  {supplier.name}
                                </p>
                                <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                                  Dihapus: {supplier.deletedAt ? formatDate(supplier.deletedAt) : "-"}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-[10px] font-semibold tracking-wide gap-1 shadow-sm px-2.5 shrink-0"
                              onClick={async () => {
                                if (appUser) {
                                  await restoreSupplier(
                                    appUser.companyId,
                                    supplier.id,
                                  );
                                } else {
                                  store.restoreSupplier(supplier.id);
                                }
                              }}
                            >
                              <RotateCcw className="h-3 w-3" /> Restore
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <ConfirmModal
        open={showRestoreConfirm}
        onClose={() => setShowRestoreConfirm(false)}
        onConfirm={doRestore}
        title="Konfirmasi Restore"
        description="Apakah kamu yakin ingin melakukan restore? Data saat ini akan ditimpa oleh data dari file backup."
        confirmLabel="Restore"
        loading={restoreLoading}
      />
    </div>
  );
}
