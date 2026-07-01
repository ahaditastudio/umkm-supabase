"use client";

import {
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  Calculator,
  Landmark,
  Wallet,
  TrendingUp,
  Activity,
  ArrowUpRight,
  Calendar,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Link from "next/link";
import { ClientOnlyChart } from "@/components/client-only-chart";
import { MetricCard } from "@/components/metric-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  topAccountsByType,
} from "@/lib/accounting";
import {
  calculateCashFlowMemo,
  calculateReportSummaryMemo,
} from "@/lib/accounting-memoized";
import { formatCurrency, formatCurrencyCompact, formatCountCompact } from "@/lib/utils";
import { useKasFlowStore } from "@/store/use-kasflow-store";

// Custom Tooltip component for Recharts
function CustomChartTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-800 dark:bg-zinc-950 animate-in fade-in duration-200">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">{label}</p>
        <div className="space-y-1.5">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-4 justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.fill || entry.stroke }} />
                {entry.name}:
              </span>
              <span className="font-semibold text-foreground">{formatCurrency(entry.value)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
}

export default function DashboardPage() {
  const accounts = useKasFlowStore((state) => state.accounts);
  const cashAccounts = useKasFlowStore((state) => state.cashAccounts);
  const journalEntries = useKasFlowStore((state) => state.journalEntries);
  const journalEntriesLoaded = useKasFlowStore((state) => state.journalEntriesLoaded);
  const loadJournalEntries = useKasFlowStore((state) => state.loadJournalEntries);
  const companyId = useKasFlowStore((state) => state.companyId);
  const taxSettings = useKasFlowStore((state) => state.taxSettings);
  const transactions = useKasFlowStore((state) => state.transactions);
  const profile = useKasFlowStore((state) => state.profile);

  const [filterType, setFilterType] = useState<"this_month" | "month" | "year" | "range">("this_month");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  useEffect(() => {
    if (companyId && !journalEntriesLoaded) {
      loadJournalEntries();
    }
  }, [companyId, journalEntriesLoaded, loadJournalEntries]);

  const { activeFrom, activeTo, periodLabel } = useMemo(() => {
    const now = new Date();
    if (filterType === "this_month") {
      const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      return {
        activeFrom: from,
        activeTo: to,
        periodLabel: "Bulan Ini",
      };
    } else if (filterType === "month") {
      const [year, month] = selectedMonth.split("-");
      const from = `${selectedMonth}-01`;
      const lastDay = new Date(Number(year), Number(month), 0).getDate();
      const to = `${selectedMonth}-${String(lastDay).padStart(2, "0")}`;
      const monthNames = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
      ];
      const label = `${monthNames[Number(month) - 1]} ${year}`;
      return {
        activeFrom: from,
        activeTo: to,
        periodLabel: label,
      };
    } else if (filterType === "year") {
      return {
        activeFrom: `${selectedYear}-01-01`,
        activeTo: `${selectedYear}-12-31`,
        periodLabel: `Tahun ${selectedYear}`,
      };
    } else {
      const from = customStart || `${now.getFullYear()}-01-01`;
      const to = customEnd || `${now.getFullYear()}-12-31`;
      const formatDisplay = (dStr: string) => {
        if (!dStr) return "";
        const parts = dStr.split("-");
        return `${parts[2]}/${parts[1]}`;
      };
      return {
        activeFrom: from,
        activeTo: to,
        periodLabel: customStart && customEnd ? `${formatDisplay(customStart)} - ${formatDisplay(customEnd)}` : "Custom",
      };
    }
  }, [filterType, selectedMonth, selectedYear, customStart, customEnd]);

  const summary = useMemo(
    () =>
      calculateReportSummaryMemo(
        journalEntries,
        accounts,
        cashAccounts,
        taxSettings,
        activeFrom,
        activeTo,
      ),
    [journalEntries, accounts, cashAccounts, taxSettings, activeFrom, activeTo],
  );
  const cashFlow = useMemo(
    () => {
      const allPoints = calculateCashFlowMemo(journalEntries, accounts);
      const fromMonth = activeFrom.slice(0, 7);
      const toMonth = activeTo.slice(0, 7);
      return allPoints.filter((pt) => pt.period >= fromMonth && pt.period <= toMonth);
    },
    [journalEntries, accounts, activeFrom, activeTo],
  );
  const topRevenue = useMemo(
    () => topAccountsByType(journalEntries, accounts, "revenue", 5, activeFrom, activeTo),
    [journalEntries, accounts, activeFrom, activeTo],
  );
  const topExpenses = useMemo(
    () => topAccountsByType(journalEntries, accounts, "expense", 5, activeFrom, activeTo),
    [journalEntries, accounts, activeFrom, activeTo],
  );

  // Show loading state while journal entries are being loaded
  if (!journalEntriesLoaded) {
    return (
      <div className="space-y-5 sm:space-y-6 lg:space-y-8 animate-in fade-in duration-500">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            <p className="mt-4 text-sm text-muted-foreground">Memuat data keuangan...</p>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="space-y-5 sm:space-y-6 lg:space-y-8 animate-in fade-in duration-500">
      {/* Welcome Banner Row */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Badge tone="green">Double Entry Ledger</Badge>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-500 bg-emerald-500/5 px-2 py-0.5 rounded-md border border-emerald-500/10">
              <Activity className="h-3 w-3" />
              Live Sync
            </span>
          </div>
          <h2 className="mt-2 text-lg sm:text-2xl lg:text-3xl font-bold tracking-tight text-foreground">
            Selamat datang, {profile.ownerName || "Rekan"}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Berikut ringkasan ledger keuangan bisnis <span className="font-semibold text-foreground">{profile.businessName}</span> hari ini.
          </p>
        </div>

        {/* Quick Statistics Badge */}
        <div className="flex items-center gap-2">
          <div className="rounded-lg border border-zinc-200/60 dark:border-zinc-800/40 bg-card px-3 py-2 text-xs font-medium text-muted-foreground flex gap-3">
            <div>
              <span className="text-foreground font-semibold">{formatCountCompact(transactions.filter((item) => !item.deletedAt).length)}</span> Transaksi
            </div>
            <div className="border-l border-zinc-200 dark:border-zinc-800" />
            <div>
              <span className="text-foreground font-semibold">{formatCountCompact(journalEntries.filter((item) => !item.deletedAt).length)}</span> Jurnal
            </div>
          </div>

          {/* Calendar Filter Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200/60 dark:border-zinc-800/40 bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/40 transition-colors h-9"
            >
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{periodLabel}</span>
              <span className="text-[10px] text-muted-foreground opacity-60">▼</span>
            </button>

            {isFilterOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsFilterOpen(false)} />
                <div className="absolute right-0 mt-2 w-72 z-50 rounded-xl border border-zinc-200 bg-white p-4 shadow-lg dark:border-zinc-800 dark:bg-zinc-950 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2.5">
                    Filter Periode
                  </div>
                  <div className="grid grid-cols-4 gap-1 bg-muted/60 p-0.5 rounded-lg text-[10px] font-semibold text-muted-foreground">
                    <button
                      onClick={() => setFilterType("this_month")}
                      className={`py-1.5 rounded-md transition-colors ${filterType === "this_month" ? "bg-white dark:bg-zinc-900 text-foreground shadow-sm" : "hover:text-foreground"}`}
                    >
                      Bulan Ini
                    </button>
                    <button
                      onClick={() => setFilterType("month")}
                      className={`py-1.5 rounded-md transition-colors ${filterType === "month" ? "bg-white dark:bg-zinc-900 text-foreground shadow-sm" : "hover:text-foreground"}`}
                    >
                      Bulan
                    </button>
                    <button
                      onClick={() => setFilterType("year")}
                      className={`py-1.5 rounded-md transition-colors ${filterType === "year" ? "bg-white dark:bg-zinc-900 text-foreground shadow-sm" : "hover:text-foreground"}`}
                    >
                      Tahun
                    </button>
                    <button
                      onClick={() => setFilterType("range")}
                      className={`py-1.5 rounded-md transition-colors ${filterType === "range" ? "bg-white dark:bg-zinc-900 text-foreground shadow-sm" : "hover:text-foreground"}`}
                    >
                      Custom
                    </button>
                  </div>

                  {filterType === "month" && (
                    <div className="mt-3.5 space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">Pilih Bulan</label>
                      <input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
                        className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 p-2 bg-transparent text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  )}

                  {filterType === "year" && (
                    <div className="mt-3.5 space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">Pilih Tahun</label>
                      <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 p-2 bg-white dark:bg-zinc-950 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        {Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 5 + i).map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {filterType === "range" && (
                    <div className="mt-3.5 space-y-2.5">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase">Mulai</label>
                          <input
                            type="date"
                            value={customStart}
                            onChange={(e) => setCustomStart(e.target.value)}
                            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 p-2 bg-transparent text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase">Selesai</label>
                          <input
                            type="date"
                            value={customEnd}
                            onChange={(e) => setCustomEnd(e.target.value)}
                            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 p-2 bg-transparent text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 pt-2.5 border-t border-zinc-100 dark:border-zinc-800/60 text-[10px] text-muted-foreground flex justify-between items-center">
                    <span>* Perubahan otomatis diterapkan</span>
                    <button
                      onClick={() => setIsFilterOpen(false)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-2.5 py-1 rounded-md text-[10px] transition-colors"
                    >
                      Selesai
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          <Link href="/transactions">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs gap-1">
              Catat Transaksi <ArrowUpRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards - 2-col grid on mobile, 3-col on desktop */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:gap-4">
        <MetricCard
          title="Total Kas"
          value={formatCurrencyCompact(summary.totalCash)}
          icon={Wallet}
          helper="Akun kas tunai"
          compact
        />
        <MetricCard
          title="Total Bank"
          value={formatCurrencyCompact(summary.totalBank)}
          icon={Landmark}
          tone="blue"
          helper="Saldo rekening bank"
          compact
        />
        <MetricCard
          title={filterType === "this_month" ? "Pendapatan Bulan Ini" : `Pendapatan (${periodLabel})`}
          value={formatCurrencyCompact(summary.monthlyRevenue)}
          icon={ArrowUpCircle}
          tone="green"
          compact
        />
        <MetricCard
          title={filterType === "this_month" ? "Pengeluaran Bulan Ini" : `Pengeluaran (${periodLabel})`}
          value={formatCurrencyCompact(summary.monthlyExpenses)}
          icon={ArrowDownCircle}
          tone="red"
          compact
        />
        <MetricCard
          title="Laba Bersih"
          value={formatCurrencyCompact(summary.netProfit)}
          icon={Banknote}
          tone={summary.netProfit >= 0 ? "green" : "red"}
          helper={summary.netProfit >= 0 ? "Profit positif" : "Defisit keuangan"}
          compact
        />
        <MetricCard
          title="Estimasi Pajak"
          value={formatCurrencyCompact(summary.estimatedTax)}
          icon={Calculator}
          tone="yellow"
          helper={`${taxSettings.name} • ${(taxSettings.rate * 100).toFixed(1)}%`}
          compact
        />
      </div>

      {/* Recharts Graphs Area */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHeader className="flex flex-row items-center justify-between border-b pb-3 mb-3 lg:pb-4 lg:mb-4">
            <div>
              <CardTitle className="text-sm sm:text-base">Pendapatan vs Pengeluaran</CardTitle>
              <CardDescription>Perbandingan arus kas bulanan berdasarkan nominal.</CardDescription>
            </div>
            <TrendingUp className="h-4 w-4 text-emerald-500 hidden sm:block" />
          </CardHeader>
          <CardContent className="h-48 sm:h-56 lg:h-72 mt-2">
            <ClientOnlyChart>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cashFlow} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}>
                  <XAxis
                    dataKey="period"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${Number(value) / 1_000_000}M`}
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <Tooltip content={<CustomChartTooltip />} cursor={{ fill: "rgba(0,0,0,0.02)" }} />
                  <Bar
                    dataKey="income"
                    name="Pendapatan"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                  <Bar
                    dataKey="expense"
                    name="Pengeluaran"
                    fill="hsl(var(--destructive))"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ClientOnlyChart>
          </CardContent>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader className="flex flex-row items-center justify-between border-b pb-3 mb-3 lg:pb-4 lg:mb-4">
            <div>
              <CardTitle className="text-sm sm:text-base">Aliran Kas Bersih</CardTitle>
              <CardDescription>Perkembangan profitabilitas (net income) bulanan.</CardDescription>
            </div>
            <Activity className="h-4 w-4 text-emerald-500 hidden sm:block" />
          </CardHeader>
          <CardContent className="h-48 sm:h-56 lg:h-72 mt-2">
            <ClientOnlyChart>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cashFlow} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}>
                  <XAxis
                    dataKey="period"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${Number(value) / 1_000_000}M`}
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <Tooltip content={<CustomChartTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="net"
                    name="Kas Bersih"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ stroke: "hsl(var(--primary))", strokeWidth: 1, r: 3, fill: "hsl(var(--card))" }}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ClientOnlyChart>
          </CardContent>
        </Card>
      </div>

      {/* Top Ledger Performers */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* ─── Pendapatan: Ranked List ─── */}
        <Card>
          <CardHeader className="border-b pb-3 mb-4 lg:pb-4 lg:mb-5">
            <CardTitle className="text-sm sm:text-base">Sumber Pendapatan Utama</CardTitle>
            <CardDescription>Akun pendapatan paling produktif di buku besar.</CardDescription>
          </CardHeader>
          <CardContent>
            {topRevenue.length ? (
              <>
                <div className="space-y-3">
                  {topRevenue.map((item, idx) => {
                    const totalRev = topRevenue.reduce((s, i) => s + i.value, 0);
                    const pct = totalRev > 0 ? (item.value / totalRev) * 100 : 0;
                    return (
                      <div key={item.account?.id} className="flex items-center gap-3">
                        {/* Rank Number */}
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/8 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-foreground truncate">{item.account?.name}</p>
                          <div className="mt-1 h-[2px] w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                            <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        {/* Value + Percentage */}
                        <div className="text-right shrink-0">
                          <p className="text-[13px] font-bold text-foreground">{formatCurrency(item.value)}</p>
                          <p className="text-[10px] font-semibold text-emerald-500">{pct.toFixed(1)}%</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Total */}
                <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Pendapatan</span>
                  <span className="text-sm font-bold text-foreground">{formatCurrency(topRevenue.reduce((s, i) => s + i.value, 0))}</span>
                </div>
              </>
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Belum ada transaksi pendapatan tercatat.
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── Pengeluaran: Stacked Bar + Legend ─── */}
        <Card>
          <CardHeader className="border-b pb-3 mb-4 lg:pb-4 lg:mb-5">
            <CardTitle className="text-sm sm:text-base">Pos Pengeluaran Terbesar</CardTitle>
            <CardDescription>Komposisi alokasi pengeluaran dana bisnis.</CardDescription>
          </CardHeader>
          <CardContent>
            {topExpenses.length ? (() => {
              const totalExp = topExpenses.reduce((s, i) => s + i.value, 0);
              const colors = [
                "bg-rose-500", "bg-amber-500", "bg-blue-500", "bg-purple-500",
                "bg-teal-500", "bg-pink-500", "bg-orange-500", "bg-cyan-500",
                "bg-lime-500", "bg-indigo-500",
              ];
              const dotColors = [
                "bg-rose-500", "bg-amber-500", "bg-blue-500", "bg-purple-500",
                "bg-teal-500", "bg-pink-500", "bg-orange-500", "bg-cyan-500",
                "bg-lime-500", "bg-indigo-500",
              ];
              return (
                <>
                  {/* Stacked Bar */}
                  <div className="flex h-3 w-full rounded-full overflow-hidden mb-5">
                    {topExpenses.map((item, idx) => {
                      const pct = totalExp > 0 ? (item.value / totalExp) * 100 : 0;
                      return (
                        <div
                          key={item.account?.id}
                          className={`${colors[idx % colors.length]} transition-all duration-500`}
                          style={{ width: `${pct}%` }}
                          title={`${item.account?.name}: ${pct.toFixed(1)}%`}
                        />
                      );
                    })}
                  </div>
                  {/* Legend Grid */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                    {topExpenses.map((item, idx) => {
                      const pct = totalExp > 0 ? (item.value / totalExp) * 100 : 0;
                      return (
                        <div key={item.account?.id} className="flex items-center gap-2 min-w-0">
                          <span className={`h-2 w-2 rounded-full shrink-0 ${dotColors[idx % dotColors.length]}`} />
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-semibold text-foreground truncate">{item.account?.name}</p>
                            <p className="text-[10px] text-muted-foreground">{formatCurrencyCompact(item.value)} <span className="text-muted-foreground/60">({pct.toFixed(0)}%)</span></p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Total */}
                  <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Pengeluaran</span>
                    <span className="text-sm font-bold text-foreground">{formatCurrency(totalExp)}</span>
                  </div>
                </>
              );
            })() : (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Belum ada transaksi pengeluaran tercatat.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
