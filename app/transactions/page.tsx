"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { RotateCcw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useAuth } from "@/components/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  createTransactionFirestore,
  restoreTransactionFirestore,
  softDeleteTransactionFirestore,
} from "@/lib/firestore/company-service";
import { isDateInClosedPeriod } from "@/lib/accounting";
import { formatCurrency, formatDate, toInputDate } from "@/lib/utils";
import {
  transactionSchema,
  type TransactionFormValues,
} from "@/lib/validation";
import { useKasFlowStore } from "@/store/use-kasflow-store";

export default function TransactionsPage() {
  const { appUser } = useAuth();
  const categories = useKasFlowStore((state) => state.categories);
  const cashAccounts = useKasFlowStore((state) => state.cashAccounts);
  const transactions = useKasFlowStore((state) => state.transactions);
  const accountingPeriods = useKasFlowStore((state) => state.accountingPeriods);
  const addTransaction = useKasFlowStore((state) => state.addTransaction);
  const softDeleteTransaction = useKasFlowStore(
    (state) => state.softDeleteTransaction,
  );
  const restoreTransaction = useKasFlowStore(
    (state) => state.restoreTransaction,
  );
  const [message, setMessage] = useState<string | null>(null);

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: "income",
      date: toInputDate(),
      amount: 0,
      description: "",
      categoryId: "cat_sales",
      cashAccountId: "cash_main",
      sourceAccountId: "cash_main",
      destinationAccountId: "bank_bca",
    },
  });
  const type = form.watch("type");
  const filteredCategories = useMemo(
    () => categories.filter((category) => category.type === type),
    [categories, type],
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

      setMessage(
        "Transaksi tersimpan ke Firestore dan jurnal otomatis berhasil dibuat.",
      );
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
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Gagal menyimpan transaksi.",
      );
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Badge>Transaksi → Journal Entry</Badge>
        <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
          Transaksi
        </h2>
        <p className="mt-1 text-muted-foreground">
          Catat pemasukan, pengeluaran, dan transfer antar akun kas. Jurnal
          dibuat otomatis dan balance.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Input Transaksi</CardTitle>
            <CardDescription>
              Validasi menggunakan React Hook Form + Zod.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
              <div className="grid gap-2">
                <Label>Jenis Transaksi</Label>
                <Select
                  {...form.register("type")}
                  onChange={(event) => {
                    form.setValue(
                      "type",
                      event.target.value as TransactionFormValues["type"],
                    );
                    form.setValue(
                      "categoryId",
                      event.target.value === "expense"
                        ? "cat_operational"
                        : "cat_sales",
                    );
                  }}
                >
                  <option value="income">Uang Masuk</option>
                  <option value="expense">Uang Keluar</option>
                  <option value="transfer">Transfer Kas</option>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Tanggal</Label>
                <Input type="date" {...form.register("date")} />
                {form.formState.errors.date ? (
                  <p className="text-xs text-red-500">
                    {form.formState.errors.date.message}
                  </p>
                ) : null}
              </div>

              {type !== "transfer" ? (
                <>
                  <div className="grid gap-2">
                    <Label>Kategori</Label>
                    <Select {...form.register("categoryId")}>
                      {filteredCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </Select>
                    {form.formState.errors.categoryId ? (
                      <p className="text-xs text-red-500">
                        {form.formState.errors.categoryId.message}
                      </p>
                    ) : null}
                  </div>

                  <div className="grid gap-2">
                    <Label>Akun Kas</Label>
                    <Select {...form.register("cashAccountId")}>
                      {cashAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                </>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Akun Sumber</Label>
                    <Select {...form.register("sourceAccountId")}>
                      {cashAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Akun Tujuan</Label>
                    <Select {...form.register("destinationAccountId")}>
                      {cashAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </Select>
                    {form.formState.errors.destinationAccountId ? (
                      <p className="text-xs text-red-500">
                        {form.formState.errors.destinationAccountId.message}
                      </p>
                    ) : null}
                  </div>
                </div>
              )}

              <div className="grid gap-2">
                <Label>Nominal</Label>
                <Input
                  type="number"
                  min="0"
                  step="1000"
                  {...form.register("amount", { valueAsNumber: true })}
                />
                {form.formState.errors.amount ? (
                  <p className="text-xs text-red-500">
                    {form.formState.errors.amount.message}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label>Deskripsi</Label>
                <Textarea
                  {...form.register("description")}
                  placeholder="Contoh: Penjualan produk harian"
                />
                {form.formState.errors.description ? (
                  <p className="text-xs text-red-500">
                    {form.formState.errors.description.message}
                  </p>
                ) : null}
              </div>

              {message ? (
                <p className="rounded-xl bg-muted px-3 py-2 text-sm">
                  {message}
                </p>
              ) : null}
              <Button className="w-full" type="submit">
                Simpan & Buat Jurnal
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Riwayat Transaksi</CardTitle>
            <CardDescription>
              Soft delete aktif agar data bisa dipulihkan dari recycle bin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {transactions.length ? (
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full min-w-[780px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-3 pr-4">Tanggal</th>
                      <th className="py-3 pr-4">Jenis</th>
                      <th className="py-3 pr-4">Deskripsi</th>
                      <th className="py-3 pr-4 text-right">Nominal</th>
                      <th className="py-3 pr-4">Status</th>
                      <th className="py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((transaction) => (
                      <tr
                        key={transaction.id}
                        className="border-b last:border-0"
                      >
                        <td className="py-3 pr-4">
                          {formatDate(transaction.date)}
                        </td>
                        <td className="py-3 pr-4 capitalize">
                          {transaction.type}
                        </td>
                        <td className="py-3 pr-4">{transaction.description}</td>
                        <td className="py-3 pr-4 text-right font-medium">
                          {formatCurrency(transaction.amount)}
                        </td>
                        <td className="py-3 pr-4">
                          {transaction.deletedAt ? (
                            <Badge tone="red">Deleted</Badge>
                          ) : (
                            <Badge tone="green">Posted</Badge>
                          )}
                        </td>
                        <td className="py-3 text-right">
                          {transaction.deletedAt ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                if (appUser) {
                                  await restoreTransactionFirestore(
                                    appUser.companyId,
                                    transaction.id,
                                  );
                                } else {
                                  restoreTransaction(transaction.id);
                                }
                              }}
                            >
                              <RotateCcw className="h-4 w-4" /> Restore
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                if (appUser) {
                                  await softDeleteTransactionFirestore(
                                    appUser.companyId,
                                    transaction.id,
                                  );
                                } else {
                                  softDeleteTransaction(transaction.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" /> Hapus
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title="Belum ada transaksi"
                description="Input transaksi pertama atau seed demo company dari menu Utilitas."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
