# KasFlow

KasFlow adalah aplikasi pencatatan keuangan dan akuntansi UMKM Indonesia berbasis **Ledger First Accounting System** sesuai PRD v3.0.

## Status Implementasi Awal

Fondasi MVP sudah dibuat dari direktori kosong:

- Next.js 15 + TypeScript + Tailwind CSS
- UI shell modern SaaS, light/dark mode, responsive, sidebar collapsible
- Zustand local persisted store untuk mode demo/offline-first
- React Hook Form + Zod untuk input transaksi
- TanStack Query provider
- Firebase client config, Firebase Auth UI, Firestore sync, Hosting config, Firestore/Storage rules
- Cloud Functions scaffold untuk server-side dashboard aggregation

## Fitur yang Sudah Ada

- Dashboard KPI dari jurnal: total kas, bank, pendapatan, pengeluaran, laba bersih, estimasi pajak
- Transaksi pemasukan, pengeluaran, transfer antar kas
- Auto journal generation:
  - Income: Debit Kas, Credit Pendapatan
  - Expense: Debit Beban, Credit Kas
  - Transfer: Debit Destination, Credit Source
- General Journal sebagai source of truth
- Ledger per account dengan running balance
- Chart of Accounts default sesuai PRD
- Laporan: Gross Revenue, Profit & Loss, Balance Sheet, Cash Flow
- Pajak dinamis: rate, base, due day, monthly/annual estimation
- Accounting period dan month-end closing dengan konfirmasi `TUTUP BUKU`
- Opening balance otomatis menjadi jurnal
- Master data: kategori, cash accounts, customer/supplier create + soft delete
- Utilities: dummy data, seed demo company, reset data, backup JSON, recycle bin
- Audit log dasar
- Onboarding wizard 3 step

## Menjalankan Project

```bash
npm install
npm run dev
```

Buka `http://localhost:3000`.

## Firebase Setup

Konfigurasi Firebase web app sudah dipasang di `.env.local` untuk project `umkm-finance-7409d`.

Di Firebase Console, pastikan:

1. Authentication → Sign-in method → Email/Password aktif.
2. Firestore Database sudah dibuat.
3. Rules sudah dideploy:

```bash
firebase deploy --only firestore:rules,storage
```

Saat user register dari `/auth`, app otomatis membuat:

- `users/{uid}`
- `business_profiles/{companyId}`
- default `accounts`
- default `account_categories`
- default `cash_accounts`
- default `tax_settings`
- default `accounting_periods`

Setelah login, data app disinkronkan realtime dari Firestore ke Zustand cache.

Untuk Functions:

```bash
cd functions
npm install
npm run build
firebase deploy --only functions
```

## Catatan Arsitektur

Semua laporan dihitung dari `journalEntries`, bukan dari `transactions`. Transaksi hanya menjadi input operasional untuk menghasilkan jurnal otomatis.

Flow production saat ini:

```txt
UI → Firestore write service → Firestore → realtime sync → Zustand cache → reports dari journalEntries
```

Zustand tetap dipakai sebagai cache/UI state, sementara Firestore menjadi source of truth setelah user login.
