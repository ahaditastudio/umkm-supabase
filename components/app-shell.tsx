"use client";

import {
  FileText,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useCompanySync } from "@/lib/supabase/use-company-sync";
import { useKasFlowStore } from "@/store/use-kasflow-store";
import { BottomTabBar } from "@/components/bottom-tab-bar";
import { TopNavBar } from "@/components/top-nav-bar";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { appUser, loading } = useAuth();
  useCompanySync();
  const [dark, setDark] = useState(false);

  const storeCompanyId = useKasFlowStore((state) => state.companyId);
  const hasCachedData = storeCompanyId && storeCompanyId !== "demo_company";

  const [showSpinner, setShowSpinner] = useState(false);
  useEffect(() => {
    if (!loading || hasCachedData) {
      setShowSpinner(false);
      return;
    }
    const timer = setTimeout(() => setShowSpinner(true), 500);
    return () => clearTimeout(timer);
  }, [loading, hasCachedData]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  if (pathname.startsWith("/auth")) {
    return <>{children}</>;
  }

  if (loading && !hasCachedData) {
    if (!showSpinner) return null;
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        <div className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 px-5 py-4 shadow-soft">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
          <span className="text-sm font-medium tracking-wide">Memuat sesi...</span>
        </div>
      </main>
    );
  }

  if (!isSupabaseConfigured || !appUser) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-4 text-white">
        <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 text-center shadow-soft backdrop-blur-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <FileText className="h-6 w-6" />
          </div>
          <h1 className="mt-6 text-2xl font-bold tracking-tight">KasFlow</h1>
          <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
            Login diperlukan agar data bisnis tersimpan dan tersinkron ke
            Supabase secara aman.
          </p>
          <Link href="/auth" className="mt-6 inline-flex w-full">
            <Button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white">
              Login / Register
            </Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNavBar dark={dark} onToggleDark={() => setDark(!dark)} />

      <main
        key={pathname}
        className="mx-auto w-full max-w-[1440px] px-4 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8 pb-24 lg:pb-8 animate-spring-in lg:animate-in lg:fade-in lg:duration-300"
      >
        {children}
      </main>

      <BottomTabBar />
    </div>
  );
}
