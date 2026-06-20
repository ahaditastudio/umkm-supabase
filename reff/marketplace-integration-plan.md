# Rencana Fitur: Integrasi Marketplace

> **Tanggal**: 16 Juni 2026
> **Status**: Finalized — Siap Implementasi
> **Aplikasi**: KasFlow — Aplikasi Keuangan UMKM

---

## 1. Latar Belakang

KasFlow saat ini adalah aplikasi pencatatan keuangan berbasis ledger-first untuk UMKM. Seller marketplace (terutama TikTok Shop) sering mengalami kesulitan merekonsiliasi data penjualan dari marketplace dengan pencatatan keuangan mereka. Proses manual rawan kesalahan dan memakan waktu.

Dengan adanya **Integrasi Marketplace**, data order dan pencairan (settlement/payout) dari marketplace akan otomatis tersinkron ke KasFlow, menghasilkan jurnal akuntansi yang akurat tanpa input manual.

---

## 2. TikTok Shop API — Referensi Lengkap

### 2.0 Overview & Domain

| Item | Detail |
|------|--------|
| **Auth Type** | OAuth 2.0 (Authorization Code Grant) |
| **Signature** | HMAC-SHA256 |
| **API Domain** | `https://open-api.tiktokglobalshop.com` |
| **Auth Domain** | `https://auth.tiktok-shops.com` |
| **Partner Center** | https://partner.tiktokshop.com |

**3 domain berbeda (JANGAN sampai tertukar):**

| Fungsi | Domain |
|--------|--------|
| OAuth Login (Seller authorize) | `auth.tiktok-shops.com` |
| Token Exchange & Refresh | `auth.tiktok-shops.com` |
| API Calls (shops, finance, order) | `open-api.tiktokglobalshop.com` |

> Domain yang benar: `auth.tiktok-shops.com` (dengan "shops" bukan "shop").

### 2.1 Algoritma Signature

Setiap request ke API **WAJIB** menyertakan `sign`:

```
message = app_secret + path + key1value1key2value2... + body + app_secret
signature = HMAC-SHA256(message, key=app_secret)
```

Langkah:
1. Ambil semua query params (exclude: `sign`, `app_secret`, `token`, `access_token`)
2. Sort alfabet berdasarkan key
3. Concat: `key1value1key2value2` (TANPA separator `=`, `&`)
4. Message: `app_secret` + `path` + `concat_params` + `body` + `app_secret`
5. Hash HMAC-SHA256, output hex lowercase

```typescript
import crypto from 'crypto';

function generateSign(
  path: string,
  params: Record<string, string | number>,
  appSecret: string,
  body: string = ''
): string {
  const filteredParams = { ...params };
  delete filteredParams.sign;
  const sortedKeys = Object.keys(filteredParams).sort();
  const paramString = sortedKeys
    .map(key => `${key}${filteredParams[key]}`)
    .join('');
  const message = `${appSecret}${path}${paramString}${body}${appSecret}`;
  return crypto.createHmac('sha256', appSecret).update(message).digest('hex');
}
```

Kesalahan umum:
| Salah | Benar |
|-------|-------|
| SHA256 biasa | HMAC-SHA256 |
| Params `key=value&key=value` | `key1value1key2value2` (tanpa separator) |
| `app_secret` tidak ikut | `app_secret` di depan DAN belakang |
| Include `sign` saat generate | Exclude `sign` |

### 2.2 OAuth Flow — Authorization

**URL Authorization:**
```
# Non-US (Indonesia, SEA, UK):
https://auth.tiktok-shops.com/oauth/authorize?app_key=YOUR_APP_KEY&state=RANDOM_STATE

# US:
https://services.us.tiktokshop.com/open/authorize?service_id=YOUR_SERVICE_ID
```

**Flow:**
1. Redirect user ke URL di atas
2. User login TikTok & authorize
3. TikTok redirect ke `REDIRECT_URI?code=AUTH_CODE&state=STATE&app_key=...`
4. Exchange `auth_code` → `access_token` (lihat Token Exchange)
5. Simpan `access_token` + `refresh_token`

**Penting:**
- `auth_code` expired **30 menit**, pakai **sekali**
- `access_token` expired **7 hari** — auto-refresh setiap **6 hari**
- `redirect_uri` harus **sama persis** dengan yang terdaftar di Partner Center
- Selalu pakai `state` parameter (random UUID) untuk CSRF protection

### 2.3 Token Exchange & Refresh

**Get Access Token:**
```
GET https://auth.tiktok-shops.com/api/v2/token/get
```

| Parameter | Required | Deskripsi |
|-----------|----------|----------|
| `app_key` | Ya | App key dari Partner Center |
| `app_secret` | Ya | App secret |
| `auth_code` | Ya | Code dari callback OAuth |
| `grant_type` | Ya | `authorized_code` |

> Endpoint ini TIDAK memerlukan signature.

Response:
```json
{
  "code": 0,
  "data": {
    "access_token": "TTP_Fw8rBwAAAAAkW...",
    "access_token_expire_in": 1660556783,
    "refresh_token": "TTP_NTUxZTNhYTQ2...",
    "refresh_token_expire_in": 1691487031,
    "open_id": "7010736057180325637",
    "seller_name": "Jjj test shop",
    "seller_base_region": "ID",
    "user_type": 0
  }
}
```

| Field | Deskripsi |
|-------|----------|
| `access_token` | Token untuk API calls (header `x-tts-access-token`) |
| `access_token_expire_in` | Unix timestamp expired (7 hari) |
| `refresh_token` | Token untuk refresh |
| `refresh_token_expire_in` | Unix timestamp expired refresh token |
| `open_id` | ID unik user |
| `seller_name` | Nama seller |
| `seller_base_region` | Region (ID, US, GB) |
| `user_type` | 0=Seller, 1=Creator, 3=Partner |

**Refresh Access Token:**
```
GET https://auth.tiktok-shops.com/api/v2/token/refresh
```

| Parameter | Required | Deskripsi |
|-----------|----------|----------|
| `app_key` | Ya | App key |
| `app_secret` | Ya | App secret |
| `refresh_token` | Ya | Refresh token |
| `grant_type` | Ya | `refresh_token` |

Response format sama — return `access_token` + `refresh_token` baru.

### 2.4 Common Parameters (Semua API Call)

**Headers:**

| Header | Required | Nilai |
|--------|----------|-------|
| `content-type` | Ya | `application/json` |
| `x-tts-access-token` | Ya | Access token |

**Query Parameters:**

| Parameter | Required | Deskripsi |
|-----------|----------|----------|
| `app_key` | Ya | App key |
| `shop_cipher` | Ya* | Identifier shop (dari Get Authorized Shops) |
| `sign` | Ya | HMAC-SHA256 signature |
| `timestamp` | Ya | Unix timestamp GMT (UTC+00:00) |

*`shop_cipher` tidak required untuk endpoint yang tidak terkait shop.

**Pagination:**

| Parameter | Default | Deskripsi |
|-----------|---------|----------|
| `page_size` | 20 | Jumlah per halaman (1–100) |
| `page_token` | — | Token halaman berikutnya |
| `sort_field` | varies | Field sorting |
| `sort_order` | `ASC` | `ASC` atau `DESC` |

### 2.5 Get Authorized Shops

```
GET /authorization/202309/shops
```
Scope: `seller.authorization.info` | shop_cipher: tidak required

Response `data.shops[]`:

| Field | Tipe | Deskripsi |
|-------|------|----------|
| `id` | string | Shop ID |
| `name` | string | Nama shop → simpan sebagai `shop_name` |
| `region` | string | Region (ID, US, GB) |
| `seller_type` | string | `CROSS_BORDER`, `LOCAL` |
| `cipher` | string | **shop_cipher** → simpan untuk API lain |
| `code` | string | Shop code |

```json
{
  "code": 0,
  "data": {
    "shops": [{
      "id": "7000714532876273420",
      "name": "Toko Example",
      "region": "ID",
      "seller_type": "LOCAL",
      "cipher": "GCP_XF90igAAAABh00qsWgtvOiGFNqyubMt3",
      "code": "CNGBCBA4LLU8"
    }]
  }
}
```

### 2.6 Finance API — Get Statements [SUMBER UTAMA SYNC]

```
GET /finance/202309/statements
```
Scope: `seller.finance.info` | Data tersedia: setelah 2023-07-01

**Ini adalah endpoint terpenting untuk KasFlow — statement harian adalah source of truth untuk pembuatan transaksi.**

| Parameter | Required | Deskripsi |
|-----------|----------|----------|
| `statement_time_ge` | Tidak | Filter >= waktu ini (Unix timestamp) |
| `statement_time_lt` | Tidak | Filter < waktu ini |
| `payment_status` | Tidak | `PAID`, `FAILED`, `PROCESSING` |
| `sort_field` | **Ya** | Harus `statement_time` |
| `sort_order` | Tidak | `ASC` / `DESC` |

Response `data.statements[]`:

| Field | Tipe | Mapping ke KasFlow |
|-------|------|-------------------|
| `id` | string | → `platform_statement_id` |
| `statement_time` | int | → tanggal transaksi |
| `revenue_amount` | string | → amount transaksi INCOME |
| `fee_amount` | string | → amount transaksi EXPENSE (ABS) |
| `settlement_amount` | string | → amount transaksi TRANSFER |
| `adjustment_amount` | string | → info tambahan |
| `net_sales_amount` | string | → info tambahan |
| `shipping_cost_amount` | string | → info tambahan |
| `payment_status` | string | → `PAID`=buat transfer, `PROCESSING`=tunda |
| `payment_id` | string | → simpan untuk referensi |
| `payment_time` | int | → tanggal transaksi transfer |
| `currency` | string | → `currency` |

Konsep:
- 1 statement = 1 hari, generate pukul 00:00 UTC
- 1 statement = 1 payment (payout ke seller)
- Statement ditutup hari berikutnya → initiate pembayaran

### 2.7 Finance API — Get Transactions by Statement

```
GET /finance/202501/statements/{statement_id}/statement_transactions
```
Scope: `seller.finance.info`

Path: `statement_id` dari Get Statements.

| Parameter | Required | Deskripsi |
|-----------|----------|----------|
| `sort_field` | **Ya** | Harus `order_create_time` |
| `sort_order` | Tidak | `ASC` / `DESC` |

Response `data`:

| Field | Deskripsi |
|-------|----------|
| `total_settlement_breakdown.total_revenue_amount` | Total pendapatan |
| `total_settlement_breakdown.total_shipping_cost_amount` | Total ongkir |
| `total_settlement_breakdown.total_fee_tax_amount` | Total pajak & biaya |
| `total_settlement_breakdown.total_adjustment_amount` | Total penyesuaian |
| `transactions[].id` | Transaction ID |
| `transactions[].type` | `ORDER`, `ADJUSTMENT` |
| `transactions[].order_id` | Order ID (untuk drill-down) |

### 2.8 Finance API — Get Transactions by Order (SKU-level)

```
GET /finance/202501/orders/{order_id}/statement_transactions
```
Scope: `seller.finance.info`

Response `data.sku_transactions[]`:

| Field | Deskripsi |
|-------|----------|
| `sku_id` | SKU ID |
| `sku_name` | Nama SKU |
| `product_name` | Nama produk |
| `quantity` | Jumlah unit |
| `settlement_amount` | Settlement SKU |
| `revenue_amount` | Pendapatan SKU |
| `revenue_breakdown.subtotal_before_discount_amount` | Subtotal |
| `revenue_breakdown.seller_discount_amount` | Diskon seller |

### 2.9 Finance API — Get Unsettled Transactions

```
GET /finance/202507/orders/unsettled
```
Scope: `seller.finance.info` | Data tersedia: setelah 2025-01-01

> **ESTIMASI** — bisa berubah sebelum settlement final.

| Parameter | Required | Deskripsi |
|-----------|----------|----------|
| `search_time_ge` | Tidak | Filter >= waktu ini |
| `search_time_lt` | Tidak | Filter < waktu ini |
| `sort_field` | **Ya** | Harus `order_create_time` |

Response `data`:

| Field | Deskripsi |
|-------|----------|
| `total_count` | Jumlah unsettled |
| `sum_est_settlement_amount` | Total estimasi settlement |
| `sum_est_revenue_amount` | Total estimasi pendapatan |
| `sum_est_fee_amount` | Total estimasi biaya |
| `transactions[].order_id` | Order ID |
| `transactions[].unsettled_reason` | Alasan belum settle |

### 2.10 Finance API — Get Payments

```
GET /finance/202605/payments
```
> **Tidak tersedia untuk market SEA (termasuk Indonesia)** — SKIP untuk MVP.

### 2.11 Order API — Get Order List

```
POST /order/202309/orders/search
```
Scope: `seller.order.info`

| Parameter | Required | Deskripsi |
|-----------|----------|----------|
| `page_size` | **Ya** | 1-100 |
| `sort_field` | Tidak | `create_time` / `update_time` |
| `sort_order` | Tidak | `ASC` / `DESC` |

Body:
```json
{
  "order_status": "COMPLETED",
  "create_time_ge": 1623812664,
  "create_time_lt": 1623912664,
  "shipping_type": "TIKTOK"
}
```

Order status: `UNPAID`, `ON_HOLD`, `AWAITING_SHIPMENT`, `PARTIALLY_SHIPPING`, `AWAITING_COLLECTION`, `IN_TRANSIT`, `DELIVERED`, `COMPLETED`, `CANCELLED`

Response `data.orders[]`:

| Field | Deskripsi |
|-------|----------|
| `id` | Order ID |
| `create_time` | Waktu order |
| `payment.currency` | Mata uang |
| `payment.sub_total` | Subtotal |
| `payment.shipping_fee` | Ongkir |
| `payment.seller_discount` | Diskon seller |

### 2.12 Order API — Get Order Detail

```
GET /order/202507/orders?ids=ORDER_ID_1,ORDER_ID_2
```
Max 50 order per request. Response detail includes: `status`, `payment` (full breakdown), `user_id`, `shipping_provider`.

### 2.13 Helper Implementasi

**API Request Wrapper:**
```typescript
const BASE_URL = 'https://open-api.tiktokglobalshop.com';

async function tiktokApiGet(
  path: string, accessToken: string, shopCipher: string,
  appKey: string, appSecret: string, extraParams: Record<string, any> = {}
) {
  const params = {
    app_key: appKey, shop_cipher: shopCipher,
    timestamp: Math.floor(Date.now() / 1000), ...extraParams,
  };
  params.sign = generateSign(path, params, appSecret);
  const url = `${BASE_URL}${path}?${new URLSearchParams(params)}`;
  const response = await fetch(url, {
    headers: { 'content-type': 'application/json', 'x-tts-access-token': accessToken },
  });
  return response.json();
}
```

**Paginate All:**
```typescript
async function fetchAllPages(path, accessToken, shopCipher, appKey, appSecret, extraParams = {}) {
  const allResults = [];
  let pageToken = null;
  while (true) {
    const params = { ...extraParams, page_size: 100 };
    if (pageToken) params.page_token = pageToken;
    const result = await tiktokApiGet(path, accessToken, shopCipher, appKey, appSecret, params);
    if (result.code !== 0) throw new Error(`API Error ${result.code}: ${result.message}`);
    const items = result.data.statements || result.data.transactions || result.data.orders || [];
    allResults.push(...items);
    if (!result.data.next_page_token) break;
    pageToken = result.data.next_page_token;
  }
  return allResults;
}
```

### 2.14 Error Codes

| Code | Message | Penanganan |
|------|---------|------------|
| `0` | Success | OK |
| `106001` | Invalid sign | Cek algoritma signature |
| `36009003` | Internal error | Retry exponential backoff |
| `10002014` | Failed to get orders | Retry |
| `21008111` | Order not belong to seller | Cek shop_cipher |

---

## 3. Struktur Menu Baru

### 3.1 Navigasi Utama

Menu baru ditambahkan di sidebar & bottom tab bar (sebagai sub-menu di "Lebih" / More):

```
Sidebar Navigation:
├── Dashboard
├── Transaksi
├── Akuntansi
├── Master Data
├── Laporan
├── Pajak
├── Integrasi Marketplace  ← BARU
├── Utilitas
└── Pengaturan
```

### 3.2 Halaman-Halaman Integrasi Marketplace

```
/integrations                    → Hub Marketplace (overview semua toko + tombol sync)
/integrations/per-store          → Ringkasan & perbandingan per toko (analytics)
/integrations/tiktok             → Setup koneksi + Statement harian + Order (tab view)
```

---

## 4. Alur Fitur (Flow)

### 4.1 Flow Koneksi TikTok Shop

```
┌──────────────────────────────────────────────────────────┐
│                  HUB MARKETPLACE                          │
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │  TikTok Shop │  │  Shopee     │  │  Tokopedia  │      │
│  │  ● Tersedia  │  │  ○ Segera   │  │  ○ Segera   │      │
│  └──────┬──────┘  └─────────────┘  └─────────────┘      │
│         │                                                │
└─────────┼────────────────────────────────────────────────┘
          │ klik "Hubungkan"
          ▼
┌──────────────────────────────────────────────────────────┐
│              SETUP KONEKSI TIKTOK SHOP                    │
│                                                          │
│  Step 1: Klik "Hubungkan TikTok Shop"                    │
│  Step 2: Redirect ke auth.tiktok-shops.com               │
│  Step 3: Seller login & authorize                        │
│  Step 4: Callback → Exchange auth_code → access_token    │
│  Step 5: Get Authorized Shops → shop info otomatis       │
│  Step 6: User bisa set label custom (display_name)       │
│  Step 7: Simpan shop_cipher + tokens + mapping akun      │
│  Step 8: Mulai sinkronisasi awal (backfill)              │
│                                                          │
│  ┌─────────────────────────────────────────────────┐     │
│  │  ✅ TikTok - "Toko Pusat" — Terhubung            │     │
│  │     Nama API: ABC Official Store                  │     │
│  │     Label: Toko Pusat (custom)                    │     │
│  │     Region: ID | Tipe: LOCAL                      │     │
│  │     Sinkronisasi terakhir: 5 menit lalu           │     │
│  │     [Sinkron Manual] [Pengaturan] [Putuskan]      │     │
│  └─────────────────────────────────────────────────┘     │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 4.2 Flow Sinkronisasi Data

**Mode Sinkronisasi (MVP: Manual only, Future: Scheduled)**

| Mode | Trigger | Kapan | Prioritas |
|------|---------|-------|----------|
| **Manual** | User klik tombol "Sinkron Sekarang" | MVP — Phase 1 | **Utama** |
| **Initial Backfill** | Otomatis saat setup pertama | MVP — Phase 1 | **Utama** |
| Scheduled | Cron job (Supabase Edge Function) | Phase 2 | Nanti |
| Webhook | TikTok push notification real-time | Phase 4 | Nanti |

**Kenapa Manual dulu?**
- Lebih simpel, tidak perlu setup cron/scheduler
- User kontrol penuh kapan data di-fetch
- Cocok untuk UMKM yang order volume-nya tidak terlalu besar
- Bisa langsung test end-to-end tanpa setup infrastruktur tambahan
- Scheduled sync bisa ditambahkan di Phase 2 tanpa perubahan besar

**Detail Flow Manual Sync (User klik "Sinkron Sekarang"):**

Pendekatan: **Statement-based sync** — transaksi KasFlow dibuat per statement harian (bukan per order).
1 statement = max 3 transaksi KasFlow (income + expense + transfer).

```
User klik "Sinkron Sekarang"
         │
         ▼
┌──────────────────────────────────────────────────────────┐
│  API Route: POST /api/integrations/tiktok/sync            │
│                                                           │
│  1. Cek koneksi: token valid? expired? perlu refresh?    │
│  2. Buat sync log entry (status: 'running')              │
│  3. Tentukan date range:                                  │
│     - Kalau backfill: dari sync_start_date                │
│     - Kalau incremental: dari last_sync_at                │
│                                                           │
│  4. FETCH & CACHE:                                        │
│     a. Get Statements (paginated) → upsert cache          │
│     b. Get Order List (paginated) → upsert cache          │
│     c. Get Unsettled → update status di cache             │
│                                                           │
│  5. BUAT TRANSAKSI KASFLOW (dari statement baru):        │
│     Untuk setiap statement dimana                           │
│     kasflow_income_txn_id IS NULL:                        │
│                                                           │
│     a. TXN 1 — INCOME (harian):                          │
│        "Penjualan TikTok - 10 Jun 2026 (15 order)"        │
│        Amount: total revenue_amount statement              │
│        Cash Account: Piutang Marketplace                  │
│        Category: Penjualan Online                         │
│        marketplace_connection_id: :conn_id                │
│                                                           │
│     b. TXN 2 — EXPENSE (harian, kalau fee > 0):          │
│        "Biaya Platform TikTok - 10 Jun 2026"              │
│        Amount: ABS(fee_amount)                            │
│        Cash Account: Piutang Marketplace                  │
│        Category: Biaya Platform                           │
│        marketplace_connection_id: :conn_id                │
│                                                           │
│     c. TXN 3 — TRANSFER (kalau payment_status=PAID):     │
│        "Pencairan TikTok - 10 Jun 2026"                   │
│        Amount: settlement_amount (net)                    │
│        Source: Piutang Marketplace                        │
│        Destination: Bank BCA                               │
│        marketplace_connection_id: :conn_id                │
│                                                           │
│  6. Update statement:                                     │
│     kasflow_income_txn_id, expense_txn_id, transfer_txn_id│
│     reconciled = true (kalau PAID)                        │
│                                                           │
│  7. Update sync log (status: 'success', counts)          │
│  8. Update last_sync_at di connection                    │
│                                                           │
└──────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────┐
│  UI menampilkan hasil:                                    │
│                                                           │
│  ✅ Sinkronisasi selesai                                  │
│  ┌────────────────────────────────────────┐               │
│  │ Statement diproses:        5 hari      │               │
│  │ Order cache diupdate:     48 order     │               │
│  │ Transaksi KasFlow dibuat: 12 txn       │               │
│  │ (4 income + 4 expense + 4 transfer)    │               │
│  │ Skipped (sudah synced):   30 hari     │               │
│  │ Error:                     0           │               │
│  │ Durasi:                    3.8 detik   │               │
│  └────────────────────────────────────────┘               │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

**Data yang di-fetch dari TikTok API:**

```
TikTok API                     →  Tabel KasFlow
─────────────────────────────────────────────────────────
Get Statements (HARIAN)         →  marketplace_statements (cache)
  [sumber utama transaksi]     →  transactions (3 txn per statement)
                               →  journal_entries (double-entry)

Get Order List + Detail         →  marketplace_orders (cache saja)
  [untuk analytics]            →  marketplace_order_items (SKU detail)
                               →  TIDAK membuat transaksi KasFlow

Get Unsettled Transactions      →  marketplace_orders (update status)
  [tracking saja]              →  Belum dijurnal
```

**Idempotency (Anti-Duplikasi):**
- Statement punya `UNIQUE(connection_id, platform_statement_id)` — tidak bisa duplikat
- Upsert: kalau `platform_statement_id` sudah ada → UPDATE cache, kalau belum → INSERT
- Transaksi KasFlow hanya dibuat jika `kasflow_income_txn_id IS NULL`
- Re-sync 100x pun, statement yang sama TIDAK dijurnal ulang
- Statement lama yang di-update dari API: cache berubah, tapi transaksi KasFlow TIDAK berubah (sudah final)
- Sync log mencatat counts: fetched, created, updated, skipped, error

### 4.3 Flow Mapping Statement Harian ke KasFlow

**PENTING**: Mapping berbasis statement harian, BUKAN per order.

```
Statement TikTok Shop (1 hari)        →  KasFlow (max 3 transaksi)
─────────────────────────────────────────────────────────────

TXN 1: INCOME (selalu dibuat)
  revenue_amount (total harian)       →  type: "income"
                                         category: mapping "revenue"
                                         cash_account: mapping "receivable"
                                         marketplace_connection_id: :conn_id

TXN 2: EXPENSE (kalau fee > 0)
  ABS(fee_amount) (total harian)      →  type: "expense"
                                         category: mapping "platform_fee"
                                         cash_account: mapping "receivable"
                                         marketplace_connection_id: :conn_id

TXN 3: TRANSFER (kalau payment_status = PAID)
  settlement_amount (net harian)      →  type: "transfer"
                                         source: mapping "receivable"
                                         destination: mapping "settlement_bank"
                                         marketplace_connection_id: :conn_id

Data yang TIDAK masuk ledger (cache saja untuk analytics):
  - Order-level detail               →  marketplace_orders
  - SKU-level detail                 →  marketplace_order_items
  - Unsettled transactions           →  marketplace_orders (status update)
```

**Contoh dengan angka nyata:**
```
Statement 10 Juni 2026 (15 order delivered):
  Revenue:      Rp 2.500.000
  Fee:          Rp   125.000
  Settlement:   Rp 2.325.000   (net, sudah dipotong fee)
  Payment:      PAID

→ TXN 1: Dr. Piutang TikTok 2.500.000 / Cr. Penjualan Online 2.500.000
→ TXN 2: Dr. Biaya Platform   125.000 / Cr. Piutang TikTok     125.000
→ TXN 3: Dr. Bank BCA       2.325.000 / Cr. Piutang TikTok   2.325.000

Saldo Piutang TikTok setelah semua: 0 ✅ (semua sudah cair ke bank)
```

---

## 5. Detail Halaman

### 5.1 Hub Marketplace (`/integrations`)

**Tujuan**: Overview semua koneksi marketplace yang tersedia.

**Konten**:
- Card untuk setiap marketplace (TikTok Shop, Shopee, Tokopedia, dll)
- Status koneksi: Terhubung / Belum Terhubung
- Ringkasan: jumlah order tersinkron, settlement terakhir
- Tombol "Hubungkan" untuk setiap marketplace

### 5.2 Setup TikTok Shop (`/integrations/tiktok`)

**Tujuan**: Setup dan manajemen koneksi TikTok Shop.

**Konten**:
- **Status Koneksi**: nama toko (dari API), label custom (display_name), region, tipe seller, status token
- **Label Custom**: user bisa rename toko (misalnya "Toko Pusat", "Cabang Bandung") — optional, fallback ke nama dari API
- **Konfigurasi Sinkronisasi**:
  - Mapping akun: pilih akun KasFlow untuk revenue, fee, settlement bank
  - Tanggal mulai sinkronisasi (backfill dari tanggal tertentu)
- **Aksi**: Sinkron Manual, Test Koneksi, Ubah Label, Putuskan Koneksi
- **Log Sinkronisasi**: riwayat sync terakhir (waktu, jumlah data, error)

### 5.3 Ringkasan Per Toko (`/integrations/per-store`)

**Tujuan**: Dashboard analytics performa masing-masing toko marketplace.

**Konten**:
- Filter: semua toko / toko tertentu, range tanggal
- Card per toko menampilkan:
  - Nama toko (display_name / shop_name)
  - Total revenue, fee, settlement
  - Jumlah order (selesai, pending, dibatalkan)
  - Bar chart perbandingan antar toko
- Klik toko → lihat detail: daftar order, statement, unsettled

### 5.4 Daftar Order & Statement (`/integrations/tiktok`)

**Tujuan**: Melihat statement harian dan daftar order untuk toko ini.

**Konten (Tab Statement)**:
- Tabel statement harian: Tanggal, Revenue, Fee, Settlement, Status Payment, Jumlah Order
- Filter: range tanggal, status payment (PAID/PROCESSING/FAILED)
- Detail per statement (expandable): breakdown settlement + daftar order di hari itu
- Badge: "Sudah dijurnal" / "Belum dijurnal" / "Sudah cair ke bank"
- Export CSV/PDF

**Konten (Tab Order)**:
- Daftar order dengan filter status & tanggal
- Detail per order: order ID, status, SKU detail, amounts
- Badge settlement: Settled / Unsettled
- Catatan: Order di sini HANYA untuk analytics, tidak membuat transaksi KasFlow

### 5.5 Transaksi Belum Settle (sub-section di 5.4)

**Tujuan**: Monitor order yang belum di-settle (estimasi pendapatan).

**Konten**:
- Ringkasan: total estimasi settlement, revenue, fee
- List transaksi unsettled:
  - Order ID, tanggal order, estimasi settlement
  - Alasan belum settle (menunggu pengiriman, dll)
- Catatan: data ini ESTIMASI, bisa berubah
- Auto-update: pindah ke settled setelah settle

---

## 6. Database Schema (Supabase-Ready)

> **File SQL siap deploy**: `supabase-marketplace-schema.sql` di root project.
> **Cara deploy**: Jalankan via Supabase SQL Editor, atau via `create-tables.js` pattern.

Schema sudah **100% konsisten** dengan schema KasFlow existing:
- `TEXT` primary keys (bukan UUID)
- `company_id TEXT REFERENCES business_profiles(id)`
- RLS policies via `auth_user_company_id()` (helper function yang sudah ada)
- Trigger `update_updated_at_column()` (reuse function yang sudah ada)
- Realtime publication ditambahkan ke `supabase_realtime`

### 6.1 Tabel Baru (6 tabel):

| # | Tabel | Fungsi |
|---|-------|--------|
| 1 | `marketplace_connections` | Koneksi OAuth (token, shop_name, **display_name**, shop_cipher) |
| 2 | `marketplace_account_mapping` | Mapping tipe transaksi → akun KasFlow (per connection) |
| 3 | `marketplace_orders` | Cache order (analytics only, tidak buat transaksi) |
| 4 | `marketplace_order_items` | Detail SKU per order (analytics only) |
| 5 | `marketplace_statements` | Statement harian (**source of truth** untuk buat transaksi KasFlow) |
| 6 | `marketplace_sync_logs` | Log setiap proses sinkronisasi |

### 6.2 Perubahan Tabel Existing (3 ALTER):

| Tabel Existing | Perubahan | Tujuan |
|----------------|-----------|--------|
| `journal_entries` | + source `'marketplace'` | Tandai jurnal dari sync marketplace |
| `transactions` | + kolom `marketplace_connection_id` (nullable) | Dimension tag untuk filter per toko |
| `journal_entries` | + kolom `marketplace_connection_id` (nullable) | Dimension tag untuk P&L per toko |

### 6.3 Statement sebagai Source of Truth:

`marketplace_statements` punya 3 link ke transaksi KasFlow:
- `kasflow_income_txn_id` → transaksi income harian
- `kasflow_expense_txn_id` → transaksi expense harian
- `kasflow_transfer_txn_id` → transaksi transfer payout harian

Idempotency: cek `kasflow_income_txn_id IS NULL` sebelum buat transaksi baru.

### Diagram Relasi:

```
business_profiles (existing)
    │
    ├──< marketplace_connections (1:N)
    │         │
    │         ├──< marketplace_account_mapping (1:N, per tipe)
    │         │
    │         ├──< marketplace_orders (1:N)
    │         │         │
    │         │         └──< marketplace_order_items (1:N, per SKU)
    │         │
    │         ├──< marketplace_statements (1:N)
    │         │
    │         └──< marketplace_sync_logs (1:N)
    │
    ├──< transactions (existing, link via marketplace_connection_id dimension)
    ├──< journal_entries (existing, link via marketplace_connection_id dimension)
    ├──< accounts (existing, direferensi via kasflow_account_id di mapping)
    └──< account_categories (existing, direferensi via kasflow_category_id di mapping)
```

### RLS & Keamanan:
- Semua tabel pakai **Row Level Security** — user hanya bisa akses data company-nya sendiri
- Policy menggunakan `auth_user_company_id()` (sama dengan tabel existing)
- `access_token` dan `refresh_token` di tabel `marketplace_connections` sebaiknya di-encrypt
  (bisa pakai `pgcrypto` extension atau Supabase Vault di kemudian hari)
- Sync logs: read-only untuk user (hanya bisa INSERT dari backend)

### Multi-Store Reporting (Dimension-based):
- Setiap toko = 1 `marketplace_connection` dengan `display_name` custom
- Transaksi & jurnal KasFlow punya kolom `marketplace_connection_id` sebagai dimension tag
- **Layer 1 (Akuntansi)**: Laporan P&L/Neraca/ArusKas existing — filter opsional per toko via dimension
- **Layer 2 (Analytics)**: Dashboard per toko dari tabel marketplace cache (ringkasan, order, statement)
- CoA tetap clean — tidak perlu akun terpisah per toko

---

## 7. Arsitektur Teknis

### 7.1 Backend (API Routes Next.js)

```
app/api/
├── integrations/
│   └── tiktok/
│       ├── auth/
│       │   ├── route.ts          → OAuth redirect & callback handler
│       ├── shops/
│       │   ├── route.ts          → Get authorized shops
│       ├── sync/
│       │   ├── route.ts          → Trigger manual sync
│       ├── orders/
│       │   ├── route.ts          → Get cached orders
│       ├── statements/
│       │   ├── route.ts          → Get cached statements
│       └── unsettled/
│           ├── route.ts          → Get unsettled transactions
```

### 7.2 Library Helpers

```
lib/
├── marketplace/
│   ├── tiktok/
│   │   ├── client.ts            → API wrapper (signature, request, pagination)
│   │   ├── auth.ts              → OAuth flow helpers
│   │   ├── sync-statements.ts   → Statement sync (SUMBER UTAMA transaksi)
│   │   ├── sync-orders.ts       → Order cache sync (analytics only)
│   │   ├── sync-unsettled.ts    → Unsettled tracking
│   │   └── create-transactions.ts → Buat 3 txn KasFlow per statement
│   ├── types.ts                 → Shared marketplace types
│   └── sync-engine.ts           → Generic sync engine (retry, pagination, logging)
```

### 7.3 Token Management

- Access token & refresh token disimpan **encrypted** di `marketplace_connections`
- **Auto-refresh** via Supabase Edge Function atau cron job setiap 6 hari
- Handler middleware: cek token validity sebelum setiap API call
- Fallback: minta user re-authorize jika refresh token expired

### 7.4 Sinkronisasi

**Strategi MVP**: Manual-first, Scheduled di Phase 2

- **Phase 1 (MVP)**: User klik tombol "Sinkron Sekarang" di halaman Setup Koneksi
- **Phase 2**: Tambah scheduled sync via Supabase Edge Function (cron setiap 1-6 jam)
- **Phase 4**: Tambah webhook untuk real-time order notifications

Detail flow sinkronisasi sudah dijelaskan di **Section 4.2** di atas.

---

## 8. Mapping Akun Default

Saat setup koneksi, user harus mapping akun-akun berikut:

| Tipe Mapping | Deskripsi | Default Suggestion |
|-------------|-----------|-------------------|
| `receivable` | Piutang marketplace (belum cair) | Aset → Piutang Usaha |
| `revenue` | Pendapatan penjualan | Pendapatan → Penjualan Online |
| `platform_fee` | Biaya komisi platform | Beban → Biaya Platform |
| `shipping_fee` | Ongkos kirim | Beban → Ongkos Kirim |
| `adjustment` | Penyesuaian (refund, penalty, dll) | Beban → Beban Lain-lain |
| `settlement_bank` | Akun bank penerima payout | Aset → Bank BCA / Mandiri |

User bisa mengubah mapping kapan saja di halaman Setup Koneksi.

---

## 9. Fitur Pengembangan Lanjutan (Future)

### Phase 1 (MVP — Prioritas Utama)
- [ ] Koneksi TikTok Shop via OAuth (termasuk display_name custom)
- [ ] Statement-based sync: fetch statements harian → buat 3 transaksi KasFlow per statement
- [ ] Order cache sync (Get Order List + Detail → analytics only)
- [ ] Account mapping setup (revenue, fee, receivable, settlement bank)
- [ ] Hub Marketplace (overview koneksi + tombol sinkron)
- [ ] Halaman statement harian + daftar order (tab view)
- [ ] Manual sync dengan idempotency (anti-duplikasi)
- [ ] Dimension tag: marketplace_connection_id di transactions & journal_entries

### Phase 2 (Enhanced)
- [ ] Unsettled transactions tracking (estimasi pendapatan)
- [ ] SKU-level detail di order cache (untuk analisis produk)
- [ ] Scheduled sync (cron job via Supabase Edge Function)
- [ ] Sync log viewer & error handling UI
- [ ] Export laporan settlement (CSV/PDF)
- [ ] Filter per toko di laporan P&L existing (via dimension)

### Phase 3 (Multi-Store & Multi-Marketplace)
- [ ] Dashboard ringkasan per toko (card + chart perbandingan)
- [ ] Shopee integration (Open Platform API)
- [ ] Tokopedia integration (API)
- [ ] Dashboard agregasi multi-marketplace
- [ ] Cross-marketplace analytics

### Phase 4 (Advanced)
- [ ] TikTok Webhook integration (real-time sync)
- [ ] Auto-matching pembayaran bank dgn settlement marketplace
- [ ] Profit analysis per SKU / produk (HPP vs revenue marketplace)
- [ ] Alert & notifikasi: order cancel, settlement gagal, token expired
- [ ] Laporan PPh khusus marketplace (PPh 23 atas fee platform)

---

## 10. Pertimbangan Penting

### 10.1 Keamanan
- Token disimpan encrypted (AES-256 atau Supabase vault)
- Jangan expose `app_secret` di client-side
- Semua API call dilakukan di server-side (API Routes)
- CSRF protection via `state` parameter di OAuth flow

### 10.2 Rate Limiting
- TikTok API tidak dokumentasikan rate limit secara resmi
- Gunakan pagination (max 100/page) untuk mengurangi jumlah request
- Implementasi exponential backoff untuk retry
- Batch sync: jangan fetch semua sekaligus, bagi per batch

### 10.3 Data Accuracy
- Data unsettled dari API adalah **ESTIMASI** — tampilkan dengan warning
- Hanya data settled (dari Statement API) yang dijadikan jurnal final
- Selalu tampilkan timestamp sync terakhir agar user tahu data terkini

### 10.4 Keterbatasan
- Get Payments API **tidak tersedia untuk market SEA** (termasuk Indonesia)
- Data finance hanya tersedia setelah **2023-07-01**
- Buyer info tidak tersedia untuk order `ON_HOLD`
- Recipient address disamarkan untuk fulfillment by TikTok

### 10.5 UX Considerations
- Loading state yang jelas saat sync berjalan
- Progress bar untuk initial backfill (bisa ribuan order)
- Empty state yang menarik saat belum ada koneksi
- Error state dengan instruksi yang jelas (re-auth, retry, dll)
- Mobile-first design (bottom sheet untuk detail order)

---

## 11. Timeline Estimasi

| Phase | Estimasi | Deskripsi |
|-------|----------|-----------|
| Phase 1 (MVP) | 2-3 minggu | Core: OAuth, sync orders & statements, basic UI |
| Phase 2 | 1-2 minggu | Unsettled, scheduled sync, rekonsiliasi |
| Phase 3 | 3-4 minggu | Multi-marketplace (Shopee + Tokopedia) |
| Phase 4 | 2-3 minggu | Webhook, analytics, advanced features |

---

## 12. Keputusan yang Sudah Disepakati

| # | Keputusan | Alasan |
|---|-----------|--------|
| 1 | **Statement-based sync** (bukan per-order) | Ledger tetap clean, 1 statement = max 3 txn. Order detail di cache saja untuk analytics |
| 2 | **Dimension/tag approach** (bukan akun per toko) | CoA tetap clean, scalable, filter reporting via marketplace_connection_id |
| 3 | **Dual-layer reporting** | Layer Akuntansi (existing, consolidated) + Layer Analytics (per toko, dari cache) |
| 4 | **Manual sync dulu (MVP)** | Simpel, user kontrol penuh. Scheduled sync di Phase 2 |
| 5 | **display_name + shop_name** | shop_name dari API (read-only), display_name custom user (optional, fallback) |
| 6 | **Idempotency via statement** | kasflow_income_txn_id IS NULL = belum dijurnal. Re-sync aman dari duplikasi |
| 7 | **Multi-shop support dari awal** | Schema sudah support multiple connections per company |
| 8 | **Skip Get Payments untuk SEA** | API tidak tersedia untuk market SEA (termasuk Indonesia) |

## 13. Open Questions (Masih Perlu Riset)

1. **Biaya API**: Apakah ada cost associated dengan TikTok Shop API calls?
2. **Supabase Edge Function vs Vercel Cron**: Untuk scheduled sync di Phase 2?
3. **Webhook endpoint**: Perlu public endpoint untuk Phase 4 — pakai apa?
4. **Token encryption**: pgcrypto atau Supabase Vault untuk encrypt access_token?

---

> **Dokumen ini sudah difinalisasi dan siap untuk implementasi Phase 1 (MVP).**
> Schema SQL siap deploy: `supabase-marketplace-schema.sql` di root project.
