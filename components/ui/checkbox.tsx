import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type CheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  onCheckedChange?: (checked: boolean) => void;
};

export function Checkbox({ className, checked, onCheckedChange, onChange, ...props }: CheckboxProps) {
  return (
    <div className="relative inline-flex items-center justify-center">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => {
          onChange?.(e);
          onCheckedChange?.(e.target.checked);
        }}
        className="peer sr-only"
        {...props}
      />
      <div
        className={cn(
          "h-4 w-4 shrink-0 rounded border border-zinc-300 dark:border-zinc-700 bg-card transition-all duration-150 peer-checked:bg-primary peer-checked:border-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/20 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
          className
        )}
        onClick={(e) => {
          const input = e.currentTarget.previousElementSibling as HTMLInputElement;
          if (input && !input.disabled) {
            input.click();
          }
        }}
      >
        {checked && (
          <Check className="h-3 w-3 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
        )}
      </div>
    </div>
  );
}
