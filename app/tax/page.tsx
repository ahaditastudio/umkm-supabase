"use client";

import { CalendarClock, FileCheck, Percent, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
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
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { calculateTaxReport } from "@/lib/accounting";
import { calculateProfitLossMemo, calculateTaxReportMemo } from "@/lib/accounting-memoized";
import { updateTaxSettings as updateTaxSettingsDB } from "@/lib/supabase/company-service";
import { toast } from "@/lib/toast";
import type { TaxSettings } from "@/lib/types";
import { formatCurrency, formatDate, monthKey, toInputDate } from "@/lib/utils";
import { useKasFlowStore } from "@/store/use-kasflow-store";

export default function TaxPage() {
  const { appUser } = useAuth();
  const accounts = useKasFlowStore((state) => state.accounts);
  const journalEntries = useKasFlowStore((state) => state.journalEntries);
  const journalEntriesLoaded = useKasFlowStore((state) => state.journalEntriesLoaded);
  const loadJournalEntries = useKasFlowStore((state) => state.loadJournalEntries);
  const companyId = useKasFlowStore((state) => state.companyId);
  const taxSettings = useKasFlowStore((state) => state.taxSettings);
  const updateTaxSettings = useKasFlowStore((state) => state.updateTaxSettings);
  const [period, setPeriod] = useState(monthKey(new Date()));

  // Local form states
  const [formName, setFormName] = useState(taxSettings.name);
  const [formRate, setFormRate] = useState(taxSettings.rate * 100);
  const [formBase, setFormBase] = useState<"gross_revenue" | "net_profit">(taxSettings.base);
  const [formDueDay, setFormDueDay] = useState(taxSettings.dueDay);
  const [formEnabled, setFormEnabled] = useState(taxSettings.enabled);
  const [saving, setSaving] = useState(false);

  // Sync form states with store when taxSettings loads or updates
  useEffect(() => {
    setFormName(taxSettings.name);
    setFormRate(taxSettings.rate * 100);
    setFormBase(taxSettings.base);
    setFormDueDay(taxSettings.dueDay);
    setFormEnabled(taxSettings.enabled);
  }, [taxSettings]);

  const isDirty =
    formName !== taxSettings.name ||
    formRate !== taxSettings.rate * 100 ||
    formBase !== taxSettings.base ||
    formDueDay !== taxSettings.dueDay ||
    formEnabled !== taxSettings.enabled;

  useEffect(() => {
    if (companyId && !journalEntriesLoaded) {
      loadJournalEntries();
    }
  }, [companyId, journalEntriesLoaded, loadJournalEntries]);

  const taxReport = useMemo(
    () => calculateTaxReportMemo(journalEntries, accounts, taxSettings, period),
    [journalEntries, accounts, taxSettings, period],
  );

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error("Nama aturan pajak wajib diisi.");
      return;
    }
    const rateVal = Number(formRate);
    if (isNaN(rateVal) || rateVal < 0) {
      toast.error("Tarif pajak harus berupa angka positif.");
      return;
    }
    const dueDayVal = Number(formDueDay);
    if (isNaN(dueDayVal) || dueDayVal < 1 || dueDayVal > 28) {
      toast.error("Due day harus bernilai di antara 1 dan 28.");
      return;
    }

    setSaving(true);
    try {
      const updates = {
        name: formName.trim(),
        rate: rateVal / 100,
        base: formBase,
        dueDay: dueDayVal,
        enabled: formEnabled,
      };

      updateTaxSettings(updates);
      if (appUser) {
        await updateTaxSettingsDB(appUser.companyId, { ...taxSettings, ...updates });
      }
      toast.success("Pengaturan pajak berhasil diperbarui.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal memperbarui pengaturan pajak.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setFormName(taxSettings.name);
    setFormRate(taxSettings.rate * 100);
    setFormBase(taxSettings.base);
    setFormDueDay(taxSettings.dueDay);
    setFormEnabled(taxSettings.enabled);
  };

  const annual = useMemo(() => {
    const year = Number(period.slice(0, 4));
    const report = calculateProfitLossMemo(
      journalEntries,
      accounts,
      toInputDate(new Date(year, 0, 1)),
      toInputDate(new Date(year, 11, 31)),
      undefined,
      taxSettings,
    );
    const base =
      taxSettings.base === "gross_revenue"
        ? report.revenue
        : Math.max(report.netProfit, 0);
    return taxSettings.enabled ? base * taxSettings.rate : 0;
  }, [journalEntries, accounts, taxSettings, period]);

  return (
    <div className="space-y-6">
      <div>
        <Badge tone="yellow">Tax Module</Badge>
        <h2 className="mt-3 text-xl font-bold tracking-tight sm:text-2xl lg:text-3xl">
          Pajak
        </h2>
        <p className="mt-1 text-muted-foreground">
          Tax rules tidak hardcoded. Tarif, basis, dan due date bisa diubah dari
          settings.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Gross Revenue"
          value={formatCurrency(taxReport.grossRevenue)}
          icon={FileCheck}
          tone="green"
        />
        <MetricCard
          title="Net Profit"
          value={formatCurrency(taxReport.netProfit)}
          icon={FileCheck}
          tone={taxReport.netProfit >= 0 ? "green" : "red"}
        />
        <MetricCard
          title="Estimasi Bulanan"
          value={formatCurrency(taxReport.estimatedTax)}
          icon={Percent}
          tone="yellow"
        />
        <MetricCard
          title="Estimasi Tahunan"
          value={formatCurrency(annual)}
          icon={CalendarClock}
          tone="blue"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Tax Settings</CardTitle>
            <CardDescription>
              Konfigurasi pajak dinamis untuk bisnis.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>Nama Aturan</Label>
              <Input
                value={formName}
                onChange={(event) => setFormName(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Tarif (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={formRate}
                onChange={(event) => setFormRate(Number(event.target.value))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Basis Perhitungan</Label>
              <Select
                value={formBase}
                onChange={(event) =>
                  setFormBase(event.target.value as "gross_revenue" | "net_profit")
                }
              >
                <option value="gross_revenue">Gross Revenue</option>
                <option value="net_profit">Net Profit</option>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Due Day</Label>
              <Input
                type="number"
                min="1"
                max="28"
                value={formDueDay}
                onChange={(event) => setFormDueDay(Number(event.target.value))}
              />
            </div>
            <label className="flex items-center gap-3 rounded-xl border p-3 text-sm">
              <input
                type="checkbox"
                checked={formEnabled}
                onChange={(event) => setFormEnabled(event.target.checked)}
              />
              Aktifkan estimasi pajak
            </label>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800/50">
              <Button
                onClick={handleSave}
                disabled={!isDirty || saving}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs h-9 gap-1.5"
              >
                <Save className="h-3.5 w-3.5" />
                Simpan Perubahan
              </Button>
              {isDirty && (
                <Button
                  variant="outline"
                  onClick={handleReset}
                  disabled={saving}
                  className="text-xs font-semibold h-9"
                >
                  Batal
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tax History & Estimation</CardTitle>
            <CardDescription>
              Estimasi berdasarkan periode terpilih.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:max-w-xs">
              <Label>Periode</Label>
              <Input
                type="month"
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-muted p-4">
                <p className="text-sm text-muted-foreground">
                  Due Date Reminder
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {formatDate(taxReport.dueDate)}
                </p>
              </div>
              <div className="rounded-xl bg-muted p-4">
                <p className="text-sm text-muted-foreground">Tax Base</p>
                <p className="mt-2 text-lg font-semibold">
                  {taxSettings.base === "gross_revenue"
                    ? "Gross Revenue"
                    : "Net Profit"}
                </p>
              </div>
            </div>
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[620px] text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-3 pr-4">Periode</th>
                    <th className="py-3 pr-4 text-right">Gross Revenue</th>
                    <th className="py-3 pr-4 text-right">Net Profit</th>
                    <th className="py-3 pr-4 text-right">Pajak</th>
                    <th className="py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-3 pr-4">{taxReport.period}</td>
                    <td className="py-3 pr-4 text-right">
                      {formatCurrency(taxReport.grossRevenue)}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      {formatCurrency(taxReport.netProfit)}
                    </td>
                    <td className="py-3 pr-4 text-right font-semibold">
                      {formatCurrency(taxReport.estimatedTax)}
                    </td>
                    <td className="py-3">
                      <Badge tone="blue">{taxReport.status}</Badge>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
