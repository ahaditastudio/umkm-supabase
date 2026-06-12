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
} from "lucide-react";
import { useMemo } from "react";
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
  calculateCashFlow,
  calculateReportSummary,
  topAccountsByType,
} from "@/lib/accounting";
import { formatCurrency } from "@/lib/utils";
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
  const taxSettings = useKasFlowStore((state) => state.taxSettings);
  const transactions = useKasFlowStore((state) => state.transactions);
  const profile = useKasFlowStore((state) => state.profile);

  const summary = useMemo(
    () =>
      calculateReportSummary(
        journalEntries,
        accounts,
        cashAccounts,
        taxSettings,
      ),
    [journalEntries, accounts, cashAccounts, taxSettings],
  );
  const cashFlow = useMemo(
    () => calculateCashFlow(journalEntries, accounts),
    [journalEntries, accounts],
  );
  const topRevenue = useMemo(
    () => topAccountsByType(journalEntries, accounts, "revenue"),
    [journalEntries, accounts],
  );
  const topExpenses = useMemo(
    () => topAccountsByType(journalEntries, accounts, "expense"),
    [journalEntries, accounts],
  );

  // Compute maximum values for percentage bars in listing
  const maxRevenue = useMemo(() => Math.max(...topRevenue.map(item => item.value), 1), [topRevenue]);
  const maxExpense = useMemo(() => Math.max(...topExpenses.map(item => item.value), 1), [topExpenses]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Welcome Banner Row */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2">
            <Badge tone="green">Double Entry Ledger</Badge>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-500 bg-emerald-500/5 px-2 py-0.5 rounded-md border border-emerald-500/10">
              <Activity className="h-3 w-3" />
              Live Sync
            </span>
          </div>
          <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl text-foreground">
            Selamat datang, {profile.ownerName || "Rekan"}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Berikut ringkasan ledger keuangan bisnis <span className="font-semibold text-foreground">{profile.businessName}</span> hari ini.
          </p>
        </div>

        {/* Quick Statistics Badge */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <div className="rounded-lg border border-zinc-200/60 dark:border-zinc-800/40 bg-card px-4 py-2 text-xs font-medium text-muted-foreground flex gap-4">
            <div>
              <span className="text-foreground font-semibold">{transactions.filter((item) => !item.deletedAt).length}</span> Transaksi
            </div>
            <div className="border-l border-zinc-200 dark:border-zinc-800" />
            <div>
              <span className="text-foreground font-semibold">{journalEntries.filter((item) => !item.deletedAt).length}</span> Jurnal
            </div>
          </div>
          <Link href="/transactions">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs gap-1">
              Catat Transaksi <ArrowUpRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          title="Total Kas"
          value={formatCurrency(summary.totalCash)}
          icon={Wallet}
          helper="Akun kas tunai"
        />
        <MetricCard
          title="Total Bank"
          value={formatCurrency(summary.totalBank)}
          icon={Landmark}
          tone="blue"
          helper="Saldo rekening bank"
        />
        <MetricCard
          title="Pendapatan Bulan Ini"
          value={formatCurrency(summary.monthlyRevenue)}
          icon={ArrowUpCircle}
          tone="green"
        />
        <MetricCard
          title="Pengeluaran Bulan Ini"
          value={formatCurrency(summary.monthlyExpenses)}
          icon={ArrowDownCircle}
          tone="red"
        />
        <MetricCard
          title="Laba Bersih"
          value={formatCurrency(summary.netProfit)}
          icon={Banknote}
          tone={summary.netProfit >= 0 ? "green" : "red"}
          helper={summary.netProfit >= 0 ? "Profit positif" : "Defisit keuangan"}
        />
        <MetricCard
          title="Estimasi Pajak"
          value={formatCurrency(summary.estimatedTax)}
          icon={Calculator}
          tone="yellow"
          helper={`${taxSettings.name} • ${(taxSettings.rate * 100).toFixed(1)}%`}
        />
      </div>

      {/* Recharts Graphs Area */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHeader className="flex flex-row items-center justify-between border-b pb-4 mb-4">
            <div>
              <CardTitle>Pendapatan vs Pengeluaran</CardTitle>
              <CardDescription>Perbandingan arus kas bulanan berdasarkan nominal.</CardDescription>
            </div>
            <TrendingUp className="h-4 w-4 text-emerald-500 hidden sm:block" />
          </CardHeader>
          <CardContent className="h-72 mt-2">
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
          <CardHeader className="flex flex-row items-center justify-between border-b pb-4 mb-4">
            <div>
              <CardTitle>Aliran Kas Bersih</CardTitle>
              <CardDescription>Perkembangan profitabilitas (net income) bulanan.</CardDescription>
            </div>
            <Activity className="h-4 w-4 text-emerald-500 hidden sm:block" />
          </CardHeader>
          <CardContent className="h-72 mt-2">
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

      {/* Top Ledger Performers (With progress bars) */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-b pb-4 mb-4">
            <CardTitle>Sumber Pendapatan Utama</CardTitle>
            <CardDescription>Akun pendapatan paling produktif di buku besar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {topRevenue.length ? (
              topRevenue.map((item) => {
                const percent = (item.value / maxRevenue) * 100;
                return (
                  <div key={item.account?.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        {item.account?.name}
                      </span>
                      <span>{formatCurrency(item.value)}</span>
                    </div>
                    {/* Visual Progress Bar */}
                    <div className="h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Belum ada transaksi pendapatan tercatat.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b pb-4 mb-4">
            <CardTitle>Pos Pengeluaran Terbesar</CardTitle>
            <CardDescription>Akun alokasi pengeluaran dana terbesar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {topExpenses.length ? (
              topExpenses.map((item) => {
                const percent = (item.value / maxExpense) * 100;
                return (
                  <div key={item.account?.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                        {item.account?.name}
                      </span>
                      <span>{formatCurrency(item.value)}</span>
                    </div>
                    {/* Visual Progress Bar */}
                    <div className="h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-rose-500/80 transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
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
