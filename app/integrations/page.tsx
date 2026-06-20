"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/auth-provider";
import { useKasFlowStore } from "@/store/use-kasflow-store";
import { toast } from "@/lib/toast";
import {
  ShoppingBag,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  CreditCard,
  Calendar,
  Package,
  Plus,
  Store,
} from "lucide-react";

type MarketplaceConnection = {
  id: string;
  platform: string;
  shop_name: string;
  display_name: string | null;
  shop_cipher: string;
  status: string;
  last_sync_at: string | null;
  token_expires_at: string | null;
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

export default function IntegrationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { appUser } = useAuth();
  const { companyId } = useKasFlowStore();
  const [connections, setConnections] = useState<MarketplaceConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // Date range for sync
  const [syncDatePreset, setSyncDatePreset] = useState("this_month");
  const [syncStartDate, setSyncStartDate] = useState(getThisMonthStartDate);
  const [syncEndDate, setSyncEndDate] = useState(getThisMonthEndDate);

  const fetchConnections = async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`/api/integrations/tiktok/connections?companyId=${companyId}`);
      if (!response.ok) {
        setConnections([]);
        setLoading(false);
        return;
      }
      const data = await response.json();
      setConnections(data.connections || []);
      setLoading(false);
    } catch (error) {
      setConnections([]);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (companyId) {
      setLoading(true);
      fetchConnections();
    } else {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    const connected = searchParams.get("connected");
    if (connected === "true" && companyId) {
      setShowSuccess(true);
      fetchConnections();
      setTimeout(() => setShowSuccess(false), 5000);
    }
  }, [searchParams, companyId]);

  const handleConnect = async () => {
    if (!appUser?.uid) return;
    try {
      const response = await fetch("/api/integrations/tiktok/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      const data = await response.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      console.error("Failed to initiate OAuth:", error);
    }
  };

  const handleSync = async (connectionId: string) => {
    setSyncing(connectionId);
    try {
      const response = await fetch("/api/integrations/tiktok/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, companyId, mode: "incremental", startDate: syncStartDate, endDate: syncEndDate }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success(`Sync selesai! Statements: ${data.summary.statements.fetched}, Orders: ${data.summary.orders.fetched}`);
        fetchConnections();
      } else {
        toast.error(`Sync gagal: ${data.error}`);
      }
    } catch (error) {
      toast.error("Sync gagal. Silakan coba lagi.");
    } finally {
      setSyncing(null);
    }
  };

  const formatLastSync = (lastSyncAt: string | null) => {
    if (!lastSyncAt) return "Belum pernah sync";
    const date = new Date(lastSyncAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffMins < 1) return "Baru saja";
    if (diffMins < 60) return `${diffMins} menit lalu`;
    if (diffHours < 24) return `${diffHours} jam lalu`;
    return `${diffDays} hari lalu`;
  };

  const getTokenStatus = (tokenExpiresAt: string | null) => {
    if (!tokenExpiresAt) return { status: "unknown", label: "Unknown" };
    const expiresAt = new Date(tokenExpiresAt);
    const now = new Date();
    const diffDays = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { status: "expired", label: "Expired" };
    if (diffDays < 3) return { status: "warning", label: `Berakhir dalam ${diffDays} hari` };
    return { status: "valid", label: `Valid ${diffDays} hari lagi` };
  };

  const getShopLabel = (conn: MarketplaceConnection) => conn.display_name || conn.shop_name;

  if (loading) {
    return (
      <div className="container mx-auto space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4">
          {[1, 2].map((i) => <Card key={i}><CardHeader><Skeleton className="h-6 w-48" /></CardHeader><CardContent><Skeleton className="h-20 w-full" /></CardContent></Card>)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Success Message */}
      {showSuccess && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          <div className="flex-1">
            <p className="font-medium text-green-500">TikTok Shop berhasil terhubung!</p>
            <p className="text-sm text-muted-foreground">Anda sekarang dapat menyinkronkan data transaksi dari TikTok Shop.</p>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Integrasi Marketplace</h1>
        <p className="text-xs text-muted-foreground">
          Kelola koneksi toko marketplace. Hubungkan toko baru atau sync data toko yang sudah terhubung.
        </p>
      </div>

      {/* TikTok Shop Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShoppingBag className="h-5 w-5" />
                TikTok Shop
              </CardTitle>
              <CardDescription className="text-xs">
                {connections.length} toko terhubung
              </CardDescription>
            </div>
            <Button onClick={handleConnect} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-9">
              <Plus className="h-4 w-4 mr-1.5" />
              Connect Toko Baru
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {connections.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed rounded-lg">
              <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">Belum Ada TikTok Shop</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Hubungkan toko TikTok Shop pertama kamu untuk mulai sync data.
              </p>
              <Button onClick={handleConnect}>
                <Plus className="h-4 w-4 mr-2" />Connect TikTok Shop
              </Button>
            </div>
          ) : (
            connections.map((conn) => {
              const tokenStatus = getTokenStatus(conn.token_expires_at);
              return (
                <div key={conn.id} className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
                  {/* Shop Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Store className="h-4 w-4 text-muted-foreground" />
                        <h3 className="font-semibold text-sm">{getShopLabel(conn)}</h3>
                        <Badge variant={conn.status === "active" ? "default" : "secondary"}>{conn.status}</Badge>
                      </div>
                      {conn.display_name && conn.shop_name !== conn.display_name && (
                        <p className="text-[11px] text-muted-foreground">Asli: {conn.shop_name}</p>
                      )}
                      <p className="text-[11px] text-muted-foreground">Shop ID: {conn.shop_cipher}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      {tokenStatus.status === "expired" ? (
                        <Badge tone="red"><AlertCircle className="h-3 w-3 mr-1" />Token Expired</Badge>
                      ) : tokenStatus.status === "warning" ? (
                        <Badge tone="yellow"><AlertCircle className="h-3 w-3 mr-1" />{tokenStatus.label}</Badge>
                      ) : (
                        <Badge tone="green"><CheckCircle2 className="h-3 w-3 mr-1" />{tokenStatus.label}</Badge>
                      )}
                    </div>
                  </div>

                  {/* Sync Controls */}
                  <div className="flex flex-wrap items-center gap-2 mb-3 pb-3 border-b border-zinc-200 dark:border-zinc-800">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <select
                      value={syncDatePreset}
                      onChange={(e) => {
                        const value = e.target.value;
                        setSyncDatePreset(value);

                        if (value === "custom") return;

                        const today = new Date();
                        let startDate: Date;
                        let endDate = today;

                        switch (value) {
                          case "today":
                            startDate = today;
                            break;
                          case "7days":
                            startDate = new Date(today);
                            startDate.setDate(today.getDate() - 7);
                            break;
                          case "30days":
                            startDate = new Date(today);
                            startDate.setDate(today.getDate() - 30);
                            break;
                          case "this_month":
                            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                            endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                            break;
                          case "last_month":
                            startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                            endDate = new Date(today.getFullYear(), today.getMonth(), 0);
                            break;
                          default:
                            startDate = new Date(today);
                            startDate.setDate(today.getDate() - 30);
                        }

                        setSyncStartDate(startDate.toISOString().split("T")[0]);
                        setSyncEndDate(endDate.toISOString().split("T")[0]);
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
                    {syncDatePreset === "custom" && (
                      <>
                        <input type="date" value={syncStartDate} onChange={(e) => setSyncStartDate(e.target.value)}
                          className="h-8 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-card px-2 text-xs outline-none focus:border-primary" />
                        <span className="text-muted-foreground text-xs">→</span>
                        <input type="date" value={syncEndDate} onChange={(e) => setSyncEndDate(e.target.value)}
                          className="h-8 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-card px-2 text-xs outline-none focus:border-primary" />
                      </>
                    )}
                    <Button variant="outline" size="sm"
                      onClick={() => handleSync(conn.id)}
                      disabled={syncing === conn.id || conn.status !== "active"}
                      className="text-xs h-8 ml-auto">
                      <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncing === conn.id ? "animate-spin" : ""}`} />
                      {syncing === conn.id ? "Syncing..." : "Sync"}
                    </Button>
                  </div>

                  {/* Info Row */}
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" />Last sync: {formatLastSync(conn.last_sync_at)}
                    </span>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm"
                        onClick={() => router.push("/marketplace/payment")}
                        className="text-xs h-7">
                        <CreditCard className="h-3.5 w-3.5 mr-1" />Payment
                      </Button>
                      <Button variant="ghost" size="sm"
                        onClick={() => router.push("/marketplace/orders")}
                        className="text-xs h-7">
                        <Package className="h-3.5 w-3.5 mr-1" />Orders
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Future Platforms */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="opacity-60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingBag className="h-5 w-5" />Shopee
            </CardTitle>
            <CardDescription className="text-xs">Coming soon</CardDescription>
          </CardHeader>
          <CardContent>
            <Button disabled variant="outline" className="text-xs">Coming Soon</Button>
          </CardContent>
        </Card>
        <Card className="opacity-60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingBag className="h-5 w-5" />Tokopedia
            </CardTitle>
            <CardDescription className="text-xs">Coming soon</CardDescription>
          </CardHeader>
          <CardContent>
            <Button disabled variant="outline" className="text-xs">Coming Soon</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
