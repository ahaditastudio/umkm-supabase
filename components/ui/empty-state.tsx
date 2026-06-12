import * as React from "react";
import { Inbox, LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}) {
  return (
    <Card className="border-dashed bg-zinc-50/50 dark:bg-zinc-900/10">
      <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted border text-muted-foreground/80">
          <Icon className="h-5 w-5" />
        </div>
        <div className="max-w-sm space-y-1">
          <h3 className="text-sm font-semibold text-foreground tracking-tight">{title}</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
        </div>
        {action ? <div className="mt-2 animate-in fade-in zoom-in-95 duration-200">{action}</div> : null}
      </CardContent>
    </Card>
  );
}
