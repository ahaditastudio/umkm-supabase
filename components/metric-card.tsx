import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MetricCard({
  title,
  value,
  icon: Icon,
  tone = "primary",
  helper,
  compact = false,
}: {
  title: string;
  value: string;
  icon: LucideIcon;
  tone?: "primary" | "green" | "red" | "blue" | "yellow";
  helper?: string;
  compact?: boolean;
}) {
  const iconToneClass = {
    primary: "text-emerald-500 bg-emerald-500/10 border-emerald-500/10",
    green: "text-emerald-500 bg-emerald-500/10 border-emerald-500/10",
    red: "text-rose-500 bg-rose-500/10 border-rose-500/10",
    blue: "text-blue-500 bg-blue-500/10 border-blue-500/10",
    yellow: "text-amber-500 bg-amber-500/10 border-amber-500/10",
  }[tone];

  if (compact) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase truncate">{title}</p>
            <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg border text-xs shrink-0", iconToneClass)}>
              <Icon className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="mt-2 text-base sm:text-lg font-bold tracking-tight text-foreground font-sans">
            {value}
          </p>
          {helper ? (
            <p className="mt-1 text-[10px] text-muted-foreground truncate">{helper}</p>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden relative group hover:border-zinc-300 dark:hover:border-zinc-700 transition duration-300">
      <CardContent className="p-4 lg:p-6">
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{title}</p>
          <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg border text-xs transition duration-300 group-hover:scale-105", iconToneClass)}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <p className="text-xl lg:text-2xl font-bold tracking-tight text-foreground font-sans">
            {value}
          </p>
        </div>
        {helper ? (
          <p className="mt-2 text-[10px] font-medium text-muted-foreground leading-none">
            {helper}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
