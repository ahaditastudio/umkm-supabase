"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
};

export function Modal({ open, onClose, title, description, children }: ModalProps) {
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

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center max-lg:items-end justify-center p-4 max-lg:p-0">
      {/* Backdrop with frosted glass effect */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
        onClick={onClose}
      />

      {/* Modal Box */}
      <div
        className={cn(
          "relative bg-card text-card-foreground border border-zinc-200/80 dark:border-zinc-800/60 shadow-2xl w-full max-w-md overflow-hidden z-10",
          "rounded-2xl p-6 animate-in fade-in zoom-in-95 duration-200",
          "max-lg:rounded-b-none max-lg:rounded-t-3xl max-lg:max-w-none max-lg:w-full max-lg:p-6",
          "max-lg:animate-in max-lg:slide-in-from-bottom max-lg:fade-in max-lg:duration-300"
        )}
        style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}
      >
        {/* Drag Handle - mobile only */}
        <div className="lg:hidden flex justify-center mb-3 -mt-1">
          <div className="w-10 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-base font-bold tracking-tight text-foreground">{title}</h3>
            {description ? (
              <p className="text-xs text-muted-foreground mt-1 leading-normal">{description}</p>
            ) : null}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition duration-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        {children ? <div className="text-xs text-muted-foreground/90 leading-relaxed mb-6">{children}</div> : null}
      </div>
    </div>,
    document.body
  );
}

type ConfirmModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
};

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Ya, Hapus",
  cancelLabel = "Batal",
  loading = false,
}: ConfirmModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="flex items-start gap-3 mb-6 bg-rose-50/50 border border-rose-200/50 dark:bg-rose-500/5 dark:border-rose-500/10 p-3 rounded-lg">
        <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5 animate-pulse" />
        <p className="text-xs text-rose-700 dark:text-rose-400 font-medium leading-normal">
          {description}
        </p>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          onClick={onClose}
          disabled={loading}
          className="text-xs font-semibold h-9"
        >
          {cancelLabel}
        </Button>
        <Button
          variant="destructive"
          onClick={onConfirm}
          loading={loading}
          className="text-xs font-semibold h-9"
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
