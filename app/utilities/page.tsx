"use client";

import {
  Download,
  Loader2,
  RotateCcw,
  Trash2,
  Upload,
  Wand2,
  Receipt,
  Package,
  User,
} from "lucide-react";
import { ChangeEvent, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
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
  generateDummyDataFirestore,
  resetBusinessDataFirestore,
  restoreCustomerFirestore,
  restoreFromBackupFirestore,
  restoreSupplierFirestore,
  restoreTransactionFirestore,
  seedDemoCompanyFirestore,
} from "@/lib/firestore/company-service";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useKasFlowStore } from "@/store/use-kasflow-store";

export default function UtilitiesPage() {
  const { appUser } = useAuth();
  const store = useKasFlowStore();
  const [dummyCount, setDummyCount] = useState(50);
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  // Backup restore state
  const [backupData, setBackupData] = useState<Record<string, unknown> | null>(
    null,
  );
  const [backupInfo, setBackupInfo] = useState<string | null>(null);
  const [restoreLoading, setRestoreLoading] = useState(false);

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
    setMessage(
      "Backup JSON berhasil dibuat. ZIP restore disiapkan sebagai tahap berikutnya.",
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

  const handleRestore = async () => {
    if (!backupData) return;
    const confirmed = window.confirm(
      "Apakah kamu yakin ingin melakukan restore? Data saat ini akan ditimpa oleh data dari file backup.",
    );
    if (!confirmed) return;
    setRestoreLoading(true);
    setMessage(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const backupPayload = backupData as any;
      if (appUser) {
        await restoreFromBackupFirestore(
          appUser.companyId,
          backupPayload as Record<string, unknown[]>,
        );
      }
      store.restoreFromBackup(backupPayload);
      setMessage("Restore berhasil. Data telah dipulihkan dari file backup.");
      setBackupData(null);
      setBackupInfo(null);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Gagal melakukan restore.",
      );
    } finally {
      setRestoreLoading(false);
    }
  };

  const handleReset = () => {
    if (resetConfirmation !== "RESET DATA") {
      setMessage("Konfirmasi harus mengetik RESET DATA.");
      return;
    }
    if (appUser) {
      resetBusinessDataFirestore(appUser.companyId).catch((error) => {
        setMessage(
          error instanceof Error
            ? error.message
            : "Gagal reset data Firestore.",
        );
      });
    } else {
      store.resetBusinessData();
    }
    setResetConfirmation("");
    setMessage(
      "Data bisnis berhasil di-reset. Profile, COA, kategori, cash accounts, dan tax settings dipertahankan.",
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <Badge tone="blue">Utilities</Badge>
        <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
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
              onClick={async () => {
                if (appUser) {
                  await generateDummyDataFirestore(
                    appUser.companyId,
                    dummyCount,
                    store.categories,
                    store.cashAccounts,
                  );
                } else {
                  store.generateDummyData(dummyCount);
                }
                setMessage(
                  `${dummyCount} dummy transactions + journals berhasil dibuat.`,
                );
              }}
            >
              <Wand2 className="h-4 w-4" /> Generate
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
              onClick={async () => {
                if (appUser) {
                  await seedDemoCompanyFirestore(
                    appUser.companyId,
                    store.categories,
                    store.cashAccounts,
                  );
                } else {
                  store.seedDemoCompany();
                }
                setMessage("Demo company berhasil dibuat.");
              }}
            >
              <Wand2 className="h-4 w-4" /> Seed Demo Company
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
          <Button variant="destructive" onClick={handleReset}>
            <Trash2 className="h-4 w-4" /> Reset Data
          </Button>
        </CardContent>
      </Card>

      {message ? (
        <p className="rounded-xl border bg-card px-4 py-3 text-sm">{message}</p>
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
                                  await restoreTransactionFirestore(
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
                                  await restoreCustomerFirestore(
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
                                  await restoreSupplierFirestore(
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
    </div>
  );
}
