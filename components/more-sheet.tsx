"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  Building2,
  Calculator,
  DatabaseZap,
  Settings,
  ShoppingCart,
} from "lucide-react";
import { cn } from "@/lib/utils";

const moreItems = [
  { name: "Master Data", href: "/master-data", icon: Building2, color: "text-blue-500 bg-blue-500/10" },
  { name: "Laporan", href: "/reports", icon: DatabaseZap, color: "text-green-500 bg-green-500/10" },
  { name: "Integrasi Marketplace", href: "/integrations", icon: ShoppingCart, color: "text-orange-500 bg-orange-500/10" },
  { name: "Pajak", href: "/tax", icon: Calculator, color: "text-amber-500 bg-amber-500/10" },
  { name: "Utilitas", href: "/utilities", icon: DatabaseZap, color: "text-purple-500 bg-purple-500/10" },
  { name: "Pengaturan", href: "/settings", icon: Settings, color: "text-zinc-500 bg-zinc-500/10" },
];

type MoreSheetProps = {
  open: boolean;
  onClose: () => void;
};

export function MoreSheet({ open, onClose }: MoreSheetProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    if (open) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [open]);

  if (!mounted) return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[60] flex items-end justify-center transition-opacity duration-300 lg:hidden",
        open ? "pointer-events-auto" : "pointer-events-none"
      )}
    >
      {/* Backdrop */}
      <div
        className={cn(
          "absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-300 ease-in-out",
          open ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />

      {/* Sheet Content */}
      <div
        className={cn(
          "relative w-full max-w-lg rounded-t-3xl bg-card border-t border-zinc-200 dark:border-zinc-800 p-6 pt-3 shadow-2xl transition-transform duration-300 ease-in-out",
          open ? "translate-y-0" : "translate-y-full"
        )}
        style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}
      >
        {/* Drag Handle */}
        <div className="flex justify-center mb-5">
          <div className="w-10 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
        </div>

        {/* Title */}
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Menu Lainnya
        </p>

        {/* Grid 2x2 */}
        <div className="grid grid-cols-2 gap-3">
          {moreItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className="flex items-center gap-3 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-900/20 p-4 transition duration-200 active:scale-[0.97] hover:border-zinc-300 dark:hover:border-zinc-700"
              >
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", item.color)}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-sm font-semibold text-foreground">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
