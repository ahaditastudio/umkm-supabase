# TikTok Shop — Finance API Documentation

> **Sumber**: [TikTok Shop Partner Center — Finance API Overview](https://partner.tiktokshop.com/docv2/page/finance-api-overview)
>
> **Tujuan**: Panduan lengkap untuk programmer dalam mengintegrasikan aplikasi dengan TikTok Shop Finance API.

---

## Daftar Isi

1. [Ringkasan](#ringkasan)
2. [Konsep Penting](#konsep-penting)
3. [Autentikasi & Common Parameters](#autentikasi--common-parameters)
4. [Endpoint: Get Statements](#1-get-statements)
5. [Endpoint: Get Payments](#2-get-payments)
6. [Endpoint: Get Transactions by Statement](#3-get-transactions-by-statement)
7. [Endpoint: Get Transactions by Order](#4-get-transactions-by-order)
8. [Endpoint: Get Unsettled Transactions](#5-get-unsettled-transactions)
9. [Alur Penggunaan API](#alur-penggunaan-api)
10. [Jenis Adjustment](#jenis-adjustment)
11. [Error Codes](#error-codes)
12. [FAQ](#faq)

---

## Ringkasan

TikTok Shop Finance API menyediakan 5 endpoint (semua **GET**) untuk mengakses data keuangan seller:

| # | Endpoint | Path | Versi | Fungsi |
|---|----------|------|-------|--------|
| 1 | Get Statements | `/finance/202309/statements` | 202309 | Daftar statement harian |
| 2 | Get Payments | `/finance/202605/payments` | 202605 | Daftar pembayaran (payout) |
| 3 | Get Transactions by Statement | `/finance/202501/statements/{id}/statement_transactions` | 202501 | Transaksi per statement |
| 4 | Get Transactions by Order | `/finance/202501/orders/{id}/statement_transactions` | 202501 | Transaksi detail per order (SKU-level) |
| 5 | Get Unsettled Transactions | `/finance/202507/orders/unsettled` | 202507 | Transaksi belum settle |

**Required Scope**: `seller.finance.info`
**Base URL**: `https://open-api.tiktokglobalshop.com`
**Data tersedia**: Hanya data setelah **2023-07-01**

---

## Konsep Penting

### Statements (Laporan Harian)

- Setiap seller mendapat **1 statement per hari**
- Statement di-generate setiap hari pukul **00:00 UTC**
- Statement ditutup (closed) pukul **00:00 UTC hari berikutnya**
- Setelah ditutup → otomatis diterbitkan dan **initiate pembayaran**
- **1 statement = 1 pembayaran** (kecuali jumlah terlalu kecil, bisa digabung jadi 1 payment)

### Payments (Pembayaran / Payout)

- Record yang menggambarkan **transfer dana** dari TikTok ke seller
- Digunakan sebagai dasar **rekonsiliasi** dengan rekening bank seller
- ⚠️ **Get Payments API saat ini tidak tersedia untuk market SEA**

### Transactions

- **Order transaction**: Transaksi standar dari penjualan
- **Adjustment transaction**: Penyesuaian (koreksi ongkir, penalty, kompensasi, dll)
- **Reserve-related transaction**: Transaksi terkait dana cadangan

---

## Autentikasi & Common Parameters

Semua request **wajib** menyertakan parameter berikut:

### Headers (Wajib)

| Header | Tipe | Deskripsi |
|--------|------|-----------|
| `content-type` | string | Harus `application/json` |
| `x-tts-access-token` | string | Seller access token dari API **Get Access Token** (`user_type = 0`) |

### Query Parameters (Wajib di Setiap Request)

| Parameter | Tipe | Deskripsi |
|-----------|------|-----------|
| `app_key` | string | Key unik app kamu. Didapat saat registrasi app di Partner Center |
| `shop_cipher` | string | Identifier shop. Didapat dari API **Get Authorization Shop** |
| `sign` | string | Signature yang di-generate dengan **algoritma sign TTS** |
| `timestamp` | int | Unix timestamp GMT (UTC+00:00) |

### Query Parameters (Opsional — Pagination)

| Parameter | Tipe | Default | Deskripsi |
|-----------|------|---------|-----------|
| `page_size` | int | 20 | Jumlah hasil per halaman. Range: **1–100** |
| `page_token` | string | — | Token untuk halaman selanjutnya. Didapat dari response `next_page_token`. Tidak perlu untuk halaman pertama |
| `sort_field` | string | — | Field untuk sorting |
| `sort_order` | string | `ASC` | Urutan sort: `ASC` atau `DESC` |

### Cara Mendapatkan Kredensial

```
1. app_key      → Daftar app di TikTok Shop Partner Center
2. shop_cipher  → Panggil API "Get Authorization Shop"
3. access_token → Panggil API "Get Access Token" (user_type = 0)
4. sign         → Generate dengan algoritma signature TTS (lihat docs "Authentication")
```

---

## 1. Get Statements

> Mengambil daftar statement harian yang di-generate untuk sebuah shop.

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/finance/202309/statements` |
| **Version** | `202309` |
| **Scope** | `seller.finance.info` |
| **Market** | Semua region |
| **Data tersedia** | Setelah 2023-07-01 |

### Deskripsi

Mengambil statement berdasarkan **range tanggal** atau **status pembayaran**. Gunakan API ini untuk melihat overview statement harian dan mengetahui mana yang sudah dibayar atau belum.

### Request — Query Parameters

| Parameter | Tipe | Wajib | Deskripsi |
|-----------|------|-------|-----------|
| `statement_time_ge` | int | Tidak | Filter statement yang di-generate **pada atau setelah** waktu ini (Unix timestamp). |
| `statement_time_lt` | int | Tidak | Filter statement yang di-generate **sebelum** waktu ini (Unix timestamp). |
| `payment_status` | string | Tidak | Filter berdasarkan status pembayaran: `PAID`, `FAILED`, `PROCESSING`. Default: semua status. |
| `sort_field` | string | **Ya** | Field sorting. Hanya support: `statement_time` |
| `sort_order` | string | Tidak | `ASC` (default) atau `DESC` |
| `page_size` | int | Tidak | Jumlah per halaman. Default: 20, range: 1–100 |
| `page_token` | string | Tidak | Token halaman berikutnya (dari response sebelumnya) |

### Catatan Penting: Filter Tanggal

Statement di-generate harian pukul **00:00 UTC**. Untuk ambil statement **5 Oktober – 10 Oktober**:

```
statement_time_ge → set ke 00:00 UTC tanggal 6 Oktober ATAU kapan saja tanggal 5 Oktober (kecuali 00:00)
statement_time_lt → set ke kapan saja tanggal 11 Oktober (kecuali 00:00)
```

### Contoh Request (cURL)

```bash
curl -X GET \
  'https://open-api.tiktokglobalshop.com/finance/202309/statements?\
sign=YOUR_SIGN&\
app_key=YOUR_APP_KEY&\
statement_time_ge=1623812664&\
statement_time_lt=1623912664&\
payment_status=PAID&\
sort_field=statement_time&\
sort_order=ASC&\
page_size=20&\
timestamp=1623812664&\
shop_cipher=YOUR_SHOP_CIPHER' \
  -H 'x-tts-access-token: YOUR_ACCESS_TOKEN' \
  -H 'content-type: application/json'
```

### Response

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `code` | int | Status code (0 = success) |
| `message` | string | Pesan status |
| `request_id` | string | ID log request |
| `data` | object | Data response |

#### `data` object:

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `next_page_token` | string | Token untuk halaman berikutnya |
| `statements` | array | Array of statement objects |

#### `statements[]` object:

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | string | Statement ID (unik) |
| `statement_time` | int | Waktu statement di-generate (Unix timestamp) |
| `settlement_amount` | string | Jumlah settlement |
| `currency` | string | Mata uang (e.g. "GBP", "USD") |
| `revenue_amount` | string | Total pendapatan |
| `fee_amount` | string | Total biaya (negatif = potongan) |
| `adjustment_amount` | string | Total penyesuaian |
| `payment_status` | string | Status: `PAID` / `FAILED` / `PROCESSING` |
| `payment_id` | string | ID pembayaran terkait |
| `net_sales_amount` | string | Jumlah penjualan bersih |
| `shipping_cost_amount` | string | Biaya pengiriman |
| `payment_time` | int | Waktu pembayaran (Unix timestamp) |

### Contoh Response

```json
{
  "code": 0,
  "data": {
    "next_page_token": "6AsPQsUMvH3RkchNUPPh22NROHkE0D8pmq/N5M1kHYcZmtRyv9aVrNv65W7Q6tFA...",
    "statements": [
      {
        "id": "7238804564097517339",
        "statement_time": 1685548800,
        "settlement_amount": "100",
        "currency": "GBP",
        "revenue_amount": "200",
        "fee_amount": "-30",
        "adjustment_amount": "-70",
        "payment_status": "PAID",
        "payment_id": "3459275187040258849",
        "net_sales_amount": "-70",
        "shipping_cost_amount": "-70",
        "payment_time": 1685548800
      }
    ]
  },
  "message": "Success",
  "request_id": "202203070749000101890810281E8C70B7"
}
```

---

## 2. Get Payments

> Mengambil daftar pembayaran otomatis untuk sebuah shop berdasarkan range tanggal.

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/finance/202605/payments` |
| **Version** | `202605` |
| **Scope** | `seller.finance.info` |
| **Market** | ⚠️ **Tidak tersedia untuk market SEA** |

### Deskripsi

Mengambil data pembayaran (payout) berdasarkan range tanggal, termasuk status pembayaran saat ini. Gunakan untuk **rekonsiliasi** pembayaran dengan rekening bank seller.

### Request — Query Parameters

| Parameter | Tipe | Wajib | Deskripsi |
|-----------|------|-------|-----------|
| `create_time_ge` | int | Tidak | Filter payment **pada atau setelah** waktu ini |
| `create_time_lt` | int | Tidak | Filter payment **sebelum** waktu ini |
| `sort_field` | string | **Ya** | Hanya support: `create_time` |
| `sort_order` | string | Tidak | `ASC` (default) atau `DESC` |
| `page_size` | int | Tidak | Default: 20, range: 1–100 |
| `page_token` | string | Tidak | Token halaman berikutnya |

### Contoh Request (cURL)

```bash
curl -X GET \
  'https://open-api.tiktokglobalshop.com/finance/202605/payments?\
sign=YOUR_SIGN&\
app_key=YOUR_APP_KEY&\
create_time_ge=1687266376&\
create_time_lt=1687366376&\
sort_field=create_time&\
sort_order=ASC&\
page_size=20&\
timestamp=1623812664&\
shop_cipher=YOUR_SHOP_CIPHER' \
  -H 'x-tts-access-token: YOUR_ACCESS_TOKEN' \
  -H 'content-type: application/json'
```

### Response

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `code` | int | Status code |
| `message` | string | Pesan status |
| `request_id` | string | ID log |
| `data` | object | Data response |

#### `data` object:

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `next_page_token` | string | Token halaman berikutnya |
| `payments` | array | Array of payment objects |

#### `payments[]` object:

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | string | Payment ID (unik) |
| `create_time` | int | Waktu payment dibuat |
| `status` | string | Status: `PAID` / `FAILED` / `PROCESSING` |
| `amount` | object | `{ "value": "100", "currency": "GBP" }` — Jumlah aktual dibayar |
| `settlement_amount` | object | `{ "value": "130", "currency": "GBP" }` — Jumlah settlement |
| `payment_amount_before_exchange` | object | Jumlah sebelum kurs |
| `exchange_rate` | string | Nilai tukar (e.g. "1.000000") |
| `paid_time` | int | Waktu pembayaran berhasil |

### Contoh Response

```json
{
  "code": 0,
  "data": {
    "next_page_token": "6AsPQsUMvH3RkchNUPPh22NROHkE0D8pmq/N5M1kHYcZmtRyv9aVrNv65W7Q6tFA...",
    "payments": [
      {
        "create_time": 1636105796,
        "id": "3458767051733897992",
        "status": "PAID",
        "amount": {
          "value": "100",
          "currency": "GBP"
        },
        "settlement_amount": {
          "value": "130",
          "currency": "GBP"
        },
        "payment_amount_before_exchange": {
          "value": "100",
          "currency": "GBP"
        },
        "exchange_rate": "1.000000",
        "paid_time": 1685548800
      }
    ]
  },
  "message": "Success",
  "request_id": "..."
}
```

---

## 3. Get Transactions by Statement

> Mengambil detail transaksi dalam satu statement, termasuk order transaction, adjustment, dan reserve.

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/finance/202501/statements/{statement_id}/statement_transactions` |
| **Version** | `202501` |
| **Scope** | `seller.finance.info` |
| **Market** | Semua region |
| **Data tersedia** | Setelah 2023-07-01 (US cross-border: setelah 2025-04-30) |

### Deskripsi

Mengambil detail sebuah statement termasuk daftar transaksinya. Transaksi bisa berupa: order, adjustment, atau reserve. Untuk detail **level SKU**, gunakan `order_id` dari response ini ke **Get Transactions by Order**.

### Request — Path Parameters

| Parameter | Tipe | Wajib | Deskripsi |
|-----------|------|-------|-----------|
| `statement_id` | string | **Ya** | Statement ID (didapat dari Get Statements) |

### Request — Query Parameters

| Parameter | Tipe | Wajib | Deskripsi |
|-----------|------|-------|-----------|
| `sort_field` | string | **Ya** | Hanya support: `order_create_time` |
| `sort_order` | string | Tidak | `ASC` (default) atau `DESC` |
| `page_size` | int | Tidak | Default: 20, range: 1–100 |
| `page_token` | string | Tidak | Token halaman berikutnya |

### Contoh Request (cURL)

```bash
curl -X GET \
  'https://open-api.tiktokglobalshop.com/finance/202501/statements/7238804564097517339/statement_transactions?\
sign=YOUR_SIGN&\
app_key=YOUR_APP_KEY&\
sort_field=order_create_time&\
sort_order=DESC&\
page_size=20&\
timestamp=1623812664&\
shop_cipher=YOUR_SHOP_CIPHER' \
  -H 'x-tts-access-token: YOUR_ACCESS_TOKEN' \
  -H 'content-type: application/json'
```

### Response

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `code` | int | Status code |
| `message` | string | Pesan status |
| `request_id` | string | ID log |
| `data` | object | Data response |

#### `data` object:

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | string | Statement ID |
| `create_time` | int | Waktu statement dibuat |
| `status` | string | Status statement (e.g. `SETTLED`) |
| `currency` | string | Mata uang |
| `payable_amount` | string | Jumlah yang harus dibayar |
| `total_reserve_amount` | string | Total dana cadangan |
| `total_settlement_amount` | string | Total settlement |
| `total_settlement_breakdown` | object | Breakdown settlement |
| `total_count` | int | Jumlah transaksi |
| `next_page_token` | string | Token halaman berikutnya |
| `transactions` | array | Array of transaction objects |

#### `total_settlement_breakdown` object:

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `total_revenue_amount` | string | Total pendapatan |
| `total_shipping_cost_amount` | string | Total ongkir |
| `total_fee_tax_amount` | string | Total pajak & biaya |
| `total_adjustment_amount` | string | Total penyesuaian |

#### `transactions[]` object:

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | string | Transaction ID |
| `type` | string | Tipe: `ORDER`, `ADJUSTMENT`, dll |
| `order_id` | string | Order ID terkait |

### Contoh Response

```json
{
  "code": 0,
  "data": {
    "next_page_token": "6AsPQsUMvH3RkchNUPPh22NROHkE0D8pmq...",
    "id": "7238804564097517339",
    "create_time": 1685548800,
    "status": "SETTLED",
    "currency": "GBP",
    "payable_amount": "150",
    "total_reserve_amount": "20",
    "total_settlement_amount": "130",
    "total_settlement_breakdown": {
      "total_revenue_amount": "100",
      "total_shipping_cost_amount": "120",
      "total_fee_tax_amount": "20",
      "total_adjustment_amount": "0"
    },
    "total_count": 2,
    "transactions": [
      {
        "id": "1636700041413599290",
        "type": "ORDER",
        "order_id": "576463220456522968"
      }
    ]
  },
  "message": "Success",
  "request_id": "..."
}
```

---

## 4. Get Transactions by Order

> Mengambil detail transaksi **level SKU** untuk sebuah order tertentu.

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/finance/202501/orders/{order_id}/statement_transactions` |
| **Version** | `202501` |
| **Scope** | `seller.finance.info` |
| **Market** | Semua region |
| **Data tersedia** | Setelah 2023-07-01 (US cross-border: setelah 2025-04-30) |

### Deskripsi

Mengambil detail transaksi pada level SKU untuk sebuah order. Mencakup: penjualan, biaya, komisi, pengiriman, pajak, dan refund.

### Request — Path Parameters

| Parameter | Tipe | Wajib | Deskripsi |
|-----------|------|-------|-----------|
| `order_id` | string | **Ya** | Order ID dari TikTok Shop |

### Request — Query Parameters

Tidak ada parameter tambahan selain common parameters (`app_key`, `sign`, `timestamp`, `shop_cipher`).

### Contoh Request (cURL)

```bash
curl -X GET \
  'https://open-api.tiktokglobalshop.com/finance/202501/orders/5793990727963214852/statement_transactions?\
sign=YOUR_SIGN&\
app_key=YOUR_APP_KEY&\
timestamp=1623812664&\
shop_cipher=YOUR_SHOP_CIPHER' \
  -H 'x-tts-access-token: YOUR_ACCESS_TOKEN' \
  -H 'content-type: application/json'
```

### Response

#### `data` object:

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `order_id` | string | Order ID |
| `order_create_time` | int | Waktu order dibuat |
| `currency` | string | Mata uang |
| `revenue_amount` | string | Total pendapatan |
| `fee_and_tax_amount` | string | Total biaya & pajak |
| `shipping_cost_amount` | string | Biaya pengiriman |
| `settlement_amount` | string | Jumlah settlement |
| `sku_transactions` | array | Detail per SKU |

#### `sku_transactions[]` object:

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `sku_id` | string | SKU ID |
| `sku_name` | string | Nama SKU |
| `statement_id` | string | Statement ID terkait |
| `product_name` | string | Nama produk |
| `quantity` | string | Jumlah unit |
| `settlement_amount` | string | Settlement untuk SKU ini |
| `revenue_amount` | string | Pendapatan SKU ini |
| `revenue_breakdown` | object | Breakdown detail pendapatan |

#### `revenue_breakdown` object:

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `subtotal_before_discount_amount` | string | Subtotal sebelum diskon |
| `seller_discount_amount` | string | Diskon dari seller |
| `refund_subtotal_before_discount_amount` | string | Refund subtotal |

### Contoh Response

```json
{
  "code": 0,
  "data": {
    "order_id": "5793990727963214852",
    "order_create_time": 1685548800,
    "currency": "GBP",
    "revenue_amount": "200",
    "fee_and_tax_amount": "-30",
    "shipping_cost_amount": "-70",
    "settlement_amount": "130",
    "sku_transactions": [
      {
        "sku_id": "1636700041413599290",
        "sku_name": "Test SKU name",
        "statement_id": "7238804564097517339",
        "product_name": "Test Product name",
        "quantity": "1",
        "settlement_amount": "130",
        "revenue_amount": "200",
        "revenue_breakdown": {
          "subtotal_before_discount_amount": "210",
          "seller_discount_amount": "-10",
          "refund_subtotal_before_discount_amount": "0"
        }
      }
    ]
  },
  "message": "Success",
  "request_id": "..."
}
```

---

## 5. Get Unsettled Transactions

> Mengambil daftar transaksi yang **belum di-settle** beserta breakdown biaya.

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/finance/202507/orders/unsettled` |
| **Version** | `202507` |
| **Scope** | `seller.finance.info` |
| **Data tersedia** | Hanya transaksi setelah **2025-01-01** |

### Deskripsi

Mengambil transaksi unsettled (order & adjustment) beserta breakdown biaya detail. Setelah transaksi settle, data **tidak muncul lagi** di API ini — ambil dari Get Transactions by Statement.

> ⚠️ **PENTING**: Semua data dari API ini adalah **estimasi** yang bisa berubah sebelum settlement. Hanya untuk referensi seller. Jumlah final hanya bisa didapat dari Statement API.

### Request — Query Parameters

| Parameter | Tipe | Wajib | Deskripsi |
|-----------|------|-------|-----------|
| `search_time_ge` | int | Tidak | Filter transaksi **pada atau setelah** waktu ini |
| `search_time_lt` | int | Tidak | Filter transaksi **sebelum** waktu ini |
| `sort_field` | string | **Ya** | Hanya support: `order_create_time` |
| `sort_order` | string | Tidak | `ASC` (default) atau `DESC` |
| `page_size` | int | Tidak | Default: 20, range: 1–100 |
| `page_token` | string | Tidak | Token halaman berikutnya |

### Catatan

- Jika `search_time_ge` diisi tapi `search_time_lt` kosong → `search_time_lt` default ke waktu saat ini
- Jika `search_time_lt` diisi tapi `search_time_ge` kosong → `search_time_ge` default ke **2025-01-01**

### Contoh Request (cURL)

```bash
curl -X GET \
  'https://open-api.tiktokglobalshop.com/finance/202507/orders/unsettled?\
sign=YOUR_SIGN&\
app_key=YOUR_APP_KEY&\
search_time_ge=1623812664&\
search_time_lt=1623912664&\
sort_field=order_create_time&\
sort_order=ASC&\
page_size=20&\
timestamp=1623812664&\
shop_cipher=YOUR_SHOP_CIPHER' \
  -H 'x-tts-access-token: YOUR_ACCESS_TOKEN' \
  -H 'content-type: application/json'
```

### Response

#### `data` object:

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `next_page_token` | string | Token halaman berikutnya |
| `total_count` | int | Jumlah transaksi unsettled |
| `sum_est_settlement_amount` | string | Total estimasi settlement |
| `sum_est_revenue_amount` | string | Total estimasi pendapatan |
| `sum_est_adjustment_amount` | string | Total estimasi penyesuaian |
| `sum_est_fee_amount` | string | Total estimasi biaya |
| `transactions` | array | Array of unsettled transactions |

#### `transactions[]` object:

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | string | Transaction ID |
| `type` | string | Tipe: `ORDER` atau `ADJUSTMENT` |
| `status` | string | Selalu `UNSETTLED` |
| `currency` | string | Mata uang |
| `estimated_settlement` | string | Estimasi waktu settlement |
| `unsettled_reason` | string | Alasan belum settle (e.g. "waiting for delivery") |
| `order_create_time` | int | Waktu order dibuat |
| `order_delivery_time` | int | Waktu order dikirim |
| `order_id` | string | Order ID |
| `adjustment_id` | string | Adjustment ID (jika tipe ADJUSTMENT) |
| `adjustment_order_id` | string | Order ID terkait adjustment |
| `est_adjustment_amount` | string | Estimasi jumlah adjustment |

### Contoh Response

```json
{
  "code": 0,
  "data": {
    "next_page_token": "6AsPQsUMvH3RkchNUPPh22NROHkE0D8pmq...",
    "total_count": 2,
    "sum_est_settlement_amount": "100",
    "sum_est_revenue_amount": "10",
    "sum_est_adjustment_amount": "-10",
    "sum_est_fee_amount": "-10",
    "transactions": [
      {
        "type": "ORDER",
        "id": "1636700041413599290",
        "status": "UNSETTLED",
        "currency": "USD",
        "estimated_settlement": "1685548800",
        "unsettled_reason": "waiting for delivery",
        "order_create_time": 1685548800,
        "order_delivery_time": 1685548800,
        "order_id": "576463220456522968",
        "adjustment_id": "7238804564097517332",
        "adjustment_order_id": "576463220456522968",
        "est_adjustment_amount": "170"
      }
    ]
  },
  "message": "Success",
  "request_id": "..."
}
```

---

## Alur Penggunaan API

### Alur 1: Data Settlement Level Order

```
┌─────────────────────┐
│  Get Statements      │  ← Input: date range
│  /statements         │  ← Output: statement_id list
└────────┬────────────┘
         │ statement_id
         ▼
┌──────────────────────────────────────┐
│  Get Transactions by Statement       │  ← Input: statement_id
│  /statements/{id}/transactions       │  ← Output: order-level detail
└──────────────────────────────────────┘
```

### Alur 2: Data Settlement Level SKU

```
┌─────────────────────┐
│  Get Statements      │  ← Output: statement_id
└────────┬────────────┘
         │ statement_id
         ▼
┌──────────────────────────────────────┐
│  Get Transactions by Statement       │  ← Output: order_id list
└────────┬─────────────────────────────┘
         │ order_id
         ▼
┌──────────────────────────────────────┐
│  Get Transactions by Order           │  ← Output: SKU-level detail
│  /orders/{id}/statement_transactions │
└──────────────────────────────────────┘
```

### Alur 3: Data Transaksi Belum Settle

```
┌──────────────────────────────┐
│  Get Unsettled Transactions  │  ← Input: date range
│  /orders/unsettled           │  ← Output: unsettled orders + breakdown
└──────────────────────────────┘
```

---

## Jenis Adjustment

Berikut 16 tipe adjustment yang mungkin muncul dalam transaksi:

| # | Tipe | Deskripsi |
|---|------|-----------|
| 1 | **Shipping fee adjustment** | Koreksi saat ada perbedaan/kesalahan ongkir yang dibayar seller |
| 2 | **Shipping fee compensation** | Ganti rugi selisih ongkir aktual vs prepaid |
| 3 | **Chargeback** | Biaya yang dibebankan kembali setelah buyer berhasil dispute |
| 4 | **Customer service compensation** | Kompensasi ekstra dari CS setelah masa after-sales |
| 5 | **Promotion adjustment** | Koreksi selisih saat seller ikut promo platform |
| 6 | **Platform compensation** | Ganti rugi setelah seller berhasil banding dispute |
| 7 | **Platform penalty** | Denda karena pelanggaran kebijakan platform |
| 8 | **Sample shipping fee** | Biaya kirim sampel via logistik platform |
| 9 | **Logistics reimbursement** | Ganti rugi dari TikTok karena order hilang/rusak di logistik |
| 10 | **Platform reimbursement** | Subsidi/ganti rugi TikTok (refund tanpa return, subsidi ketidakpuasan buyer) |
| 11 | **Deductions incurred by seller** | Potongan ke seller karena: barang rusak, telat kirim, fraud, counterfeit, produk defective |
| 12 | **Shipping fee rebate** | Cashback ongkir dari kampanye platform |
| 13 | **Warehouse service fee** | Biaya layanan gudang (wrapping, barcode labeling, inspeksi produk baru) |
| 14 | **Platform commission adjustment** | Koreksi komisi platform |
| 15 | **Platform commission compensation** | Ganti rugi selisih komisi platform |
| 16 | **Other adjustment** | Penyesuaian karena alasan lain |

---

## Error Codes

### Common Error

| Code | Message | Penanganan |
|------|---------|------------|
| `36009003` | Internal error. Please try again. | Retry request. Jika persisten, hubungi support TikTok |

> Untuk error codes lainnya, lihat dokumentasi **Common Error Codes** di Partner Center.

### Tips Penanganan Error

```javascript
// Contoh implementasi retry
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      const data = await response.json();

      if (data.code === 0) return data;

      if (data.code === 36009003) {
        // Internal error — retry setelah delay
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        continue;
      }

      // Error lain — langsung throw
      throw new Error(`API Error ${data.code}: ${data.message}`);
    } catch (err) {
      if (i === maxRetries - 1) throw err;
    }
  }
}
```

---

## FAQ

### Kenapa order tidak muncul di API response?
Order yang **belum di-settle** tidak akan muncul di Get Statements / Get Transactions by Statement. Gunakan **Get Unsettled Transactions** untuk melihat order yang masih dalam proses.

### Kenapa order belum di-settle?
Aturan settlement berbeda per market. Lihat **TikTok Shop Academy** untuk aturan settlement market kamu.

### Kapan pakai Get Payments vs Get Statements?
- **Get Statements** → Untuk melihat breakdown transaksi harian
- **Get Payments** → Untuk rekonsiliasi dengan rekening bank

### Data Get Unsettled Transactions akurat?
**Tidak**. Data unsettled adalah **estimasi** yang bisa berubah sebelum settlement final. Untuk jumlah pasti, gunakan data dari Statement API setelah order di-settle.

---

## Catatan Implementasi

### Rate Limiting
- Belum didokumentasikan secara resmi
- Gunakan pagination (`page_size` max 100) untuk menghindari request berlebihan
- Implementasi exponential backoff untuk retry

### Checklist Sebelum Go-Live

- [ ] Daftar app di TikTok Shop Partner Center → dapatkan `app_key`
- [ ] Setup OAuth flow → dapatkan `access_token` dan `shop_cipher`
- [ ] Implementasi algoritma **signature generation** sesuai docs TTS
- [ ] Test semua endpoint di **Sandbox** dulu
- [ ] Implementasi pagination (loop `next_page_token` sampai kosong)
- [ ] Implementasi error handling & retry logic
- [ ] Simpan `next_page_token` untuk resume jika proses terputus
- [ ] Handle perbedaan timezone — semua timestamp dalam **UTC**
- [ ] Perhatikan bahwa **Get Payments tidak tersedia untuk market SEA**

### Contoh Implementasi Node.js (Skeleton)

```javascript
const crypto = require('crypto');

const APP_KEY = 'YOUR_APP_KEY';
const APP_SECRET = 'YOUR_APP_SECRET';
const BASE_URL = 'https://open-api.tiktokglobalshop.com';

// Generate signature (sesuaikan dengan algoritma resmi TTS)
function generateSignature(path, params, appSecret) {
  const sortedParams = Object.keys(params).sort().map(
    key => `${key}=${params[key]}`
  ).join('&');

  const signString = `${appSecret}${path}${sortedParams}${appSecret}`;
  return crypto.createHash('sha256').update(signString).digest('hex');
}

// Get Statements
async function getStatements(accessToken, shopCipher, startDate, endDate) {
  const params = {
    app_key: APP_KEY,
    shop_cipher: shopCipher,
    statement_time_ge: startDate,
    statement_time_lt: endDate,
    sort_field: 'statement_time',
    sort_order: 'ASC',
    page_size: 100,
    timestamp: Math.floor(Date.now() / 1000),
  };

  const path = '/finance/202309/statements';
  params.sign = generateSignature(path, params, APP_SECRET);

  const queryString = new URLSearchParams(params).toString();
  const url = `${BASE_URL}${path}?${queryString}`;

  const response = await fetch(url, {
    headers: {
      'content-type': 'application/json',
      'x-tts-access-token': accessToken,
    },
  });

  return response.json();
}

// Paginate all statements
async function getAllStatements(accessToken, shopCipher, startDate, endDate) {
  const allStatements = [];
  let pageToken = null;

  while (true) {
    const result = await getStatements(accessToken, shopCipher, startDate, endDate, pageToken);

    if (result.code !== 0) {
      throw new Error(`Error: ${result.message}`);
    }

    allStatements.push(...result.data.statements);

    if (!result.data.next_page_token) break;
    pageToken = result.data.next_page_token;
  }

  return allStatements;
}
```

---

> **Dokumen ini dibuat berdasarkan scraping halaman resmi TikTok Shop Partner Center pada 14 Juni 2026.**
> Selalu cek dokumentasi terbaru di: https://partner.tiktokshop.com/docv2/page/finance-api-overview
