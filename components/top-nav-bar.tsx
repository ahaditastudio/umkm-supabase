"use client";

import {
  BarChart3,
  Building2,
  Calculator,
  ChevronDown,
  CreditCard,
  DatabaseZap,
  FileText,
  Home,
  Landmark,
  LogOut,
  Moon,
  Package,
  ReceiptText,
  Settings,
  ShoppingCart,
  Sun,
  User,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { cn } from "@/lib/utils";
import { useKasFlowStore } from "@/store/use-kasflow-store";

/* ────────────────────── Navigation Data ────────────────────── */

type NavItem = {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  startsWith?: string;
};

type NavDropdown = {
  label: string;
  items: NavItem[];
};

const primaryItems: NavItem[] = [
  { name: "Dashboard", href: "/", icon: Home, exact: true },
  { name: "Transaksi", href: "/transactions", icon: ReceiptText },
  { name: "Master Data", href: "/master-data", icon: Building2 },
  { name: "Laporan", href: "/reports", icon: BarChart3 },
];

const dropdowns: NavDropdown[] = [
  {
    label: "Akuntansi",
    items: [
      { name: "Jurnal & Ledger", href: "/accounting", icon: Landmark },
      { name: "Pajak", href: "/tax", icon: Calculator },
    ],
  },
  {
    label: "Marketplace",
    items: [
      { name: "Payment", href: "/marketplace/payment", icon: CreditCard, startsWith: "/marketplace/payment" },
      { name: "Orders", href: "/marketplace/orders", icon: Package, startsWith: "/marketplace/orders" },
      { name: "Integrasi", href: "/integrations", icon: ShoppingCart, exact: true },
    ],
  },
];

const systemItems: NavDropdown = {
  label: "Sistem",
  items: [
    { name: "Utilitas", href: "/utilities", icon: DatabaseZap },
    { name: "Pengaturan", href: "/settings", icon: Settings },
  ],
};

/* ──────────────────── Helper: is active? ──────────────────── */

function isActive(item: NavItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href;
  if (item.startsWith) return pathname.startsWith(item.startsWith);
  return pathname === item.href;
}

function isDropdownActive(dropdown: NavDropdown, pathname: string): boolean {
  return dropdown.items.some((item) => isActive(item, pathname));
}

/* ─────────────────────── Dropdown Panel ─────────────────────── */

function DropdownPanel({
  dropdown,
  pathname,
  isOpen,
  onToggle,
}: {
  dropdown: NavDropdown;
  pathname: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const active = isDropdownActive(dropdown, pathname);

  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onToggle();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen, onToggle]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={onToggle}
        className={cn(
          "flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200",
          active
            ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/5"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
        )}
      >
        {dropdown.label}
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform duration-200",
            isOpen && "rotate-180",
          )}
        />
      </button>

      <div
        className={cn(
          "absolute top-full left-0 mt-1.5 z-50 min-w-[200px] rounded-xl border border-zinc-200/60 dark:border-zinc-800/50 bg-card shadow-dropdown overflow-hidden transition-all duration-200 origin-top",
          isOpen
            ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
            : "opacity-0 scale-95 -translate-y-1 pointer-events-none",
        )}
      >
        <div className="px-3 pt-3 pb-1">
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60">
            {dropdown.label}
          </p>
        </div>
        <div className="px-2 pb-2">
          {dropdown.items.map((item) => {
            const itemActive = isActive(item, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onToggle}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-150",
                  itemActive
                    ? "bg-emerald-500/8 text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                )}
              >
                <item.icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    itemActive ? "text-emerald-500" : "text-muted-foreground/60",
                  )}
                />
                {item.name}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────── Profile Menu ─────────────────────── */

function ProfileMenu({
  dark,
  onToggleDark,
}: {
  dark: boolean;
  onToggleDark: () => void;
}) {
  const { logout } = useAuth();
  const profile = useKasFlowStore((s) => s.profile);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const initial = (profile.ownerName || profile.businessName || "K").charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-all duration-200 hover:bg-muted/50"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm font-bold border border-emerald-500/15">
          {initial}
        </div>
        <div className="hidden sm:block text-left">
          <p className="text-[13px] font-semibold text-foreground leading-none truncate max-w-[120px]">
            {profile.businessName}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[120px]">
            {profile.ownerName}
          </p>
        </div>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 hidden sm:block",
            open && "rotate-180",
          )}
        />
      </button>

      <div
        className={cn(
          "absolute top-full right-0 mt-1.5 z-50 w-[240px] rounded-xl border border-zinc-200/60 dark:border-zinc-800/50 bg-card shadow-dropdown overflow-hidden transition-all duration-200 origin-top-right",
          open
            ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
            : "opacity-0 scale-95 -translate-y-1 pointer-events-none",
        )}
      >
        <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800/60">
          <p className="text-sm font-semibold text-foreground truncate">
            {profile.businessName}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {profile.ownerName}
          </p>
        </div>

        <div className="px-2 py-1.5 border-b border-zinc-100 dark:border-zinc-800/60">
          <p className="px-3 pt-1.5 pb-1 text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60">
            {systemItems.label}
          </p>
          {systemItems.items.map((item) => {
            const itemActive = isActive(item, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-150",
                  itemActive
                    ? "bg-emerald-500/8 text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                )}
              >
                <item.icon className={cn("h-4 w-4 shrink-0", itemActive ? "text-emerald-500" : "text-muted-foreground/60")} />
                {item.name}
              </Link>
            );
          })}
        </div>

        <div className="px-2 py-2 space-y-0.5">
          <button
            onClick={() => { onToggleDark(); setOpen(false); }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-150"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {dark ? "Light Mode" : "Dark Mode"}
          </button>
          <button
            onClick={() => { logout(); setOpen(false); }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-rose-500 hover:bg-rose-500/5 transition-all duration-150"
          >
            <LogOut className="h-4 w-4" />
            Keluar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────── Mobile Menu ─────────────────────── */

function MobileMenu({
  isOpen,
  onClose,
  pathname,
}: {
  isOpen: boolean;
  onClose: () => void;
  pathname: string;
}) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-[55] lg:hidden transition-opacity duration-200",
        isOpen ? "pointer-events-auto" : "pointer-events-none",
      )}
    >
      <div
        className={cn(
          "absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity duration-200",
          isOpen ? "opacity-100" : "opacity-0",
        )}
        onClick={onClose}
      />

      <div
        className={cn(
          "absolute top-[60px] left-0 right-0 bg-card border-b border-zinc-200/60 dark:border-zinc-800/50 shadow-xl transition-all duration-300 ease-out",
          isOpen ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4",
        )}
        style={{ maxHeight: "calc(100vh - 60px)" }}
      >
        <div className="overflow-y-auto scrollbar-thin py-3 px-3">
          <div className="space-y-0.5">
            {primaryItems.map((item) => {
              const itemActive = isActive(item, pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-150",
                    itemActive
                      ? "bg-emerald-500/8 text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                  )}
                >
                  <item.icon className={cn("h-5 w-5 shrink-0", itemActive ? "text-emerald-500" : "text-muted-foreground/60")} />
                  {item.name}
                </Link>
              );
            })}
          </div>

          {dropdowns.map((dropdown, idx) => (
            <div key={idx} className="mt-4">
              <div className="flex items-center gap-2 px-4 mb-1.5">
                <div className="h-px flex-1 bg-zinc-200/60 dark:bg-zinc-800/40" />
                <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50">
                  {dropdown.label}
                </span>
                <div className="h-px flex-1 bg-zinc-200/60 dark:bg-zinc-800/40" />
              </div>
              <div className="space-y-0.5">
                {dropdown.items.map((item) => {
                  const itemActive = isActive(item, pathname);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-150",
                        itemActive
                          ? "bg-emerald-500/8 text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                      )}
                    >
                      <item.icon className={cn("h-5 w-5 shrink-0", itemActive ? "text-emerald-500" : "text-muted-foreground/60")} />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="mt-4">
            <div className="flex items-center gap-2 px-4 mb-1.5">
              <div className="h-px flex-1 bg-zinc-200/60 dark:bg-zinc-800/40" />
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50">
                Sistem
              </span>
              <div className="h-px flex-1 bg-zinc-200/60 dark:bg-zinc-800/40" />
            </div>
            <div className="space-y-0.5">
              {systemItems.items.map((item) => {
                const itemActive = isActive(item, pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-150",
                      itemActive
                        ? "bg-emerald-500/8 text-emerald-600 dark:text-emerald-400"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                    )}
                  >
                    <item.icon className={cn("h-5 w-5 shrink-0", itemActive ? "text-emerald-500" : "text-muted-foreground/60")} />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────── TopNavBar ─────────────────────── */

export function TopNavBar({
  dark,
  onToggleDark,
}: {
  dark: boolean;
  onToggleDark: () => void;
}) {
  const pathname = usePathname();
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
    setOpenDropdown(null);
  }, [pathname]);

  const toggleDropdown = useCallback((idx: number) => {
    setOpenDropdown((prev) => (prev === idx ? null : idx));
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpenDropdown(null);
        setMobileOpen(false);
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-50 h-[60px] flex items-center border-b border-zinc-200/50 dark:border-zinc-800/40 bg-card/80 backdrop-blur-xl">
        <div className="flex h-full w-full max-w-[1440px] mx-auto items-center justify-between px-4 lg:px-6">
          {/* Left: Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0 mr-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-white font-bold shadow-[0_0_15px_rgba(16,185,129,0.25)]">
              <FileText className="h-[18px] w-[18px]" />
            </div>
            <span className="text-base font-bold tracking-tight text-foreground hidden sm:block">
              KasFlow
            </span>
          </Link>

          {/* Center: Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {primaryItems.map((item) => {
              const itemActive = isActive(item, pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200",
                    itemActive
                      ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/5"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      itemActive ? "text-emerald-500" : "text-muted-foreground/60",
                    )}
                  />
                  {item.name}
                </Link>
              );
            })}

            {dropdowns.map((dropdown, idx) => (
              <DropdownPanel
                key={idx}
                dropdown={dropdown}
                pathname={pathname}
                isOpen={openDropdown === idx}
                onToggle={() => toggleDropdown(idx)}
              />
            ))}
          </nav>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 shrink-0 ml-auto lg:ml-0">
            <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-semibold text-emerald-500 bg-emerald-500/5 px-2.5 py-1.5 rounded-lg border border-emerald-500/10">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </div>

            <div className="hidden lg:block">
              <ProfileMenu dark={dark} onToggleDark={onToggleDark} />
            </div>

            <button
              onClick={onToggleDark}
              className="flex lg:hidden h-9 w-9 items-center justify-center rounded-lg border border-zinc-200/60 dark:border-zinc-800/40 hover:bg-muted text-muted-foreground transition duration-200"
              title={dark ? "Light Mode" : "Dark Mode"}
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className={cn(
                "flex lg:hidden h-9 w-9 flex-col items-center justify-center gap-[5px] rounded-lg border border-zinc-200/60 dark:border-zinc-800/40 hover:bg-muted transition duration-200",
              )}
              aria-label="Menu"
            >
              <span
                className={cn(
                  "block h-[1.5px] w-4 bg-foreground rounded-full transition-all duration-300",
                  mobileOpen && "rotate-45 translate-y-[3.25px]",
                )}
              />
              <span
                className={cn(
                  "block h-[1.5px] w-4 bg-foreground rounded-full transition-all duration-300",
                  mobileOpen && "-rotate-45 -translate-y-[3.25px]",
                )}
              />
            </button>
          </div>
        </div>
      </header>

      <MobileMenu
        isOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        pathname={pathname}
      />
    </>
  );
}
