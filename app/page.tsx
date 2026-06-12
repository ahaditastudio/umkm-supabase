"use client";

import {
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  Calculator,
  Landmark,
  Wallet,
} from "lucide-react";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ClientOnlyChart } from "@/components/client-only-chart";
import { MetricCard } from "@/components/metric-card";
import { Badge } from "@/components/ui/badge";
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

export default function DashboardPage() {
  const accounts = useKasFlowStore((state) => state.accounts);
  const cashAccounts = useKasFlowStore((state) => state.cashAccounts);
  const journalEntries = useKasFlowStore((state) => state.journalEntries);
  const taxSettings = useKasFlowStore((state) => state.taxSettings);
  const transactions = useKasFlowStore((state) => state.transactions);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Badge tone="green">Ledger First Architecture</Badge>
          <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            Dashboard Keuangan
          </h2>
          <p className="mt-1 text-muted-foreground">
            Semua KPI dihitung dari journal entries, bukan dari transaksi
            mentah.
          </p>
        </div>
        <div className="rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">
          {transactions.filter((item) => !item.deletedAt).length} transaksi
          aktif • {journalEntries.filter((item) => !item.deletedAt).length}{" "}
          jurnal
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
        />
        <MetricCard
          title="Estimasi Pajak"
          value={formatCurrency(summary.estimatedTax)}
          icon={Calculator}
          tone="yellow"
          helper={`${taxSettings.name} • ${(taxSettings.rate * 100).toFixed(2)}%`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle>Pendapatan vs Pengeluaran</CardTitle>
            <CardDescription>
              Agregasi bulanan dari akun revenue dan expense.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ClientOnlyChart>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cashFlow}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="period" />
                  <YAxis
                    tickFormatter={(value) => `${Number(value) / 1_000_000}jt`}
                  />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value))}
                  />
                  <Bar
                    dataKey="income"
                    name="Pendapatan"
                    fill="#10b981"
                    radius={[8, 8, 0, 0]}
                  />
                  <Bar
                    dataKey="expense"
                    name="Pengeluaran"
                    fill="#ef4444"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ClientOnlyChart>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Cashflow</CardTitle>
            <CardDescription>
              Net income bulanan sebagai indikator arus kas operasional.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ClientOnlyChart>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cashFlow}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="period" />
                  <YAxis
                    tickFormatter={(value) => `${Number(value) / 1_000_000}jt`}
                  />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value))}
                  />
                  <Line
                    type="monotone"
                    dataKey="net"
                    name="Net"
                    stroke="#14b8a6"
                    strokeWidth={3}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ClientOnlyChart>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Pendapatan</CardTitle>
            <CardDescription>
              Akun revenue dengan nominal terbesar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {topRevenue.length ? (
              topRevenue.map((item) => (
                <div
                  key={item.account?.id}
                  className="flex items-center justify-between rounded-xl bg-muted px-4 py-3"
                >
                  <span className="font-medium">{item.account?.name}</span>
                  <span>{formatCurrency(item.value)}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                Belum ada pendapatan.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Pengeluaran</CardTitle>
            <CardDescription>
              Akun expense dengan nominal terbesar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {topExpenses.length ? (
              topExpenses.map((item) => (
                <div
                  key={item.account?.id}
                  className="flex items-center justify-between rounded-xl bg-muted px-4 py-3"
                >
                  <span className="font-medium">{item.account?.name}</span>
                  <span>{formatCurrency(item.value)}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                Belum ada pengeluaran.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
