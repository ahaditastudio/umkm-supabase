import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MetricCard({
  title,
  value,
  icon: Icon,
  tone = "primary",
  helper,
}: {
  title: string;
  value: string;
  icon: LucideIcon;
  tone?: "primary" | "green" | "red" | "blue" | "yellow";
  helper?: string;
}) {
  const toneClass = {
    primary: "bg-primary/10 text-primary",
    green: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    red: "bg-red-500/10 text-red-600 dark:text-red-300",
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-300",
    yellow: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  }[tone];

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-5">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
          {helper ? <p className="mt-1 text-xs text-muted-foreground">{helper}</p> : null}
        </div>
        <div className={cn("rounded-xl p-3", toneClass)}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}
