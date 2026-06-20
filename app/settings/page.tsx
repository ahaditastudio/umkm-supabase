"use client";

import Link from "next/link";
import { useState } from "react";
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
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { updateBusinessProfile } from "@/lib/supabase/company-service";
import { toast } from "@/lib/toast";
import { formatDate } from "@/lib/utils";
import { useKasFlowStore } from "@/store/use-kasflow-store";
import { Settings, Shield, HelpCircle, Calendar, Users2, Database, ShieldAlert, Award, Save, Loader2 } from "lucide-react";

export default function SettingsPage() {
  const { appUser } = useAuth();
  const profile = useKasFlowStore((state) => state.profile);
  const updateProfile = useKasFlowStore((state) => state.updateProfile);
  const accountingPeriods = useKasFlowStore((state) => state.accountingPeriods);

  // Local form state
  const [formName, setFormName] = useState(profile.businessName);
  const [formOwner, setFormOwner] = useState(profile.ownerName);
  const [formType, setFormType] = useState(profile.businessType);
  const [formTax, setFormTax] = useState(profile.taxNumber ?? "");
  const [saving, setSaving] = useState(false);

  const isDirty =
    formName !== profile.businessName ||
    formOwner !== profile.ownerName ||
    formType !== profile.businessType ||
    formTax !== (profile.taxNumber ?? "");

  const handleSave = async () => {
    if (!formName.trim() || !formOwner.trim()) {
      toast.error("Nama perusahaan dan pemilik wajib diisi.");
      return;
    }
    setSaving(true);
    try {
      const updates = {
        businessName: formName.trim(),
        ownerName: formOwner.trim(),
        businessType: formType as typeof profile.businessType,
        taxNumber: formTax.trim(),
      };
      updateProfile(updates);
      if (appUser) {
        await updateBusinessProfile(appUser.companyId, { ...profile, ...updates });
      }
      toast.success("Profil badan usaha berhasil diperbarui.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal memperbarui profil.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setFormName(profile.businessName);
    setFormOwner(profile.ownerName);
    setFormType(profile.businessType);
    setFormTax(profile.taxNumber ?? "");
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <Badge tone="muted">Settings & Management</Badge>
          <h2 className="mt-3 text-xl font-bold tracking-tight sm:text-2xl lg:text-3xl text-foreground">
            Pengaturan Sistem
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Atur profil entitas bisnis, role akses user, masa tahun buku akuntansi, serta integrasi server cloud.
          </p>
        </div>
      </div>

      {/* Grid Layout */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left column: Business Profile Form */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="border-zinc-200/60 dark:border-zinc-800/50 shadow-sm">
            <CardHeader className="border-b pb-4 mb-4">
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-emerald-500" /> Profil Badan Usaha
              </CardTitle>
              <CardDescription>
                Informasi identitas bisnis yang akan dicetak pada invoice dan laporan formal.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 mt-2">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="bizName">Nama Perusahaan / Toko</Label>
                  <Input
                    id="bizName"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="h-9.5 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ownerName">Nama Pemilik (Owner)</Label>
                  <Input
                    id="ownerName"
                    value={formOwner}
                    onChange={(e) => setFormOwner(e.target.value)}
                    className="h-9.5 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="bizType">Jenis Sektor Usaha</Label>
                  <Select
                    id="bizType"
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as any)}
                    className="h-9.5 text-xs"
                  >
                    <option value="retail">Retail (Jual Beli)</option>
                    <option value="service">Service (Jasa)</option>
                    <option value="online_shop">Online Shop (Dagang)</option>
                    <option value="distributor">Distributor / Logistik</option>
                    <option value="freelancer">Freelancer / Mandiri</option>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="taxNum">Nomor Pokok Wajib Pajak (NPWP)</Label>
                  <Input
                    id="taxNum"
                    value={formTax}
                    onChange={(e) => setFormTax(e.target.value)}
                    placeholder="Masukkan NPWP/NIK bisnis"
                    className="h-9.5 text-xs"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800/50">
                <Button
                  onClick={handleSave}
                  disabled={!isDirty || saving}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs h-9 gap-1.5"
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
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

          {/* Role Management */}
          <Card className="border-zinc-200/60 dark:border-zinc-800/50 shadow-sm">
            <CardHeader className="border-b pb-4 mb-4">
              <CardTitle className="flex items-center gap-2">
                <Users2 className="h-4 w-4 text-emerald-500" /> Pengaturan Hak Akses (Role)
              </CardTitle>
              <CardDescription>Hierarki otorisasi akses menu pada platform KasFlow.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3 mt-2">
              <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/5 p-4 flex flex-col justify-between h-28 dark:bg-emerald-500/5 dark:border-emerald-500/20">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-foreground">Owner</span>
                  <Award className="h-4 w-4 text-emerald-500" />
                </div>
                <p className="text-[10px] text-muted-foreground leading-normal">
                  Akses penuh ke seluruh sistem, penutupan buku, master data, dan setting.
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 p-4 flex flex-col justify-between h-28 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-foreground">Accountant</span>
                  <Shield className="h-4 w-4 text-zinc-400" />
                </div>
                <p className="text-[10px] text-muted-foreground leading-normal">
                  Akses modul akuntansi, ledger, laporan keuangan, jurnal umum, tanpa kontrol period.
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 p-4 flex flex-col justify-between h-28 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-foreground">Staff</span>
                  <Users2 className="h-4 w-4 text-zinc-400" />
                </div>
                <p className="text-[10px] text-muted-foreground leading-normal">
                  Hanya memiliki hak pencatatan transaksi kas harian (Pemasukan/Pengeluaran).
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column: Status Integration & Setup Tools */}
        <div className="lg:col-span-4 space-y-6">
          {/* Cloud Database Integration */}
          <Card className="border-zinc-200/60 dark:border-zinc-800/50 shadow-sm">
            <CardHeader className="border-b pb-4 mb-4">
              <CardTitle className="flex items-center gap-2">
                <Database className="h-4 w-4 text-emerald-500" /> Integrasi Cloud Server
              </CardTitle>
              <CardDescription>Sinkronisasi data ke cloud server Supabase.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 mt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase">Status Koneksi:</span>
                <Badge tone={isSupabaseConfigured ? "green" : "yellow"}>
                  {isSupabaseConfigured ? "Supabase Active" : "Local Database"}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {isSupabaseConfigured
                  ? "Seluruh data transaksi dan jurnal tersimpan dengan aman pada database PostgreSQL Supabase terenkripsi."
                  : "Anda berjalan pada mode local storage. Harap konfigurasikan file env jika ingin menggunakan server cloud."}
              </p>
            </CardContent>
          </Card>

          {/* Stepper Guide */}
          <Card className="border-zinc-200/60 dark:border-zinc-800/50 shadow-sm">
            <CardHeader className="border-b pb-4 mb-4">
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-emerald-500" /> Wizard Panduan
              </CardTitle>
              <CardDescription>Bimbingan setup profil & saldo awal.</CardDescription>
            </CardHeader>
            <CardContent className="mt-2">
              <p className="text-[11px] text-muted-foreground leading-relaxed mb-4">
                Butuh memetakan ulang Chart of Accounts (COA) atau generate saldo modal kas awal bisnis Anda?
              </p>
              <Link href="/onboarding" className="block w-full">
                <Button className="w-full text-xs font-semibold h-9.5">
                  Buka Setup Wizard
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* List of Accounting Periods */}
          <Card className="border-zinc-200/60 dark:border-zinc-800/50 shadow-sm">
            <CardHeader className="border-b pb-4 mb-4">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-emerald-500" /> Tahun Buku Terdaftar
              </CardTitle>
              <CardDescription>Rentang periode akuntansi yang aktif.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 px-3 overflow-y-auto max-h-[300px] scrollbar-thin mt-2">
              {accountingPeriods.map((period) => (
                <div
                  key={period.id}
                  className="flex items-center justify-between rounded-lg border p-3 text-xs dark:border-zinc-800 bg-zinc-50/20"
                >
                  <div className="space-y-1.5">
                    <p className="font-semibold text-foreground">
                      {formatDate(period.startDate)} — {formatDate(period.endDate)}
                    </p>
                    {period.closedAt ? (
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <ShieldAlert className="h-3 w-3 text-rose-500" />
                        Ditutup pada {formatDate(period.closedAt)}
                      </p>
                    ) : null}
                  </div>
                  <Badge tone={period.status === "open" ? "green" : "red"}>
                    {period.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
