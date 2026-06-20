"use client";

import { Loader2, Lock, PlusCircle, Pencil, BookOpen, Layers, ShieldCheck, History, CalendarDays } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
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
  addAccount as addAccountDB,
  addAccountingPeriod as addAccountingPeriodDB,
  closeAccountingPeriod,
  createOpeningBalance as createOpeningBalanceDB,
  updateAccount as updateAccountDB,
  updateAccountingPeriod as updateAccountingPeriodDB,
} from "@/lib/supabase/company-service";
import type { AccountType, NormalBalance } from "@/lib/types";
import { formatCurrency, formatDate, formatNumberInput } from "@/lib/utils";
import { useKasFlowStore } from "@/store/use-kasflow-store";
import { cn } from "@/lib/utils";

type TabType = "journal_ledger" | "period_setup" | "coa";

export default function AccountingPage() {
  const { appUser } = useAuth();
  const accounts = useKasFlowStore((state) => state.accounts);
  const journalEntries = useKasFlowStore((state) => state.journalEntries);
  const journalEntriesLoaded = useKasFlowStore((state) => state.journalEntriesLoaded);
  const loadJournalEntries = useKasFlowStore((state) => state.loadJournalEntries);
  const companyId = useKasFlowStore((state) => state.companyId);
  const ledgerEntries = useKasFlowStore((state) => state.ledgerEntries);
  const accountingPeriods = useKasFlowStore((state) => state.accountingPeriods);
  const auditLogs = useKasFlowStore((state) => state.auditLogs);
  const createOpeningBalance = useKasFlowStore((state) => state.createOpeningBalance);
  const closeCurrentPeriod = useKasFlowStore((state) => state.closeCurrentPeriod);
  const addAccount = useKasFlowStore((state) => state.addAccount);
  const addAccountingPeriod = useKasFlowStore((state) => state.addAccountingPeriod);
  const updateAccount = useKasFlowStore((state) => state.updateAccount);
  const updateAccountingPeriod = useKasFlowStore((state) => state.updateAccountingPeriod);

  // Load journal entries when page mounts (lazy loading)
  useEffect(() => {
    if (companyId && !journalEntriesLoaded) {
      loadJournalEntries();
    }
  }, [companyId, journalEntriesLoaded, loadJournalEntries]);

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
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);

  // Edit accounting period state
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);
  const [editPeriodStartDate, setEditPeriodStartDate] = useState("");
  const [editPeriodEndDate, setEditPeriodEndDate] = useState("");
  const [editPeriodLoading, setEditPeriodLoading] = useState(false);

  // Add accounting period state
  const [periodStartDate, setPeriodStartDate] = useState("");
  const [periodEndDate, setPeriodEndDate] = useState("");
  const [addPeriodLoading, setAddPeriodLoading] = useState(false);

  const selectedLedger = useMemo(
    () => ledgerEntries.filter((entry) => entry.accountId === selectedAccountId),
    [ledgerEntries, selectedAccountId],
  );
  const currentPeriod = accountingPeriods[0] || null;

  const handleOpeningBalance = async () => {
    if (!openingAmount) return toast.error("Nominal saldo awal wajib diisi.");
    try {
      if (appUser) {
        await createOpeningBalanceDB(
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
      if (!currentPeriod) {
        throw new Error("Tidak ada periode akuntansi yang aktif.");
      }
      if (appUser) {
        await closeAccountingPeriod(
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
      if (editingAccountId) {
        // Edit mode
        if (appUser) {
          await updateAccountDB(
            appUser.companyId,
            editingAccountId,
            {
              code: newAccountCode.trim(),
              name: newAccountName.trim(),
              type: newAccountType,
              normalBalance: newAccountNormalBalance,
            },
          );
        }
        updateAccount(editingAccountId, {
          code: newAccountCode.trim(),
          name: newAccountName.trim(),
          type: newAccountType,
          normalBalance: newAccountNormalBalance,
        });
        toast.success(`Akun ${newAccountCode.trim()} berhasil diperbarui.`);
        setEditingAccountId(null);
      } else {
        // Create mode
        if (appUser) {
          await addAccountDB(
            appUser.companyId,
            {
              code: newAccountCode.trim(),
              name: newAccountName.trim(),
              type: newAccountType,
              normalBalance: newAccountNormalBalance,
            },
          );
        }
        addAccount(
          newAccountCode.trim(),
          newAccountName.trim(),
          newAccountType,
          newAccountNormalBalance,
        );
        toast.success(`Akun ${newAccountCode.trim()} berhasil ditambahkan ke COA.`);
      }
      setNewAccountCode("");
      setNewAccountName("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal menyimpan akun.",
      );
    } finally {
      setAddAccountLoading(false);
    }
  };

  const openEditAccount = (accountId: string) => {
    const account = accounts.find((a) => a.id === accountId);
    if (!account) return;
    setNewAccountCode(account.code);
    setNewAccountName(account.name);
    setNewAccountType(account.type);
    setNewAccountNormalBalance(account.normalBalance);
    setEditingAccountId(accountId);
  };

  const cancelEditAccount = () => {
    setEditingAccountId(null);
    setNewAccountCode("");
    setNewAccountName("");
    setNewAccountType("asset");
    setNewAccountNormalBalance("debit");
  };

  const openEditPeriod = (periodId: string) => {
    const period = accountingPeriods.find((p) => p.id === periodId);
    if (!period) return;
    setEditingPeriodId(periodId);
    setEditPeriodStartDate(period.startDate);
    setEditPeriodEndDate(period.endDate);
  };

  const handleUpdatePeriod = async () => {
    if (!editPeriodStartDate || !editPeriodEndDate || !editingPeriodId) {
      toast.error("Tanggal mulai dan akhir periode wajib diisi.");
      return;
    }
    if (editPeriodStartDate >= editPeriodEndDate) {
      toast.error("Tanggal mulai harus lebih awal dari tanggal akhir.");
      return;
    }
    setEditPeriodLoading(true);
    try {
      if (appUser) {
        await updateAccountingPeriodDB(
          appUser.companyId,
          editingPeriodId,
          { start_date: editPeriodStartDate, end_date: editPeriodEndDate },
        );
      }
      updateAccountingPeriod(editingPeriodId, {
        startDate: editPeriodStartDate,
        endDate: editPeriodEndDate,
      });
      toast.success("Periode akuntansi berhasil diperbarui.");
      setEditingPeriodId(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal memperbarui periode.",
      );
    } finally {
      setEditPeriodLoading(false);
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
    // Check for duplicate/overlapping periods
    const overlaps = accountingPeriods.some(
      (p) => p.startDate <= periodEndDate && p.endDate >= periodStartDate,
    );
    if (overlaps) {
      toast.error("Periode baru tumpang tindih dengan periode yang sudah ada.");
      return;
    }
    setAddPeriodLoading(true);
    try {
      if (appUser) {
        await addAccountingPeriodDB(
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
          <h2 className="mt-3 text-xl font-bold tracking-tight sm:text-2xl lg:text-3xl text-foreground">
            Sistem Akuntansi & Ledger
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Lacak buku besar, jurnal penyesuaian, daftar kode akun, dan manajemen tutup buku berkala.
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 pb-1 lg:mx-0 lg:px-0 lg:border-b lg:border-zinc-200 lg:dark:border-zinc-800 lg:gap-6">
        <button
          onClick={() => setActiveTab("journal_ledger")}
          className={cn(
            "shrink-0 px-3.5 py-2 text-xs font-semibold tracking-wider transition rounded-full lg:rounded-none lg:pb-3.5 lg:px-0 lg:uppercase",
            activeTab === "journal_ledger"
              ? "bg-emerald-500 text-white lg:bg-transparent lg:text-primary lg:border-b-2 lg:border-primary"
              : "text-muted-foreground hover:text-foreground bg-zinc-100 dark:bg-white/[0.06] dark:hover:bg-white/[0.10] dark:border dark:border-white/[0.08] lg:bg-transparent lg:dark:bg-transparent lg:dark:border-0"
          )}
        >
          <span className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> <span className="lg:hidden">Jurnal & Ledger</span><span className="hidden lg:inline">Jurnal & Buku Besar</span>
          </span>
        </button>
        <button
          onClick={() => setActiveTab("period_setup")}
          className={cn(
            "shrink-0 px-3.5 py-2 text-xs font-semibold tracking-wider transition rounded-full lg:rounded-none lg:pb-3.5 lg:px-0 lg:uppercase",
            activeTab === "period_setup"
              ? "bg-emerald-500 text-white lg:bg-transparent lg:text-primary lg:border-b-2 lg:border-primary"
              : "text-muted-foreground hover:text-foreground bg-zinc-100 dark:bg-white/[0.06] dark:hover:bg-white/[0.10] dark:border dark:border-white/[0.08] lg:bg-transparent lg:dark:bg-transparent lg:dark:border-0"
          )}
        >
          <span className="flex items-center gap-2">
            <Layers className="h-4 w-4" /> <span className="lg:hidden">Tutup Buku</span><span className="hidden lg:inline">Tutup Buku & Saldo Awal</span>
          </span>
        </button>
        <button
          onClick={() => setActiveTab("coa")}
          className={cn(
            "shrink-0 px-3.5 py-2 text-xs font-semibold tracking-wider transition rounded-full lg:rounded-none lg:pb-3.5 lg:px-0 lg:uppercase",
            activeTab === "coa"
              ? "bg-emerald-500 text-white lg:bg-transparent lg:text-primary lg:border-b-2 lg:border-primary"
              : "text-muted-foreground hover:text-foreground bg-zinc-100 dark:bg-white/[0.06] dark:hover:bg-white/[0.10] dark:border dark:border-white/[0.08] lg:bg-transparent lg:dark:bg-transparent lg:dark:border-0"
          )}
        >
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> <span className="lg:hidden">COA</span><span className="hidden lg:inline">Chart of Accounts (COA)</span>
          </span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="space-y-6">
        {activeTab === "journal_ledger" && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* General Journal */}
            <Card className="border-zinc-200/60 dark:border-zinc-800/50 shadow-sm overflow-hidden flex flex-col h-full">
              <CardHeader className="border-b pb-4 mb-2">
                <CardTitle>Jurnal Umum (General Journal)</CardTitle>
                <CardDescription>Pencatatan kronologis seluruh double-entry debit dan kredit.</CardDescription>
              </CardHeader>
              <CardContent className="p-4 flex-1">
                <div className="max-h-[500px] overflow-y-auto space-y-4 pr-1 scrollbar-thin">
                  {journalEntries.length ? (
                    journalEntries.map((journal) => (
                      <div key={journal.id} className="rounded-xl border border-zinc-200/60 bg-zinc-50/25 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/10 space-y-3">
                        {/* Header Jurnal */}
                        <div className="flex justify-between items-start gap-2 border-b border-zinc-100 dark:border-zinc-800/50 pb-2">
                          <div>
                            <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{journal.description}</p>
                            <span className="text-[10px] text-muted-foreground font-medium">Ref: {journal.id}</span>
                          </div>
                          <Badge tone="muted" className="text-[9px] font-bold py-0.5 px-2">
                            {formatDate(journal.date)}
                          </Badge>
                        </div>

                        {/* Detail Debit/Kredit */}
                        <div className="space-y-2 text-xs">
                          {journal.lines.map((line, idx) => {
                            const account = getAccount(accounts, line.accountId);
                            const isCredit = line.credit > 0;
                            return (
                              <div key={idx} className="flex justify-between items-center gap-4">
                                <span className={cn(
                                  "font-medium",
                                  isCredit ? "pl-5 text-muted-foreground italic flex items-center gap-1.5" : "text-zinc-800 dark:text-zinc-200"
                                )}>
                                  {isCredit && <span className="text-[10px] text-zinc-400">↳</span>}
                                  {account ? `${account.code} · ${account.name}` : line.accountId}
                                </span>
                                <span className={cn(
                                  "font-semibold tabular-nums shrink-0",
                                  isCredit ? "text-zinc-500 font-medium" : "text-zinc-800 dark:text-zinc-200"
                                )}>
                                  {isCredit ? (
                                    <span>(K) {formatCurrency(line.credit)}</span>
                                  ) : (
                                    <span>(D) {formatCurrency(line.debit)}</span>
                                  )}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState
                      title="Jurnal kosong"
                      description="Belum ada pencatatan jurnal akuntansi otomatis atau manual."
                    />
                  )}
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
                    <>
                      {/* Mobile: stacked cards */}
                      <div className="lg:hidden divide-y divide-zinc-100 dark:divide-zinc-800/50">
                        {selectedLedger.map((entry) => (
                          <div key={entry.id} className="px-4 py-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-zinc-950 dark:text-white">{formatDate(entry.date)}</span>
                              <span className={cn(
                                "text-xs font-extrabold tabular-nums",
                                entry.balance > 0 ? "text-emerald-600 dark:text-emerald-400" : entry.balance < 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"
                              )}>
                                {formatCurrency(entry.balance)}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate mb-1">{entry.description}</p>
                            <div className="flex gap-4 text-[11px]">
                              <span className="text-muted-foreground">D: <span className="font-bold text-zinc-900 dark:text-white">{entry.debit ? formatCurrency(entry.debit) : "-"}</span></span>
                              <span className="text-muted-foreground">K: <span className="font-bold text-zinc-900 dark:text-white">{entry.credit ? formatCurrency(entry.credit) : "-"}</span></span>
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* Desktop: table */}
                      <div className="hidden lg:block">
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
                                <TableCell className={cn(
                                  "text-right text-xs font-extrabold",
                                  entry.balance > 0 ? "text-emerald-600 dark:text-emerald-400" : entry.balance < 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"
                                )}>
                                  {formatCurrency(entry.balance)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </>
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
                {currentPeriod ? (
                  <>
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
                  </>
                ) : (
                  <div className="rounded-xl border bg-amber-50 p-4 text-xs text-amber-700 dark:bg-amber-950/20 dark:text-amber-400">
                    <p className="font-semibold mb-1">⚠️ Tidak Ada Periode Aktif</p>
                    <p className="text-muted-foreground">
                      Tidak ada periode akuntansi yang aktif. Buat periode baru terlebih dahulu di bawah.
                    </p>
                  </div>
                )}
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
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={openingAmount ? formatNumberInput(openingAmount) : ""}
                    onChange={(event) => {
                      const raw = event.target.value.replace(/[^0-9]/g, "");
                      setOpeningAmount(raw ? parseInt(raw, 10) : 0);
                    }}
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
              {/* Tambah/Edit COA */}
              <Card className="border-zinc-200/60 dark:border-zinc-800/50 shadow-sm h-fit">
                <CardHeader className="border-b pb-4 mb-4">
                  <CardTitle>{editingAccountId ? "Edit Kode Akun (COA)" : "Tambah Kode Akun (COA)"}</CardTitle>
                  <CardDescription>{editingAccountId ? "Perbarui informasi akun." : "Buat klasifikasi pembukuan baru."}</CardDescription>
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
                      {editingAccountId ? "Simpan Perubahan" : "Daftarkan Akun"}
                    </Button>
                    {editingAccountId && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={cancelEditAccount}
                        className="w-full font-semibold text-xs tracking-wide h-9.5 mt-1"
                      >
                        Batal Edit
                      </Button>
                    )}
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
                <CardContent className="p-0">
                  <div className="max-h-80 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/50 scrollbar-thin">
                    {accountingPeriods.length ? (
                      accountingPeriods.map((period) => (
                        <div key={period.id} className="p-3.5">
                          {editingPeriodId === period.id ? (
                            /* ── Edit Mode: proper card layout ── */
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Edit Periode</span>
                                <button
                                  onClick={() => setEditingPeriodId(null)}
                                  className="text-[10px] font-semibold text-zinc-400 hover:text-foreground transition"
                                >
                                  ✕ Batal
                                </button>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <Label className="text-[10px] font-semibold text-muted-foreground">Mulai</Label>
                                  <Input
                                    type="date"
                                    value={editPeriodStartDate}
                                    onChange={(e) => setEditPeriodStartDate(e.target.value)}
                                    className="h-8 text-xs"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[10px] font-semibold text-muted-foreground">Selesai</Label>
                                  <Input
                                    type="date"
                                    value={editPeriodEndDate}
                                    onChange={(e) => setEditPeriodEndDate(e.target.value)}
                                    className="h-8 text-xs"
                                  />
                                </div>
                              </div>
                              <Button
                                onClick={handleUpdatePeriod}
                                disabled={editPeriodLoading}
                                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8"
                              >
                                {editPeriodLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Simpan Perubahan"}
                              </Button>
                            </div>
                          ) : (
                            /* ── View Mode ── */
                            <div className="flex items-center justify-between">
                              <div className="space-y-0.5">
                                <span className="font-semibold text-xs text-zinc-800 dark:text-zinc-200">
                                  {formatDate(period.startDate)} — {formatDate(period.endDate)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {period.status === "open" && (
                                  <button
                                    onClick={() => openEditPeriod(period.id)}
                                    className="p-1 hover:bg-blue-50 dark:hover:bg-blue-950/20 text-blue-600 rounded-md transition"
                                    title="Edit Periode"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                )}
                                <Badge tone={period.status === "open" ? "green" : "red"}>
                                  {period.status}
                                </Badge>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="p-6">
                        <EmptyState title="Belum ada periode" description="Buat periode akuntansi pertama Anda melalui form di samping." />
                      </div>
                    )}
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
                  <div key={account.id} className="group rounded-xl border border-zinc-200/60 p-3 bg-zinc-50/30 flex items-start justify-between dark:border-zinc-800">
                    <div className="space-y-1">
                      <p className="font-bold text-xs text-foreground font-mono">
                        {account.code}
                      </p>
                      <p className="font-semibold text-xs text-zinc-700 dark:text-zinc-300">
                        {account.name}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <Badge tone="muted" className="text-[9px]">{account.type}</Badge>
                        <button
                          onClick={() => openEditAccount(account.id)}
                          className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 p-1 hover:bg-blue-50 dark:hover:bg-blue-950/20 text-blue-600 rounded-md transition"
                          title="Edit Akun"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      </div>
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
