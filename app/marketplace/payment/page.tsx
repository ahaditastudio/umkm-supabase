"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth-provider";
import { useKasFlowStore } from "@/store/use-kasflow-store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmModal } from "@/components/ui/modal";
import { toast } from "@/lib/toast";
import {
  RefreshCw,
  DollarSign,
  FileText,
  AlertCircle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Check,
  X,
  Calendar,
  Filter,
  Settings,
  Store,
} from "lucide-react";

type Shop = {
  id: string;
  shop_name: string;
  display_name: string | null;
  status: string;
};

type Statement = {
  id: string;
  connectionId: string;
  shopName: string;
  platformStatementId: string;
  statementTime: string;
  currency: string;
  settlementAmount: number;
  revenueAmount: number;
  feeAmount: number;
  adjustmentAmount: number;
  netSalesAmount: number;
  paymentStatus: string;
  reconciled: boolean;
  orderCount: number;
  kasflowIncomeTxnId: string | null;
  kasflowExpenseTxnId: string | null;
  kasflowTransferTxnId: string | null;
  approvalStatus?: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
  rejectedReason?: string | null;
};

/** Format a local date as YYYY-MM-DD (no UTC conversion) */
function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getThisMonthStartDate() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  return toLocalDateStr(start);
}

function getThisMonthEndDate() {
  const today = new Date();
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return toLocalDateStr(end);
}

const PAGE_SIZE = 25;

export default function MarketplacePaymentPage() {
  const { appUser } = useAuth();
  const companyId = appUser?.companyId || "";
  const userId = appUser?.uid || "";
  const queryClient = useQueryClient();

  const [selectedShop, setSelectedShop] = useState("all"); // "all" or connectionId
  const [activeTab, setActiveTab] = useState("statements");
  const [selectedStatements, setSelectedStatements] = useState<Set<string>>(new Set());
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Modal states
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [onConfirmAction, setOnConfirmAction] = useState<() => void>(() => {});

  // Date filter (client-side)
  const [datePreset, setDatePreset] = useState("this_month");
  const [filterStartDate, setFilterStartDate] = useState(getThisMonthStartDate);
  const [filterEndDate, setFilterEndDate] = useState(getThisMonthEndDate);

  // Account mapping
  const [mapping, setMapping] = useState({
    revenueCategoryId: "",
    expenseCategoryId: "",
    cashAccountId: "",
  });
  const [savingMapping, setSavingMapping] = useState(false);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedShop, filterStartDate, filterEndDate]);

  // Fetch shops (parallel, doesn't depend on selectedShop)
  const { data: shopsData, isLoading: loadingShops } = useQuery({
    queryKey: ["shops", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/integrations/tiktok/connections?companyId=${companyId}`);
      const data = await res.json();
      return data.connections || [];
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  const shops = shopsData || [];

  // Fetch statements (parallel with shops, pagination)
  const { data: statementsData, isLoading: loadingStatements } = useQuery({
    queryKey: ["statements", companyId, selectedShop, currentPage],
    queryFn: async () => {
      const offset = (currentPage - 1) * PAGE_SIZE;
      const params = new URLSearchParams({
        companyId,
        offset: offset.toString(),
        limit: PAGE_SIZE.toString(),
      });
      if (selectedShop !== "all") {
        params.append("connectionId", selectedShop);
      }
      const res = await fetch(`/api/integrations/tiktok/statements?${params}`);
      const data = await res.json();
      return { statements: data.statements || [], total: data.total || 0 };
    },
    enabled: !!companyId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
  const statements = statementsData?.statements || [];
  const totalStatements = statementsData?.total || 0;

  // Fetch mapping only when specific shop is selected
  const { data: mappingData } = useQuery({
    queryKey: ["mapping", companyId, selectedShop],
    queryFn: async () => {
      const [mappingRes, catRes, cashRes] = await Promise.all([
        fetch(`/api/integrations/tiktok/mapping?connectionId=${selectedShop}&companyId=${companyId}`),
        fetch(`/api/integrations/tiktok/categories?companyId=${companyId}`),
        fetch(`/api/integrations/tiktok/cash-accounts?companyId=${companyId}`),
      ]);

      const result: any = { categories: [], cashAccounts: [], mapping: {} };

      if (mappingRes.ok) {
        const data = await mappingRes.json();
        const mappings = data.mappings || [];
        const revenue = mappings.find((m: any) => m.mapping_type === "revenue");
        const expense = mappings.find((m: any) => m.mapping_type === "platform_fee");
        result.mapping = {
          revenueCategoryId: revenue?.kasflow_category_id || "",
          expenseCategoryId: expense?.kasflow_category_id || "",
          cashAccountId: revenue?.kasflow_cash_account_id || expense?.kasflow_cash_account_id || "",
        };
      }

      if (catRes.ok) {
        const data = await catRes.json();
        result.categories = data.categories || [];
      }

      if (cashRes.ok) {
        const data = await cashRes.json();
        result.cashAccounts = data.cashAccounts || [];
      }

      return result;
    },
    enabled: !!companyId && selectedShop !== "all",
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const categories = mappingData?.categories || [];
  const cashAccounts = mappingData?.cashAccounts || [];

  // Update mapping state when mappingData changes
  useEffect(() => {
    if (mappingData?.mapping) {
      setMapping(mappingData.mapping);
    }
  }, [mappingData]);

  const loading = loadingShops || loadingStatements;

  const saveMapping = async () => {
    if (selectedShop === "all") return;
    setSavingMapping(true);
    try {
      const mappings = [
        { mappingType: "revenue", kasflowCategoryId: mapping.revenueCategoryId, kasflowCashAccountId: mapping.cashAccountId },
        { mappingType: "platform_fee", kasflowCategoryId: mapping.expenseCategoryId, kasflowCashAccountId: mapping.cashAccountId },
      ];

      const response = await fetch("/api/integrations/tiktok/mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: selectedShop, companyId, mappings }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success("Account mapping berhasil disimpan!");
      } else {
        toast.error(`Gagal menyimpan: ${data.error}`);
      }
    } catch (error) {
      console.error("Failed to save mapping:", error);
      toast.error("Gagal menyimpan mapping.");
    } finally {
      setSavingMapping(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = "IDR") => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency, minimumFractionDigits: 0 }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("id-ID", { year: "numeric", month: "short", day: "numeric" });
  };

  const calculateTotals = () => {
    const settled = filteredStatements.filter((s) => s.paymentStatus === "PAID");
    return {
      totalRevenue: settled.reduce((sum, s) => sum + s.revenueAmount, 0),
      totalFee: settled.reduce((sum, s) => sum + Math.abs(s.feeAmount), 0),
      totalSettlement: settled.reduce((sum, s) => sum + s.settlementAmount, 0),
      reconciledCount: filteredStatements.filter((s) => s.reconciled).length,
      pendingCount: filteredStatements.filter((s) => s.approvalStatus === "pending_approval").length,
    };
  };

  // Client-side date filter (for display only, server handles pagination)
  const filteredStatements = statements.filter((s) => {
    if (!s.statementTime) return true;
    const d = s.statementTime.split("T")[0];
    return d >= filterStartDate && d <= filterEndDate;
  });

  // Server-side pagination
  const totalPages = Math.ceil(totalStatements / PAGE_SIZE);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStartDate, filterEndDate, selectedShop]);

  const handleApprove = async (statementIds?: string[]) => {
    const ids = statementIds || Array.from(selectedStatements);
    if (ids.length === 0) { toast.error("Pilih minimal 1 statement untuk di-approve."); return; }
    setConfirmMessage(`Approve ${ids.length} statement? Transaksi KasFlow akan dibuat.`);
    setOnConfirmAction(() => () => doApprove(ids));
    setShowConfirmModal(true);
  };

  const doApprove = async (ids: string[]) => {
    setApproving(true);
    setShowConfirmModal(false);
    try {
      const response = await fetch("/api/integrations/tiktok/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statementIds: ids, companyId, userId }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success(`Berhasil approve ${data.summary?.approved || 0} statement.`);
        setSelectedStatements(new Set());
        queryClient.invalidateQueries({ queryKey: ["statements"] });
      } else {
        toast.error(`Gagal approve: ${data.error}`);
      }
    } catch (error) {
      toast.error("Gagal approve statement.");
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async (statementIds?: string[]) => {
    const ids = statementIds || Array.from(selectedStatements);
    if (ids.length === 0) { toast.error("Pilih minimal 1 statement untuk di-reject."); return; }
    const reason = prompt("Alasan reject (opsional):");
    if (reason === null) return;
    setRejecting(true);
    try {
      const response = await fetch("/api/integrations/tiktok/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statementIds: ids, reason: reason || null }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success(`Berhasil reject ${ids.length} statement.`);
        setSelectedStatements(new Set());
        queryClient.invalidateQueries({ queryKey: ["statements"] });
      } else {
        toast.error(`Gagal reject: ${data.error}`);
      }
    } catch (error) {
      toast.error("Gagal reject statement.");
    } finally {
      setRejecting(false);
    }
  };

  const toggleStatementSelection = (statementId: string) => {
    const newSelected = new Set(selectedStatements);
    if (newSelected.has(statementId)) newSelected.delete(statementId);
    else newSelected.add(statementId);
    setSelectedStatements(newSelected);
  };

  const toggleAllPending = () => {
    const pendingStatements = filteredStatements.filter((s) => s.approvalStatus === "pending_approval");
    if (selectedStatements.size === pendingStatements.length) setSelectedStatements(new Set());
    else setSelectedStatements(new Set(pendingStatements.map((s) => s.id)));
  };

  const getApprovalBadge = (status?: string) => {
    switch (status) {
      case "pending_approval": return <Badge tone="yellow"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "approved": return <Badge tone="green"><Check className="h-3 w-3 mr-1" />Approved</Badge>;
      case "rejected": return <Badge tone="red"><X className="h-3 w-3 mr-1" />Rejected</Badge>;
      case "auto_approved": return <Badge tone="muted">Auto</Badge>;
      default: return null;
    }
  };

  const getPaymentBadge = (status: string) => {
    if (status === "PAID") return <Badge tone="green">PAID</Badge>;
    if (status === "PROCESSING") return <Badge tone="yellow">PROCESSING</Badge>;
    return <Badge tone="red">FAILED</Badge>;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Card key={i}><CardContent className="pt-6"><Skeleton className="h-20 w-full" /></CardContent></Card>)}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const totals = calculateTotals();
  const showShopColumn = selectedShop === "all";

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Platform Filter */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground mr-1">Platform:</span>
        <button className="px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-600 text-white">
          TikTok Shop
        </button>
        <button className="px-3 py-1.5 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed" disabled>
          Shopee
        </button>
        <button className="px-3 py-1.5 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed" disabled>
          Tokopedia
        </button>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Payment & Settlement</h1>
        <p className="text-xs text-muted-foreground">
          Kelola statement, approval, dan account mapping
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <select
          value={selectedShop}
          onChange={(e) => { setSelectedShop(e.target.value); setSelectedStatements(new Set()); }}
          className="h-9 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-card px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
        >
          <option value="all">Semua Toko ({shops.length})</option>
          {shops.map((shop) => (
            <option key={shop.id} value={shop.id}>
              {shop.display_name || shop.shop_name}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1.5 text-xs">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          <select
            value={datePreset}
            onChange={(e) => {
              const preset = e.target.value;
              setDatePreset(preset);
              const today = new Date();
              let start: Date;
              let end = new Date(today);

              switch (preset) {
                case "today":
                  start = new Date(today);
                  break;
                case "7days":
                  start = new Date(today);
                  start.setDate(start.getDate() - 6);
                  break;
                case "30days":
                  start = new Date(today);
                  start.setDate(start.getDate() - 29);
                  break;
                case "this_month":
                  start = new Date(today.getFullYear(), today.getMonth(), 1);
                  end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                  break;
                case "last_month":
                  start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                  end = new Date(today.getFullYear(), today.getMonth(), 0);
                  break;
                default:
                  return; // custom range, don't change dates
              }

              setFilterStartDate(toLocalDateStr(start));
              setFilterEndDate(toLocalDateStr(end));
            }}
            className="h-8 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-card px-2 text-xs outline-none focus:border-primary"
          >
            <option value="today">Hari Ini</option>
            <option value="7days">7 Hari Terakhir</option>
            <option value="30days">30 Hari Terakhir</option>
            <option value="this_month">Bulan Ini</option>
            <option value="last_month">Bulan Lalu</option>
            <option value="custom">Custom Range</option>
          </select>
          {datePreset === "custom" && (
            <>
              <input type="date" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)}
                className="h-8 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-card px-2 text-xs outline-none focus:border-primary" />
              <span className="text-muted-foreground">→</span>
              <input type="date" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)}
                className="h-8 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-card px-2 text-xs outline-none focus:border-primary" />
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold">{formatCurrency(totals.totalRevenue)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{totals.reconciledCount} reconciled</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5" />Fees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold">{formatCurrency(totals.totalFee)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Platform fees</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />Settlement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold">{formatCurrency(totals.totalSettlement)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Diterima di KasFlow</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="statements" className="text-xs flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Statements ({filteredStatements.length})
          </TabsTrigger>
          <TabsTrigger value="pending" className="text-xs flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Pending ({totals.pendingCount})
          </TabsTrigger>
          <TabsTrigger value="settings" className="text-xs flex items-center gap-1.5">
            <Settings className="h-3.5 w-3.5" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Statements Tab */}
        <TabsContent value="statements" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm">Daily Statements</CardTitle>
                  <CardDescription className="text-xs">
                    Data settlement dari TikTok Shop API. Statement pending perlu di-approve sebelum menghasilkan transaksi KasFlow.
                  </CardDescription>
                </div>
                {totals.pendingCount > 0 && (
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={toggleAllPending} className="text-xs h-8">
                      {selectedStatements.size === totals.pendingCount ? "Deselect All" : "Select All"}
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleReject()}
                      disabled={selectedStatements.size === 0 || rejecting} className="text-xs h-8">
                      <X className="h-3.5 w-3.5 mr-1" />Reject ({selectedStatements.size})
                    </Button>
                    <Button onClick={() => handleApprove()} disabled={selectedStatements.size === 0 || approving}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8">
                      <Check className="h-3.5 w-3.5 mr-1" />Approve ({selectedStatements.size})
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {filteredStatements.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                  <h3 className="font-semibold mb-2 text-sm">Belum Ada Statement</h3>
                  <p className="text-xs text-muted-foreground mb-4">Klik "Sync Now" untuk mengambil data statement dari TikTok Shop.</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-zinc-200 dark:border-zinc-800 text-muted-foreground text-[10px]">
                          <th className="py-2 px-2 text-left font-medium w-8">
                            {totals.pendingCount > 0 && (
                              <Checkbox checked={selectedStatements.size === totals.pendingCount} onCheckedChange={toggleAllPending} />
                            )}
                          </th>
                          <th className="py-2 px-2 text-left font-medium w-8">#</th>
                          <th className="py-2 px-2 text-left font-medium">Tanggal</th>
                          {showShopColumn && <th className="py-2 px-2 text-left font-medium">Shop</th>}
                          <th className="py-2 px-2 text-left font-medium">Status</th>
                          <th className="py-2 px-2 text-left font-medium">Approval</th>
                          <th className="py-2 px-2 text-right font-medium">Orders</th>
                          <th className="py-2 px-2 text-right font-medium">Revenue</th>
                          <th className="py-2 px-2 text-right font-medium">Fees</th>
                          <th className="py-2 px-2 text-right font-medium">Settlement</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStatements.map((stmt, index) => {
                          const rowNumber = (currentPage - 1) * PAGE_SIZE + index + 1;
                          return (
                            <tr key={stmt.id} className="border-b border-zinc-100 dark:border-zinc-900 hover:bg-muted/30 transition-colors">
                              <td className="py-2 px-2">
                                {stmt.approvalStatus === "pending_approval" && (
                                  <Checkbox checked={selectedStatements.has(stmt.id)} onCheckedChange={() => toggleStatementSelection(stmt.id)} />
                                )}
                              </td>
                              <td className="py-2 px-2 font-semibold text-muted-foreground">{rowNumber}</td>
                              <td className="py-2 px-2 font-semibold">{formatDate(stmt.statementTime)}</td>
                              {showShopColumn && <td className="py-2 px-2">{stmt.shopName}</td>}
                              <td className="py-2 px-2">{getPaymentBadge(stmt.paymentStatus)}</td>
                              <td className="py-2 px-2">
                                {getApprovalBadge(stmt.approvalStatus)}
                                {stmt.reconciled && <Badge tone="green" className="ml-1">✓</Badge>}
                              </td>
                              <td className="py-2 px-2 text-right">{stmt.orderCount}</td>
                              <td className="py-2 px-2 text-right font-semibold">{formatCurrency(stmt.revenueAmount, stmt.currency)}</td>
                              <td className="py-2 px-2 text-right">{formatCurrency(Math.abs(stmt.feeAmount), stmt.currency)}</td>
                              <td className="py-2 px-2 text-right font-semibold">{formatCurrency(stmt.settlementAmount, stmt.currency)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                      <div className="text-xs text-muted-foreground">
                        Showing {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, totalStatements)} of {totalStatements}
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1}
                          className="px-3 py-1.5 rounded-lg text-xs border border-zinc-200 dark:border-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted/50">First</button>
                        <button onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage === 1}
                          className="px-3 py-1.5 rounded-lg text-xs border border-zinc-200 dark:border-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted/50">←</button>
                        {(() => {
                          const maxVisible = 5;
                          let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
                          let end = Math.min(totalPages, start + maxVisible - 1);

                          if (end - start + 1 < maxVisible) {
                            start = Math.max(1, end - maxVisible + 1);
                          }

                          const pages = [];
                          for (let i = start; i <= end; i++) {
                            pages.push(i);
                          }

                          return pages.map((page) => (
                            <button key={page} onClick={() => setCurrentPage(page)}
                              className={`px-3 py-1.5 rounded-lg text-xs border ${currentPage === page ? "bg-primary text-primary-foreground border-primary" : "border-zinc-200 dark:border-zinc-800 hover:bg-muted/50"}`}>
                              {page}
                            </button>
                          ));
                        })()}
                        <button onClick={() => setCurrentPage(currentPage + 1)} disabled={currentPage === totalPages}
                          className="px-3 py-1.5 rounded-lg text-xs border border-zinc-200 dark:border-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted/50">→</button>
                        <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}
                          className="px-3 py-1.5 rounded-lg text-xs border border-zinc-200 dark:border-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted/50">Last</button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pending Tab */}
        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm">Pending Approval</CardTitle>
                  <CardDescription className="text-xs">
                    Review dan approve statement ini sebelum menghasilkan transaksi KasFlow.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={toggleAllPending} className="text-xs h-8">
                    {selectedStatements.size === totals.pendingCount ? "Deselect All" : "Select All"}
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleReject()}
                    disabled={selectedStatements.size === 0 || rejecting} className="text-xs h-8">
                    <X className="h-3.5 w-3.5 mr-1" />Reject ({selectedStatements.size})
                  </Button>
                  <Button onClick={() => handleApprove()} disabled={selectedStatements.size === 0 || approving}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8">
                    <Check className="h-3.5 w-3.5 mr-1" />Approve ({selectedStatements.size})
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredStatements.filter((s) => s.approvalStatus === "pending_approval").length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500/40 mb-4" />
                  <h3 className="font-semibold mb-2 text-sm">Semua Sudah Di-Review!</h3>
                  <p className="text-xs text-muted-foreground">Tidak ada statement yang menunggu approval.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-800 text-muted-foreground text-[10px]">
                        <th className="py-2 px-2 text-left font-medium w-8">
                          <Checkbox checked={selectedStatements.size === totals.pendingCount} onCheckedChange={toggleAllPending} />
                        </th>
                        <th className="py-2 px-2 text-left font-medium">Tanggal</th>
                        {showShopColumn && <th className="py-2 px-2 text-left font-medium">Shop</th>}
                        <th className="py-2 px-2 text-left font-medium">Status</th>
                        <th className="py-2 px-2 text-right font-medium">Orders</th>
                        <th className="py-2 px-2 text-right font-medium">Revenue</th>
                        <th className="py-2 px-2 text-right font-medium">Fees</th>
                        <th className="py-2 px-2 text-right font-medium">Settlement</th>
                        <th className="py-2 px-2 text-right font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStatements.filter((s) => s.approvalStatus === "pending_approval").map((stmt) => (
                        <tr key={stmt.id} className="border-b border-zinc-100 dark:border-zinc-900 hover:bg-yellow-50/50 dark:hover:bg-yellow-900/10 transition-colors">
                          <td className="py-2 px-2">
                            <Checkbox checked={selectedStatements.has(stmt.id)} onCheckedChange={() => toggleStatementSelection(stmt.id)} />
                          </td>
                          <td className="py-2 px-2 font-semibold">{formatDate(stmt.statementTime)}</td>
                          {showShopColumn && <td className="py-2 px-2">{stmt.shopName}</td>}
                          <td className="py-2 px-2">
                            {getPaymentBadge(stmt.paymentStatus)}
                          </td>
                          <td className="py-2 px-2 text-right">{stmt.orderCount}</td>
                          <td className="py-2 px-2 text-right font-semibold">{formatCurrency(stmt.revenueAmount, stmt.currency)}</td>
                          <td className="py-2 px-2 text-right">{formatCurrency(Math.abs(stmt.feeAmount), stmt.currency)}</td>
                          <td className="py-2 px-2 text-right font-semibold">{formatCurrency(stmt.settlementAmount, stmt.currency)}</td>
                          <td className="py-2 px-2 text-right">
                            <div className="flex gap-1 justify-end">
                              <Button variant="outline" size="sm" onClick={() => handleReject([stmt.id])} disabled={rejecting} className="text-xs h-7 px-2">
                                <X className="h-3 w-3" />
                              </Button>
                              <Button onClick={() => handleApprove([stmt.id])} disabled={approving}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-7 px-2">
                                <Check className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Account Mapping</CardTitle>
              <CardDescription className="text-xs">
                Tentukan akun KasFlow mana yang digunakan untuk transaksi otomatis dari TikTok Shop.
                {selectedShop === "all" && " Pilih toko tertentu untuk mengatur mapping."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedShop === "all" ? (
                <div className="text-center py-8">
                  <AlertCircle className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">Pilih satu toko untuk mengatur account mapping.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium mb-2">Kategori Pendapatan <span className="text-red-500">*</span></label>
                    <select value={mapping.revenueCategoryId} onChange={(e) => setMapping({ ...mapping, revenueCategoryId: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg bg-background text-sm">
                      <option value="">Pilih kategori income</option>
                      {categories.filter((c) => c.type === "income").map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-muted-foreground mt-1">Pendapatan penjualan dari TikTok akan masuk ke kategori ini</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-2">Kategori Biaya Platform <span className="text-red-500">*</span></label>
                    <select value={mapping.expenseCategoryId} onChange={(e) => setMapping({ ...mapping, expenseCategoryId: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg bg-background text-sm">
                      <option value="">Pilih kategori expense</option>
                      {categories.filter((c) => c.type === "expense").map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-muted-foreground mt-1">Biaya platform TikTok (komisi, admin, dll) akan masuk ke kategori ini</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-2">Akun Kas/Bank Penerima <span className="text-red-500">*</span></label>
                    <select value={mapping.cashAccountId} onChange={(e) => setMapping({ ...mapping, cashAccountId: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg bg-background text-sm">
                      <option value="">Pilih akun kas atau bank</option>
                      {cashAccounts.map((ca) => (
                        <option key={ca.id} value={ca.id}>{ca.name}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-muted-foreground mt-1">Uang hasil penjualan TikTok akan masuk ke akun ini</p>
                  </div>
                  <div className="pt-4 border-t">
                    <Button onClick={saveMapping}
                      disabled={!mapping.revenueCategoryId || !mapping.expenseCategoryId || !mapping.cashAccountId || savingMapping}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white">
                      {savingMapping ? "Menyimpan..." : "Simpan Mapping"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ConfirmModal
        open={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={onConfirmAction}
        title="Konfirmasi Approval"
        description={confirmMessage}
        confirmLabel="Approve"
        cancelLabel="Batal"
        loading={approving}
      />
    </div>
  );
}
