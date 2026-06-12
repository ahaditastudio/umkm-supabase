"use client";

import { Loader2, Trash2 } from "lucide-react";
import { FormEvent, useState } from "react";
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
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { getAccount } from "@/lib/accounting";
import {
  addCashAccountFirestore,
  addCategoryFirestore,
  addCustomerFirestore,
  addSupplierFirestore,
  deleteCashAccountFirestore,
  deleteCategoryFirestore,
  softDeleteCustomerFirestore,
  softDeleteSupplierFirestore,
} from "@/lib/firestore/company-service";
import type { CashAccountType } from "@/lib/types";
import { useKasFlowStore } from "@/store/use-kasflow-store";

export default function MasterDataPage() {
  const { appUser } = useAuth();
  const accounts = useKasFlowStore((state) => state.accounts);
  const categories = useKasFlowStore((state) => state.categories);
  const cashAccounts = useKasFlowStore((state) => state.cashAccounts);
  const customers = useKasFlowStore((state) => state.customers);
  const suppliers = useKasFlowStore((state) => state.suppliers);
  const addCustomer = useKasFlowStore((state) => state.addCustomer);
  const addSupplier = useKasFlowStore((state) => state.addSupplier);
  const softDeleteCustomer = useKasFlowStore(
    (state) => state.softDeleteCustomer,
  );
  const softDeleteSupplier = useKasFlowStore(
    (state) => state.softDeleteSupplier,
  );
  const addCategory = useKasFlowStore((state) => state.addCategory);
  const deleteCategory = useKasFlowStore((state) => state.deleteCategory);
  const addCashAccount = useKasFlowStore((state) => state.addCashAccount);
  const deleteCashAccount = useKasFlowStore((state) => state.deleteCashAccount);

  // Category form
  const [categoryName, setCategoryName] = useState("");
  const [categoryType, setCategoryType] = useState<"income" | "expense">(
    "income",
  );
  const [categoryAccountId, setCategoryAccountId] = useState("");
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [categoryMessage, setCategoryMessage] = useState<string | null>(null);

  // Cash account form
  const [cashName, setCashName] = useState("");
  const [cashType, setCashType] = useState<CashAccountType>("cash");
  const [cashLinkedAccountId, setCashLinkedAccountId] = useState("");
  const [cashLoading, setCashLoading] = useState(false);
  const [cashMessage, setCashMessage] = useState<string | null>(null);

  // Customer / Supplier form
  const [customerName, setCustomerName] = useState("");
  const [supplierName, setSupplierName] = useState("");

  // Accounts filtered for categories (revenue or expense COA)
  const categoryAccounts = accounts.filter(
    (a) => a.type === "revenue" || a.type === "expense",
  );

  // Accounts filtered for cash accounts (isCash flag or type asset)
  const cashableAccounts = accounts.filter(
    (a) => a.isCash || a.type === "asset",
  );

  const handleAddCategory = async (event: FormEvent) => {
    event.preventDefault();
    if (!categoryName.trim() || !categoryAccountId) {
      setCategoryMessage("Nama kategori dan akun COA wajib diisi.");
      return;
    }
    setCategoryLoading(true);
    setCategoryMessage(null);
    try {
      if (appUser) {
        await addCategoryFirestore(
          appUser.companyId,
          categoryName.trim(),
          categoryType,
          categoryAccountId,
        );
      }
      addCategory(categoryName.trim(), categoryType, categoryAccountId);
      setCategoryName("");
      setCategoryMessage("Kategori berhasil ditambahkan.");
    } catch (error) {
      setCategoryMessage(
        error instanceof Error ? error.message : "Gagal menambah kategori.",
      );
    } finally {
      setCategoryLoading(false);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    try {
      if (appUser) {
        await deleteCategoryFirestore(appUser.companyId, categoryId);
      } else {
        deleteCategory(categoryId);
      }
    } catch (error) {
      setCategoryMessage(
        error instanceof Error ? error.message : "Gagal menghapus kategori.",
      );
    }
  };

  const handleAddCashAccount = async (event: FormEvent) => {
    event.preventDefault();
    if (!cashName.trim() || !cashLinkedAccountId) {
      setCashMessage("Nama akun dan akun COA wajib diisi.");
      return;
    }
    setCashLoading(true);
    setCashMessage(null);
    try {
      if (appUser) {
        await addCashAccountFirestore(
          appUser.companyId,
          cashName.trim(),
          cashType,
          cashLinkedAccountId,
        );
      }
      addCashAccount(cashName.trim(), cashType, cashLinkedAccountId);
      setCashName("");
      setCashMessage("Cash account berhasil ditambahkan.");
    } catch (error) {
      setCashMessage(
        error instanceof Error ? error.message : "Gagal menambah cash account.",
      );
    } finally {
      setCashLoading(false);
    }
  };

  const handleDeleteCashAccount = async (cashAccountId: string) => {
    try {
      if (appUser) {
        await deleteCashAccountFirestore(appUser.companyId, cashAccountId);
      } else {
        deleteCashAccount(cashAccountId);
      }
    } catch (error) {
      setCashMessage(
        error instanceof Error
          ? error.message
          : "Gagal menghapus cash account.",
      );
    }
  };

  const handleCustomer = async (event: FormEvent) => {
    event.preventDefault();
    if (!customerName.trim()) return;
    if (appUser) {
      await addCustomerFirestore(appUser.companyId, customerName.trim());
    } else {
      addCustomer(customerName.trim());
    }
    setCustomerName("");
  };

  const handleSupplier = async (event: FormEvent) => {
    event.preventDefault();
    if (!supplierName.trim()) return;
    if (appUser) {
      await addSupplierFirestore(appUser.companyId, supplierName.trim());
    } else {
      addSupplier(supplierName.trim());
    }
    setSupplierName("");
  };

  return (
    <div className="space-y-6">
      <div>
        <Badge tone="yellow">Master Data</Badge>
        <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
          Master Data
        </h2>
        <p className="mt-1 text-muted-foreground">
          Kategori wajib map ke COA. Cash accounts menjadi akun kas untuk
          transaksi dan transfer.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── Categories ── */}
        <Card>
          <CardHeader>
            <CardTitle>Kategori Transaksi</CardTitle>
            <CardDescription>
              Income/expense categories mapped to chart of accounts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleAddCategory} className="space-y-3">
              <div className="grid gap-2">
                <Label>Nama Kategori</Label>
                <Input
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="Contoh: Penjualan Produk"
                />
              </div>
              <div className="grid gap-2">
                <Label>Tipe</Label>
                <Select
                  value={categoryType}
                  onChange={(e) =>
                    setCategoryType(e.target.value as "income" | "expense")
                  }
                >
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Akun COA</Label>
                <Select
                  value={categoryAccountId}
                  onChange={(e) => setCategoryAccountId(e.target.value)}
                >
                  <option value="">-- Pilih Akun --</option>
                  {categoryAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.code} {account.name}
                    </option>
                  ))}
                </Select>
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={categoryLoading}
              >
                {categoryLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Tambah Kategori
              </Button>
              {categoryMessage ? (
                <p className="text-sm text-muted-foreground">
                  {categoryMessage}
                </p>
              ) : null}
            </form>

            <div className="grid gap-3 sm:grid-cols-2">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="rounded-xl border bg-muted/40 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{category.name}</p>
                    <div className="flex items-center gap-1">
                      <Badge
                        tone={category.type === "income" ? "green" : "red"}
                      >
                        {category.type}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteCategory(category.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    COA: {getAccount(accounts, category.accountId)?.code}{" "}
                    {getAccount(accounts, category.accountId)?.name}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Cash Accounts ── */}
        <Card>
          <CardHeader>
            <CardTitle>Cash Accounts</CardTitle>
            <CardDescription>
              Cash, bank, dan e-wallet untuk transaksi harian.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleAddCashAccount} className="space-y-3">
              <div className="grid gap-2">
                <Label>Nama Akun</Label>
                <Input
                  value={cashName}
                  onChange={(e) => setCashName(e.target.value)}
                  placeholder="Contoh: BCA Utama"
                />
              </div>
              <div className="grid gap-2">
                <Label>Tipe</Label>
                <Select
                  value={cashType}
                  onChange={(e) =>
                    setCashType(e.target.value as CashAccountType)
                  }
                >
                  <option value="cash">Cash</option>
                  <option value="bank">Bank</option>
                  <option value="ewallet">E-Wallet</option>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Akun COA</Label>
                <Select
                  value={cashLinkedAccountId}
                  onChange={(e) => setCashLinkedAccountId(e.target.value)}
                >
                  <option value="">-- Pilih Akun --</option>
                  {cashableAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.code} {account.name}
                    </option>
                  ))}
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={cashLoading}>
                {cashLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Tambah Cash Account
              </Button>
              {cashMessage ? (
                <p className="text-sm text-muted-foreground">{cashMessage}</p>
              ) : null}
            </form>

            <div className="grid gap-3 sm:grid-cols-2">
              {cashAccounts.map((cashAccount) => (
                <div
                  key={cashAccount.id}
                  className="rounded-xl border bg-muted/40 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{cashAccount.name}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteCashAccount(cashAccount.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm capitalize text-muted-foreground">
                    {cashAccount.type}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    COA: {getAccount(accounts, cashAccount.accountId)?.code}{" "}
                    {getAccount(accounts, cashAccount.accountId)?.name}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* ── Customers ── */}
        <Card>
          <CardHeader>
            <CardTitle>Customers</CardTitle>
            <CardDescription>Create dan soft delete customer.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="flex gap-2" onSubmit={handleCustomer}>
              <div className="flex-1">
                <Label className="sr-only">Nama Customer</Label>
                <Input
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  placeholder="Nama customer"
                />
              </div>
              <Button type="submit">Tambah</Button>
            </form>
            {customers.length ? (
              <div className="max-h-80 overflow-auto scrollbar-thin">
                {customers.map((customer) => (
                  <div
                    key={customer.id}
                    className="flex items-center justify-between gap-3 border-b py-3 last:border-0"
                  >
                    <div>
                      <p className="font-medium">{customer.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {customer.email ?? "-"}
                      </p>
                    </div>
                    {customer.deletedAt ? (
                      <Badge tone="red">Deleted</Badge>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          if (appUser) {
                            await softDeleteCustomerFirestore(
                              appUser.companyId,
                              customer.id,
                            );
                          } else {
                            softDeleteCustomer(customer.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Belum ada customer"
                description="Tambahkan customer manual atau seed demo company."
              />
            )}
          </CardContent>
        </Card>

        {/* ── Suppliers ── */}
        <Card>
          <CardHeader>
            <CardTitle>Suppliers</CardTitle>
            <CardDescription>Create dan soft delete supplier.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="flex gap-2" onSubmit={handleSupplier}>
              <div className="flex-1">
                <Label className="sr-only">Nama Supplier</Label>
                <Input
                  value={supplierName}
                  onChange={(event) => setSupplierName(event.target.value)}
                  placeholder="Nama supplier"
                />
              </div>
              <Button type="submit">Tambah</Button>
            </form>
            {suppliers.length ? (
              <div className="max-h-80 overflow-auto scrollbar-thin">
                {suppliers.map((supplier) => (
                  <div
                    key={supplier.id}
                    className="flex items-center justify-between gap-3 border-b py-3 last:border-0"
                  >
                    <div>
                      <p className="font-medium">{supplier.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {supplier.email ?? "-"}
                      </p>
                    </div>
                    {supplier.deletedAt ? (
                      <Badge tone="red">Deleted</Badge>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          if (appUser) {
                            await softDeleteSupplierFirestore(
                              appUser.companyId,
                              supplier.id,
                            );
                          } else {
                            softDeleteSupplier(supplier.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Belum ada supplier"
                description="Tambahkan supplier manual atau seed demo company."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
