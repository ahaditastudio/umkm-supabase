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
  Menu,
  Moon,
  ReceiptText,
  Settings,
  Sun,
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  if (pathname.startsWith("/auth")) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-soft">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm font-medium">Memuat sesi Firebase...</span>
        </div>
      </main>
    );
  }

  if (!isFirebaseConfigured || !appUser) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
        <div className="w-full max-w-md rounded-xl border bg-card p-6 text-center shadow-soft">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <FileText className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-2xl font-bold">KasFlow</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Login diperlukan agar data bisnis tersimpan dan tersinkron ke
            Firestore.
          </p>
          <Link href="/auth" className="mt-5 inline-flex">
            <Button>Login / Register</Button>
          </Link>
        </div>
      </main>
    );
  }

  const sidebar = (
    <aside
      className={cn(
        "flex h-full flex-col border-r bg-card/90 backdrop-blur transition-all",
        collapsed ? "w-20" : "w-72",
      )}
    >
      <div className="flex h-16 items-center justify-between gap-3 border-b px-4">
        <Link href="/" className="flex items-center gap-3 overflow-hidden">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <FileText className="h-5 w-5" />
          </div>
          {!collapsed ? (
            <div className="truncate">
              <p className="font-bold leading-tight">KasFlow</p>
              <p className="truncate text-xs text-muted-foreground">
                Ledger-first UMKM
              </p>
            </div>
          ) : null}
        </Link>
        <Button
          className="hidden lg:inline-flex"
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navigation.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition hover:bg-muted",
                active
                  ? "bg-primary text-primary-foreground hover:bg-primary"
                  : "text-muted-foreground hover:text-foreground",
                collapsed && "justify-center px-2",
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed ? <span>{item.name}</span> : null}
            </Link>
          );
        })}
      </nav>

      {!collapsed ? (
        <div className="border-t p-4">
          <div className="rounded-xl bg-muted p-3">
            <p className="truncate text-sm font-semibold">
              {profile.businessName}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              Owner: {profile.ownerName}
            </p>
            <Badge className="mt-3" tone="green">
              Firebase Sync
            </Badge>
          </div>
        </div>
      ) : null}
    </aside>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-y-0 left-0 z-40 hidden lg:block">
        {sidebar}
      </div>
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-black/40"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0">{sidebar}</div>
        </div>
      ) : null}

      <div
        className={cn("transition-all", collapsed ? "lg:pl-20" : "lg:pl-72")}
      >
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/85 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <Button
              className="lg:hidden"
              variant="ghost"
              size="sm"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div>
              <p className="text-sm text-muted-foreground">KasFlow PRD v3.0</p>
              <h1 className="text-base font-semibold sm:text-lg">
                {profile.businessName}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setDark(!dark)}>
              {dark ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">
                {dark ? "Light" : "Dark"}
              </span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => logout()}>
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
