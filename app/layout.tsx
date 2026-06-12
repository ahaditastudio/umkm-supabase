import type { Metadata } from "next";
import "@/app/globals.css";
import { AppShell } from "@/components/app-shell";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: {
    default: "KasFlow",
    template: "%s | KasFlow",
  },
  description:
    "Aplikasi pencatatan keuangan dan akuntansi UMKM Indonesia. Ledger-first, otomatis jurnal, laporan keuangan real-time.",
  applicationName: "KasFlow",
  keywords: ["keuangan", "akuntansi", "UMKM", "laporan keuangan", "jurnal"],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
