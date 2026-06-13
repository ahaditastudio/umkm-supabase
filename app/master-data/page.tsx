"use client";

import { Loader2, Trash2, PlusCircle, Pencil, User, Users, FolderTree, Landmark, Wallet, Smartphone } from "lucide-react";
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
  updateCategoryFirestore,
  updateCashAccountFirestore,
  updateCustomerFirestore,
  updateSupplierFirestore,
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
  const updateCategory = useKasFlowStore((state) => state.updateCategory);
  const addCashAccount = useKasFlowStore((state) => state.addCashAccount);
  const deleteCashAccount = useKasFlowStore((state) => state.deleteCashAccount);
  const updateCashAccount = useKasFlowStore((state) => state.updateCashAccount);
  const updateCustomer = useKasFlowStore((state) => state.updateCustomer);
  const updateSupplier = useKasFlowStore((state) => state.updateSupplier);

  // Active Tab State
  const [activeTab, setActiveTab] = useState<TabType>("categories");

  // Drawer States
  const [isCategoryDrawerOpen, setIsCategoryDrawerOpen] = useState(false);
  const [isCashDrawerOpen, setIsCashDrawerOpen] = useState(false);
  const [isContactDrawerOpen, setIsContactDrawerOpen] = useState(false);

  // Drawer states: null = create mode, string = edit mode (entity id)
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCashAccountId, setEditingCashAccountId] = useState<string | null>(null);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);

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

  // Helper: open category drawer in edit mode
  const openEditCategory = (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId);
    if (!category) return;
    setCategoryName(category.name);
    setCategoryType(category.type);
    setCategoryAccountId(category.accountId);
    setEditingCategoryId(categoryId);
    setIsCategoryDrawerOpen(true);
  };

  const openEditCashAccount = (cashAccountId: string) => {
    const ca = cashAccounts.find((c) => c.id === cashAccountId);
    if (!ca) return;
    setCashName(ca.name);
    setCashType(ca.type);
    setCashLinkedAccountId(ca.accountId);
    setEditingCashAccountId(cashAccountId);
    setIsCashDrawerOpen(true);
  };

  const openEditContact = (contactId: string, type: "customer" | "supplier") => {
    const entity = type === "customer"
      ? customers.find((c) => c.id === contactId)
      : suppliers.find((s) => s.id === contactId);
    if (!entity) return;
    setContactType(type);
    setContactName(entity.name);
    setContactEmail(entity.email ?? "");
    setContactPhone(entity.phone ?? "");
    setEditingContactId(contactId);
    setIsContactDrawerOpen(true);
  };

  const handleAddCategory = async (event: FormEvent) => {
    event.preventDefault();
    if (!categoryName.trim() || !categoryAccountId) {
      toast.error("Nama kategori dan akun COA wajib diisi.");
      return;
    }
    setCategoryLoading(true);
    try {
      if (editingCategoryId) {
        // Edit mode
        if (appUser) {
          await updateCategoryFirestore(appUser.companyId, editingCategoryId, {
            name: categoryName.trim(),
            type: categoryType,
            accountId: categoryAccountId,
          });
        }
        updateCategory(editingCategoryId, {
          name: categoryName.trim(),
          type: categoryType,
          accountId: categoryAccountId,
        });
        toast.success("Kategori berhasil diperbarui.");
        setEditingCategoryId(null);
      } else {
        // Create mode
        if (appUser) {
          await addCategoryFirestore(
            appUser.companyId,
            categoryName.trim(),
            categoryType,
            categoryAccountId
          );
        }
        addCategory(categoryName.trim(), categoryType, categoryAccountId);
        toast.success("Kategori berhasil ditambahkan.");
      }
      setCategoryName("");
      setIsCategoryDrawerOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal menyimpan kategori."
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
      if (editingCashAccountId) {
        // Edit mode
        if (appUser) {
          await updateCashAccountFirestore(appUser.companyId, editingCashAccountId, {
            name: cashName.trim(),
            type: cashType,
            accountId: cashLinkedAccountId,
          });
        }
        updateCashAccount(editingCashAccountId, {
          name: cashName.trim(),
          type: cashType,
          accountId: cashLinkedAccountId,
        });
        toast.success("Dompet/Bank berhasil diperbarui.");
        setEditingCashAccountId(null);
      } else {
        // Create mode
        if (appUser) {
          await addCashAccountFirestore(
            appUser.companyId,
            cashName.trim(),
            cashType,
            cashLinkedAccountId
          );
        }
        addCashAccount(cashName.trim(), cashType, cashLinkedAccountId);
        toast.success("Dompet/Bank berhasil ditambahkan.");
      }
      setCashName("");
      setIsCashDrawerOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal menyimpan cash account."
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
      if (editingContactId) {
        // Edit mode
        const updateData = {
          name: contactName.trim(),
          email: contactEmail.trim() || undefined,
          phone: contactPhone.trim() || undefined,
        };
        if (contactType === "customer") {
          if (appUser) {
            await updateCustomerFirestore(appUser.companyId, editingContactId, updateData);
          }
          updateCustomer(editingContactId, updateData);
          toast.success(`Pelanggan ${contactName.trim()} berhasil diperbarui.`);
        } else {
          if (appUser) {
            await updateSupplierFirestore(appUser.companyId, editingContactId, updateData);
          }
          updateSupplier(editingContactId, updateData);
          toast.success(`Pemasok ${contactName.trim()} berhasil diperbarui.`);
        }
        setEditingContactId(null);
      } else {
        // Create mode
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
      }
      setContactName("");
      setContactEmail("");
      setContactPhone("");
      setIsContactDrawerOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal menyimpan kontak."
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
          <h2 className="mt-3 text-xl font-bold tracking-tight sm:text-2xl lg:text-3xl text-foreground">
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
              setEditingCategoryId(null);
              setCategoryName("");
              setCategoryType("income");
              setCategoryAccountId("");
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
              setEditingCashAccountId(null);
              setCashName("");
              setCashType("cash");
              setCashLinkedAccountId("");
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
              setEditingContactId(null);
              setContactType("customer");
              setContactName("");
              setContactEmail("");
              setContactPhone("");
              setIsContactDrawerOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs gap-1.5 h-9 self-start sm:self-auto"
          >
            <PlusCircle className="h-4 w-4" /> Tambah Kontak Baru
          </Button>
        )}
      </div>

      {/* Tabs Navigation (Pills format) */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 pb-1 lg:mx-0 lg:px-0 lg:border-b lg:border-zinc-200 lg:dark:border-zinc-800 lg:gap-6">
        <button
          onClick={() => setActiveTab("categories")}
          className={cn(
            "shrink-0 px-3.5 py-2 text-xs font-semibold tracking-wider transition rounded-full lg:rounded-none lg:pb-3.5 lg:px-0 lg:uppercase",
            activeTab === "categories"
              ? "bg-emerald-500 text-white lg:bg-transparent lg:text-primary lg:border-b-2 lg:border-primary"
              : "text-muted-foreground hover:text-foreground bg-zinc-100 dark:bg-zinc-800 lg:bg-transparent"
          )}
        >
          <span className="flex items-center gap-2">
            <FolderTree className="h-4 w-4" /> <span className="lg:hidden">Kategori</span><span className="hidden lg:inline">Kategori Transaksi</span>
          </span>
        </button>
        <button
          onClick={() => setActiveTab("cash_accounts")}
          className={cn(
            "shrink-0 px-3.5 py-2 text-xs font-semibold tracking-wider transition rounded-full lg:rounded-none lg:pb-3.5 lg:px-0 lg:uppercase",
            activeTab === "cash_accounts"
              ? "bg-emerald-500 text-white lg:bg-transparent lg:text-primary lg:border-b-2 lg:border-primary"
              : "text-muted-foreground hover:text-foreground bg-zinc-100 dark:bg-zinc-800 lg:bg-transparent"
          )}
        >
          <span className="flex items-center gap-2">
            <Landmark className="h-4 w-4" /> <span className="lg:hidden">Kas / Bank</span><span className="hidden lg:inline">Rekening Kas / Bank</span>
          </span>
        </button>
        <button
          onClick={() => setActiveTab("contacts")}
          className={cn(
            "shrink-0 px-3.5 py-2 text-xs font-semibold tracking-wider transition rounded-full lg:rounded-none lg:pb-3.5 lg:px-0 lg:uppercase",
            activeTab === "contacts"
              ? "bg-emerald-500 text-white lg:bg-transparent lg:text-primary lg:border-b-2 lg:border-primary"
              : "text-muted-foreground hover:text-foreground bg-zinc-100 dark:bg-zinc-800 lg:bg-transparent"
          )}
        >
          <span className="flex items-center gap-2">
            <Users className="h-4 w-4" /> <span className="lg:hidden">Kontak</span><span className="hidden lg:inline">Database Kontak</span>
          </span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="space-y-6">
        {activeTab === "categories" && (
          <>
            {/* Mobile: iOS-style list rows */}
            <div className="lg:hidden rounded-2xl border border-zinc-200/60 dark:border-zinc-800/50 bg-card shadow-sm divide-y divide-zinc-100 dark:divide-zinc-800/50">
              {categories.length ? (
                categories.map((category) => {
                  const mappedAccount = getAccount(accounts, category.accountId);
                  return (
                    <div key={category.id} className="group flex items-center justify-between px-4 py-3 transition hover:bg-zinc-50/50 dark:hover:bg-zinc-800/10">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn(
                          "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                          category.type === "income" ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400"
                        )}>
                          <FolderTree className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate">{category.name}</p>
                          {category.type === "income" ? (
                            <Badge tone="green">Pemasukan</Badge>
                          ) : (
                            <Badge tone="red">Pengeluaran</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button onClick={() => openEditCategory(category.id)} className="p-2 hover:bg-blue-50 dark:hover:bg-blue-950/20 text-blue-600 rounded-lg transition" title="Edit Kategori">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => openDeleteConfirmation("category", category.id)} className="p-2 hover:bg-red-50 dark:hover:bg-red-950/20 text-rose-600 rounded-lg transition" title="Hapus Kategori">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-6">
                  <EmptyState title="Kategori kosong" description="Buat kategori transaksi baru untuk memetakan pos pengeluaran dan pendapatan Anda." />
                </div>
              )}
            </div>
            {/* Desktop: card grid */}
            <div className="hidden lg:grid lg:grid-cols-3 lg:gap-4">
              {categories.length ? (
                categories.map((category) => {
                  const mappedAccount = getAccount(accounts, category.accountId);
                  return (
                    <Card key={category.id} className="group relative border-zinc-200/60 dark:border-zinc-800/50 shadow-sm overflow-hidden p-4 hover:shadow-md transition duration-200 flex flex-col justify-between min-h-[120px]">
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "p-2 rounded-lg shrink-0",
                              category.type === "income" ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400"
                            )}>
                              <FolderTree className="h-4 w-4" />
                            </div>
                            <p className="font-semibold text-sm text-zinc-800 dark:text-zinc-200">
                              {category.name}
                            </p>
                          </div>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center pr-1 gap-0.5">
                            <button onClick={() => openEditCategory(category.id)} className="p-1 hover:bg-blue-50 dark:hover:bg-blue-950/20 text-blue-600 rounded-md transition" title="Edit Kategori">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => openDeleteConfirmation("category", category.id)} className="p-1 hover:bg-red-50 dark:hover:bg-red-950/20 text-rose-600 rounded-md transition" title="Hapus Kategori">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1.5 text-xs">
                          <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
                            <span className="text-[10px] uppercase font-bold tracking-wider">Aliran:</span>
                            {category.type === "income" ? (
                              <Badge tone="green">Pemasukan</Badge>
                            ) : (
                              <Badge tone="red">Pengeluaran</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/50 text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                        <span className="font-semibold">COA:</span>
                        <span className="truncate">{mappedAccount ? `${mappedAccount.code} — ${mappedAccount.name}` : "-"}</span>
                      </div>
                    </Card>
                  );
                })
              ) : (
                <div className="col-span-full">
                  <EmptyState title="Kategori kosong" description="Buat kategori transaksi baru untuk memetakan pos pengeluaran dan pendapatan Anda." />
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === "cash_accounts" && (
          <>
            {/* Mobile: iOS-style list rows */}
            <div className="lg:hidden rounded-2xl border border-zinc-200/60 dark:border-zinc-800/50 bg-card shadow-sm divide-y divide-zinc-100 dark:divide-zinc-800/50">
              {cashAccounts.length ? (
                cashAccounts.map((cashAccount) => {
                  const typeInfo = {
                    cash: { icon: Wallet, bg: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
                    bank: { icon: Landmark, bg: "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400" },
                    ewallet: { icon: Smartphone, bg: "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400" },
                  }[cashAccount.type] || { icon: Landmark, bg: "bg-zinc-50 dark:bg-zinc-800/50 text-zinc-650" };
                  const TypeIcon = typeInfo.icon;
                  return (
                    <div key={cashAccount.id} className="group flex items-center justify-between px-4 py-3 transition hover:bg-zinc-50/50 dark:hover:bg-zinc-800/10">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn("h-10 w-10 rounded-full flex items-center justify-center shrink-0", typeInfo.bg)}>
                          <TypeIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate">{cashAccount.name}</p>
                          <span className="text-xs capitalize text-muted-foreground font-medium">
                            {cashAccount.type === "cash" ? "Kas Fisik" : cashAccount.type === "bank" ? "Transfer Bank" : "E-Wallet"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button onClick={() => openEditCashAccount(cashAccount.id)} className="p-2 hover:bg-blue-50 dark:hover:bg-blue-950/20 text-blue-600 rounded-lg transition" title="Edit">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => openDeleteConfirmation("cash", cashAccount.id)} className="p-2 hover:bg-red-50 dark:hover:bg-red-950/20 text-rose-600 rounded-lg transition" title="Hapus">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-6">
                  <EmptyState title="Dompet Kas kosong" description="Daftarkan rekening bank atau kas fisik toko Anda untuk memulai pelacakan dana." />
                </div>
              )}
            </div>
            {/* Desktop: card grid */}
            <div className="hidden lg:grid lg:grid-cols-3 lg:gap-4">
              {cashAccounts.length ? (
                cashAccounts.map((cashAccount) => {
                  const mappedAccount = getAccount(accounts, cashAccount.accountId);
                  const typeInfo = {
                    cash: { icon: Wallet, bg: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
                    bank: { icon: Landmark, bg: "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400" },
                    ewallet: { icon: Smartphone, bg: "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400" },
                  }[cashAccount.type] || { icon: Landmark, bg: "bg-zinc-50 dark:bg-zinc-800/50 text-zinc-650" };
                  const TypeIcon = typeInfo.icon;
                  return (
                    <Card key={cashAccount.id} className="group relative border-zinc-200/60 dark:border-zinc-800/50 shadow-sm overflow-hidden p-4 hover:shadow-md transition duration-200 flex flex-col justify-between min-h-[120px]">
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className={cn("p-2 rounded-lg shrink-0", typeInfo.bg)}>
                              <TypeIcon className="h-4 w-4" />
                            </div>
                            <p className="font-semibold text-sm text-zinc-800 dark:text-zinc-200">{cashAccount.name}</p>
                          </div>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center pr-1 gap-0.5">
                            <button onClick={() => openEditCashAccount(cashAccount.id)} className="p-1 hover:bg-blue-50 dark:hover:bg-blue-950/20 text-blue-600 rounded-md transition" title="Edit Dompet/Bank">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => openDeleteConfirmation("cash", cashAccount.id)} className="p-1 hover:bg-red-50 dark:hover:bg-red-950/20 text-rose-600 rounded-md transition" title="Hapus Dompet/Bank">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1.5 text-xs">
                          <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
                            <span className="text-[10px] uppercase font-bold tracking-wider">Tipe:</span>
                            <span className="capitalize font-semibold text-zinc-750 dark:text-zinc-350 text-xs">
                              {cashAccount.type === "cash" ? "Kas Fisik" : cashAccount.type === "bank" ? "Transfer Bank" : "E-Wallet"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/50 text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                        <span className="font-semibold">COA:</span>
                        <span className="truncate">{mappedAccount ? `${mappedAccount.code} — ${mappedAccount.name}` : "-"}</span>
                      </div>
                    </Card>
                  );
                })
              ) : (
                <div className="col-span-full">
                  <EmptyState title="Dompet Kas kosong" description="Daftarkan rekening bank atau kas fisik toko Anda untuk memulai pelacakan dana." />
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === "contacts" && (
          <>
            {/* Mobile: stacked sections */}
            <div className="lg:hidden space-y-5">
              {/* Pelanggan Section */}
              <div>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <User className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Pelanggan</span>
                </div>
                <div className="rounded-2xl border border-zinc-200/60 dark:border-zinc-800/50 bg-card shadow-sm divide-y divide-zinc-100 dark:divide-zinc-800/50">
                  {customers.length ? (
                    customers.map((customer) => {
                      const isDeleted = customer.deletedAt != null;
                      const initial = customer.name ? customer.name.trim().charAt(0).toUpperCase() : "?";
                      return (
                        <div key={customer.id} className={cn("group flex items-center justify-between px-4 py-3 transition hover:bg-zinc-50/50 dark:hover:bg-zinc-800/10", isDeleted && "opacity-45")}>
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-10 w-10 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-sm flex items-center justify-center shrink-0">
                              {initial}
                            </div>
                            <p className={cn("text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate", isDeleted && "line-through text-muted-foreground")}>
                              {customer.name}
                            </p>
                          </div>
                          {isDeleted ? (
                            <Badge tone="red">Dihapus</Badge>
                          ) : (
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button onClick={() => openEditContact(customer.id, "customer")} className="p-2 hover:bg-blue-50 dark:hover:bg-blue-950/20 text-blue-600 rounded-lg transition" title="Edit Pelanggan">
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button onClick={() => openDeleteConfirmation("customer", customer.id)} className="p-2 hover:bg-red-50 dark:hover:bg-red-950/20 text-rose-600 rounded-lg transition" title="Hapus Pelanggan">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-6">
                      <EmptyState title="Pelanggan kosong" description="Tambahkan relasi pelanggan untuk tracking penjualan detail." />
                    </div>
                  )}
                </div>
              </div>

              {/* Pemasok Section */}
              <div>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <User className="h-3.5 w-3.5 text-rose-500" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Pemasok</span>
                </div>
                <div className="rounded-2xl border border-zinc-200/60 dark:border-zinc-800/50 bg-card shadow-sm divide-y divide-zinc-100 dark:divide-zinc-800/50">
                  {suppliers.length ? (
                    suppliers.map((supplier) => {
                      const isDeleted = supplier.deletedAt != null;
                      const initial = supplier.name ? supplier.name.trim().charAt(0).toUpperCase() : "?";
                      return (
                        <div key={supplier.id} className={cn("group flex items-center justify-between px-4 py-3 transition hover:bg-zinc-50/50 dark:hover:bg-zinc-800/10", isDeleted && "opacity-45")}>
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-10 w-10 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold text-sm flex items-center justify-center shrink-0">
                              {initial}
                            </div>
                            <p className={cn("text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate", isDeleted && "line-through text-muted-foreground")}>
                              {supplier.name}
                            </p>
                          </div>
                          {isDeleted ? (
                            <Badge tone="red">Dihapus</Badge>
                          ) : (
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button onClick={() => openEditContact(supplier.id, "supplier")} className="p-2 hover:bg-blue-50 dark:hover:bg-blue-950/20 text-blue-600 rounded-lg transition" title="Edit Pemasok">
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button onClick={() => openDeleteConfirmation("supplier", supplier.id)} className="p-2 hover:bg-red-50 dark:hover:bg-red-950/20 text-rose-600 rounded-lg transition" title="Hapus Pemasok">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-6">
                      <EmptyState title="Pemasok kosong" description="Tambahkan relasi supplier untuk pencatatan procurement belanja barang." />
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* Desktop: side-by-side cards */}
            <div className="hidden lg:grid lg:grid-cols-2 lg:gap-6">
              {/* Pelanggan Card */}
              <Card className="border-zinc-200/60 dark:border-zinc-800/50 shadow-sm overflow-hidden">
                <CardHeader className="border-b border-zinc-100 dark:border-zinc-800/50 pb-4 mb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-emerald-500" /> Daftar Pelanggan (Customers)
                  </CardTitle>
                  <CardDescription>Entitas relasi pemasukan dana bisnis Anda.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {customers.length ? (
                    <div className="max-h-[420px] overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/50 scrollbar-thin">
                      {customers.map((customer) => {
                        const isDeleted = customer.deletedAt != null;
                        const initial = customer.name ? customer.name.trim().charAt(0).toUpperCase() : "?";
                        return (
                          <div key={customer.id} className={cn("group flex items-center justify-between p-3.5 transition duration-150 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/10", isDeleted && "opacity-45")}>
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="h-8 w-8 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0">
                                {initial}
                              </div>
                              <div className="min-w-0">
                                <p className={cn("text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate", isDeleted && "line-through text-muted-foreground")}>
                                  {customer.name}
                                </p>
                                <span className="text-[10px] text-muted-foreground">ID: {customer.id}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {isDeleted ? (
                                <Badge tone="red">Deleted</Badge>
                              ) : (
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pr-1 flex items-center gap-0.5">
                                  <button onClick={() => openEditContact(customer.id, "customer")} className="p-1 hover:bg-blue-50 dark:hover:bg-blue-950/20 text-blue-600 rounded-md transition" title="Edit Pelanggan">
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button onClick={() => openDeleteConfirmation("customer", customer.id)} className="p-1 hover:bg-red-50 dark:hover:bg-red-950/20 text-rose-600 rounded-md transition" title="Hapus Pelanggan">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-6">
                      <EmptyState title="Pelanggan kosong" description="Tambahkan relasi pelanggan untuk tracking penjualan detail." />
                    </div>
                  )}
                </CardContent>
              </Card>
              {/* Pemasok Card */}
              <Card className="border-zinc-200/60 dark:border-zinc-800/50 shadow-sm overflow-hidden">
                <CardHeader className="border-b border-zinc-100 dark:border-zinc-800/50 pb-4 mb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-rose-500" /> Daftar Pemasok (Suppliers)
                  </CardTitle>
                  <CardDescription>Entitas relasi pengeluaran beban belanja.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {suppliers.length ? (
                    <div className="max-h-[420px] overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/50 scrollbar-thin">
                      {suppliers.map((supplier) => {
                        const isDeleted = supplier.deletedAt != null;
                        const initial = supplier.name ? supplier.name.trim().charAt(0).toUpperCase() : "?";
                        return (
                          <div key={supplier.id} className={cn("group flex items-center justify-between p-3.5 transition duration-150 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/10", isDeleted && "opacity-45")}>
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="h-8 w-8 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center justify-center shrink-0">
                                {initial}
                              </div>
                              <div className="min-w-0">
                                <p className={cn("text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate", isDeleted && "line-through text-muted-foreground")}>
                                  {supplier.name}
                                </p>
                                <span className="text-[10px] text-muted-foreground">ID: {supplier.id}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {isDeleted ? (
                                <Badge tone="red">Deleted</Badge>
                              ) : (
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pr-1 flex items-center gap-0.5">
                                  <button onClick={() => openEditContact(supplier.id, "supplier")} className="p-1 hover:bg-blue-50 dark:hover:bg-blue-950/20 text-blue-600 rounded-md transition" title="Edit Pemasok">
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button onClick={() => openDeleteConfirmation("supplier", supplier.id)} className="p-1 hover:bg-red-50 dark:hover:bg-red-950/20 text-rose-600 rounded-md transition" title="Hapus Pemasok">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-6">
                      <EmptyState title="Pemasok kosong" description="Tambahkan relasi supplier untuk pencatatan procurement belanja barang." />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>

      {/* Category Add/Edit Drawer */}
      <Drawer
        open={isCategoryDrawerOpen}
        onClose={() => { setIsCategoryDrawerOpen(false); setEditingCategoryId(null); }}
        title={editingCategoryId ? "Edit Kategori" : "Tambah Kategori Baru"}
        description={editingCategoryId ? "Perbarui informasi kategori transaksi." : "Buat klasifikasi transaksi untuk pemetaan jurnal ledger yang tepat."}
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
              onClick={() => { setIsCategoryDrawerOpen(false); setEditingCategoryId(null); }}
              className="flex-1 text-xs font-semibold h-9"
            >
              Batal
            </Button>
            <Button
              type="submit"
              loading={categoryLoading}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs h-9"
            >
              {editingCategoryId ? "Simpan Perubahan" : "Tambah Kategori"}
            </Button>
          </div>
        </form>
      </Drawer>

      {/* Cash Account Add/Edit Drawer */}
      <Drawer
        open={isCashDrawerOpen}
        onClose={() => { setIsCashDrawerOpen(false); setEditingCashAccountId(null); }}
        title={editingCashAccountId ? "Edit Rekening Kas/Bank" : "Daftarkan Rekening Kas/Bank"}
        description={editingCashAccountId ? "Perbarui informasi dompet atau rekening bank." : "Hubungkan entitas dompet fisik, rekening bank, atau e-wallet ke Chart of Accounts."}
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
              onClick={() => { setIsCashDrawerOpen(false); setEditingCashAccountId(null); }}
              className="flex-1 text-xs font-semibold h-9"
            >
              Batal
            </Button>
            <Button
              type="submit"
              loading={cashLoading}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs h-9"
            >
              {editingCashAccountId ? "Simpan Perubahan" : "Daftarkan Kas"}
            </Button>
          </div>
        </form>
      </Drawer>

      {/* Contact Add/Edit Drawer */}
      <Drawer
        open={isContactDrawerOpen}
        onClose={() => { setIsContactDrawerOpen(false); setEditingContactId(null); }}
        title={editingContactId ? "Edit Relasi Kontak" : "Tambah Relasi Kontak Baru"}
        description={editingContactId ? "Perbarui informasi pelanggan atau pemasok." : "Daftarkan pelanggan atau pemasok bisnis ke dalam database relasi."}
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
              onClick={() => { setIsContactDrawerOpen(false); setEditingContactId(null); }}
              className="flex-1 text-xs font-semibold h-9"
            >
              Batal
            </Button>
            <Button
              type="submit"
              loading={contactLoading}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs h-9"
            >
              {editingContactId ? "Simpan Perubahan" : "Simpan Kontak"}
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
