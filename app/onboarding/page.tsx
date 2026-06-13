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
import {
  createOpeningBalanceFirestore,
  updateBusinessProfileFirestore,
} from "@/lib/firestore/company-service";
import { useKasFlowStore } from "@/store/use-kasflow-store";
import { ShoppingBag, Briefcase, Globe, Landmark, DollarSign, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

export default function OnboardingPage() {
  const { appUser } = useAuth();
  const profile = useKasFlowStore((state) => state.profile);
  const updateProfile = useKasFlowStore((state) => state.updateProfile);
  const createOpeningBalance = useKasFlowStore(
    (state) => state.createOpeningBalance,
  );
  const cashAccounts = useKasFlowStore((state) => state.cashAccounts);
  const [step, setStep] = useState(1);
  const [template, setTemplate] = useState(profile.businessType);
  const [openingCashAccount, setOpeningCashAccount] = useState(
    cashAccounts[0]?.accountId ?? "1110",
  );
  const [openingBalance, setOpeningBalance] = useState(0);

  const persistProfile = async (partialProfile: Partial<typeof profile>) => {
    updateProfile(partialProfile);
    if (appUser)
      await updateBusinessProfileFirestore(appUser.companyId, {
        ...profile,
        ...partialProfile,
      });
  };

  const handleOpeningBalance = async () => {
    try {
      if (appUser) {
        await createOpeningBalanceFirestore(
          appUser.companyId,
          openingCashAccount,
          openingBalance,
          "debit",
        );
      } else {
        createOpeningBalance(openingCashAccount, openingBalance, "debit");
      }
      toast.success("Saldo awal berhasil di-generate ke jurnal pembukuan.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal meng-generate saldo awal.");
    }
  };

  // Icons for templates
  const templateIcons: Record<string, any> = {
    retail: ShoppingBag,
    service: Briefcase,
    online_shop: Globe,
    distributor: Landmark,
    freelancer: DollarSign,
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-8 animate-in fade-in duration-500">
      {/* Header Info */}
      <div className="text-center space-y-2">
        <Badge tone="blue">Setup Wizard</Badge>
        <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl lg:text-3xl">
          Konfigurasi Awal KasFlow
        </h2>
        <p className="text-xs text-muted-foreground/95 max-w-md mx-auto leading-relaxed">
          Ikuti 3 langkah mudah di bawah ini untuk menyesuaikan sistem pencatatan keuangan dengan model bisnis Anda.
        </p>
      </div>

      {/* Stepper Visual Component */}
      <div className="relative flex items-center justify-between px-6">
        <div className="absolute left-6 right-6 top-1/2 h-0.5 -translate-y-1/2 bg-zinc-200 dark:bg-zinc-800 z-0" />
        {[1, 2, 3].map((s) => {
          const ActiveIcon = s === 1 ? UserCheck : s === 2 ? Briefcase : DollarSign;
          return (
            <div key={s} className="relative z-10 flex flex-col items-center gap-2">
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border transition duration-300",
                  step === s
                    ? "bg-primary text-white border-primary shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                    : step > s
                    ? "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
                    : "bg-background text-muted-foreground border-zinc-200 dark:border-zinc-800"
                )}
              >
                <ActiveIcon className="h-4 w-4" />
              </div>
              <span className={cn("text-[10px] font-semibold uppercase tracking-wider", step === s ? "text-primary" : "text-muted-foreground")}>
                Langkah {s}
              </span>
            </div>
          );
        })}
      </div>

      <Card className="border-zinc-200/60 dark:border-zinc-800/50 shadow-soft">
        <CardHeader className="border-b pb-4 mb-4">
          <CardTitle className="text-sm font-bold tracking-tight uppercase">
            {step === 1
              ? "Profil Bisnis & Identitas"
              : step === 2
                ? "Pilih Template Model Bisnis"
                : "Input Saldo Kas Awal"}
          </CardTitle>
          <CardDescription className="text-xs">
            {step === 1
              ? "Lengkapi data legalitas bisnis untuk header invoice dan laporan pajak."
              : step === 2
                ? "KasFlow akan otomatis menyusun Chart of Accounts (COA) yang relevan."
                : "Masukkan modal uang tunai atau saldo bank awal yang Anda miliki saat ini."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {step === 1 ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="bizName">Nama Bisnis</Label>
                <Input
                  id="bizName"
                  value={profile.businessName}
                  onChange={(event) =>
                    persistProfile({ businessName: event.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="owner">Nama Pemilik</Label>
                <Input
                  id="owner"
                  value={profile.ownerName}
                  onChange={(event) =>
                    persistProfile({ ownerName: event.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="bizType">Tipe Bisnis</Label>
                <Select
                  id="bizType"
                  value={profile.businessType}
                  onChange={(event) =>
                    persistProfile({
                      businessType: event.target.value as any,
                    })
                  }
                >
                  <option value="retail">Retail (Jual Beli Barang)</option>
                  <option value="service">Service (Penyedia Jasa)</option>
                  <option value="online_shop">Online Shop (E-commerce)</option>
                  <option value="distributor">Distributor / Grosir</option>
                  <option value="freelancer">Freelancer / Mandiri</option>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="tax">Nomor NPWP (Opsional)</Label>
                <Input
                  id="tax"
                  placeholder="00.000.000.0-000.000"
                  value={profile.taxNumber ?? ""}
                  onChange={(event) =>
                    persistProfile({ taxNumber: event.target.value })
                  }
                />
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {["retail", "service", "online_shop", "distributor"].map(
                (item) => {
                  const IconComp = templateIcons[item] || ShoppingBag;
                  const isSelected = template === item;
                  return (
                    <button
                      key={item}
                      className={cn(
                        "flex items-start gap-4 rounded-xl border p-5 text-left transition duration-200",
                        isSelected
                          ? "border-primary bg-emerald-500/5 dark:bg-emerald-500/10 shadow-sm"
                          : "border-zinc-200 dark:border-zinc-800 bg-card hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30"
                      )}
                      onClick={() => setTemplate(item as any)}
                    >
                      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-sm", isSelected ? "bg-primary text-white border-primary" : "bg-muted text-muted-foreground")}>
                        <IconComp className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold capitalize text-sm text-foreground">
                          {item.replace("_", " ")}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground leading-normal">
                          Mengaktifkan set akun keuangan default untuk industri {item.replace("_", " ")}.
                        </p>
                      </div>
                    </button>
                  );
                },
              )}
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-5 max-w-md">
              <div className="space-y-1">
                <Label htmlFor="cashAcc">Akun Kas / Bank Penerima</Label>
                <Select
                  id="cashAcc"
                  value={openingCashAccount}
                  onChange={(event) =>
                    setOpeningCashAccount(event.target.value)
                  }
                >
                  {cashAccounts.map((account) => (
                    <option key={account.id} value={account.accountId}>
                      {account.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="balance">Jumlah Saldo Awal (Rp)</Label>
                <Input
                  id="balance"
                  type="number"
                  placeholder="Contoh: 15000000"
                  value={openingBalance || ""}
                  onChange={(event) =>
                    setOpeningBalance(Number(event.target.value))
                  }
                />
              </div>
              <Button
                onClick={handleOpeningBalance}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs tracking-wide h-9"
              >
                Simpan Saldo Awal & Buat Jurnal
              </Button>
            </div>
          ) : null}

          {/* Stepper Footer Action */}
          <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800 pt-4 mt-6">
            <Button
              variant="outline"
              disabled={step === 1}
              onClick={() => setStep((value) => Math.max(1, value - 1))}
              className="text-xs font-semibold"
            >
              Kembali
            </Button>
            {step < 3 ? (
              <Button
                onClick={() => setStep((value) => Math.min(3, value + 1))}
                className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                Lanjutkan
              </Button>
            ) : (
              <Link href="/">
                <Button className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white">Selesai</Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
