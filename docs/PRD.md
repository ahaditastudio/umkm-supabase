# KasFlow — Product Requirements Document

> **Version:** 3.0 | **Last Updated:** 2026-06-20

## 1. Overview

KasFlow is a **ledger-first accounting application** for Indonesian UMKM (Micro, Small & Medium Enterprises). Built on double-entry bookkeeping, all financial reports are derived from journal entries — not raw transactions.

**Tech Stack:** Next.js 15 (App Router) · Supabase (PostgreSQL + Auth + Realtime) · Zustand · Tailwind CSS · Recharts

**Target Users:** Small business owners who need compliant, transparent, and recoverable bookkeeping.

---

## 2. Core Architecture

```
Transaction → Journal Entry (debit/credit) → Ledger → Financial Reports
```

- **Ledger-first:** Dashboard and reports NEVER read amounts directly from transactions. Everything flows through `journal_entries`.
- **Double-entry:** Every transaction produces balanced debit/credit journal lines.
- **Soft-delete:** Transactions, customers, and suppliers use `deleted_at` timestamps instead of hard deletes.
- **Multi-period:** Support for multiple accounting periods with month-end closing.
- **RLS isolation:** Each user can only access data belonging to their company via Supabase Row Level Security.

---

## 3. Modules

### 3.1 Dashboard (`/`)
- KPI cards: Total Kas, Total Bank, Pendapatan Bulan Ini, Pengeluaran Bulan Ini, Laba Bersih, Estimasi Pajak
- Revenue vs Expense visualization (monthly)
- Net cash flow trend line
- Top revenue sources (ranked list)
- Top expense positions (stacked bar + legend grid)
- Quick stats: total transactions & journal entries count

### 3.2 Transactions (`/transactions`)
- Create income, expense, transfer, and capital transactions
- Auto-generate balanced journal entries on save
- Server-side paginated list with infinite scroll
- Filter by type, cash/bank account, year, and search text
- Soft-delete and restore functionality
- Closed period enforcement (cannot add/delete in closed periods)
- Capital transaction validation (dividen ≤ laba, prive ≤ modal + laba)

### 3.3 Accounting (`/accounting`)
- **Journal & Ledger tab:** General journal view + per-account ledger with running balance
- **Period Closing tab:** Close accounting period, input opening balance, audit log
- **COA tab:** Chart of Accounts CRUD, create new accounting periods

### 3.4 Master Data (`/master-data`)
- Categories (income/expense)
- Cash Accounts (cash/bank/ewallet)
- Customers (with soft-delete)
- Suppliers (with soft-delete)

### 3.5 Reports (`/reports`)
- Profit & Loss (Laba Rugi) — monthly/annual
- Balance Sheet (Neraca) — PMSAK-compliant classified format
- Cash Flow Statement (Arus Kas)
- Revenue summary
- Export to CSV

### 3.6 Tax (`/tax`)
- Dynamic tax settings (rate, base, due day)
- Monthly and annual tax estimation
- Based on configurable formula — no hardcoded rules

### 3.7 Utilities (`/utilities`)
- Dummy data generator
- Demo company seeder (300 transactions + 100 customers)
- Full data reset (hard-delete transactions, journals, customers, suppliers, audit logs)
- Backup & restore (JSON export/import)

### 3.8 Settings (`/settings`)
- Business profile management
- Tax settings configuration

### 3.9 Marketplace Integration (`/integrations`)
- TikTok Shop OAuth connection flow
- Multi-store support per platform
- Statement-based sync with idempotency
- Approval workflow (pending → approved/rejected)
- Auto-create transactions + journal entries from approved statements
- Account mapping configuration (revenue, fees, settlement)

### 3.10 Onboarding (`/onboarding`)
- 3-step wizard: Business Profile → Initial Capital → Default COA seeding
- Bootstrap company data via `lib/supabase/bootstrap.ts`

---

## 4. Data Model

### Core Tables (18 total)
| # | Table | Purpose |
|---|-------|---------|
| 1 | `business_profiles` | Company identity |
| 2 | `users` | Auth user → company mapping |
| 3 | `accounts` | Chart of Accounts (COA) |
| 4 | `account_categories` | Income/expense category buckets |
| 5 | `cash_accounts` | Cash/bank/ewallet accounts |
| 6 | `customers` | Customer directory (soft-delete) |
| 7 | `suppliers` | Supplier directory (soft-delete) |
| 8 | `transactions` | Financial transactions |
| 9 | `journal_entries` | Double-entry journal (source of truth) |
| 10 | `tax_settings` | Tax configuration |
| 11 | `accounting_periods` | Open/closed fiscal periods |
| 12 | `audit_logs` | Audit trail |
| 13 | `marketplace_connections` | TikTok Shop OAuth connections |
| 14 | `marketplace_account_mapping` | Fee/revenue account mapping |
| 15 | `marketplace_orders` | Order cache from platform API |
| 16 | `marketplace_order_items` | SKU-level order detail |
| 17 | `marketplace_statements` | Settlement statements + approval |
| 18 | `marketplace_sync_logs` | Sync operation tracking |

See `supabase-schema.sql` for complete DDL.

---

## 5. Security

- **Authentication:** Supabase Auth (email + password)
- **Authorization:** Row Level Security (RLS) on all 18 tables
- **Helper function:** `auth_user_company_id()` resolves company_id from `users` table
- **Service role key:** Only used in server-side API routes, never exposed to client
- **Soft-delete:** Data is never permanently removed by end users

---

## 6. Real-time Sync

- Supabase Realtime subscriptions on all active tables
- In-place state patching for INSERT/UPDATE/DELETE events
- Journal entries loaded eagerly during initial sync
- Deferred loading for customers, suppliers, audit logs

---

## 7. Default COA (Chart of Accounts)

Auto-seeded on company bootstrap:

| Code | Name | Type | Normal Balance | Neraca Section |
|------|------|------|---------------|----------------|
| 1100 | Kas | asset | debit | aset_lancar |
| 1110 | Bank | asset | debit | aset_lancar |
| 1120 | Piutang Usaha | asset | debit | aset_lancar |
| 1130 | Persediaan | asset | debit | aset_lancar |
| 1200 | Sewa Dibayar Dimuka | asset | debit | aset_lancar |
| 1300 | Aset Lancar Lainnya | asset | debit | aset_lancar |
| 1400 | Aset Tetap | asset | debit | aset_tetap |
| 1410 | Peralatan & Inventaris | asset | debit | aset_tetap |
| 1420 | Kendaraan | asset | debit | aset_tetap |
| 1500 | Akumulasi Penyusutan | asset | credit | akumulasi_penyusutan |
| 2100 | Utang Usaha | liability | credit | kewajiban_lancar |
| 2200 | Utang Pajak | liability | credit | kewajiban_lancar |
| 2300 | Utang Bank | liability | credit | kewajiban_jangka_panjang |
| 3100 | Modal Pemilik | equity | credit | ekuitas |
| 3200 | Laba Bersih Periode Berjalan | equity | credit | ekuitas |
| 3300 | Dividen | equity | debit | ekuitas |
| 3400 | Laba Ditahan | equity | credit | ekuitas |
| 4100 | Penjualan | revenue | credit | — |
| 4200 | Pendapatan Lain | revenue | credit | — |
| 5100 | Harga Pokok Penjualan | expense | debit | — |
| 5200 | Beban Gaji | expense | debit | — |
| 5300 | Beban Sewa | expense | debit | — |
| 5400 | Beban Utilitas | expense | debit | — |
| 5500 | Beban Lainnya | expense | debit | — |
| 5600 | Beban Penyusutan | expense | debit | — |
| 5700 | Beban Platform | expense | debit | — |
| 5800 | Beban Pengiriman | expense | debit | — |

---

## 8. Setup Guide

### Prerequisites
- Node.js 18+
- Supabase project (free tier works)
- Git

### Installation

```bash
# 1. Clone the repository
git clone <repo-url> kasflow
cd kasflow

# 2. Install dependencies
npm install

# 3. Copy and configure environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# 4. Set up the database
# Open Supabase Dashboard → SQL Editor
# Paste the ENTIRE content of supabase-schema.sql and execute

# 5. Run the development server
npm run dev
# Open http://localhost:3000
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-side only) |
| `NEXT_PUBLIC_APP_URL` | Yes | App base URL for OAuth callbacks |
| `TIKTOK_APP_KEY` | Optional | TikTok Shop API key |
| `TIKTOK_APP_SECRET` | Optional | TikTok Shop API secret |

---

## 9. Project Structure

```
app/                    # Next.js App Router pages
  page.tsx              # Dashboard
  accounting/           # Journal, ledger, COA, periods
  transactions/         # Transaction CRUD
  master-data/          # Categories, cash accounts, customers, suppliers
  reports/              # Financial reports
  tax/                  # Tax estimation
  utilities/            # Dummy data, reset, backup
  settings/             # Business profile
  integrations/         # TikTok Shop marketplace
  onboarding/           # First-time setup wizard
  api/                  # Server-side API routes (Supabase service role)

components/             # Shared React components
  ui/                   # Primitives (button, card, badge, etc.)
  app-shell.tsx         # Layout wrapper with auth guard
  auth-provider.tsx     # Auth context provider
  providers.tsx         # QueryClient + Auth + Toaster

hooks/                  # Custom React hooks
lib/                    # Business logic
  accounting.ts         # Journal generation, ledger, COA defaults
  accounting-memoized.ts # Memoized report calculations
  report-export.ts      # CSV export utilities
  supabase/             # Supabase client, services, sync
  types.ts              # TypeScript interfaces
  validation.ts         # Zod schemas

store/                  # Zustand state management
supabase-migrations/    # Incremental SQL migration files
supabase-schema.sql     # Complete schema (fresh install)
docs/                   # Implementation notes
reff/                   # API reference documents
```

---

## 10. Key Design Decisions

1. **Zustand over Redux** — minimal boilerplate, direct state access for sync layer
2. **Client-side rendering only** — `"use client"` on all pages, `force-dynamic` export
3. **Lazy journal loading** — journal entries loaded eagerly in initial sync batch
4. **Memoized reports** — expensive calculations cached with reference-equality memoize
5. **Partialize large arrays** — transactions, journals, ledger excluded from localStorage persistence
6. **Incremental ledger** — `appendLedgerEntries()` for new transactions, full rebuild only for backdated edits
7. **Statement-based marketplace sync** — idempotent settlement processing, not order-by-order
