"use client";

import Link from "next/link";
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
import { isFirebaseConfigured } from "@/lib/firebase";
import { updateBusinessProfileFirestore } from "@/lib/firestore/company-service";
import { formatDate } from "@/lib/utils";
import { useKasFlowStore } from "@/store/use-kasflow-store";
import { Settings, Shield, HelpCircle, Calendar, Users2, Database, ShieldAlert, Award } from "lucide-react";

export default function SettingsPage() {
  const { appUser } = useAuth();
  const profile = useKasFlowStore((state) => state.profile);
  const updateProfile = useKasFlowStore((state) => state.updateProfile);
  const accountingPeriods = useKasFlowStore((state) => state.accountingPeriods);

  const persistProfile = async (partialProfile: Partial<typeof profile>) => {
    updateProfile(partialProfile);
    if (appUser)
      await updateBusinessProfileFirestore(appUser.companyId, {
        ...profile,
        ...partialProfile,
      });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <Badge tone="muted">Settings & Management</Badge>
          <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl text-foreground">
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
            <CardContent className="grid gap-5 sm:grid-cols-2 mt-2">
              <div className="space-y-1">
                <Label htmlFor="bizName">Nama Perusahaan / Toko</Label>
                <Input
                  id="bizName"
                  value={profile.businessName}
                  onChange={(event) =>
                    persistProfile({ businessName: event.target.value })
                  }
                  className="h-9.5 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ownerName">Nama Pemilik (Owner)</Label>
                <Input
                  id="ownerName"
                  value={profile.ownerName}
                  onChange={(event) =>
                    persistProfile({ ownerName: event.target.value })
                  }
                  className="h-9.5 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="bizType">Jenis Sektor Usaha</Label>
                <Select
                  id="bizType"
                  value={profile.businessType}
                  onChange={(event) =>
                    persistProfile({
                      businessType: event.target.value as any,
                    })
                  }
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
                  value={profile.taxNumber ?? ""}
                  onChange={(event) =>
                    persistProfile({ taxNumber: event.target.value })
                  }
                  placeholder="Masukkan NPWP/NIK bisnis"
                  className="h-9.5 text-xs"
                />
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
              <CardDescription>Sinkronisasi data ke cloud server Firebase.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 mt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase">Status Koneksi:</span>
                <Badge tone={isFirebaseConfigured ? "green" : "yellow"}>
                  {isFirebaseConfigured ? "Firebase Active" : "Local Database"}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {isFirebaseConfigured
                  ? "Seluruh data transaksi dan jurnal tersimpan dengan aman pada database Firestore terenkripsi."
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
