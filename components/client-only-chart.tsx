"use client";

import { ReactNode, useEffect, useState } from "react";

export function ClientOnlyChart({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-full w-full animate-pulse rounded-xl bg-muted" />;
  }

  return <>{children}</>;
}
