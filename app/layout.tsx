import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "@/app/globals.css";
import { AppShell } from "@/components/app-shell";
import { Providers } from "@/components/providers";

// Force dynamic rendering — all pages are 100% client-side rendered.
// Prevents static pre-render errors from browser-only APIs (localStorage, Supabase client).
export const dynamic = "force-dynamic";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta-sans",
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#10b981",
};

export const metadata: Metadata = {
  title: {
    default: "KasFlow",
    template: "%s | KasFlow",
  },
  description:
    "Aplikasi pencatatan keuangan dan akuntansi UMKM Indonesia. Ledger-first, otomatis jurnal, laporan keuangan real-time.",
  applicationName: "KasFlow",
  keywords: ["keuangan", "akuntansi", "UMKM", "laporan keuangan", "jurnal"],
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "KasFlow",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className={plusJakartaSans.variable} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
