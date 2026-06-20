"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Package,
  Filter,
  Calendar,
  ShoppingCart,
  TrendingUp,
  Truck,
  CheckCircle2,
  Clock,
  XCircle,
  Store,
} from "lucide-react";

type Shop = {
  id: string;
  shop_name: string;
  display_name: string | null;
  status: string;
};

type Order = {
  id: string;
  connectionId: string;
  shopName: string;
  platformOrderId: string;
  platformStatus: string;
  orderCreateTime: string;
  currency: string;
  subtotal: number;
  shippingFee: number;
  totalAmount: number;
  settlementStatus: string;
  settlementAmount: number;
  revenueAmount: number;
  feeAmount: number;
  shippingProvider?: string;
};

const PAGE_SIZE = 25;

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

type Stats = {
  total: number;
  completed: number;
  delivered: number;
  inTransit: number;
  awaitingCollection: number;
  awaitingShipment: number;
  cancelled: number;
  totalRevenue: number;
  settledCount: number;
};

export default function MarketplaceOrdersPage() {
  const { appUser } = useAuth();
  const companyId = appUser?.companyId || "";

  const [selectedShop, setSelectedShop] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [datePreset, setDatePreset] = useState("this_month");
  const [filterStartDate, setFilterStartDate] = useState(getThisMonthStartDate);
  const [filterEndDate, setFilterEndDate] = useState(getThisMonthEndDate);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch shops with React Query
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

  // Fetch orders with React Query (parallel with shops)
  const { data: ordersData, isLoading: loadingOrders } = useQuery({
    queryKey: ["orders", companyId, selectedShop, filterStartDate, filterEndDate, statusFilter, currentPage],
    queryFn: async () => {
      const offset = (currentPage - 1) * PAGE_SIZE;
      const params = new URLSearchParams({
        companyId,
        limit: String(PAGE_SIZE),
        offset: String(offset),
        startDate: filterStartDate,
        endDate: filterEndDate,
      });
      if (selectedShop !== "all") {
        params.set("connectionId", selectedShop);
      }
      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }
      const res = await fetch(`/api/integrations/tiktok/orders?${params}`);
      const data = await res.json();
      return {
        orders: data.orders || [],
        total: data.total || 0,
        stats: data.stats || {
          total: 0,
          completed: 0,
          delivered: 0,
          inTransit: 0,
          awaitingCollection: 0,
          awaitingShipment: 0,
          cancelled: 0,
          totalRevenue: 0,
          settledCount: 0,
        },
      };
    },
    enabled: !!companyId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const orders = ordersData?.orders || [];
  const totalOrders = ordersData?.total || 0;
  const totalPages = Math.ceil(totalOrders / PAGE_SIZE);
  const stats = ordersData?.stats || {
    total: 0,
    completed: 0,
    delivered: 0,
    inTransit: 0,
    awaitingCollection: 0,
    awaitingShipment: 0,
    cancelled: 0,
    totalRevenue: 0,
    settledCount: 0,
  };


  const loading = loadingShops || loadingOrders;

  const formatCurrency = (amount: number, currency: string = "IDR") => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency, minimumFractionDigits: 0 }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("id-ID", { year: "numeric", month: "short", day: "numeric" });
  };

  const getStatusBadge = (status: string) => {
    const s = status?.toUpperCase();
    if (s === "DELIVERED" || s === "COMPLETED") return <Badge tone="green"><CheckCircle2 className="h-3 w-3 mr-1" />{status}</Badge>;
    if (s === "AWAITING_SHIPMENT" || s === "PENDING") return <Badge tone="yellow"><Clock className="h-3 w-3 mr-1" />{status}</Badge>;
    if (s === "IN_TRANSIT" || s === "SHIPPED") return <Badge tone="blue"><Truck className="h-3 w-3 mr-1" />{status}</Badge>;
    if (s === "CANCELLED" || s === "FAILED") return <Badge tone="red"><XCircle className="h-3 w-3 mr-1" />{status}</Badge>;
    return <Badge tone="muted">{status}</Badge>;
  };

  // In-progress = all statuses between AWAITING_SHIPMENT and DELIVERED
  const inProgressCount = stats.awaitingShipment + stats.awaitingCollection + stats.inTransit + stats.delivered;

  // Pagination helper - ensures page numbers stay within valid range
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);

    // Adjust start if we're near the end
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
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
        <h1 className="text-xl font-bold sm:text-2xl">Marketplace Orders</h1>
        <p className="text-xs text-muted-foreground">
          Analytics order dari semua toko marketplace yang terkoneksi
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <select value={selectedShop} onChange={(e) => { setSelectedShop(e.target.value); setCurrentPage(1); }}
          className="h-9 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-card px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10">
          <option value="all">Semua Toko ({shops.length})</option>
          {shops.map((shop) => (
            <option key={shop.id} value={shop.id}>{shop.display_name || shop.shop_name}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
          className="h-9 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-card px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10">
          <option value="all">Semua Status</option>
          {[...new Set(orders.map((o) => o.platformStatus).filter(Boolean))].map((s) => (
            <option key={s} value={s!}>{s}</option>
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
              let end = new Date();

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
                  end = new Date(today.getFullYear(), today.getMonth() + 1, 0); // akhir bulan ini
                  break;
                case "last_month":
                  start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                  end = new Date(today.getFullYear(), today.getMonth(), 0);
                  break;
                case "custom":
                  return; // Don't change dates, let user pick
                default:
                  start = new Date(today);
                  start.setDate(start.getDate() - 29);
              }

              setFilterStartDate(toLocalDateStr(start));
              setFilterEndDate(toLocalDateStr(end));
              setCurrentPage(1);
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
              <input type="date" value={filterStartDate} onChange={(e) => { setFilterStartDate(e.target.value); setCurrentPage(1); }}
                className="h-8 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-card px-2 text-xs outline-none focus:border-primary" />
              <span className="text-muted-foreground">→</span>
              <input type="date" value={filterEndDate} onChange={(e) => { setFilterEndDate(e.target.value); setCurrentPage(1); }}
                className="h-8 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-card px-2 text-xs outline-none focus:border-primary" />
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
              <ShoppingCart className="h-3.5 w-3.5" />Total Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold">{stats.total}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{stats.settledCount} settled</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold text-emerald-600">{stats.completed}</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(1) : 0}% dari total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5" />In Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold text-blue-600">{stats.delivered + stats.inTransit + stats.awaitingCollection + stats.awaitingShipment}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Sedang diproses</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
              <XCircle className="h-3.5 w-3.5" />Cancelled
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold text-red-600">{stats.cancelled}</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {stats.total > 0 ? ((stats.cancelled / stats.total) * 100).toFixed(1) : 0}% cancellation rate
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold">{formatCurrency(stats.totalRevenue)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {stats.completed > 0 ? `Avg: ${formatCurrency(stats.totalRevenue / stats.completed)}` : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Order List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Order List</CardTitle>
          <CardDescription className="text-xs">
            Data order untuk analytics. Order tidak menghasilkan transaksi KasFlow — gunakan tab Payment untuk settlement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="font-semibold mb-2 text-sm">Belum Ada Order</h3>
              <p className="text-xs text-muted-foreground">
                {totalOrders === 0
                  ? "Sync data terlebih dahulu dari halaman Payment untuk mengambil order."
                  : "Tidak ada order dengan filter yang dipilih."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-muted-foreground text-[10px]">
                    <th className="py-2 px-2 text-left font-medium w-8">#</th>
                    <th className="py-2 px-2 text-left font-medium">Order ID</th>
                    {showShopColumn && <th className="py-2 px-2 text-left font-medium">Shop</th>}
                    <th className="py-2 px-2 text-left font-medium">Status</th>
                    <th className="py-2 px-2 text-left font-medium">Tanggal</th>
                    <th className="py-2 px-2 text-right font-medium">Total</th>
                    <th className="py-2 px-2 text-right font-medium">Pencairan</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order, index) => {
                    const rowNumber = (currentPage - 1) * PAGE_SIZE + index + 1;
                    return (
                      <tr key={order.id} className="border-b border-zinc-100 dark:border-zinc-900 hover:bg-muted/30 transition-colors">
                        <td className="py-2 px-2 font-semibold text-muted-foreground">{rowNumber}</td>
                        <td className="py-2 px-2 font-mono">{order.platformOrderId}</td>
                        {showShopColumn && <td className="py-2 px-2">{order.shopName}</td>}
                        <td className="py-2 px-2">{getStatusBadge(order.platformStatus)}</td>
                        <td className="py-2 px-2 text-muted-foreground">{formatDate(order.orderCreateTime)}</td>
                        <td className="py-2 px-2 text-right font-semibold">{formatCurrency(order.totalAmount, order.currency)}</td>
                        <td className={`py-2 px-2 text-right font-semibold ${order.settlementAmount < 0 ? "text-red-600" : ""}`}>
                          {formatCurrency(order.settlementAmount, order.currency)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4">
          <div className="text-xs text-muted-foreground">
            Showing {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, totalOrders)} of {totalOrders} orders
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-lg text-xs border border-zinc-200 dark:border-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted/50"
            >
              First
            </button>
            <button
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-lg text-xs border border-zinc-200 dark:border-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted/50"
            >
              ←
            </button>
            {getPageNumbers().map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-1.5 rounded-lg text-xs border ${
                  currentPage === page
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-zinc-200 dark:border-zinc-800 hover:bg-muted/50"
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-lg text-xs border border-zinc-200 dark:border-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted/50"
            >
              →
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-lg text-xs border border-zinc-200 dark:border-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted/50"
            >
              Last
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
