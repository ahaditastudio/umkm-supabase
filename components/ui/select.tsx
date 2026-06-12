import * as React from "react";
import { cn } from "@/lib/utils";

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-9 w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-card px-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/5 disabled:cursor-not-allowed disabled:opacity-50 appearance-none",
        className,
      )}
      {...props}
    />
  );
}
