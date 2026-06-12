"use client";

import { Loader2, Lock, PlusCircle, BookOpen, Layers, ShieldCheck, History, CalendarDays } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/lib/toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { accountLabel, getAccount } from "@/lib/accounting";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/data-table";
import {
  addAccountFirestore,
  addAccountingPeriodFirestore,
  closeCurrentPeriodFirestore,
  createOpeningBalanceFirestore,
} from "@/lib/firestore/company-service";
import type { AccountType, NormalBalance } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useKasFlowStore } from "@/store/use-kasflow-store";
import { cn } from "@/lib/utils";

type TabType = "journal_ledger" | "period_setup" | "coa";

export default function AccountingPage() {
  const { appUser } = useAuth();
  const accounts = useKasFlowStore((state) => state.accounts);
  const journalEntries = useKasFlowStore((state) => state.journalEntries);
  const ledgerEntries = useKasFlowStore((state) => state.ledgerEntries);
  const accountingPeriods = useKasFlowStore((state) => state.accountingPeriods);
  const auditLogs = useKasFlowStore((state) => state.auditLogs);
  const createOpeningBalance = useKasFlowStore((state) => state.createOpeningBalance);
  const closeCurrentPeriod = useKasFlowStore((state) => state.closeCurrentPeriod);
  const addAccount = useKasFlowStore((state) => state.addAccount);
  const addAccountingPeriod = useKasFlowStore((state) => state.addAccountingPeriod);

  // Active Tab State
  const [activeTab, setActiveTab] = useState<TabType>("journal_ledger");

  // Opening balance state
  const [selectedAccountId, setSelectedAccountId] = useState("1110");
  const [openingAmount, setOpeningAmount] = useState(0);
  const [openingSide, setOpeningSide] = useState<"debit" | "credit">("debit");

  // Closing state
  const [confirmation, setConfirmation] = useState("");

  // Add account (COA) state
  const [newAccountCode, setNewAccountCode] = useState("");
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountType, setNewAccountType] = useState<AccountType>("asset");
  const [newAccountNormalBalance, setNewAccountNormalBalance] = useState<NormalBalance>("debit");
  const [addAccountLoading, setAddAccountLoading] = useState(false);

  // Add accounting period state
  const [periodStartDate, setPeriodStartDate] = useState("");
  const [periodEndDate, setPeriodEndDate] = useState("");
  const [addPeriodLoading, setAddPeriodLoading] = useState(false);

  const selectedLedger = useMemo(
    () => ledgerEntries.filter((entry) => entry.accountId === selectedAccountId),
    [ledgerEntries, selectedAccountId],
  );
  const currentPeriod = accountingPeriods[0];

  const handleOpeningBalance = async () => {
    if (!openingAmount) return toast.error("Nominal saldo awal wajib diisi.");
    try {
      if (appUser) {
        await createOpeningBalanceFirestore(
          appUser.companyId,
          selectedAccountId,
          openingAmount,
          openingSide,
        );
      } else {
        createOpeningBalance(selectedAccountId, openingAmount, openingSide);
      }
      toast.success("Saldo awal berhasil dibuat sebagai jurnal otomatis.");
      setOpeningAmount(0);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal membuat saldo awal.");
    }
  };

  const handleClosing = async () => {
    try {
      if (confirmation !== "TUTUP BUKU") {
        throw new Error("Konfirmasi harus mengetik TUTUP BUKU.");
      }
      if (appUser) {
        await closeCurrentPeriodFirestore(
          appUser.companyId,
          currentPeriod.id,
          currentPeriod.startDate,
          currentPeriod.endDate,
        );
      } else {
        closeCurrentPeriod(confirmation);
      }
      toast.success(
        "Periode ditutup. Transaksi dan jurnal dalam periode ini terkunci.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal tutup buku.");
    }
  };

  const handleAddAccount = async (event: FormEvent) => {
    event.preventDefault();
    if (!newAccountCode.trim() || !newAccountName.trim()) {
      toast.error("Kode dan nama akun wajib diisi.");
      return;
    }
    setAddAccountLoading(true);
    try {
      if (appUser) {
        await addAccountFirestore(
          appUser.companyId,
          newAccountCode.trim(),
          newAccountName.trim(),
          newAccountType,
          newAccountNormalBalance,
        );
      }
      addAccount(
        newAccountCode.trim(),
        newAccountName.trim(),
        newAccountType,
        newAccountNormalBalance,
      );
      setNewAccountCode("");
      setNewAccountName("");
      toast.success(`Akun ${newAccountCode.trim()} berhasil ditambahkan ke COA.`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal menambah akun.",
      );
    } finally {
      setAddAccountLoading(false);
    }
  };

  const handleAddPeriod = async (event: FormEvent) => {
    event.preventDefault();
    if (!periodStartDate || !periodEndDate) {
      toast.error("Tanggal mulai dan akhir periode wajib diisi.");
      return;
    }
    if (periodStartDate >= periodEndDate) {
      toast.error("Tanggal mulai harus lebih awal dari tanggal akhir.");
      return;
    }
    setAddPeriodLoading(true);
    try {
      if (appUser) {
        await addAccountingPeriodFirestore(
          appUser.companyId,
          periodStartDate,
          periodEndDate,
        );
      }
      addAccountingPeriod(periodStartDate, periodEndDate);
      setPeriodStartDate("");
      setPeriodEndDate("");
      toast.success("Periode akuntansi baru berhasil dibuat.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal membuat periode.",
      );
    } finally {
      setAddPeriodLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header Page */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <Badge tone="blue">Accounting Core</Badge>
          <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl text-foreground">
            Sistem Akuntansi & Ledger
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Lacak buku besar, jurnal penyesuaian, daftar kode akun, dan manajemen tutup buku berkala.
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 gap-6">
        <button
          onClick={() => setActiveTab("journal_ledger")}
          className={cn(
            "pb-3.5 text-xs font-semibold uppercase tracking-wider transition relative",
            activeTab === "journal_ledger"
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> Jurnal & Buku Besar
          </span>
        </button>
        <button
          onClick={() => setActiveTab("period_setup")}
          className={cn(
            "pb-3.5 text-xs font-semibold uppercase tracking-wider transition relative",
            activeTab === "period_setup"
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span className="flex items-center gap-2">
            <Layers className="h-4 w-4" /> Tutup Buku & Saldo Awal
          </span>
        </button>
        <button
          onClick={() => setActiveTab("coa")}
          className={cn(
            "pb-3.5 text-xs font-semibold uppercase tracking-wider transition relative",
            activeTab === "coa"
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Chart of Accounts (COA)
          </span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="space-y-6">
        {activeTab === "journal_ledger" && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* General Journal */}
            <Card className="border-zinc-200/60 dark:border-zinc-800/50 shadow-sm overflow-hidden">
              <CardHeader className="border-b pb-4 mb-2">
                <CardTitle>Jurnal Umum (General Journal)</CardTitle>
                <CardDescription>Pencatatan kronologis seluruh double-entry debit dan kredit.</CardDescription>
              </CardHeader>
              <CardContent className="px-0 py-0">
                <div className="max-h-[500px] overflow-y-auto scrollbar-thin">
                  <Table>
                    <TableHeader className="bg-transparent">
                      <TableRow>
                        <TableHead>Tanggal</TableHead>
                        <TableHead>Akun & Keterangan</TableHead>
                        <TableHead className="text-right">Debit</TableHead>
                        <TableHead className="text-right">Kredit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {journalEntries.flatMap((journal) =>
                        journal.lines.map((line, index) => (
                          <TableRow key={`${journal.id}_${index}`}>
                            {index === 0 ? (
                              <TableCell className="font-semibold align-top" rowSpan={journal.lines.length}>
                                {formatDate(journal.date)}
                                <div className="text-[10px] text-muted-foreground font-normal mt-1">{journal.description}</div>
                              </TableCell>
                            ) : null}
                            <TableCell className={cn("font-medium py-3 text-xs", line.credit > 0 ? "pl-6 text-zinc-550" : "")}>
                              {getAccount(accounts, line.accountId)?.name ?? line.accountId}
                            </TableCell>
                            <TableCell className="text-right text-xs font-semibold text-zinc-900 dark:text-white py-3">
                              {line.debit ? formatCurrency(line.debit) : "-"}
                            </TableCell>
                            <TableCell className="text-right text-xs font-semibold text-zinc-900 dark:text-white py-3">
                              {line.credit ? formatCurrency(line.credit) : "-"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Ledger per Account */}
            <Card className="border-zinc-200/60 dark:border-zinc-800/50 shadow-sm overflow-hidden">
              <CardHeader className="border-b pb-4 mb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle>Buku Besar (Ledger)</CardTitle>
                    <CardDescription>Rincian mutasi nominal per pos rekening.</CardDescription>
                  </div>
                  <Select
                    value={selectedAccountId}
                    onChange={(event) => setSelectedAccountId(event.target.value)}
                    className="h-8 text-xs max-w-[180px] font-semibold"
                  >
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {accountLabel(account)}
                      </option>
                    ))}
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="px-0 py-0">
                <div className="max-h-[440px] overflow-y-auto scrollbar-thin">
                  {selectedLedger.length ? (
                    <Table>
                      <TableHeader className="bg-transparent">
                        <TableRow>
                          <TableHead>Tanggal</TableHead>
                          <TableHead>Keterangan</TableHead>
                          <TableHead className="text-right">Debit</TableHead>
                          <TableHead className="text-right">Kredit</TableHead>
                          <TableHead className="text-right">Saldo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedLedger.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell className="font-semibold text-zinc-950 dark:text-white">{formatDate(entry.date)}</TableCell>
                            <TableCell className="max-w-[120px] truncate">{entry.description}</TableCell>
                            <TableCell className="text-right text-xs font-bold text-zinc-900 dark:text-white">
                              {entry.debit ? formatCurrency(entry.debit) : "-"}
                            </TableCell>
                            <TableCell className="text-right text-xs font-bold text-zinc-900 dark:text-white">
                              {entry.credit ? formatCurrency(entry.credit) : "-"}
                            </TableCell>
                            <TableCell className="text-right text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(entry.balance)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="p-6">
                      <EmptyState
                        title="Buku besar kosong"
                        description="Belum ada aktivitas mutasi dana untuk pos rekening terpilih."
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "period_setup" && (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Tutup Buku Card */}
            <Card className="border-zinc-200/60 dark:border-zinc-800/50 shadow-sm">
              <CardHeader className="border-b pb-4 mb-4">
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-rose-500" /> Tutup Buku Berkala
                </CardTitle>
                <CardDescription>Mengunci transaksi pada rentang periode ini.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border bg-zinc-50/50 p-4 text-xs space-y-2 dark:bg-zinc-900/10">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tanggal Mulai:</span>
                    <span className="font-semibold text-foreground">{formatDate(currentPeriod.startDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tanggal Selesai:</span>
                    <span className="font-semibold text-foreground">{formatDate(currentPeriod.endDate)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-muted-foreground">Status:</span>
                    <Badge tone={currentPeriod.status === "open" ? "green" : "red"}>
                      {currentPeriod.status}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmCode">Ketik konfirmasi tutup buku</Label>
                  <Input
                    id="confirmCode"
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    placeholder="Ketik TUTUP BUKU"
                    className="h-9.5 text-xs"
                  />
                </div>
                <Button
                  className="w-full bg-rose-600 hover:bg-rose-550 text-white font-semibold text-xs tracking-wide h-9.5"
                  onClick={handleClosing}
                  disabled={currentPeriod.status === "closed"}
                >
                  Proses Tutup Buku
                </Button>
              </CardContent>
            </Card>

            {/* Input Saldo Awal (Opening Balance) */}
            <Card className="border-zinc-200/60 dark:border-zinc-800/50 shadow-sm">
              <CardHeader className="border-b pb-4 mb-4">
                <CardTitle className="flex items-center gap-2">
                  <PlusCircle className="h-4 w-4 text-emerald-500" /> Entry Saldo Awal
                </CardTitle>
                <CardDescription>Tambahkan modal awal secara balance ke ekuitas.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <Label>Akun Penerima</Label>
                  <Select
                    value={selectedAccountId}
                    onChange={(event) => setSelectedAccountId(event.target.value)}
                    className="h-9.5 text-xs"
                  >
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {accountLabel(account)}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Posisi Saldo</Label>
                  <Select
                    value={openingSide}
                    onChange={(event) => setOpeningSide(event.target.value as any)}
                    className="h-9.5 text-xs"
                  >
                    <option value="debit">Debit (+ Aset)</option>
                    <option value="credit">Kredit (+ Kewajiban / Modal)</option>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Nominal Saldo (Rp)</Label>
                  <Input
                    type="number"
                    value={openingAmount || ""}
                    onChange={(event) => setOpeningAmount(Number(event.target.value))}
                    className="h-9.5 text-xs"
                  />
                </div>
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs tracking-wide h-9.5"
                  onClick={handleOpeningBalance}
                >
                  Simpan Saldo Awal
                </Button>
              </CardContent>
            </Card>

            {/* Audit Logs */}
            <Card className="border-zinc-200/60 dark:border-zinc-800/50 shadow-sm">
              <CardHeader className="border-b pb-4 mb-4">
                <CardTitle className="flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground/85" /> Audit Log Aktivitas
                </CardTitle>
                <CardDescription>Mutasi log audit pengubahan data di sistem.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 px-3 overflow-y-auto max-h-[300px] scrollbar-thin">
                {auditLogs.slice(0, 5).map((log) => (
                  <div key={log.id} className="rounded-lg border bg-zinc-50/40 p-3 text-xs dark:bg-zinc-900/10">
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone="muted">{log.action}</Badge>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-semibold">
                        <CalendarDays className="h-3 w-3" />
                        {formatDate(log.timestamp)}
                      </span>
                    </div>
                    <p className="mt-2 font-semibold text-foreground">{log.module}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "coa" && (
          <div className="space-y-6">
            {/* Form & COA list */}
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Tambah COA */}
              <Card className="border-zinc-200/60 dark:border-zinc-800/50 shadow-sm h-fit">
                <CardHeader className="border-b pb-4 mb-4">
                  <CardTitle>Tambah Kode Akun (COA)</CardTitle>
                  <CardDescription>Buat klasifikasi pembukuan baru.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAddAccount} className="space-y-4">
                    <div className="space-y-1">
                      <Label>Kode Rekening</Label>
                      <Input
                        value={newAccountCode}
                        onChange={(e) => setNewAccountCode(e.target.value)}
                        placeholder="Contoh: 1120"
                        className="h-9.5 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Nama Akun</Label>
                      <Input
                        value={newAccountName}
                        onChange={(e) => setNewAccountName(e.target.value)}
                        placeholder="Contoh: Piutang Penjualan"
                        className="h-9.5 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Klasifikasi Tipe</Label>
                      <Select
                        value={newAccountType}
                        onChange={(e) => setNewAccountType(e.target.value as any)}
                        className="h-9.5 text-xs"
                      >
                        <option value="asset">Aset (Harta)</option>
                        <option value="liability">Liabilitas (Utang)</option>
                        <option value="equity">Ekuitas (Modal)</option>
                        <option value="revenue">Pendapatan (Revenue)</option>
                        <option value="expense">Beban Biaya (Expense)</option>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Normal Balance</Label>
                      <Select
                        value={newAccountNormalBalance}
                        onChange={(e) => setNewAccountNormalBalance(e.target.value as any)}
                        className="h-9.5 text-xs"
                      >
                        <option value="debit">Debit</option>
                        <option value="credit">Kredit</option>
                      </Select>
                    </div>
                    <Button
                      type="submit"
                      disabled={addAccountLoading}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs tracking-wide h-9.5 mt-2"
                    >
                      {addAccountLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <PlusCircle className="h-4 w-4" />
                      )}{" "}
                      Daftarkan Akun
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Buat Periode */}
              <Card className="border-zinc-200/60 dark:border-zinc-800/50 shadow-sm h-fit">
                <CardHeader className="border-b pb-4 mb-4">
                  <CardTitle>Buka Periode Baru</CardTitle>
                  <CardDescription>Buka masa pelaporan keuangan baru.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <form onSubmit={handleAddPeriod} className="space-y-4">
                    <div className="space-y-1">
                      <Label>Tanggal Mulai</Label>
                      <Input
                        type="date"
                        value={periodStartDate}
                        onChange={(e) => setPeriodStartDate(e.target.value)}
                        className="h-9.5 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Tanggal Selesai</Label>
                      <Input
                        type="date"
                        value={periodEndDate}
                        onChange={(e) => setPeriodEndDate(e.target.value)}
                        className="h-9.5 text-xs"
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={addPeriodLoading}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs tracking-wide h-9.5 mt-2"
                    >
                      {addPeriodLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <PlusCircle className="h-4 w-4" />
                      )}{" "}
                      Aktifkan Periode
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Riwayat Periode */}
              <Card className="border-zinc-200/60 dark:border-zinc-800/50 shadow-sm h-fit">
                <CardHeader className="border-b pb-4 mb-4">
                  <CardTitle>Semua Periode Terdaftar</CardTitle>
                  <CardDescription>Daftar riwayat audit masa tahun buku.</CardDescription>
                </CardHeader>
                <CardContent className="px-0 py-0">
                  <div className="max-h-80 overflow-y-auto scrollbar-thin">
                    <Table>
                      <TableHeader className="bg-transparent">
                        <TableRow>
                          <TableHead>Rentang Tanggal</TableHead>
                          <TableHead className="text-right">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {accountingPeriods.map((period) => (
                          <TableRow key={period.id}>
                            <TableCell className="font-semibold text-xs py-3">
                              {formatDate(period.startDate)} — {formatDate(period.endDate)}
                            </TableCell>
                            <TableCell className="text-right py-3 pr-6">
                              <Badge tone={period.status === "open" ? "green" : "red"}>
                                {period.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* List Full COA */}
            <Card className="border-zinc-200/60 dark:border-zinc-800/50 shadow-sm">
              <CardHeader className="border-b pb-4 mb-4">
                <CardTitle>Daftar Lengkap Chart of Accounts (COA)</CardTitle>
                <CardDescription>Struktur penamaan pos akun akuntansi default.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {accounts.map((account) => (
                  <div key={account.id} className="rounded-xl border border-zinc-200/60 p-3 bg-zinc-50/30 flex items-start justify-between dark:border-zinc-800">
                    <div className="space-y-1">
                      <p className="font-bold text-xs text-foreground font-mono">
                        {account.code}
                      </p>
                      <p className="font-semibold text-xs text-zinc-700 dark:text-zinc-300">
                        {account.name}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <Badge tone="muted" className="text-[9px]">{account.type}</Badge>
                      <span className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground">Bal: {account.normalBalance}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
