import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "destructive";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
};

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:bg-primary/95 shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-primary/10",
  secondary: "bg-muted text-foreground hover:bg-muted/80 border border-zinc-200/50 dark:border-zinc-800/40",
  outline: "border border-zinc-200 dark:border-zinc-800 bg-card text-foreground hover:bg-muted hover:text-foreground",
  ghost: "hover:bg-muted text-muted-foreground hover:text-foreground",
  destructive: "bg-destructive text-white hover:bg-destructive/90 shadow-[0_1px_2px_rgba(0,0,0,0.05)]",
};

const sizes = {
  sm: "h-9 px-3.5 text-[11px]",
  md: "h-11 px-4 text-xs",
  lg: "h-12 px-5 text-sm",
};

export function Button({ className, variant = "primary", size = "md", loading, children, disabled, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition duration-200 select-none disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : null}
      {children}
    </button>
  );
}
