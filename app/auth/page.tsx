"use client";

import { Loader2, FileText, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
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
import { isFirebaseConfigured } from "@/lib/firebase";

function getAuthErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Autentikasi gagal.";
  if (message.includes("auth/email-already-in-use"))
    return "Email sudah terdaftar.";
  if (message.includes("auth/invalid-credential"))
    return "Email atau password salah.";
  if (message.includes("auth/weak-password"))
    return "Password minimal 6 karakter.";
  if (message.includes("auth/invalid-email"))
    return "Format email tidak valid.";
  if (message.includes("auth/operation-not-allowed")) {
    return "Metode Email/Password belum aktif di Firebase Authentication. Buka Firebase Console → Authentication → Sign-in method → aktifkan Email/Password.";
  }
  return message;
}

export default function AuthPage() {
  const router = useRouter();
  const { appUser, loading, login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && appUser) router.replace("/");
  }, [appUser, loading, router]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (mode === "register") {
        await register(email, password, businessName);
      } else {
        await login(email, password);
      }
      router.replace("/");
    } catch (authError) {
      setError(getAuthErrorMessage(authError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="grid min-h-screen grid-cols-1 lg:grid-cols-12 bg-background">
      {/* Sisi Kiri: Branding & Marketing Panel (Hanya di layar besar) */}
      <div className="hidden lg:flex lg:col-span-5 relative flex-col justify-between bg-zinc-950 p-12 text-white overflow-hidden border-r border-zinc-900">
        {/* Background Subtle Gradient Shape */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-emerald-500/10 blur-[120px]" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-96 h-96 rounded-full bg-indigo-500/10 blur-[120px]" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-zinc-950 font-bold shadow-[0_0_15px_rgba(16,185,129,0.3)]">
            <FileText className="h-5 w-5 animate-pulse" />
          </div>
          <span className="font-bold text-lg tracking-tight">KasFlow</span>
        </div>

        <div className="relative z-10 space-y-6">
          <h2 className="text-3xl font-bold tracking-tight leading-tight">
            Pembukuan Keuangan UMKM Jadi Jauh Lebih Mudah & Otomatis.
          </h2>
          <p className="text-sm text-zinc-450 leading-relaxed">
            KasFlow dirancang dengan konsep ledger-first untuk mendeteksi arus kas, jurnal pembukuan, hingga laporan keuangan secara real-time.
          </p>
          <div className="space-y-3 pt-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span className="text-xs text-zinc-300 font-medium">Auto-generated Jurnal & Buku Besar</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span className="text-xs text-zinc-300 font-medium">Laporan Laba Rugi & Neraca Instan</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span className="text-xs text-zinc-300 font-medium">Keamanan Enkripsi Firebase Cloud</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-xs text-zinc-550">
          &copy; {new Date().getFullYear()} KasFlow App. Advanced Agentic Accounting.
        </div>
      </div>

      {/* Sisi Kanan: Form Card Login/Register */}
      <div className="col-span-1 lg:col-span-7 flex flex-col justify-center items-center p-6 sm:p-12 md:p-16">
        <div className="w-full max-w-md space-y-6">
          {/* Logo untuk Mobile (hanya muncul di small screens) */}
          <div className="flex lg:hidden items-center gap-3 mb-6 justify-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-zinc-950 font-bold shadow-soft">
              <FileText className="h-5 w-5" />
            </div>
            <span className="font-bold text-lg tracking-tight">KasFlow</span>
          </div>

          <Card className="border-zinc-200/50 dark:border-zinc-800/40 shadow-soft">
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between">
                <Badge tone="blue">Firebase Cloud</Badge>
              </div>
              <CardTitle className="text-xl font-bold tracking-tight">
                {mode === "login" ? "Selamat Datang Kembali" : "Buat Akun Bisnis Baru"}
              </CardTitle>
              <CardDescription>
                {mode === "login"
                  ? "Masukkan akun Anda untuk membuka data ledger bisnis."
                  : "Daftar untuk memulai pembukuan otomatis hari ini."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!isFirebaseConfigured ? (
                <div className="space-y-4 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-xs text-destructive leading-relaxed">
                  <p className="font-medium">
                    Konfigurasi Firebase Belum Ditemukan.
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Silakan pastikan file `.env.local` sudah terisi dengan benar di server lokal Anda.
                  </p>
                  <Link href="/" className="inline-block mt-2">
                    <Button variant="outline" size="sm">Kembali Ke Dashboard</Button>
                  </Link>
                </div>
              ) : (
                <form className="space-y-4" onSubmit={handleSubmit}>
                  {mode === "register" ? (
                    <div className="space-y-1">
                      <Label htmlFor="businessName">Nama Bisnis</Label>
                      <Input
                        id="businessName"
                        value={businessName}
                        onChange={(event) => setBusinessName(event.target.value)}
                        placeholder="Contoh: Toko Kopi Seduh"
                        required
                        className="h-9.5 text-xs"
                      />
                    </div>
                  ) : null}

                  <div className="space-y-1">
                    <Label htmlFor="email">Email address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="owner@bisnis.id"
                      required
                      className="h-9.5 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                    </div>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      minLength={6}
                      placeholder="••••••••"
                      required
                      className="h-9.5 text-xs"
                    />
                  </div>

                  {error ? (
                    <p className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs font-medium text-destructive leading-relaxed">
                      {error}
                    </p>
                  ) : null}

                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs tracking-wide h-9.5 mt-2"
                    type="submit"
                    loading={submitting}
                  >
                    {mode === "login" ? "MASUK" : "DAFTAR"}
                  </Button>

                  <div className="relative flex items-center justify-center my-4">
                    <div className="absolute inset-0 border-t border-zinc-200 dark:border-zinc-800" />
                    <span className="relative bg-card px-2 text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                      Atau
                    </span>
                  </div>

                  <Button
                    className="w-full text-xs font-semibold"
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setMode((value) =>
                        value === "login" ? "register" : "login",
                      );
                      setError(null);
                    }}
                  >
                    {mode === "login"
                      ? "Belum punya akun? Buat Baru"
                      : "Sudah punya akun? Masuk"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
