"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/data-table";
import {
  getAccount,
} from "@/lib/accounting";
import {
  calculateBalanceSheetMemo,
  calculateProfitLossMemo,
  calculateCashFlowMemo,
  calculateTaxReportMemo,
} from "@/lib/accounting-memoized";
import type { NeracaAccountDetail } from "@/lib/types";
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { useKasFlowStore } from "@/store/use-kasflow-store";
import {
  Banknote,
  Landmark,
  Scale,
  TrendingUp,
  FileSpreadsheet,
  ShieldCheck,
  AlertCircle,
  FileDown,
  Calendar,
  Layers,
  BookOpen,
  Users2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  exportPeredaranBrutoPDF,
  exportProfitLossPDF,
  exportBalanceSheetPDF,
  exportAllReportsToExcel,
} from "@/lib/report-export";

type ReportTab = "profit_loss" | "balance_sheet" | "bruto_tax" | "cash_flow";

// Neraca section helper component
function NeracaSectionBlock({ title, details, subtotal, accent }: {
  title: string;
  details: NeracaAccountDetail[];
  subtotal: number;
  accent?: string;
}) {
  return (
    <div className="space-y-1">
      <h5 className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 pl-2">{title}</h5>
      <div className="divide-y divide-zinc-50 dark:divide-zinc-900 pl-4">
        {details.map((d) => (
          <div key={d.accountId} className="flex justify-between py-1.5 text-xs">
            <span className="text-zinc-600 dark:text-zinc-400">
              {d.accountName}
            </span>
            <span className="text-foreground">
              {formatCurrency(d.balance)}
            </span>
          </div>
        ))}
        {details.length === 0 && (
          <div className="flex justify-between py-1.5 text-xs text-muted-foreground">
            <span>-</span><span>-</span>
          </div>
        )}
      </div>
      <div className="flex justify-between py-2 text-xs font-semibold border-t border-zinc-200 dark:border-zinc-800 pl-2">
        <span>Subtotal {title.split(".")[1]?.trim() || title}</span>
        <span className={accent}>{formatCurrency(subtotal)}</span>
      </div>
    </div>
  );
}

// Custom Tooltip component for Recharts Area
function CustomAreaTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-800 dark:bg-zinc-950 animate-in fade-in duration-200">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">{label}</p>
        <div className="flex items-center gap-4 justify-between text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {payload[0].name}:
          </span>
          <span className="font-semibold text-foreground">{formatCurrency(payload[0].value)}</span>
        </div>
      </div>
    );
  }
  return null;
}

export default function ReportsPage() {
  const accounts = useKasFlowStore((state) => state.accounts);
  const journalEntries = useKasFlowStore((state) => state.journalEntries);
  const journalEntriesLoaded = useKasFlowStore((state) => state.journalEntriesLoaded);
  const loadJournalEntries = useKasFlowStore((state) => state.loadJournalEntries);
  const companyId = useKasFlowStore((state) => state.companyId);
  const transactions = useKasFlowStore((state) => state.transactions);
  const categories = useKasFlowStore((state) => state.categories);
  const profile = useKasFlowStore((state) => state.profile);
  const taxSettings = useKasFlowStore((state) => state.taxSettings);
  const accountingPeriods = useKasFlowStore((state) => state.accountingPeriods);

  // Load journal entries on mount if not already loaded
  useEffect(() => {
    if (companyId && !journalEntriesLoaded) {
      loadJournalEntries();
    }
  }, [companyId, journalEntriesLoaded, loadJournalEntries]);

  const [activeTab, setActiveTab] = useState<ReportTab>("profit_loss");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const yearsList = [2024, 2025, 2026, 2027];

  // Dynamic date boundary for calculation
  const fromDate = `${selectedYear}-01-01`;
  const toDate = `${selectedYear}-12-31`;

  // Financial calculations memoized based on selected date boundary
  const profitLoss = useMemo(
    () => calculateProfitLossMemo(journalEntries, accounts, fromDate, toDate, transactions, taxSettings),
    [journalEntries, accounts, fromDate, toDate, transactions, taxSettings],
  );

  const balanceSheet = useMemo(
    () => calculateBalanceSheetMemo(journalEntries, accounts, taxSettings, accountingPeriods),
    [journalEntries, accounts, taxSettings, accountingPeriods],
  );

  const cashFlow = useMemo(
    () => calculateCashFlowMemo(journalEntries, accounts),
    [journalEntries, accounts],
  );

  // Generate 12 months for Peredaran Bruto
  const monthlyTaxReports = useMemo(() => {
    const months = [
      { name: "Januari", key: "01" },
      { name: "Februari", key: "02" },
      { name: "Maret", key: "03" },
      { name: "April", key: "04" },
      { name: "Mei", key: "05" },
      { name: "Juni", key: "06" },
      { name: "Juli", key: "07" },
      { name: "Agustus", key: "08" },
      { name: "September", key: "09" },
      { name: "Oktober", key: "10" },
      { name: "November", key: "11" },
      { name: "Desember", key: "12" },
    ];

    let cumulativeTurnover = 0;
    let cumulativeTax = 0;

    return months.map((m) => {
      const periodKey = `${selectedYear}-${m.key}`;
      const report = calculateTaxReportMemo(journalEntries, accounts, taxSettings, periodKey);

      cumulativeTurnover += report.grossRevenue;
      cumulativeTax += report.estimatedTax;

      return {
        monthName: m.name,
        grossRevenue: report.grossRevenue,
        tax: report.estimatedTax,
        cumOmset: cumulativeTurnover,
        cumTax: cumulativeTax,
      };
    });
  }, [journalEntries, accounts, taxSettings, selectedYear]);

  // Aggregate totals for Peredaran Bruto
  const totalGrossRevenue = useMemo(() => monthlyTaxReports.reduce((sum, item) => sum + item.grossRevenue, 0), [monthlyTaxReports]);
  const totalTaxDue = useMemo(() => monthlyTaxReports.reduce((sum, item) => sum + item.tax, 0), [monthlyTaxReports]);

  // Trigger Excel download
  const handleExcelExport = async () => {
    await exportAllReportsToExcel(profile, selectedYear, monthlyTaxReports, profitLoss, balanceSheet, accounts);
  };

  // Trigger PDF download depending on active tab
  const handlePdfExport = () => {
    if (activeTab === "profit_loss") {
      exportProfitLossPDF(profile, selectedYear, profitLoss, accounts);
    } else if (activeTab === "balance_sheet") {
      exportBalanceSheetPDF(profile, selectedYear, balanceSheet);
    } else if (activeTab === "bruto_tax") {
      exportPeredaranBrutoPDF(profile, selectedYear, monthlyTaxReports);
    } else {
      toast.warning("Grafik arus kas tidak dapat diekspor langsung ke PDF dokumen formal.");
    }
  };

  // Signature Block JSX for on-screen document look
  const renderedSignatureBlock = (
    <div className="flex justify-center pt-10 text-xs">
      <div className="w-full sm:w-64 space-y-12 sm:space-y-16 text-center select-none">
        <div className="space-y-1">
          <p className="text-muted-foreground font-medium">Pekanbaru, {new Date().getDate()} April {selectedYear + 1}</p>
          <p className="font-semibold text-foreground">Penanggung Jawab,</p>
        </div>
        <div className="space-y-1 leading-none">
          <p className="font-bold text-foreground underline">{profile.ownerName || "NOVIA SINATA"}</p>
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
            {profile.businessType === "freelancer" ? "Freelancer" : "Direktur / Pemilik"}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Page Header with Filters & Action Buttons */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b pb-5 border-zinc-200/50 dark:border-zinc-800/40">
        <div>
          <Badge tone="green">Laporan Keuangan</Badge>
          <h2 className="mt-3 text-xl font-bold tracking-tight sm:text-2xl lg:text-3xl text-foreground">
            Laporan & Finansial
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Rekapitulasi laba rugi, neraca aktiva-pasiva, serta peredaran bruto PPh Final UMKM.
          </p>
        </div>

        {/* Action Header controls */}
        <div className="space-y-2.5 self-start lg:self-auto lg:space-y-0 lg:flex lg:items-center lg:gap-2">
          {/* Year selector - full width on mobile, auto on desktop */}
          <div className="relative w-full lg:w-auto">
            <Calendar className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="h-9.5 w-full lg:w-40 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-card pl-8 pr-2 text-xs font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition duration-150 appearance-none"
            >
              {yearsList.map((y) => (
                <option key={y} value={y}>
                  Tahun Pajak {y}
                </option>
              ))}
            </select>
          </div>

          {/* Export buttons - row below on mobile, inline on desktop */}
          <div className="flex items-center gap-2">
            {/* Excel Export Button */}
            <Button
              onClick={handleExcelExport}
              variant="outline"
              className="flex-1 lg:flex-none text-xs font-semibold h-9.5 gap-1.5"
            >
              <FileDown className="h-4 w-4" />
              <span className="hidden sm:inline">Export </span>Excel
            </Button>

            {/* PDF Export Button */}
            {activeTab !== "cash_flow" && (
              <Button
                onClick={handlePdfExport}
                className="flex-1 lg:flex-none bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-white text-xs font-semibold h-9.5 gap-1.5"
              >
                <FileDown className="h-4 w-4" />
                <span className="hidden sm:inline">Export </span>PDF
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards - 2-col grid on mobile, 4-col on desktop */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
        <MetricCard
          title="Gross Revenue"
          value={formatCurrencyCompact(profitLoss.revenue)}
          icon={TrendingUp}
          tone="green"
          compact
        />
        <MetricCard
          title="Total Beban"
          value={formatCurrencyCompact(
            profitLoss.cogs +
            profitLoss.totalOperatingExpenses +
            profitLoss.nonOperatingExpense +
            profitLoss.taxExpense,
          )}
          icon={Banknote}
          tone="red"
          compact
        />
        <MetricCard
          title="Net Profit"
          value={formatCurrencyCompact(profitLoss.netProfit)}
          icon={Scale}
          tone={profitLoss.netProfit >= 0 ? "green" : "red"}
          compact
        />
        <MetricCard
          title="Total Assets"
          value={formatCurrencyCompact(balanceSheet.assets)}
          icon={Landmark}
          tone="blue"
          compact
        />
      </div>

      {/* Navigation Tabs - scrollable pills on mobile */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 pb-1 lg:mx-0 lg:px-0 lg:border-b lg:border-zinc-200 lg:dark:border-zinc-800 lg:gap-6">
        <button
          onClick={() => setActiveTab("profit_loss")}
          className={cn(
            "shrink-0 px-3.5 py-2 text-xs font-semibold tracking-wider transition rounded-full lg:rounded-none lg:pb-3.5 lg:px-0 lg:uppercase",
            activeTab === "profit_loss"
              ? "bg-emerald-500 text-white lg:bg-transparent lg:text-primary lg:border-b-2 lg:border-primary"
              : "text-muted-foreground hover:text-foreground bg-zinc-100 dark:bg-white/[0.06] dark:hover:bg-white/[0.10] dark:border dark:border-white/[0.08] lg:bg-transparent lg:dark:bg-transparent lg:dark:border-0"
          )}
        >
          <span className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> <span className="lg:hidden">Laba Rugi</span><span className="hidden lg:inline">Laba Rugi</span>
          </span>
        </button>
        <button
          onClick={() => setActiveTab("balance_sheet")}
          className={cn(
            "shrink-0 px-3.5 py-2 text-xs font-semibold tracking-wider transition rounded-full lg:rounded-none lg:pb-3.5 lg:px-0 lg:uppercase",
            activeTab === "balance_sheet"
              ? "bg-emerald-500 text-white lg:bg-transparent lg:text-primary lg:border-b-2 lg:border-primary"
              : "text-muted-foreground hover:text-foreground bg-zinc-100 dark:bg-white/[0.06] dark:hover:bg-white/[0.10] dark:border dark:border-white/[0.08] lg:bg-transparent lg:dark:bg-transparent lg:dark:border-0"
          )}
        >
          <span className="flex items-center gap-2">
            <Layers className="h-4 w-4" /> <span className="lg:hidden">Neraca</span><span className="hidden lg:inline">Neraca Keuangan</span>
          </span>
        </button>
        <button
          onClick={() => setActiveTab("bruto_tax")}
          className={cn(
            "shrink-0 px-3.5 py-2 text-xs font-semibold tracking-wider transition rounded-full lg:rounded-none lg:pb-3.5 lg:px-0 lg:uppercase",
            activeTab === "bruto_tax"
              ? "bg-emerald-500 text-white lg:bg-transparent lg:text-primary lg:border-b-2 lg:border-primary"
              : "text-muted-foreground hover:text-foreground bg-zinc-100 dark:bg-white/[0.06] dark:hover:bg-white/[0.10] dark:border dark:border-white/[0.08] lg:bg-transparent lg:dark:bg-transparent lg:dark:border-0"
          )}
        >
          <span className="flex items-center gap-2">
            <Users2 className="h-4 w-4" /> <span className="lg:hidden">Peredaran Bruto</span><span className="hidden lg:inline">Peredaran Bruto (0,5%)</span>
          </span>
        </button>
        <button
          onClick={() => setActiveTab("cash_flow")}
          className={cn(
            "shrink-0 px-3.5 py-2 text-xs font-semibold tracking-wider transition rounded-full lg:rounded-none lg:pb-3.5 lg:px-0 lg:uppercase",
            activeTab === "cash_flow"
              ? "bg-emerald-500 text-white lg:bg-transparent lg:text-primary lg:border-b-2 lg:border-primary"
              : "text-muted-foreground hover:text-foreground bg-zinc-100 dark:bg-white/[0.06] dark:hover:bg-white/[0.10] dark:border dark:border-white/[0.08] lg:bg-transparent lg:dark:bg-transparent lg:dark:border-0"
          )}
        >
          <span className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" /> <span className="lg:hidden">Arus Kas</span><span className="hidden lg:inline">Arus Kas</span>
          </span>
        </button>
      </div>

      {/* Tab Render Body */}
      <div className="space-y-6">
        {activeTab === "profit_loss" && (
          <Card className="border-zinc-200/60 dark:border-zinc-800/50 shadow-sm p-4 sm:p-6 space-y-6 sm:space-y-8 bg-card">
            {/* Styled Sheet-like Document Header */}
            <div className="text-center space-y-1.5 border-b pb-6 select-none">
              <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-zinc-400">Laporan Laba Rugi</h3>
              <h2 className="text-base sm:text-lg font-black uppercase text-foreground tracking-tight">{profile.businessName}</h2>
              <p className="text-xs text-muted-foreground">Tahun Pajak {selectedYear} | Periode: 1 Januari - 31 Desember {selectedYear}</p>
              <div className="text-[10px] text-muted-foreground font-semibold flex flex-col sm:flex-row justify-center gap-1 sm:gap-6 pt-2">
                <span>NPWP: {profile.taxNumber || "-"}</span>
                <span>Mata Uang: IDR (Rupiah)</span>
              </div>
            </div>

            {/* SAK EMKM Income Statement */}
            <div className="space-y-6 max-w-3xl mx-auto">
              {/* I. PENDAPATAN USAHA */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">
                  I. PENDAPATAN USAHA
                </h4>
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {Object.entries(profitLoss.revenueByAccount).map(([accountId, value]) => {
                    const account = getAccount(accounts, accountId);
                    const categoryBreakdown = profitLoss.revenueByAccountAndCategory[accountId] || {};
                    return (
                      <div key={accountId}>
                        <div className="flex justify-between py-2.5 text-xs font-semibold text-foreground">
                          <span className="pl-4 text-zinc-700 dark:text-zinc-300">{account?.name}</span>
                          <span>{formatCurrency(value)}</span>
                        </div>
                        {Object.entries(categoryBreakdown).map(([catId, catValue]) => {
                          const cat = categories.find((c) => c.id === catId);
                          return (
                            <div key={catId} className="flex justify-between py-1.5 text-xs text-zinc-500 pl-8">
                              <span className="truncate max-w-[200px]">{cat?.name || (catId === "_uncategorized_" ? "Tanpa Kategori" : catId)}</span>
                              <span>{formatCurrency(catValue)}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                  <div className="flex justify-between py-3 text-xs font-bold text-foreground border-t-2 border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-900/30 px-3 rounded-lg mt-1">
                    <span>Total Pendapatan Usaha</span>
                    <span>{formatCurrency(profitLoss.revenue)}</span>
                  </div>
                </div>
              </div>

              {/* II. HARGA POKOK PENJUALAN (COGS) */}
              {profitLoss.cogs > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">
                    II. HARGA POKOK PENJUALAN
                  </h4>
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {Object.entries(profitLoss.cogsByAccount).map(([accountId, value]) => {
                      const account = getAccount(accounts, accountId);
                      return (
                        <div key={accountId} className="flex justify-between py-2.5 text-xs font-semibold text-foreground">
                          <span className="pl-4 text-zinc-700 dark:text-zinc-300">{account?.name}</span>
                          <span className="text-rose-500">-{formatCurrency(value)}</span>
                        </div>
                      );
                    })}
                    <div className="flex justify-between py-3 text-xs font-bold text-foreground border-t border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-900/30 px-3 rounded-lg mt-1">
                      <span>Total HPP</span>
                      <span className="text-rose-500">-{formatCurrency(profitLoss.cogs)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* III. LABA KOTOR */}
              {profitLoss.cogs > 0 && (
                <div className="flex justify-between items-center py-3 px-4 bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-200 dark:border-emerald-800 rounded-lg">
                  <span className="text-sm font-bold text-emerald-900 dark:text-emerald-100">III. LABA KOTOR</span>
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(profitLoss.grossProfit)}</span>
                </div>
              )}

              {/* IV. BEBAN OPERASIONAL */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">
                  IV. BEBAN OPERASIONAL
                </h4>

                {/* Beban Penjualan */}
                {Object.keys(profitLoss.sellingByAccount).length > 0 && (
                  <div className="space-y-1">
                    <h5 className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 pl-2">A. Beban Penjualan</h5>
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800 pl-4">
                      {Object.entries(profitLoss.sellingByAccount).map(([accountId, value]) => {
                        const account = getAccount(accounts, accountId);
                        return (
                          <div key={accountId} className="flex justify-between py-2 text-xs">
                            <span className="text-zinc-600 dark:text-zinc-400">{account?.name}</span>
                            <span className="text-rose-500">-{formatCurrency(value)}</span>
                          </div>
                        );
                      })}
                      <div className="flex justify-between py-2 text-xs font-semibold border-t border-zinc-200 dark:border-zinc-800">
                        <span>Subtotal Beban Penjualan</span>
                        <span className="text-rose-500">-{formatCurrency(profitLoss.sellingExpenses)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Beban Administrasi & Umum */}
                {Object.keys(profitLoss.adminByAccount).length > 0 && (
                  <div className="space-y-1">
                    <h5 className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 pl-2">B. Beban Administrasi & Umum</h5>
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800 pl-4">
                      {Object.entries(profitLoss.adminByAccount).map(([accountId, value]) => {
                        const account = getAccount(accounts, accountId);
                        return (
                          <div key={accountId} className="flex justify-between py-2 text-xs">
                            <span className="text-zinc-600 dark:text-zinc-400">{account?.name}</span>
                            <span className="text-rose-500">-{formatCurrency(value)}</span>
                          </div>
                        );
                      })}
                      <div className="flex justify-between py-2 text-xs font-semibold border-t border-zinc-200 dark:border-zinc-800">
                        <span>Subtotal Beban Administrasi</span>
                        <span className="text-rose-500">-{formatCurrency(profitLoss.adminExpenses)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Beban Operasional Lainnya */}
                {Object.keys(profitLoss.otherOperatingByAccount).length > 0 && (
                  <div className="space-y-1">
                    <h5 className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 pl-2">C. Beban Operasional Lainnya</h5>
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800 pl-4">
                      {Object.entries(profitLoss.otherOperatingByAccount).map(([accountId, value]) => {
                        const account = getAccount(accounts, accountId);
                        return (
                          <div key={accountId} className="flex justify-between py-2 text-xs">
                            <span className="text-zinc-600 dark:text-zinc-400">{account?.name}</span>
                            <span className="text-rose-500">-{formatCurrency(value)}</span>
                          </div>
                        );
                      })}
                      <div className="flex justify-between py-2 text-xs font-semibold border-t border-zinc-200 dark:border-zinc-800">
                        <span>Subtotal Beban Operasional Lainnya</span>
                        <span className="text-rose-500">-{formatCurrency(profitLoss.otherOperatingExpenses)}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-between py-3 text-xs font-bold text-foreground border-t-2 border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-900/30 px-3 rounded-lg">
                  <span>Total Beban Operasional</span>
                  <span className="text-rose-500">-{formatCurrency(profitLoss.totalOperatingExpenses)}</span>
                </div>
              </div>

              {/* V. LABA OPERASIONAL (EBIT) */}
              <div className="flex justify-between items-center py-3 px-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg">
                <span className="text-sm font-bold text-blue-900 dark:text-blue-100">V. LABA OPERASIONAL (EBIT)</span>
                <span className={profitLoss.ebit >= 0 ? "text-sm font-bold text-emerald-600 dark:text-emerald-400" : "text-sm font-bold text-rose-600 dark:text-rose-400"}>
                  {formatCurrency(profitLoss.ebit)}
                </span>
              </div>

              {/* VI. PENDAPATAN & BEBAN DI LUAR USAHA */}
              {(profitLoss.nonOperatingIncome > 0 || profitLoss.nonOperatingExpense > 0) && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">
                    VI. PENDAPATAN & BEBAN DI LUAR USAHA
                  </h4>
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {Object.entries(profitLoss.nonOperatingIncomeByAccount).map(([accountId, value]) => {
                      const account = getAccount(accounts, accountId);
                      return (
                        <div key={accountId} className="flex justify-between py-2 text-xs">
                          <span className="pl-4 text-zinc-600 dark:text-zinc-400">{account?.name}</span>
                          <span className="text-emerald-500">{formatCurrency(value)}</span>
                        </div>
                      );
                    })}
                    {Object.entries(profitLoss.nonOperatingExpenseByAccount).map(([accountId, value]) => {
                      const account = getAccount(accounts, accountId);
                      return (
                        <div key={accountId} className="flex justify-between py-2 text-xs">
                          <span className="pl-4 text-zinc-600 dark:text-zinc-400">{account?.name}</span>
                          <span className="text-rose-500">-{formatCurrency(value)}</span>
                        </div>
                      );
                    })}
                    <div className="flex justify-between py-2 text-xs font-semibold border-t border-zinc-200 dark:border-zinc-800">
                      <span>Total Pendapatan/Beban Lain</span>
                      <span className={profitLoss.nonOperatingNet >= 0 ? "text-emerald-500" : "text-rose-500"}>
                        {formatCurrency(profitLoss.nonOperatingNet)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* VII. LABA SEBELUM PAJAK (EBT) */}
              <div className="flex justify-between items-center py-3 px-4 bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-200 dark:border-purple-800 rounded-lg">
                <span className="text-sm font-bold text-purple-900 dark:text-purple-100">VII. LABA SEBELUM PAJAK</span>
                <span className={profitLoss.ebt >= 0 ? "text-sm font-bold text-emerald-600 dark:text-emerald-400" : "text-sm font-bold text-rose-600 dark:text-rose-400"}>
                  {formatCurrency(profitLoss.ebt)}
                </span>
              </div>

              {/* VIII. BEBAN PAJAK */}
              {profitLoss.taxExpense > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">
                    VIII. BEBAN PAJAK PENGHASILAN
                  </h4>
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {Object.entries(profitLoss.taxByAccount).map(([accountId, value]) => {
                      const account = getAccount(accounts, accountId);
                      return (
                        <div key={accountId} className="flex justify-between py-2 text-xs">
                          <span className="pl-4 text-zinc-600 dark:text-zinc-400">{account?.name}</span>
                          <span className="text-rose-500">-{formatCurrency(value)}</span>
                        </div>
                      );
                    })}
                    <div className="flex justify-between py-2 text-xs font-semibold border-t border-zinc-200 dark:border-zinc-800">
                      <span>Total Beban Pajak</span>
                      <span className="text-rose-500">-{formatCurrency(profitLoss.taxExpense)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* IX. LABA BERSIH SETELAH PAJAK */}
              <div className="flex justify-between items-center py-4 px-5 bg-gradient-to-r from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-700 rounded-lg shadow-lg">
                <span className="text-base font-bold text-white">IX. LABA BERSIH SETELAH PAJAK</span>
                <span className="text-lg font-bold text-white">{formatCurrency(profitLoss.netProfit)}</span>
              </div>
            </div>

            {/* Signature Block */}
            {renderedSignatureBlock}
          </Card>
        )}

        {activeTab === "balance_sheet" && (
          <Card className="border-zinc-200/60 dark:border-zinc-800/50 shadow-sm p-4 sm:p-6 space-y-6 sm:space-y-8 bg-card">
            {/* Styled Sheet-like Document Header */}
            <div className="text-center space-y-1.5 border-b pb-6 select-none">
              <h3 className="text-sm font-extrabold uppercase tracking-widest text-zinc-400">Neraca Keuangan</h3>
              <h2 className="text-base sm:text-lg font-black uppercase text-foreground tracking-tight">{profile.businessName}</h2>
              <p className="text-xs text-muted-foreground">Per tanggal 31 Desember {selectedYear}</p>
              <div className="text-[10px] text-muted-foreground font-semibold flex flex-col sm:flex-row justify-center gap-1 sm:gap-6 pt-2">
                <span>NPWP: {profile.taxNumber || "-"}</span>
                <span>Mata Uang: IDR (Rupiah)</span>
              </div>
            </div>

            {/* Balance Sheet Columns (Aktiva vs Pasiva) */}
            <div className="grid gap-6 lg:grid-cols-2 max-w-4xl mx-auto border-zinc-200/60 dark:border-zinc-800/60">
              {/* Left Column: Aktiva */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">AKTIVA / ASET</h4>
                <div className="space-y-4 border-y py-3">
                  <NeracaSectionBlock
                    title="A. Aset Lancar"
                    details={balanceSheet.asetLancarDetails}
                    subtotal={balanceSheet.asetLancar}
                  />
                  <NeracaSectionBlock
                    title="B. Aset Tetap"
                    details={[
                      ...balanceSheet.asetTetapDetails,
                      ...balanceSheet.akumulasiPenyusutanDetails.map((d) => ({
                        ...d,
                        balance: -d.balance,
                        accountName: `${d.accountName} (-)`,
                      })),
                    ]}
                    subtotal={balanceSheet.asetTetap}
                  />
                </div>
                <div className="flex justify-between py-2.5 text-xs font-bold text-foreground bg-zinc-50 dark:bg-zinc-900/30 px-3 rounded-lg border border-zinc-200/50">
                  <span>TOTAL AKTIVA</span>
                  <span>{formatCurrency(balanceSheet.totalAset)}</span>
                </div>
              </div>

              {/* Right Column: Pasiva */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">PASIVA (KEWAJIBAN & EKUITAS)</h4>
                <div className="space-y-4 border-y py-3">
                  <NeracaSectionBlock
                    title="C. Kewajiban Lancar"
                    details={balanceSheet.kewajibanLancarDetails}
                    subtotal={balanceSheet.kewajibanLancar}
                  />
                  <NeracaSectionBlock
                    title="D. Kewajiban Jangka Panjang"
                    details={balanceSheet.kewajibanJangkaPanjangDetails}
                    subtotal={balanceSheet.kewajibanJangkaPanjang}
                  />
                  <NeracaSectionBlock
                    title="E. Ekuitas"
                    details={balanceSheet.ekuitasDetails}
                    subtotal={balanceSheet.totalEkuitas}
                  />
                </div>
                <div className="flex justify-between py-2.5 text-xs font-bold text-foreground bg-zinc-50 dark:bg-zinc-900/30 px-3 rounded-lg border border-zinc-200/50">
                  <span>TOTAL PASIVA</span>
                  <span>{formatCurrency(balanceSheet.totalKewajiban + balanceSheet.totalEkuitas)}</span>
                </div>
              </div>
            </div>

            {/* Balance check */}
            <div className="max-w-4xl mx-auto rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 sm:p-4 bg-zinc-50/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {balanceSheet.isBalanced ? (
                  <>
                    <ShieldCheck className="h-5 w-5 text-emerald-500" />
                    <Badge tone="green">Balanced</Badge>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-rose-500" />
                    <Badge tone="red">Needs Review</Badge>
                  </>
                )}
                <span className="text-[10px] text-muted-foreground font-semibold">Toleransi selisih Aktiva vs Pasiva &lt; Rp1.</span>
              </div>
            </div>

            {/* Signature Block */}
            {renderedSignatureBlock}
          </Card>
        )}

        {activeTab === "bruto_tax" && (
          <Card className="border-zinc-200/60 dark:border-zinc-800/50 shadow-sm p-4 sm:p-6 space-y-8 bg-card">
            {/* Styled Sheet-like Document Header */}
            <div className="text-center space-y-1.5 border-b pb-6 select-none">
              <h3 className="text-sm font-extrabold uppercase tracking-widest text-zinc-400">Laporan Peredaran Bruto (Omset) UMKM</h3>
              <h2 className="text-base sm:text-lg font-black uppercase text-foreground tracking-tight">{profile.businessName}</h2>
              <p className="text-xs text-muted-foreground">Tahun Pajak {selectedYear} | Periode: 1 Januari - 31 Desember {selectedYear}</p>
              <div className="text-[10px] text-muted-foreground font-semibold flex flex-col sm:flex-row justify-center gap-1 sm:gap-6 pt-2">
                <span>NPWP: {profile.taxNumber || "-"}</span>
                <span>Skema Perpajakan: PPh Final 0,5% (PP No. 55 Tahun 2022)</span>
              </div>
            </div>

            {/* Monthly data */}
            <>
              {/* Mobile: month cards */}
              <div className="lg:hidden space-y-3">
                {monthlyTaxReports.map((item, index) => (
                  <div key={index} className="rounded-xl border border-zinc-200/60 dark:border-zinc-800/50 p-4 bg-zinc-50/25 dark:bg-zinc-900/10">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-bold text-sm text-foreground">{item.monthName}</span>
                      <Badge tone="muted" className="text-[10px]">#{index + 1}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Peredaran Bruto</span>
                        <p className="font-bold text-zinc-950 dark:text-white mt-0.5">{formatCurrency(item.grossRevenue)}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">PPh Final 0,5%</span>
                        <p className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{formatCurrency(item.tax)}</p>
                      </div>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800/50 grid grid-cols-2 gap-3 text-[11px]">
                      <div>
                        <span className="text-muted-foreground">Kum. Omset</span>
                        <p className="font-semibold text-foreground">{formatCurrency(item.cumOmset)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Kum. PPh</span>
                        <p className="font-semibold text-foreground">{formatCurrency(item.cumTax)}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {/* Total summary */}
                <div className="rounded-xl border-2 border-zinc-300 dark:border-zinc-700 p-4 bg-zinc-50 dark:bg-zinc-900/30">
                  <p className="font-bold text-xs uppercase tracking-wider text-foreground mb-3">Total Tahun {selectedYear}</p>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Total Bruto</span>
                      <p className="font-extrabold text-zinc-950 dark:text-white mt-0.5">{formatCurrency(totalGrossRevenue)}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Total PPh</span>
                      <p className="font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">{formatCurrency(totalTaxDue)}</p>
                    </div>
                  </div>
                </div>
              </div>
              {/* Desktop: table */}
              <div className="hidden lg:block overflow-x-auto">
                <div className="min-w-[700px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">No</TableHead>
                        <TableHead>Bulan</TableHead>
                        <TableHead className="text-right">Peredaran Bruto (Rp)</TableHead>
                        <TableHead className="text-right">PPh Final 0,5% (Rp)</TableHead>
                        <TableHead className="text-right">Kumulatif Omset (Rp)</TableHead>
                        <TableHead className="text-right">Kumulatif PPh (Rp)</TableHead>
                        <TableHead className="text-center">Keterangan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthlyTaxReports.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                          <TableCell className="font-bold">{item.monthName}</TableCell>
                          <TableCell className="text-right font-semibold text-zinc-950 dark:text-white">
                            {formatCurrency(item.grossRevenue)}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(item.tax)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatCurrency(item.cumOmset)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatCurrency(item.cumTax)}
                          </TableCell>
                          <TableCell className="text-center text-muted-foreground">-</TableCell>
                        </TableRow>
                      ))}
                      {/* Total Row */}
                      <TableRow className="bg-zinc-50/70 dark:bg-zinc-900/40 font-black border-t border-zinc-900">
                        <TableCell></TableCell>
                        <TableCell className="uppercase tracking-wider">Total Tahun {selectedYear}</TableCell>
                        <TableCell className="text-right text-zinc-950 dark:text-white font-extrabold">
                          {formatCurrency(totalGrossRevenue)}
                        </TableCell>
                        <TableCell className="text-right text-emerald-600 dark:text-emerald-400 font-extrabold">
                          {formatCurrency(totalTaxDue)}
                        </TableCell>
                        <TableCell className="text-right">-</TableCell>
                        <TableCell className="text-right">-</TableCell>
                        <TableCell className="text-center text-muted-foreground font-semibold">Total Setahun</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>

            {/* Legal Footnote disclaimer */}
            <div className="text-[10px] text-muted-foreground/80 leading-normal border-t pt-4">
              <span className="font-bold text-foreground">Catatan Perpajakan:</span>
              <p className="mt-1">1. Sesuai PP No. 55 Tahun 2022, PPh Final 0,5% dihitung dari peredaran bruto/omset bulanan.</p>
              <p>2. Khusus Wajib Pajak Orang Pribadi (OP), dikenakan pajak apabila akumulasi omset kumulatif setahun telah melewati batas ambang tidak kena pajak Rp 500.000.000 (Lima Ratus Juta Rupiah).</p>
            </div>

            {/* Signature Block */}
            {renderedSignatureBlock}
          </Card>
        )}

        {activeTab === "cash_flow" && (
          <div className="space-y-6">
            <Card className="border-zinc-200/60 dark:border-zinc-800/50 shadow-sm">
              <CardHeader className="border-b pb-4 mb-4">
                <CardTitle>Arus Kas Bersih (Net Cash Flow)</CardTitle>
                <CardDescription>Grafik aliran dana masuk & keluar riil dari aktivitas operasional.</CardDescription>
              </CardHeader>
              <CardContent className="h-56 lg:h-80 mt-2">
                <ClientOnlyChart>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={cashFlow} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
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
                      <Tooltip content={<CustomAreaTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="net"
                        name="Kas Bersih"
                        fill="url(#colorNet)"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </ClientOnlyChart>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
