"use client";

import { Loader2 } from "lucide-react";
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
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <Badge className="w-fit">Firebase Auth</Badge>
          <CardTitle className="text-2xl">
            {mode === "login" ? "Login KasFlow" : "Daftar KasFlow"}
          </CardTitle>
          <CardDescription>
            {mode === "login"
              ? "Masuk untuk membuka data bisnis dari Firestore."
              : "Buat akun owner dan company baru otomatis."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isFirebaseConfigured ? (
            <div className="space-y-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
              <p>
                Firebase belum dikonfigurasi. Pastikan `.env.local` sudah berisi
                config web app.
              </p>
              <Link href="/">
                <Button variant="outline">Kembali</Button>
              </Link>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              {mode === "register" ? (
                <div className="grid gap-2">
                  <Label>Nama Bisnis</Label>
                  <Input
                    value={businessName}
                    onChange={(event) => setBusinessName(event.target.value)}
                    placeholder="Contoh: Toko Maju Jaya"
                    required
                  />
                </div>
              ) : null}

              <div className="grid gap-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="owner@bisnis.id"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={6}
                  required
                />
              </div>

              {error ? (
                <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              ) : null}

              <Button
                className="w-full"
                type="submit"
                disabled={submitting || loading}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                {mode === "login" ? "Login" : "Register"}
              </Button>

              <Button
                className="w-full"
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
                  ? "Belum punya akun? Register"
                  : "Sudah punya akun? Login"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
