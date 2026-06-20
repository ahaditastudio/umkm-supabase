# PRD Summary - KasFlow

> See full PRD: [`docs/PRD.md`](./PRD.md)

KasFlow is a **ledger-first accounting application** for Indonesian UMKM, built with Next.js 15 + Supabase. All financial reports derive from double-entry journal entries.

## Modules

| # | Module | Route | Status |
|---|--------|-------|--------|
| 1 | Dashboard | `/` | Done — KPI cards, charts, top revenue/expense |
| 2 | Transactions | `/transactions` | Done — CRUD, pagination, soft-delete, capital validation |
| 3 | Accounting | `/accounting` | Done — journal, ledger, COA, period closing, opening balance |
| 4 | Master Data | `/master-data` | Done — categories, cash accounts, customers, suppliers |
| 5 | Reports | `/reports` | Done — P&L, balance sheet, cash flow, CSV export |
| 6 | Tax | `/tax` | Done — dynamic settings, monthly/annual estimation |
| 7 | Utilities | `/utilities` | Done — dummy data, seed, reset, backup/restore |
| 8 | Settings | `/settings` | Done — business profile |
| 9 | Marketplace | `/integrations` | Done — TikTok Shop sync, approval workflow |
| 10 | Onboarding | `/onboarding` | Done — 3-step wizard |

## Key Architecture

- **Ledger-first:** `journal_entries` is the source of truth, not `transactions`
- **RLS isolation:** 18 tables with company-scoped Row Level Security
- **Real-time sync:** Supabase Realtime subscriptions on all active tables
- **Zustand store:** Client-side state with localStorage persistence (large arrays excluded)
- **Memoized reports:** Expensive calculations cached via reference-equality memoize
