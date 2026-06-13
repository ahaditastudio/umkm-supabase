"use client";

import {
  Home,
  ReceiptText,
  Landmark,
  BarChart3,
  Grid3X3,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { MoreSheet } from "@/components/more-sheet";

const primaryTabs = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Transaksi", href: "/transactions", icon: ReceiptText },
  { name: "Akuntansi", href: "/accounting", icon: Landmark },
  { name: "Laporan", href: "/reports", icon: BarChart3 },
  { name: "Lainnya", href: null, icon: Grid3X3 },
];

export function BottomTabBar() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 lg:hidden ios-glass border-t border-zinc-200/50 dark:border-zinc-800/40"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex h-16 items-center justify-around">
          {primaryTabs.map((tab) => {
            const isActive = tab.href
              ? pathname === tab.href
              : false;
            const Icon = tab.icon;

            if (!tab.href) {
              // "Lainnya" button
              return (
                <button
                  key={tab.name}
                  onClick={() => setMoreOpen(true)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 flex-1 py-1 transition-transform duration-150 active:scale-90",
                    moreOpen ? "text-emerald-500" : "text-muted-foreground"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-[10px] font-medium">{tab.name}</span>
                </button>
              );
            }

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 flex-1 py-1 transition-transform duration-150 active:scale-90",
                  isActive ? "text-emerald-500" : "text-muted-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{tab.name}</span>
                {isActive && (
                  <div className="h-1 w-1 rounded-full bg-emerald-500 mt-0.5" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}
