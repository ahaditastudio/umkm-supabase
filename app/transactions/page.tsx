"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { RotateCcw, Trash2, PlusCircle, Search, Calendar, Filter, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Landmark } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useAuth } from "@/components/auth-provider";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { usePaginatedTransactions } from "@/hooks/use-paginated-transactions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Drawer } from "@/components/ui/drawer";
import { ConfirmModal } from "@/components/ui/modal";
import { toast } from "@/lib/toast";
import {
  addTransaction as addTransactionDB,
  restoreTransaction as restoreTransactionDB,
  softDeleteTransaction as softDeleteTransactionDB,
} from "@/lib/supabase/company-service";
import { isDateInClosedPeriod } from "@/lib/accounting";
import { calculateBalanceSheetMemo } from "@/lib/accounting-memoized";
import { cn, formatCurrency, formatDate, formatNumberInput, parseNumberInput, toInputDate } from "@/lib/utils";
import { transactionSchema, type TransactionFormValues } from "@/lib/validation";
import type { Transaction } from "@/lib/types";
import { useKasFlowStore } from "@/store/use-kasflow-store";

export default function TransactionsPage() {
  const { appUser } = useAuth();
  const accounts = useKasFlowStore((state) => state.accounts);
  const categories = useKasFlowStore((state) => state.categories);
  const cashAccounts = useKasFlowStore((state) => state.cashAccounts);
  const journalEntries = useKasFlowStore((state) => state.journalEntries);
  const journalEntriesLoaded = useKasFlowStore((state) => state.journalEntriesLoaded);
  const loadJournalEntries = useKasFlowStore((state) => state.loadJournalEntries);
  const companyId = useKasFlowStore((state) => state.companyId);
  const accountingPeriods = useKasFlowStore((state) => state.accountingPeriods);
  const addTransaction = useKasFlowStore((state) => state.addTransaction);
  const softDeleteTransaction = useKasFlowStore((state) => state.softDeleteTransaction);
  const restoreTransaction = useKasFlowStore((state) => state.restoreTransaction);

  useEffect(() => {
    if (companyId && !journalEntriesLoaded) {
      loadJournalEntries();
    }
  }, [companyId, journalEntriesLoaded, loadJournalEntries]);

  // UI States
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterAccount, setFilterAccount] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<number | undefined>(undefined);

  // Generate year options (current year and 2 years back)
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

  // Build filters for server-side pagination
  const paginationFilters = useMemo(() => ({
    type: filterType === "all" ? undefined : filterType as 'income' | 'expense' | 'transfer' | 'capital',
    accountId: filterAccount === "all" ? undefined : filterAccount,
    search: debouncedSearch || undefined,
    year: filterYear,
  }), [filterType, filterAccount, debouncedSearch, filterYear]);

  // Pagination
  const {
    transactions,
    loading: paginationLoading,
    hasMore,
    fetchNextPage,
    refresh: refreshTransactions,
  } = usePaginatedTransactions(
    appUser?.companyId || "",
    paginationFilters
  );

  // Delete Confirmation Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [selectedTxDate, setSelectedTxDate] = useState<string>("");
  const [amountDisplay, setAmountDisplay] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: "income",
      date: toInputDate(),
      amount: 0,
      description: "",
      categoryId: categories.find((c) => c.type === "income")?.id ?? "",
      cashAccountId: cashAccounts[0]?.id ?? "",
      sourceAccountId: cashAccounts[0]?.id ?? "",
      destinationAccountId: cashAccounts[1]?.id ?? cashAccounts[0]?.id ?? "",
    },
  });

  const transactionType = form.watch("type");

  const filteredCategories = useMemo(
    () => categories.filter((category) => category.type === transactionType),
    [categories, transactionType],
  );

  // Helper function untuk validasi dividen dan prive
  const validateCapitalTransaction = (capitalType: string, amount: number) => {
    const balanceSheet = calculateBalanceSheetMemo(journalEntries, accounts, undefined, accountingPeriods);
    const labaBerjalan = balanceSheet.labaBersihPeriodeBerjalan;
    const labaDitahan = balanceSheet.labaDitahan;
    const modalPemilik = balanceSheet.ekuitasDetails.find(e => e.accountCode === "3100")?.balance || 0;

    // Hitung dividen dan prive yang sudah diambil langsung dari transactions (lebih akurat)
    const currentPeriod = accountingPeriods.find(p => p.status === "open");
    const periodStart = currentPeriod?.startDate || "1970-01-01";
    const periodEnd = currentPeriod?.endDate || "2999-12-31";

    const dividenSudahDiambil = transactions
      .filter(tx =>
        tx.type === "capital" &&
        tx.capitalType === "dividen" &&
        !tx.deletedAt &&
        tx.date >= periodStart &&
        tx.date <= periodEnd
      )
      .reduce((sum, tx) => sum + tx.amount, 0);

    const priveSudahDiambil = transactions
      .filter(tx =>
        tx.type === "capital" &&
        tx.capitalType === "prive" &&
        !tx.deletedAt &&
        tx.date >= periodStart &&
        tx.date <= periodEnd
      )
      .reduce((sum, tx) => sum + tx.amount, 0);

    if (capitalType === "dividen") {
      const totalLaba = labaBerjalan + labaDitahan;
      const sisaLaba = totalLaba - dividenSudahDiambil;

      if (amount > sisaLaba) {
        throw new Error(
          `Dividen tidak boleh melebihi sisa laba. Sisa laba tersedia: ${formatCurrency(sisaLaba)}`
        );
      }
    }

    if (capitalType === "prive") {
      const totalLaba = labaBerjalan + labaDitahan;
      const sisaLaba = totalLaba - priveSudahDiambil - dividenSudahDiambil;
      const sisaModal = modalPemilik - priveSudahDiambil;

      // Prive bisa dari modal ATAU dari laba (cukup salah satu yang cukup)
      const bisaDariModal = sisaModal >= amount;
      const bisaDariLaba = sisaLaba >= amount;

      if (!bisaDariModal && !bisaDariLaba) {
        throw new Error(
          `Prive tidak mencukupi. Sisa modal: ${formatCurrency(sisaModal)}, Sisa laba: ${formatCurrency(sisaLaba)}`
        );
      }
    }
  };

  const onSubmit = async (values: TransactionFormValues) => {
    try {
      if (isDateInClosedPeriod(accountingPeriods, values.date)) {
        throw new Error(
          "Periode akuntansi sudah ditutup. Transaksi tidak dapat ditambahkan.",
        );
      }

      // Validasi untuk transaksi perubahan modal
      if (values.type === "capital" && values.capitalType) {
        validateCapitalTransaction(values.capitalType, values.amount);
      }

      if (appUser) {
        let result: Transaction;
        try {
          result = await addTransactionDB(
            appUser.companyId,
            {
              companyId: appUser.companyId,
              type: values.type,
              date: values.date,
              categoryId: values.categoryId,
              cashAccountId: values.cashAccountId,
              sourceAccountId: values.sourceAccountId,
              destinationAccountId: values.destinationAccountId,
              amount: values.amount,
              description: values.description,
              status: "posted",
              capitalType: values.capitalType,
            },
            categories,
            cashAccounts,
            accounts,
          );
        } catch (dbError) {
          // Transaction may have been inserted but journal/audit failed.
          throw dbError;
        }

        // Update local state directly so UI responds immediately
        useKasFlowStore.setState((state) => {
          // Avoid duplicates — check if already added by realtime sync
          const exists = state.transactions.some((t) => t.id === result.id);
          if (exists) return {};
          return {
            transactions: [result, ...state.transactions].sort(
              (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
            ),
          };
        });

        toast.success("Transaksi berhasil disimpan dan jurnal otomatis dibuat.");
      } else {
        addTransaction(values);
        toast.success("Transaksi berhasil disimpan.");
      }

      form.reset({
        type: values.type,
        date: toInputDate(),
        amount: 0,
        description: "",
        categoryId:
          values.type === "expense"
            ? categories.find((c) => c.type === "expense")?.id ?? ""
            : categories.find((c) => c.type === "income")?.id ?? "",
        cashAccountId: cashAccounts[0]?.id ?? "",
        sourceAccountId: cashAccounts[0]?.id ?? "",
        destinationAccountId: cashAccounts[1]?.id ?? cashAccounts[0]?.id ?? "",
      });
      setAmountDisplay("");
      setIsDrawerOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal menyimpan transaksi.",
      );
    }
  };

  const openDeleteConfirmation = (id: string, date: string) => {
    setSelectedTxId(id);
    setSelectedTxDate(date);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedTxId) return;
    setDeleteLoading(true);
    try {
      if (isDateInClosedPeriod(accountingPeriods, selectedTxDate)) {
        throw new Error(
          "Tidak dapat menghapus transaksi pada periode yang telah ditutup.",
        );
      }

      if (appUser) {
        await softDeleteTransactionDB(appUser.companyId, selectedTxId);
      } else {
        softDeleteTransaction(selectedTxId);
      }
      toast.success("Transaksi berhasil dinonaktifkan (soft deleted).");
      setDeleteModalOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal menghapus transaksi.",
      );
    } finally {
      setDeleteLoading(false);
      setSelectedTxId(null);
    }
  };

  const handleRestore = async (id: string, date: string) => {
    try {
      if (isDateInClosedPeriod(accountingPeriods, date)) {
        throw new Error(
          "Tidak dapat memulihkan transaksi pada periode yang telah ditutup.",
        );
      }

      if (appUser) {
        await restoreTransactionDB(appUser.companyId, id);
      } else {
        restoreTransaction(id);
      }
      toast.success("Transaksi berhasil dipulihkan.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal memulihkan transaksi.",
      );
    }
  };

  // Transactions already filtered server-side via usePaginatedTransactions hook
  const filteredTransactions = transactions;

  // Group transactions by date for the timeline view
  const groupedTransactions = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    filteredTransactions.forEach((tx) => {
      if (!groups[tx.date]) {
        groups[tx.date] = [];
      }
      groups[tx.date].push(tx);
    });
    return groups;
  }, [filteredTransactions]);

  const sortedDates = useMemo(() => {
    return Object.keys(groupedTransactions).sort((a, b) => b.localeCompare(a));
  }, [groupedTransactions]);

  // ── Infinite Scroll: fetch more from server ──
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // IntersectionObserver: auto-load when sentinel enters viewport
  const handleLoadMore = useCallback(() => {
    if (hasMore && !paginationLoading) {
      fetchNextPage();
    }
  }, [hasMore, paginationLoading, fetchNextPage]);

  // IntersectionObserver: auto-load when sentinel enters viewport
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) handleLoadMore();
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleLoadMore]);


  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header section with Action Button */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <Badge tone="blue">Ledger Entries</Badge>
          <h2 className="mt-3 text-xl font-bold tracking-tight sm:text-2xl lg:text-3xl text-foreground">
            Riwayat Transaksi
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Catatan penerimaan kas, pengeluaran kas, serta transfer antar kas/bank.
          </p>
        </div>
        <Button
          onClick={() => {
            setIsDrawerOpen(true);
          }}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs gap-1.5 h-9 self-start sm:self-auto shadow-sm"
        >
          <PlusCircle className="h-4 w-4" /> Tambah Transaksi
        </Button>
      </div>

      {/* Filter and search bar */}
      <Card className="border-zinc-200/60 dark:border-zinc-800/50 shadow-soft">
        <CardContent className="p-4 flex flex-col md:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
            <input
              type="text"
              placeholder="Cari deskripsi transaksi..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-9 w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-card pl-9 pr-3 text-xs outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition duration-150"
            />
          </div>

          {/* Type, Account, and Year Filter */}
          <div className="flex flex-col sm:flex-row gap-2 sm:min-w-[480px]">
            <div className="flex-1 relative">
              <Filter className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="h-9 w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-card pl-8 pr-2 text-xs font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition duration-150 appearance-none"
              >
                <option value="all">Semua Jenis</option>
                <option value="income">Pemasukan</option>
                <option value="expense">Pengeluaran</option>
                <option value="transfer">Transfer</option>
                <option value="capital">Perubahan Modal</option>
              </select>
            </div>

            <div className="flex-1 relative">
              <Filter className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
              <select
                value={filterAccount}
                onChange={(e) => setFilterAccount(e.target.value)}
                className="h-9 w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-card pl-8 pr-2 text-xs font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition duration-150 appearance-none"
              >
                <option value="all">Semua Kas/Bank</option>
                {cashAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 relative">
              <Calendar className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
              <select
                value={filterYear ?? "all"}
                onChange={(e) => setFilterYear(e.target.value === "all" ? undefined : parseInt(e.target.value))}
                className="h-9 w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-card pl-8 pr-2 text-xs font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition duration-150 appearance-none"
              >
                <option value="all">Semua Tahun</option>
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Full-Width Timeline Feed */}
      {filteredTransactions.length ? (
        <div className="relative pl-8">
          {/* Vertical timeline line */}
          <div className="timeline-line" />

          {sortedDates.map((date) => {
            const dateTransactions = groupedTransactions[date];
            return (
              <div key={date} className="relative mb-6">
                {/* Date Pill — sits ON the timeline */}
                <div className="relative z-10 flex items-center -ml-8 mb-3">
                  <div className="w-[32px] flex justify-center">
                    <div className="h-3 w-3 rounded-full bg-emerald-400 dark:bg-emerald-500 ring-4 ring-background" />
                  </div>
                  <span className="ml-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/50 dark:border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    {formatDate(date)}
                    <span className="text-emerald-400 dark:text-emerald-500 font-semibold">
                      ({dateTransactions.length})
                    </span>
                  </span>
                </div>

                {/* Transaction Cards */}
                <div className="space-y-2.5">
                  {dateTransactions.map((tx) => {
                    const isDeleted = tx.deletedAt != null;

                    let accountName = "-";
                    if (tx.type === "transfer") {
                      const src = cashAccounts.find((a) => a.id === tx.sourceAccountId)?.name ?? "Kas";
                      const dest = cashAccounts.find((a) => a.id === tx.destinationAccountId)?.name ?? "Kas";
                      accountName = `${src} ➔ ${dest}`;
                    } else {
                      accountName = cashAccounts.find((a) => a.id === tx.cashAccountId)?.name ?? "Kas";
                    }

                    const categoryName = categories.find((c) => c.id === tx.categoryId)?.name;

                    const typeConfig = {
                      income: {
                        icon: ArrowDownLeft,
                        bg: "bg-emerald-50 dark:bg-emerald-500/10",
                        iconColor: "text-emerald-600 dark:text-emerald-400",
                        amountColor: "text-emerald-600 dark:text-emerald-400",
                        prefix: "+",
                      },
                      expense: {
                        icon: ArrowUpRight,
                        bg: "bg-rose-50 dark:bg-rose-500/10",
                        iconColor: "text-rose-600 dark:text-rose-400",
                        amountColor: "text-rose-600 dark:text-rose-400",
                        prefix: "-",
                      },
                      transfer: {
                        icon: ArrowLeftRight,
                        bg: "bg-blue-50 dark:bg-blue-500/10",
                        iconColor: "text-blue-600 dark:text-blue-400",
                        amountColor: "text-blue-600 dark:text-blue-400",
                        prefix: "",
                      },
                      capital: {
                        icon: Landmark,
                        bg: "bg-amber-50 dark:bg-amber-500/10",
                        iconColor: "text-amber-600 dark:text-amber-400",
                        amountColor: "text-amber-600 dark:text-amber-400",
                        prefix: "",
                      },
                    }[tx.type] ?? {
                      icon: RotateCcw,
                      bg: "bg-zinc-50 dark:bg-zinc-500/10",
                      iconColor: "text-zinc-600 dark:text-zinc-400",
                      amountColor: "text-zinc-600 dark:text-zinc-400",
                      prefix: "",
                    };

                    const TypeIcon = typeConfig.icon;

                    return (
                      <div key={tx.id} className="relative -ml-8 pl-8">
                        {/* Connector dot on the timeline */}
                        <div className={cn(
                          "absolute left-[11px] top-4 h-2.5 w-2.5 rounded-full z-10 border-2",
                          isDeleted
                            ? "bg-red-100 dark:bg-red-900 border-red-300 dark:border-red-600"
                            : "bg-white dark:bg-zinc-800 border-emerald-300 dark:border-emerald-600"
                        )} />

                        {/* Transaction Card */}
                        <Card className="border-zinc-200/60 dark:border-zinc-800/50 shadow-sm p-3.5">
                          <div className="flex items-start justify-between gap-3">
                            {/* Left: Icon + Info */}
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className={cn(
                                "p-2 rounded-xl shrink-0",
                                isDeleted ? "bg-zinc-100 dark:bg-zinc-800" : typeConfig.bg
                              )}>
                                <TypeIcon className={cn(
                                  "h-4 w-4",
                                  isDeleted ? "text-zinc-400 dark:text-zinc-500" : typeConfig.iconColor
                                )} />
                              </div>
                              <div className="min-w-0 space-y-0.5">
                                <p className={cn(
                                  "text-xs font-semibold truncate leading-snug",
                                  isDeleted
                                    ? "line-through text-zinc-400 dark:text-zinc-500"
                                    : "text-zinc-800 dark:text-zinc-200"
                                )}>
                                  {tx.description}
                                </p>
                                <div className={cn(
                                  "flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-medium",
                                  isDeleted ? "text-zinc-400 dark:text-zinc-600" : "text-muted-foreground"
                                )}>
                                  <span>{accountName}</span>
                                  {tx.type === "capital" && tx.capitalType ? (
                                    <>
                                      <span className="text-zinc-300 dark:text-zinc-700">•</span>
                                      <span className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800/80 rounded-md">
                                        {tx.capitalType === "setoran" ? "Setoran Modal" :
                                         tx.capitalType === "dividen" ? "Dividen" : "Prive"}
                                      </span>
                                    </>
                                  ) : categoryName ? (
                                    <>
                                      <span className="text-zinc-300 dark:text-zinc-700">•</span>
                                      <span className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800/80 rounded-md">
                                        {categoryName}
                                      </span>
                                    </>
                                  ) : null}
                                </div>
                              </div>
                            </div>

                            {/* Right: Amount (top) + Badge & Action (below, aligned with account row) */}
                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                              {/* Amount */}
                              <p className={cn(
                                "text-xs font-bold leading-none tracking-tight",
                                isDeleted
                                  ? "line-through text-zinc-400 dark:text-zinc-500"
                                  : typeConfig.amountColor
                              )}>
                                {typeConfig.prefix}{formatCurrency(tx.amount)}
                              </p>
                              {/* Badge + Action — aligned with account name row */}
                              <div className="flex items-center gap-1.5">
                                {isDeleted ? (
                                  <Badge tone="red">Deleted</Badge>
                                ) : (
                                  <Badge tone="green">Posted</Badge>
                                )}
                                {isDeleted ? (
                                  <button
                                    onClick={() => handleRestore(tx.id, tx.date)}
                                    className="flex h-6 w-6 items-center justify-center rounded-md border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition duration-150"
                                    title="Pulihkan Transaksi"
                                  >
                                    <RotateCcw className="h-3 w-3" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => openDeleteConfirmation(tx.id, tx.date)}
                                    className="flex h-6 w-6 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500 hover:border-red-200 hover:bg-red-50 hover:text-red-500 dark:hover:border-red-500/20 dark:hover:bg-red-500/10 dark:hover:text-red-400 transition duration-150"
                                    title="Soft Delete"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </Card>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* ── Infinite Scroll Sentinel & Load More ── */}
          {hasMore && (
            <div ref={loadMoreRef} className="flex flex-col items-center gap-3 py-6 -ml-8">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                <div className="h-px w-8 bg-zinc-200 dark:bg-zinc-800" />
                Menampilkan {transactions.length} transaksi
                <div className="h-px w-8 bg-zinc-200 dark:bg-zinc-800" />
              </div>
              <button
                onClick={fetchNextPage}
                disabled={paginationLoading}
                className="px-5 py-2 rounded-full bg-zinc-100 dark:bg-zinc-800/80 text-xs font-semibold text-foreground hover:bg-zinc-200 dark:hover:bg-zinc-700 transition duration-200 active:scale-95 border border-zinc-200/60 dark:border-zinc-700/50 disabled:opacity-50"
              >
                {paginationLoading ? 'Memuat...' : 'Muat lebih lama ↓'}
              </button>
            </div>
          )}

          {/* Show "all loaded" when everything is visible */}
          {!hasMore && transactions.length > 0 && (
            <div className="flex items-center justify-center gap-2 py-5 -ml-8">
              <div className="h-px w-10 bg-zinc-200 dark:bg-zinc-800" />
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Semua transaksi ditampilkan ({transactions.length} transaksi)
              </span>
              <div className="h-px w-10 bg-zinc-200 dark:bg-zinc-800" />
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          title="Tidak ada transaksi"
          description="Ganti filter pencarian atau buat transaksi keuangan baru dengan menekan tombol di atas."
          action={
            <Button
              onClick={() => setIsDrawerOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs"
            >
              Tambah Transaksi Pertama
            </Button>
          }
        />
      )}

      {/* Side-Over Right Drawer for Input Form */}
      <Drawer
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="Pencatatan Transaksi"
        description="Masukkan nominal uang dan alokasikan akun debit/kredit yang sesuai."
      >
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Jenis Transaksi */}
          <div className="space-y-1">
            <Label htmlFor="type">Jenis Transaksi</Label>
            <select
              id="type"
              {...form.register("type")}
              onChange={(event) => {
                form.setValue("type", event.target.value as any);
                form.setValue(
                  "categoryId",
                  event.target.value === "expense"
                    ? categories.find((c) => c.type === "expense")?.id ?? ""
                    : categories.find((c) => c.type === "income")?.id ?? ""
                );
              }}
              className="h-9 w-full rounded-lg border border-zinc-200 dark:border-zinc-805 bg-card px-3 text-xs font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition duration-150 appearance-none"
            >
              <option value="income">Pemasukan Kas</option>
              <option value="expense">Pengeluaran Kas</option>
              <option value="transfer">Transfer Antar Bank</option>
              <option value="capital">Perubahan Modal</option>
            </select>
          </div>

          {/* Tanggal */}
          <div className="space-y-1">
            <Label htmlFor="date">Tanggal</Label>
            <Input
              id="date"
              type="date"
              {...form.register("date")}
            />
            {form.formState.errors.date && <p className="text-[10px] font-bold text-red-500">{form.formState.errors.date.message}</p>}
          </div>

          {/* Conditional Input based on Transaction Type */}
          {(transactionType === "income" || transactionType === "expense") && (
            <>
              {/* Category */}
              <div className="space-y-1">
                <Label htmlFor="categoryId">Kategori</Label>
                <select
                  id="categoryId"
                  {...form.register("categoryId")}
                  className="h-9 w-full rounded-lg border border-zinc-200 dark:border-zinc-805 bg-card px-3 text-xs font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition duration-150 appearance-none"
                >
                  {filteredCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                {form.formState.errors.categoryId && <p className="text-[10px] font-bold text-red-500">{form.formState.errors.categoryId.message}</p>}
              </div>

              {/* Cash Account */}
              <div className="space-y-1">
                <Label htmlFor="cashAccountId">Akun Kas</Label>
                <select
                  id="cashAccountId"
                  {...form.register("cashAccountId")}
                  className="h-9 w-full rounded-lg border border-zinc-200 dark:border-zinc-805 bg-card px-3 text-xs font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition duration-150 appearance-none"
                >
                  {cashAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {transactionType === "transfer" && (
            <div className="grid grid-cols-2 gap-3">
              {/* Source Cash Account */}
              <div className="space-y-1">
                <Label htmlFor="sourceAccountId">Akun Sumber</Label>
                <select
                  id="sourceAccountId"
                  {...form.register("sourceAccountId")}
                  className="h-9 w-full rounded-lg border border-zinc-200 dark:border-zinc-805 bg-card px-3 text-xs font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition duration-150 appearance-none"
                >
                  {cashAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Destination Cash Account */}
              <div className="space-y-1">
                <Label htmlFor="destinationAccountId">Akun Tujuan</Label>
                <select
                  id="destinationAccountId"
                  {...form.register("destinationAccountId")}
                  className="h-9 w-full rounded-lg border border-zinc-200 dark:border-zinc-805 bg-card px-3 text-xs font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition duration-150 appearance-none"
                >
                  {cashAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
                {form.formState.errors.destinationAccountId && <p className="text-[10px] font-bold text-red-500">{form.formState.errors.destinationAccountId.message}</p>}
              </div>
            </div>
          )}

          {transactionType === "capital" && (
            <>
              {/* Capital Type */}
              <div className="space-y-1">
                <Label htmlFor="capitalType">Jenis Perubahan Modal</Label>
                <select
                  id="capitalType"
                  {...form.register("capitalType")}
                  className="h-9 w-full rounded-lg border border-zinc-200 dark:border-zinc-805 bg-card px-3 text-xs font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition duration-150 appearance-none"
                >
                  <option value="">— Pilih jenis —</option>
                  <option value="setoran">Setoran Modal (kas masuk)</option>
                  <option value="prive">Prive (kas keluar)</option>
                  <option value="dividen">Dividen (kas keluar)</option>
                </select>
                {form.formState.errors.capitalType && <p className="text-[10px] font-bold text-red-500">{form.formState.errors.capitalType.message}</p>}
              </div>

              {/* Cash Account */}
              <div className="space-y-1">
                <Label htmlFor="cashAccountId">Akun Kas</Label>
                <select
                  id="cashAccountId"
                  {...form.register("cashAccountId")}
                  className="h-9 w-full rounded-lg border border-zinc-200 dark:border-zinc-805 bg-card px-3 text-xs font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition duration-150 appearance-none"
                >
                  {cashAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
                {form.formState.errors.cashAccountId && <p className="text-[10px] font-bold text-red-500">{form.formState.errors.cashAccountId.message}</p>}
              </div>
            </>
          )}

          {/* Nominal */}
          <div className="space-y-1">
            <Label htmlFor="amount">Nominal Uang (Rp)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground/60 select-none">IDR</span>
              <input
                id="amount"
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={amountDisplay}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, "");
                  const num = raw ? parseInt(raw, 10) : 0;
                  setAmountDisplay(num ? formatNumberInput(num) : "");
                  form.setValue("amount", num, { shouldValidate: true });
                }}
                className="h-9 w-full rounded-lg border border-zinc-200 dark:border-zinc-805 bg-card pl-10 pr-3 text-xs outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition duration-150"
              />
            </div>
            {form.formState.errors.amount && <p className="text-[10px] font-bold text-red-500">{form.formState.errors.amount.message}</p>}
          </div>

          {/* Deskripsi */}
          <div className="space-y-1">
            <Label htmlFor="description">Deskripsi</Label>
            <Textarea
              id="description"
              placeholder="Contoh: Pembelian kopi arabika mentah 5kg"
              {...form.register("description")}
            />
            {form.formState.errors.description && <p className="text-[10px] font-bold text-red-500">{form.formState.errors.description.message}</p>}
          </div>

          {/* Footer Buttons */}
          <div className="flex gap-2 pt-4 border-t mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDrawerOpen(false)}
              className="flex-1 text-xs font-semibold h-9"
            >
              Batal
            </Button>
            <Button
              type="submit"
              loading={form.formState.isSubmitting}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs h-9"
            >
              Simpan Transaksi
            </Button>
          </div>
        </form>
      </Drawer>

      {/* Centered Confirm Modal with Frosted glass effect for Delete */}
      <ConfirmModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        loading={deleteLoading}
        title="Konfirmasi Hapus Transaksi"
        description="Apakah Anda yakin ingin menonaktifkan transaksi ini? Tindakan ini akan menghapus jurnal penyesuaian terkait dan memicu penyesuaian saldo pada buku besar secara real-time."
        confirmLabel="Hapus Transaksi"
      />
    </div>
  );
}
