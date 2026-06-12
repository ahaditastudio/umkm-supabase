import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "default" | "green" | "red" | "yellow" | "blue" | "muted";
};

const tones = {
  default: "bg-primary/10 text-primary",
  green: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  red: "bg-red-500/10 text-red-600 dark:text-red-300",
  yellow: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-300",
  muted: "bg-muted text-muted-foreground",
};

export function Badge({ className, tone = "default", ...props }: BadgeProps) {
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", tones[tone], className)} {...props} />;
}
