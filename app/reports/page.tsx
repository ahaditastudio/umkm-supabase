"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
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
  calculateBalanceSheet,
  calculateCashFlow,
  calculateProfitLoss,
  getAccount,
} from "@/lib/accounting";
import { formatCurrency } from "@/lib/utils";
import { useKasFlowStore } from "@/store/use-kasflow-store";
import { Banknote, Landmark, Scale, TrendingUp } from "lucide-react";

export default function ReportsPage() {
  const accounts = useKasFlowStore((state) => state.accounts);
  const journalEntries = useKasFlowStore((state) => state.journalEntries);
  const profitLoss = useMemo(
    () => calculateProfitLoss(journalEntries, accounts),
    [journalEntries, accounts],
  );
  const balanceSheet = useMemo(
    () => calculateBalanceSheet(journalEntries, accounts),
    [journalEntries, accounts],
  );
  const cashFlow = useMemo(
    () => calculateCashFlow(journalEntries, accounts),
    [journalEntries, accounts],
  );

  return (
    <div className="space-y-6">
      <div>
        <Badge tone="green">Reports from Journal</Badge>
        <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
          Laporan Keuangan
        </h2>
        <p className="mt-1 text-muted-foreground">
          Gross revenue, profit & loss, balance sheet, dan cash flow dihitung
          langsung dari jurnal.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Gross Revenue"
          value={formatCurrency(profitLoss.revenue)}
          icon={TrendingUp}
          tone="green"
        />
        <MetricCard
          title="Total Expenses"
          value={formatCurrency(profitLoss.expenses)}
          icon={Banknote}
          tone="red"
        />
        <MetricCard
          title="Net Profit"
          value={formatCurrency(profitLoss.netProfit)}
          icon={Scale}
          tone={profitLoss.netProfit >= 0 ? "green" : "red"}
        />
        <MetricCard
          title="Total Assets"
          value={formatCurrency(balanceSheet.assets)}
          icon={Landmark}
          tone="blue"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profit & Loss</CardTitle>
            <CardDescription>
              Revenue minus expenses equals net profit.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <h3 className="font-semibold">Revenue</h3>
              <div className="mt-3 space-y-2">
                {Object.entries(profitLoss.revenueByAccount).map(
                  ([accountId, value]) => (
                    <div
                      key={accountId}
                      className="flex justify-between rounded-xl bg-muted px-4 py-3 text-sm"
                    >
                      <span>{getAccount(accounts, accountId)?.name}</span>
                      <span>{formatCurrency(value)}</span>
                    </div>
                  ),
                )}
              </div>
            </div>
            <div>
              <h3 className="font-semibold">Expenses</h3>
              <div className="mt-3 space-y-2">
                {Object.entries(profitLoss.expenseByAccount).map(
                  ([accountId, value]) => (
                    <div
                      key={accountId}
                      className="flex justify-between rounded-xl bg-muted px-4 py-3 text-sm"
                    >
                      <span>{getAccount(accounts, accountId)?.name}</span>
                      <span>{formatCurrency(value)}</span>
                    </div>
                  ),
                )}
              </div>
            </div>
            <div className="flex justify-between rounded-xl border bg-card px-4 py-3 font-semibold">
              <span>Net Profit</span>
              <span>{formatCurrency(profitLoss.netProfit)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Balance Sheet</CardTitle>
            <CardDescription>
              Formula: Assets = Liabilities + Equity.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between rounded-xl bg-muted px-4 py-3">
              <span>Assets</span>
              <span className="font-semibold">
                {formatCurrency(balanceSheet.assets)}
              </span>
            </div>
            <div className="flex justify-between rounded-xl bg-muted px-4 py-3">
              <span>Liabilities</span>
              <span className="font-semibold">
                {formatCurrency(balanceSheet.liabilities)}
              </span>
            </div>
            <div className="flex justify-between rounded-xl bg-muted px-4 py-3">
              <span>Equity</span>
              <span className="font-semibold">
                {formatCurrency(balanceSheet.equity)}
              </span>
            </div>
            <div className="flex justify-between rounded-xl bg-muted px-4 py-3">
              <span>Retained Earnings</span>
              <span className="font-semibold">
                {formatCurrency(balanceSheet.retainedEarnings)}
              </span>
            </div>
            <div className="rounded-xl border p-4">
              <Badge tone={balanceSheet.isBalanced ? "green" : "red"}>
                {balanceSheet.isBalanced ? "Balanced" : "Needs Review"}
              </Badge>
              <p className="mt-2 text-sm text-muted-foreground">
                Selisih toleransi laporan kurang dari Rp1.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cash Flow</CardTitle>
          <CardDescription>
            Operating activities. Investing activities disiapkan untuk roadmap.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          <ClientOnlyChart>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cashFlow}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="period" />
                <YAxis
                  tickFormatter={(value) => `${Number(value) / 1_000_000}jt`}
                />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Area
                  type="monotone"
                  dataKey="net"
                  name="Net Cashflow"
                  fill="#14b8a6"
                  stroke="#0f766e"
                  fillOpacity={0.22}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ClientOnlyChart>
        </CardContent>
      </Card>
    </div>
  );
}
