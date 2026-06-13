"use client";

import {
  BarChart3,
  Building2,
  Calculator,
  ChevronLeft,
  ChevronRight,
  DatabaseZap,
  FileText,
  Home,
  Landmark,
  Loader2,
  LogOut,
  Moon,
  ReceiptText,
  Settings,
  Sun,
  User,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { isFirebaseConfigured } from "@/lib/firebase";
import { useCompanySync } from "@/lib/firestore/use-company-sync";
import { cn } from "@/lib/utils";
import { useKasFlowStore } from "@/store/use-kasflow-store";
import { BottomTabBar } from "@/components/bottom-tab-bar";

const navigation = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Transaksi", href: "/transactions", icon: ReceiptText },
  { name: "Akuntansi", href: "/accounting", icon: Landmark },
  { name: "Master Data", href: "/master-data", icon: Building2 },
  { name: "Laporan", href: "/reports", icon: BarChart3 },
  { name: "Pajak", href: "/tax", icon: Calculator },
  { name: "Utilitas", href: "/utilities", icon: DatabaseZap },
  { name: "Pengaturan", href: "/settings", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { appUser, loading, logout } = useAuth();
  useCompanySync();
  const profile = useKasFlowStore((state) => state.profile);
  const collapsed = useKasFlowStore((state) => state.sidebarCollapsed);
  const setCollapsed = useKasFlowStore((state) => state.setSidebarCollapsed);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  if (pathname.startsWith("/auth")) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        <div className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 px-5 py-4 shadow-soft">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
          <span className="text-sm font-medium tracking-wide">Memuat sesi Firebase...</span>
        </div>
      </main>
    );
  }

  if (!isFirebaseConfigured || !appUser) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-4 text-white">
        <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 text-center shadow-soft backdrop-blur-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <FileText className="h-6 w-6" />
          </div>
          <h1 className="mt-6 text-2xl font-bold tracking-tight">KasFlow</h1>
          <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
            Login diperlukan agar data bisnis tersimpan dan tersinkron ke
            Firestore secara aman.
          </p>
          <Link href="/auth" className="mt-6 inline-flex w-full">
            <Button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white">Login / Register</Button>
          </Link>
        </div>
      </main>
    );
  }

  const sidebar = (
    <aside
      className={cn(
        "flex h-full flex-col bg-zinc-950 text-zinc-400 transition-all duration-300 ease-in-out border-r border-zinc-900",
        collapsed ? "w-16" : "w-64",
      )}
    >
      {/* Brand Header */}
      <div className={cn("flex h-16 items-center justify-between border-b border-zinc-900 px-4", collapsed && "justify-center px-0")}>
        <Link href="/" className="flex items-center gap-3 overflow-hidden ml-1">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-zinc-950 font-bold shadow-[0_0_15px_rgba(16,185,129,0.3)]">
            <FileText className="h-5 w-5" />
          </div>
          {!collapsed ? (
            <div className="truncate">
              <p className="font-semibold text-sm tracking-tight text-white">KasFlow</p>
              <p className="truncate text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">
                Ledger-First
              </p>
            </div>
          ) : null}
        </Link>
        {!collapsed && (
          <button
            className="hidden lg:flex h-8 w-8 items-center justify-center rounded-lg hover:bg-zinc-900 text-zinc-400 hover:text-white transition duration-200"
            onClick={() => setCollapsed(!collapsed)}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Toggle Button for Collapsed State */}
      {collapsed && (
        <div className="hidden lg:flex justify-center py-2 border-b border-zinc-900/50">
          <button
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-zinc-900 text-zinc-400 hover:text-white transition duration-200"
            onClick={() => setCollapsed(!collapsed)}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Navigation List */}
      <nav className="flex-1 space-y-1 py-4 px-3 overflow-y-auto scrollbar-thin">
        {navigation.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium transition duration-200 tracking-wide",
                active
                  ? "bg-zinc-900 text-white shadow-sm"
                  : "hover:bg-zinc-900/50 hover:text-zinc-200",
                collapsed && "justify-center px-0 py-3",
              )}
              title={collapsed ? item.name : undefined}
            >
              <item.icon className={cn("shrink-0 transition duration-200", collapsed ? "h-5 w-5" : "h-4 w-4", active ? "text-emerald-400" : "text-zinc-400 group-hover:text-zinc-200")} />
              {!collapsed ? <span>{item.name}</span> : null}
            </Link>
          );
        })}
      </nav>

      {/* Profile Footer */}
      <div className="p-4 border-t border-zinc-900">
        {collapsed ? (
          <div className="flex justify-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-900 text-zinc-300 border border-zinc-800">
              <User className="h-4 w-4" />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl bg-zinc-900/40 p-3 border border-zinc-900">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-zinc-300 border border-zinc-800">
              <User className="h-4 w-4" />
            </div>
            <div className="truncate flex-1">
              <p className="truncate text-xs font-medium text-white leading-none mb-1">
                {profile.businessName}
              </p>
              <p className="truncate text-[10px] text-zinc-500">
                {profile.ownerName}
              </p>
            </div>
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" title="Firebase Synced" />
          </div>
        )}
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="fixed inset-y-0 left-0 z-40 hidden lg:block">
        {sidebar}
      </div>

      <div
        className={cn("transition-all duration-300", collapsed ? "lg:pl-16" : "lg:pl-64")}
      >
        {/* Top Sticky Header */}
        <header className="sticky top-0 z-30 flex h-14 lg:h-16 items-center justify-between border-b bg-background/80 px-3 lg:px-6 backdrop-blur-md border-zinc-200/50 dark:border-zinc-800/40">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-foreground leading-none truncate">
                {profile.businessName}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setDark(!dark)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border hover:bg-muted text-muted-foreground transition duration-200"
              title={dark ? "Light Mode" : "Dark Mode"}
            >
              {dark ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={() => logout()}
              className="flex h-9 w-9 items-center justify-center rounded-lg border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 text-muted-foreground transition duration-200"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Page Content area */}
        <main key={pathname} className="mx-auto w-full max-w-7xl px-4 py-3 sm:px-6 sm:py-6 md:px-8 md:py-8 pb-24 lg:pb-8 animate-spring-in lg:animate-in lg:fade-in lg:duration-300">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <BottomTabBar />
    </div>
  );
}
