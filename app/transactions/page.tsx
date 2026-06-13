"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { RotateCcw, Trash2, PlusCircle, Search, Calendar, Filter, ArrowDownLeft, ArrowUpRight, ArrowLeftRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useAuth } from "@/components/auth-provider";
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
  createTransactionFirestore,
  restoreTransactionFirestore,
  softDeleteTransactionFirestore,
} from "@/lib/firestore/company-service";
import { isDateInClosedPeriod } from "@/lib/accounting";
import { cn, formatCurrency, formatDate, toInputDate } from "@/lib/utils";
import { transactionSchema, type TransactionFormValues } from "@/lib/validation";
import { useKasFlowStore } from "@/store/use-kasflow-store";

export default function TransactionsPage() {
  const { appUser } = useAuth();
  const categories = useKasFlowStore((state) => state.categories);
  const cashAccounts = useKasFlowStore((state) => state.cashAccounts);
  const transactions = useKasFlowStore((state) => state.transactions);
  const accountingPeriods = useKasFlowStore((state) => state.accountingPeriods);
  const addTransaction = useKasFlowStore((state) => state.addTransaction);
  const softDeleteTransaction = useKasFlowStore((state) => state.softDeleteTransaction);
  const restoreTransaction = useKasFlowStore((state) => state.restoreTransaction);

  // UI States
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterAccount, setFilterAccount] = useState<string>("all");

  // Delete Confirmation Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [selectedTxDate, setSelectedTxDate] = useState<string>("");
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

  const onSubmit = async (values: TransactionFormValues) => {
    try {
      if (isDateInClosedPeriod(accountingPeriods, values.date)) {
        throw new Error(
          "Periode akuntansi sudah ditutup. Transaksi tidak dapat ditambahkan.",
        );
      }

      if (appUser) {
        await createTransactionFirestore({
          companyId: appUser.companyId,
          values,
          categories,
          cashAccounts,
        });
      } else {
        addTransaction(values);
      }

      toast.success("Transaksi berhasil disimpan dan jurnal otomatis dibuat.");
      form.reset({
        type: values.type,
        date: toInputDate(),
        amount: 0,
        description: "",
        categoryId: values.type === "expense" ? "cat_operational" : "cat_sales",
        cashAccountId: "cash_main",
        sourceAccountId: "cash_main",
        destinationAccountId: "bank_bca",
      });
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
        await softDeleteTransactionFirestore(appUser.companyId, selectedTxId);
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
        await restoreTransactionFirestore(appUser.companyId, id);
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

  // Filtered and searched transactions list
  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((tx) => {
        // Search description
        const matchesSearch = tx.description.toLowerCase().includes(searchTerm.toLowerCase());

        // Type filter
        const matchesType = filterType === "all" || tx.type === filterType;

        // Account filter
        let matchesAccount = true;
        if (filterAccount !== "all") {
          if (tx.type === "transfer") {
            matchesAccount = tx.sourceAccountId === filterAccount || tx.destinationAccountId === filterAccount;
          } else {
            matchesAccount = tx.cashAccountId === filterAccount;
          }
        }

        return matchesSearch && matchesType && matchesAccount;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, searchTerm, filterType, filterAccount]);

  // Group transactions by date for the timeline view
  const groupedTransactions = useMemo(() => {
    const groups: Record<string, typeof filteredTransactions> = {};
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

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header section with Action Button */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <Badge tone="blue">Ledger Entries</Badge>
          <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl text-foreground">
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
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-card pl-9 pr-3 text-xs outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition duration-150"
            />
          </div>

          {/* Type and Account Filter */}
          <div className="flex gap-2 min-w-[320px]">
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
          </div>
        </CardContent>
      </Card>

      {/* Main Full-Width Timeline Feed */}
      {filteredTransactions.length ? (
        <div className="space-y-6">
          {sortedDates.map((date) => {
            const dateTransactions = groupedTransactions[date];
            return (
              <div key={date} className="space-y-2.5">
                {/* Date Group Header */}
                <div className="sticky top-[57px] z-10 -mx-4 px-4 py-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-y border-zinc-200/50 dark:border-zinc-800/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                    <span className="text-xs font-bold tracking-wide text-zinc-500 uppercase">
                      {formatDate(date)}
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500">
                    {dateTransactions.length} Transaksi
                  </span>
                </div>

                {/* Timeline Card Items List */}
                <Card className="border-zinc-200/60 dark:border-zinc-800/50 overflow-hidden shadow-sm divide-y divide-zinc-100 dark:divide-zinc-800/50">
                  {dateTransactions.map((tx) => {
                    const isDeleted = tx.deletedAt != null;

                    // Details label for accounts
                    let accountName = "-";
                    if (tx.type === "transfer") {
                      const src = cashAccounts.find((a) => a.id === tx.sourceAccountId)?.name ?? "Kas";
                      const dest = cashAccounts.find((a) => a.id === tx.destinationAccountId)?.name ?? "Kas";
                      accountName = `${src} ➔ ${dest}`;
                    } else {
                      accountName = cashAccounts.find((a) => a.id === tx.cashAccountId)?.name ?? "Kas";
                    }

                    // Category name if available
                    const categoryName = categories.find((c) => c.id === tx.categoryId)?.name;

                    // Configure icon and colors based on transaction type
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
                    }[tx.type];

                    const TypeIcon = typeConfig.icon;

                    return (
                      <div
                        key={tx.id}
                        className={cn(
                          "group relative p-4 flex items-center justify-between gap-4 transition duration-200 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20",
                          isDeleted && "opacity-45"
                        )}
                      >
                        {/* Left: Icon & Description Info */}
                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                          {/* Round Icon container */}
                          <div className={cn("p-2.5 rounded-xl shrink-0 transition-transform duration-200 group-hover:scale-105", typeConfig.bg)}>
                            <TypeIcon className={cn("h-4 w-4", typeConfig.iconColor)} />
                          </div>

                          {/* Text details */}
                          <div className="min-w-0 space-y-1">
                            <p
                              className={cn(
                                "text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate leading-snug",
                                isDeleted && "line-through text-muted-foreground"
                              )}
                            >
                              {tx.description}
                            </p>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground font-medium">
                              <span>{accountName}</span>
                              {categoryName && (
                                <>
                                  <span className="text-zinc-300 dark:text-zinc-700">•</span>
                                  <span className="px-1.5 py-0.2 bg-zinc-100 dark:bg-zinc-800/80 rounded-md text-zinc-650 dark:text-zinc-400">
                                    {categoryName}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right: Amount, Badge, and Action buttons */}
                        <div className="flex items-center gap-4 shrink-0 text-right">
                          <div className="space-y-1">
                            {/* Amount */}
                            <p className={cn("text-xs font-bold leading-none tracking-tight", typeConfig.amountColor)}>
                              {typeConfig.prefix}
                              {formatCurrency(tx.amount)}
                            </p>

                            {/* Status Badge & Actions (Contextual on hover) */}
                            <div className="h-5 flex items-center justify-end relative">
                              {/* Standard Posted/Deleted Badge (Hidden on Hover if active/actions exist) */}
                              <div className="transition-opacity duration-200 group-hover:opacity-0 flex items-center justify-end">
                                {isDeleted ? (
                                  <Badge tone="red">Deleted</Badge>
                                ) : (
                                  <Badge tone="green">Posted</Badge>
                                )}
                              </div>

                              {/* Contextual Actions (Fade in on Hover) */}
                              <div className="absolute right-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1 bg-gradient-to-l from-zinc-50/90 dark:from-zinc-900/95 via-background pl-4">
                                {isDeleted ? (
                                  <button
                                    onClick={() => handleRestore(tx.id, tx.date)}
                                    className="p-1 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-emerald-650 dark:text-emerald-400 rounded-md transition"
                                    title="Pulihkan Transaksi"
                                  >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => openDeleteConfirmation(tx.id, tx.date)}
                                    className="p-1 hover:bg-red-50 dark:hover:bg-red-950/30 text-rose-600 rounded-md transition"
                                    title="Hapus Transaksi"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </Card>
              </div>
            );
          })}
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
          {transactionType !== "transfer" ? (
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
          ) : (
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

          {/* Nominal */}
          <div className="space-y-1">
            <Label htmlFor="amount">Nominal Uang (Rp)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground/60 select-none">IDR</span>
              <input
                id="amount"
                type="number"
                min="0"
                step="1000"
                {...form.register("amount", { valueAsNumber: true })}
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
