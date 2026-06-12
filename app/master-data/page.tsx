"use client";

import { Loader2, Trash2, PlusCircle, User, Users, FolderTree, Landmark } from "lucide-react";
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
import { Drawer } from "@/components/ui/drawer";
import { ConfirmModal } from "@/components/ui/modal";
import { toast } from "@/lib/toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/data-table";
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
import { cn } from "@/lib/utils";

type TabType = "categories" | "cash_accounts" | "contacts";

export default function MasterDataPage() {
  const { appUser } = useAuth();
  const accounts = useKasFlowStore((state) => state.accounts);
  const categories = useKasFlowStore((state) => state.categories);
  const cashAccounts = useKasFlowStore((state) => state.cashAccounts);
  const customers = useKasFlowStore((state) => state.customers);
  const suppliers = useKasFlowStore((state) => state.suppliers);
  const addCustomer = useKasFlowStore((state) => state.addCustomer);
  const addSupplier = useKasFlowStore((state) => state.addSupplier);
  const softDeleteCustomer = useKasFlowStore((state) => state.softDeleteCustomer);
  const softDeleteSupplier = useKasFlowStore((state) => state.softDeleteSupplier);
  const addCategory = useKasFlowStore((state) => state.addCategory);
  const deleteCategory = useKasFlowStore((state) => state.deleteCategory);
  const addCashAccount = useKasFlowStore((state) => state.addCashAccount);
  const deleteCashAccount = useKasFlowStore((state) => state.deleteCashAccount);

  // Active Tab State
  const [activeTab, setActiveTab] = useState<TabType>("categories");

  // Drawer States
  const [isCategoryDrawerOpen, setIsCategoryDrawerOpen] = useState(false);
  const [isCashDrawerOpen, setIsCashDrawerOpen] = useState(false);
  const [isContactDrawerOpen, setIsContactDrawerOpen] = useState(false);

  // Delete Confirmation Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteType, setDeleteType] = useState<"category" | "cash" | "customer" | "supplier" | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Category form state
  const [categoryName, setCategoryName] = useState("");
  const [categoryType, setCategoryType] = useState<"income" | "expense">("income");
  const [categoryAccountId, setCategoryAccountId] = useState("");
  const [categoryLoading, setCategoryLoading] = useState(false);

  // Cash account form state
  const [cashName, setCashName] = useState("");
  const [cashType, setCashType] = useState<CashAccountType>("cash");
  const [cashLinkedAccountId, setCashLinkedAccountId] = useState("");
  const [cashLoading, setCashLoading] = useState(false);

  // Customer / Supplier form state
  const [contactType, setContactType] = useState<"customer" | "supplier">("customer");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactLoading, setContactLoading] = useState(false);

  // Accounts filters
  const categoryAccounts = accounts.filter(
    (a) => a.type === "revenue" || a.type === "expense"
  );
  const cashableAccounts = accounts.filter(
    (a) => a.isCash || a.type === "asset"
  );

  const handleAddCategory = async (event: FormEvent) => {
    event.preventDefault();
    if (!categoryName.trim() || !categoryAccountId) {
      toast.error("Nama kategori dan akun COA wajib diisi.");
      return;
    }
    setCategoryLoading(true);
    try {
      if (appUser) {
        await addCategoryFirestore(
          appUser.companyId,
          categoryName.trim(),
          categoryType,
          categoryAccountId
        );
      }
      addCategory(categoryName.trim(), categoryType, categoryAccountId);
      setCategoryName("");
      toast.success("Kategori berhasil ditambahkan.");
      setIsCategoryDrawerOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal menambah kategori."
      );
    } finally {
      setCategoryLoading(false);
    }
  };

  const openDeleteConfirmation = (type: "category" | "cash" | "customer" | "supplier", id: string) => {
    setDeleteType(type);
    setDeleteTargetId(id);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetId || !deleteType) return;
    setDeleteLoading(true);
    try {
      if (deleteType === "category") {
        if (appUser) {
          await deleteCategoryFirestore(appUser.companyId, deleteTargetId);
        } else {
          deleteCategory(deleteTargetId);
        }
        toast.success("Kategori berhasil dihapus.");
      } else if (deleteType === "cash") {
        if (appUser) {
          await deleteCashAccountFirestore(appUser.companyId, deleteTargetId);
        } else {
          deleteCashAccount(deleteTargetId);
        }
        toast.success("Rekening Kas/Bank berhasil dihapus.");
      } else if (deleteType === "customer") {
        if (appUser) {
          await softDeleteCustomerFirestore(appUser.companyId, deleteTargetId);
        } else {
          softDeleteCustomer(deleteTargetId);
        }
        toast.success("Pelanggan berhasil dinonaktifkan.");
      } else if (deleteType === "supplier") {
        if (appUser) {
          await softDeleteSupplierFirestore(appUser.companyId, deleteTargetId);
        } else {
          softDeleteSupplier(deleteTargetId);
        }
        toast.success("Pemasok berhasil dinonaktifkan.");
      }
      setDeleteModalOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal menghapus entitas."
      );
    } finally {
      setDeleteLoading(false);
      setDeleteType(null);
      setDeleteTargetId(null);
    }
  };

  const handleAddCashAccount = async (event: FormEvent) => {
    event.preventDefault();
    if (!cashName.trim() || !cashLinkedAccountId) {
      toast.error("Nama akun dan akun COA wajib diisi.");
      return;
    }
    setCashLoading(true);
    try {
      if (appUser) {
        await addCashAccountFirestore(
          appUser.companyId,
          cashName.trim(),
          cashType,
          cashLinkedAccountId
        );
      }
      addCashAccount(cashName.trim(), cashType, cashLinkedAccountId);
      setCashName("");
      toast.success("Dompet/Bank berhasil ditambahkan.");
      setIsCashDrawerOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal menambah cash account."
      );
    } finally {
      setCashLoading(false);
    }
  };

  const handleAddContact = async (event: FormEvent) => {
    event.preventDefault();
    if (!contactName.trim()) {
      toast.error("Nama kontak wajib diisi.");
      return;
    }
    setContactLoading(true);
    try {
      if (contactType === "customer") {
        if (appUser) {
          await addCustomerFirestore(appUser.companyId, contactName.trim());
        } else {
          addCustomer(contactName.trim());
        }
        toast.success(`Pelanggan ${contactName.trim()} berhasil ditambahkan.`);
      } else {
        if (appUser) {
          await addSupplierFirestore(appUser.companyId, contactName.trim());
        } else {
          addSupplier(contactName.trim());
        }
        toast.success(`Pemasok ${contactName.trim()} berhasil ditambahkan.`);
      }
      setContactName("");
      setContactEmail("");
      setContactPhone("");
      setIsContactDrawerOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal menambah kontak."
      );
    } finally {
      setContactLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header Page */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <Badge tone="yellow">Config & Entities</Badge>
          <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl text-foreground">
            Master Data & Pengaturan
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Kelola klasifikasi kategori, akun kas/bank, hingga database pelanggan dan supplier bisnis.
          </p>
        </div>

        {/* Dynamic Add Trigger depending on Active Tab */}
        {activeTab === "categories" && (
          <Button
            onClick={() => {
              setIsCategoryDrawerOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs gap-1.5 h-9 self-start sm:self-auto"
          >
            <PlusCircle className="h-4 w-4" /> Tambah Kategori
          </Button>
        )}
        {activeTab === "cash_accounts" && (
          <Button
            onClick={() => {
              setIsCashDrawerOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs gap-1.5 h-9 self-start sm:self-auto"
          >
            <PlusCircle className="h-4 w-4" /> Tambah Dompet/Bank
          </Button>
        )}
        {activeTab === "contacts" && (
          <Button
            onClick={() => {
              setIsContactDrawerOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs gap-1.5 h-9 self-start sm:self-auto"
          >
            <PlusCircle className="h-4 w-4" /> Tambah Kontak Baru
          </Button>
        )}
      </div>

      {/* Tabs Navigation (Pills format) */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 gap-6">
        <button
          onClick={() => setActiveTab("categories")}
          className={cn(
            "pb-3.5 text-xs font-semibold uppercase tracking-wider transition relative",
            activeTab === "categories"
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span className="flex items-center gap-2">
            <FolderTree className="h-4 w-4" /> Kategori Transaksi
          </span>
        </button>
        <button
          onClick={() => setActiveTab("cash_accounts")}
          className={cn(
            "pb-3.5 text-xs font-semibold uppercase tracking-wider transition relative",
            activeTab === "cash_accounts"
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span className="flex items-center gap-2">
            <Landmark className="h-4 w-4" /> Rekening Kas / Bank
          </span>
        </button>
        <button
          onClick={() => setActiveTab("contacts")}
          className={cn(
            "pb-3.5 text-xs font-semibold uppercase tracking-wider transition relative",
            activeTab === "contacts"
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span className="flex items-center gap-2">
            <Users className="h-4 w-4" /> Database Kontak
          </span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="space-y-6">
        {activeTab === "categories" && (
          <Card className="border-zinc-200/60 dark:border-zinc-800/50 shadow-sm overflow-hidden">
            {categories.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Kategori</TableHead>
                    <TableHead>Jenis Aliran</TableHead>
                    <TableHead>Terhubung ke Kode Akun (COA)</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category) => {
                    const mappedAccount = getAccount(accounts, category.accountId);
                    return (
                      <TableRow key={category.id}>
                        <TableCell className="font-semibold text-zinc-955 dark:text-white">
                          {category.name}
                        </TableCell>
                        <TableCell>
                          {category.type === "income" ? (
                            <Badge tone="green">Pemasukan (Income)</Badge>
                          ) : (
                            <Badge tone="red">Pengeluaran (Expense)</Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-zinc-550 text-xs">
                          {mappedAccount ? `${mappedAccount.code} — ${mappedAccount.name}` : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <button
                            onClick={() => openDeleteConfirmation("category", category.id)}
                            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/20 text-rose-600 rounded-lg transition"
                            title="Hapus Kategori"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <EmptyState
                title="Kategori kosong"
                description="Buat kategori transaksi baru untuk memetakan pos pengeluaran dan pendapatan Anda."
              />
            )}
          </Card>
        )}

        {activeTab === "cash_accounts" && (
          <Card className="border-zinc-200/60 dark:border-zinc-800/50 shadow-sm overflow-hidden">
            {cashAccounts.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Dompet / Bank</TableHead>
                    <TableHead>Tipe Dompet</TableHead>
                    <TableHead>Terhubung ke Akun COA</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cashAccounts.map((cashAccount) => {
                    const mappedAccount = getAccount(accounts, cashAccount.accountId);
                    return (
                      <TableRow key={cashAccount.id}>
                        <TableCell className="font-semibold text-zinc-955 dark:text-white">
                          {cashAccount.name}
                        </TableCell>
                        <TableCell>
                          <span className="capitalize font-semibold text-xs">{cashAccount.type}</span>
                        </TableCell>
                        <TableCell className="font-mono text-zinc-550 text-xs">
                          {mappedAccount ? `${mappedAccount.code} — ${mappedAccount.name}` : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <button
                            onClick={() => openDeleteConfirmation("cash", cashAccount.id)}
                            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/20 text-rose-600 rounded-lg transition"
                            title="Hapus Dompet/Bank"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <EmptyState
                title="Dompet Kas kosong"
                description="Daftarkan rekening bank atau kas fisik toko Anda untuk memulai pelacakan dana."
              />
            )}
          </Card>
        )}

        {activeTab === "contacts" && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Pelanggan Card */}
            <Card className="border-zinc-200/60 dark:border-zinc-800/50 shadow-sm">
              <CardHeader className="border-b pb-4 mb-2">
                <CardTitle className="flex items-center gap-2 text-xs">
                  <User className="h-4 w-4 text-emerald-500" /> Daftar Pelanggan (Customers)
                </CardTitle>
                <CardDescription>Entitas relasi pemasukan dana bisnis Anda.</CardDescription>
              </CardHeader>
              <CardContent className="px-0 py-0">
                {customers.length ? (
                  <div className="max-h-96 overflow-y-auto scrollbar-thin">
                    <Table>
                      <TableHeader className="bg-transparent">
                        <TableRow>
                          <TableHead>Nama Pelanggan</TableHead>
                          <TableHead className="text-right">Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customers.map((customer) => (
                          <TableRow key={customer.id} className={customer.deletedAt ? "opacity-55" : ""}>
                            <TableCell className="font-semibold text-zinc-955 dark:text-white py-3">
                              {customer.name}
                            </TableCell>
                            <TableCell className="text-right py-3 pr-6">
                              {customer.deletedAt ? (
                                <Badge tone="red">Deleted</Badge>
                              ) : (
                                <button
                                  onClick={() => openDeleteConfirmation("customer", customer.id)}
                                  className="p-1 text-muted-foreground hover:text-rose-650 transition rounded-lg"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="p-6">
                    <EmptyState
                      title="Pelanggan kosong"
                      description="Tambahkan relasi pelanggan untuk tracking penjualan detail."
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pemasok Card */}
            <Card className="border-zinc-200/60 dark:border-zinc-800/50 shadow-sm">
              <CardHeader className="border-b pb-4 mb-2">
                <CardTitle className="flex items-center gap-2 text-xs">
                  <User className="h-4 w-4 text-rose-500" /> Daftar Pemasok (Suppliers)
                </CardTitle>
                <CardDescription>Entitas relasi pengeluaran beban belanja.</CardDescription>
              </CardHeader>
              <CardContent className="px-0 py-0">
                {suppliers.length ? (
                  <div className="max-h-96 overflow-y-auto scrollbar-thin">
                    <Table>
                      <TableHeader className="bg-transparent">
                        <TableRow>
                          <TableHead>Nama Pemasok</TableHead>
                          <TableHead className="text-right">Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {suppliers.map((supplier) => (
                          <TableRow key={supplier.id} className={supplier.deletedAt ? "opacity-55" : ""}>
                            <TableCell className="font-semibold text-zinc-955 dark:text-white py-3">
                              {supplier.name}
                            </TableCell>
                            <TableCell className="text-right py-3 pr-6">
                              {supplier.deletedAt ? (
                                <Badge tone="red">Deleted</Badge>
                              ) : (
                                <button
                                  onClick={() => openDeleteConfirmation("supplier", supplier.id)}
                                  className="p-1 text-muted-foreground hover:text-rose-650 transition rounded-lg"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="p-6">
                    <EmptyState
                      title="Pemasok kosong"
                      description="Tambahkan relasi supplier untuk pencatatan procurement belanja barang."
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Category Add Drawer */}
      <Drawer
        open={isCategoryDrawerOpen}
        onClose={() => setIsCategoryDrawerOpen(false)}
        title="Tambah Kategori Baru"
        description="Buat klasifikasi transaksi untuk pemetaan jurnal ledger yang tepat."
      >
        <form onSubmit={handleAddCategory} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="catName">Nama Kategori</Label>
            <Input
              id="catName"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="Contoh: Belanja Bahan Baku"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="catType">Tipe Aliran Dana</Label>
            <Select
              id="catType"
              value={categoryType}
              onChange={(e) => setCategoryType(e.target.value as any)}
            >
              <option value="income">Income (Pemasukan)</option>
              <option value="expense">Expense (Pengeluaran)</option>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="catAcc">Hubungkan ke Akun COA</Label>
            <Select
              id="catAcc"
              value={categoryAccountId}
              onChange={(e) => setCategoryAccountId(e.target.value)}
            >
              <option value="">-- Pilih Rekening Akun --</option>
              {categoryAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  [{account.code}] {account.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex gap-2 pt-4 border-t mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCategoryDrawerOpen(false)}
              className="flex-1 text-xs font-semibold h-9"
            >
              Batal
            </Button>
            <Button
              type="submit"
              loading={categoryLoading}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs h-9"
            >
              Tambah Kategori
            </Button>
          </div>
        </form>
      </Drawer>

      {/* Cash Account Add Drawer */}
      <Drawer
        open={isCashDrawerOpen}
        onClose={() => setIsCashDrawerOpen(false)}
        title="Daftarkan Rekening Kas/Bank"
        description="Hubungkan entitas dompet fisik, rekening bank, atau e-wallet ke Chart of Accounts."
      >
        <form onSubmit={handleAddCashAccount} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="cName">Nama Dompet / Bank</Label>
            <Input
              id="cName"
              value={cashName}
              onChange={(e) => setCashName(e.target.value)}
              placeholder="Contoh: Mandiri Operasional"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cType">Tipe Kas</Label>
            <Select
              id="cType"
              value={cashType}
              onChange={(e) => setCashType(e.target.value as any)}
            >
              <option value="cash">Cash (Uang Fisik)</option>
              <option value="bank">Bank Transfer</option>
              <option value="ewallet">E-Wallet (OVO/GoPay/dll)</option>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="cAcc">Hubungkan ke Akun COA</Label>
            <Select
              id="cAcc"
              value={cashLinkedAccountId}
              onChange={(e) => setCashLinkedAccountId(e.target.value)}
            >
              <option value="">-- Pilih Rekening Akun --</option>
              {cashableAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  [{account.code}] {account.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex gap-2 pt-4 border-t mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCashDrawerOpen(false)}
              className="flex-1 text-xs font-semibold h-9"
            >
              Batal
            </Button>
            <Button
              type="submit"
              loading={cashLoading}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs h-9"
            >
              Daftarkan Kas
            </Button>
          </div>
        </form>
      </Drawer>

      {/* Contact Add Drawer */}
      <Drawer
        open={isContactDrawerOpen}
        onClose={() => setIsContactDrawerOpen(false)}
        title="Tambah Relasi Kontak Baru"
        description="Daftarkan pelanggan atau pemasok bisnis ke dalam database relasi."
      >
        <form onSubmit={handleAddContact} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="ctType">Tipe Kontak</Label>
            <Select
              id="ctType"
              value={contactType}
              onChange={(e) => setContactType(e.target.value as any)}
            >
              <option value="customer">Pelanggan (Customer)</option>
              <option value="supplier">Pemasok / Vendor (Supplier)</option>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ctName">Nama Kontak</Label>
            <Input
              id="ctName"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Contoh: PT Harapan Jaya"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ctEmail">Alamat Email (Opsional)</Label>
            <Input
              id="ctEmail"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="vendor@mail.com"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ctPhone">No Telepon (Opsional)</Label>
            <Input
              id="ctPhone"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="0812xxxxxxxx"
            />
          </div>

          <div className="flex gap-2 pt-4 border-t mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsContactDrawerOpen(false)}
              className="flex-1 text-xs font-semibold h-9"
            >
              Batal
            </Button>
            <Button
              type="submit"
              loading={contactLoading}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs h-9"
            >
              Simpan Kontak
            </Button>
          </div>
        </form>
      </Drawer>

      {/* Centered Confirm Modal for Delete Actions */}
      <ConfirmModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        loading={deleteLoading}
        title={`Konfirmasi Hapus ${
          deleteType === "category"
            ? "Kategori"
            : deleteType === "cash"
            ? "Rekening Kas"
            : deleteType === "customer"
            ? "Pelanggan"
            : "Pemasok"
        }`}
        description={`Apakah Anda yakin ingin menghapus data ini dari sistem? Penghapusan data master dapat memengaruhi pencatatan transaksi yang bergantung pada entitas ini.`}
      />
    </div>
  );
}
