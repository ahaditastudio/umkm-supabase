# TikTok Shop API — Dokumentasi Lengkap

> **Terakhir diperbarui**: 15 Juni 2026
>
> Dokumen ini merangkum hasil riset dan implementasi integrasi TikTok Shop Open API,
> termasuk algoritma signature yang benar, OAuth flow, dan seluruh endpoint Finance & Authorization.

---

## Daftar Isi

1. [Ringkasan Umum](#ringkasan-umum)
2. [Domain & Base URL](#domain--base-url)
3. [Algoritma Signature (PENTING)](#algoritma-signature-penting)
4. [OAuth Flow — Authorization](#oauth-flow--authorization)
5. [Token Exchange & Refresh](#token-exchange--refresh)
6. [Common Parameters](#common-parameters-semua-api-request)
7. [Authorization API — Get Authorized Shops](#authorization-api--get-authorized-shops)
8. [Finance API — Ringkasan](#finance-api--ringkasan)
9. [Finance API — Get Statements](#finance-api--get-statements)
10. [Finance API — Get Payments](#finance-api--get-payments)
11. [Finance API — Get Transactions by Statement](#finance-api--get-transactions-by-statement)
12. [Finance API — Get Transactions by Order](#finance-api--get-transactions-by-order)
13. [Finance API — Get Unsettled Transactions](#finance-api--get-unsettled-transactions)
14. [Error Codes](#error-codes)
15. [Best Practices & Gotchas](#best-practices--gotchas)
16. [Referensi Implementasi (Node.js)](#referensi-implementasi-nodejs)

---

## Ringkasan Umum

| Item | Detail |
|------|--------|
| **Platform** | TikTok Shop Open API |
| **Auth Type** | OAuth 2.0 (Authorization Code Grant) |
| **Signature** | HMAC-SHA256 dengan format khusus |
| **API Domain** | `https://open-api.tiktokglobalshop.com` |
| **Auth Domain** | `https://auth.tiktok-shops.com` |
| **OAuth Domain** | `https://auth.tiktok-shops.com` (Non-US) atau `https://services.us.tiktokshop.com` (US) |
| **Partner Center** | https://partner.tiktokshop.com |

---

## Domain & Base URL

### ⚠️ PENTING — Ada 3 domain berbeda:

| Fungsi | Domain | Contoh |
|--------|--------|--------|
| **OAuth Login** (Seller authorize) | `auth.tiktok-shops.com` | `https://auth.tiktok-shops.com/oauth/authorize?app_key=...` |
| **Token Exchange & Refresh** | `auth.tiktok-shops.com` | `https://auth.tiktok-shops.com/api/v2/token/get?...` |
| **API Calls** (shops, finance, order, dll) | `open-api.tiktokglobalshop.com` | `https://open-api.tiktokglobalshop.com/finance/202309/statements?...` |

> **Pelajaran**: Jangan gunakan `auth.tiktok.com` (domain TikTok umum, bukan TikTok Shop).
> Domain yang benar adalah `auth.tiktok-shops.com` (dengan "shops" bukan "shop").

---

## Algoritma Signature (PENTING)

Setiap request ke API (`open-api.tiktokglobalshop.com`) **WAJIB** menyertakan parameter `sign` yang di-generate dengan algoritma berikut.

### Formula

```
message = app_secret + path + key1value1key2value2... + body + app_secret
signature = HMAC-SHA256(message, key=app_secret)
```

### Langkah-langkah

1. **Ambil semua query parameters** (kecuali `sign` itu sendiri)
2. **Filter** parameter yang tidak boleh ikut: `app_secret`, `token`, `access_token`, `sign`
3. **Sort** parameter secara alfabet berdasarkan key
4. **Concat** sebagai `key1value1key2value2` (TANPA separator `=`, `&`, dll)
5. **Buat message**: `app_secret` + `path` + `concat_params` + `body` + `app_secret`
   - `path` = path API saja, contoh: `/authorization/202309/shops`
   - `body` = JSON string body request (kosong untuk GET)
6. **Hash** dengan HMAC-SHA256, key = `app_secret`
7. **Output**: hex string (lowercase)

### Contoh Implementasi (Node.js/TypeScript)

```typescript
import crypto from 'crypto';

function generateSign(
  path: string,
  params: Record<string, string | number>,
  appSecret: string,
  body: string = ''
): string {
  // Filter out 'sign' parameter itself
  const filteredParams = { ...params };
  delete filteredParams.sign;

  // Sort parameters alphabetically by key
  const sortedKeys = Object.keys(filteredParams).sort();

  // Concatenate key-value pairs WITHOUT separators: key1value1key2value2
  const paramString = sortedKeys
    .map(key => `${key}${filteredParams[key]}`)
    .join('');

  // Construct message: app_secret + path + params + body + app_secret
  const message = `${appSecret}${path}${paramString}${body}${appSecret}`;

  // Generate HMAC-SHA256 signature
  return crypto
    .createHmac('sha256', appSecret)
    .update(message)
    .digest('hex');
}
```

### Contoh Implementasi (JavaScript)

```javascript
const crypto = require('crypto');

function generateSign(path, params, appSecret, body = '') {
  const filteredParams = { ...params };
  delete filteredParams.sign;

  const sortedKeys = Object.keys(filteredParams).sort();

  const paramString = sortedKeys
    .map(key => `${key}${filteredParams[key]}`)
    .join('');

  const message = `${appSecret}${path}${paramString}${body}${appSecret}`;

  return crypto
    .createHmac('sha256', appSecret)
    .update(message)
    .digest('hex');
}
```

### ⚠️ Kesalahan Umum Signature

| ❌ Salah | ✅ Benar |
|----------|----------|
| SHA256 biasa (bukan HMAC) | HMAC-SHA256 |
| Params pakai `key=value&key=value` | Params pakai `key1value1key2value2` (tanpa separator) |
| `app_secret` tidak ikut di message | `app_secret` ada di depan DAN belakang message |
| Include `sign` saat generate | Exclude `sign` dari perhitungan |

### Error jika signature salah

```json
{
  "code": 106001,
  "message": "Invalid credentials. The 'sign' query parameter is invalid.",
  "request_id": "..."
}
```

---

## OAuth Flow — Authorization

### URL Authorization

```
# Non-US (Indonesia, UK, SEA, dll):
https://auth.tiktok-shops.com/oauth/authorize?app_key=YOUR_APP_KEY&state=RANDOM_STATE

# US:
https://services.us.tiktokshop.com/open/authorize?service_id=YOUR_SERVICE_ID
```

### Flow Lengkap

```
1. User klik "Login" di aplikasi kita
2. Redirect ke: auth.tiktok-shops.com/oauth/authorize?app_key=...&state=...
3. User login TikTok & authorize
4. TikTok redirect ke REDIRECT_URI dengan parameter:
   {redirect_uri}?code=AUTH_CODE&state=STATE&app_key=APP_KEY&locale=...&shop_region=...
5. Kita exchange auth_code → access_token (lihat section Token Exchange)
6. Simpan access_token & refresh_token
7. Gunakan access_token untuk API calls
```

### ⚠️ Penting

- `auth_code` expired dalam **30 menit** dan hanya bisa dipakai **sekali**
- `access_token` expired dalam **7 hari** — harus di-refresh sebelum expired
- `redirect_uri` di request **harus sama persis** dengan yang terdaftar di Partner Center
- Selalu gunakan parameter `state` (random UUID) untuk mencegah CSRF

---

## Token Exchange & Refresh

### Get Access Token (Exchange auth_code)

```
GET https://auth.tiktok-shops.com/api/v2/token/get
```

| Parameter | Tipe | Required | Deskripsi |
|-----------|------|----------|-----------|
| `app_key` | string | Ya | App key dari Partner Center |
| `app_secret` | string | Ya | App secret dari Partner Center |
| `auth_code` | string | Ya | Code dari callback OAuth |
| `grant_type` | string | Ya | Harus `authorized_code` |

> **Catatan**: Endpoint ini TIDAK memerlukan signature. Kirim sebagai GET dengan query params.

#### Contoh Request

```
GET https://auth.tiktok-shops.com/api/v2/token/get?app_key=6kansj1ig81eo&app_secret=xxx&auth_code=ROW_xxx&grant_type=authorized_code
```

#### Response (Success)

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "access_token": "TTP_Fw8rBwAAAAAkW03FYd09DG-9INtpw361hWthei8S3fHX8iPJ5AUv99fLSCYD9",
    "access_token_expire_in": 1660556783,
    "refresh_token": "TTP_NTUxZTNhYTQ2ZDk2YmRmZWNmYWY2YWY2YzkxNGYwNjQ3YjkzYTllYjA0YmNlMw",
    "refresh_token_expire_in": 1691487031,
    "open_id": "7010736057180325637",
    "seller_name": "Jjj test shop",
    "seller_base_region": "ID",
    "user_type": 0
  },
  "request_id": "2022080809462301024509910319695C45"
}
```

#### Response Fields

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `access_token` | string | Token untuk API calls (kirim di header `x-tts-access-token`) |
| `access_token_expire_in` | int | Unix timestamp kapan access_token expired |
| `refresh_token` | string | Token untuk refresh access_token |
| `refresh_token_expire_in` | int | Unix timestamp kapan refresh_token expired |
| `open_id` | string | ID unik user yang authorize |
| `seller_name` | string | Nama seller |
| `seller_base_region` | string | Region seller (e.g. "ID", "US", "GB") |
| `user_type` | int | 0 = Seller, 1 = Creator, 3 = Partner |

### Refresh Access Token

```
GET https://auth.tiktok-shops.com/api/v2/token/refresh
```

| Parameter | Tipe | Required | Deskripsi |
|-----------|------|----------|-----------|
| `app_key` | string | Ya | App key |
| `app_secret` | string | Ya | App secret |
| `refresh_token` | string | Ya | Refresh token dari token exchange sebelumnya |
| `grant_type` | string | Ya | Harus `refresh_token` |

#### Contoh Request

```
GET https://auth.tiktok-shops.com/api/v2/token/refresh?app_key=65t6a8e8bfejb&app_secret=f4c770e4b45aa62e&refresh_token=TTP_xxx&grant_type=refresh_token
```

#### Response

Format sama dengan Get Access Token — mengembalikan `access_token` dan `refresh_token` baru.

### ⚠️ Refresh Schedule

- Access token expired setiap **7 hari**
- Refresh token expired sama dengan durasi authorization awal
- **WAJIB** refresh sebelum access_token expired, kalau tidak semua API call akan gagal
- Disarankan: auto-refresh setiap **6 hari** (1 hari sebelum expired)

---

## Common Parameters (Semua API Request)

Semua request ke `open-api.tiktokglobalshop.com` **WAJIB** menyertakan parameter berikut:

### Headers

| Header | Tipe | Required | Deskripsi |
|--------|------|----------|-----------|
| `content-type` | string | Ya | `application/json` |
| `x-tts-access-token` | string | Ya | Access token dari token exchange |

### Query Parameters

| Parameter | Tipe | Required | Deskripsi |
|-----------|------|----------|-----------|
| `app_key` | string | Ya | App key dari Partner Center |
| `shop_cipher` | string | Ya* | Identifier shop dari Get Authorized Shops |
| `sign` | string | Ya | Signature (lihat algoritma di atas) |
| `timestamp` | int | Ya | Unix timestamp GMT (UTC+00:00) |

> *`shop_cipher` tidak required untuk API yang tidak terkait shop (seperti Get Authorized Shops itu sendiri).

### Pagination Parameters (Opsional)

| Parameter | Tipe | Default | Deskripsi |
|-----------|------|---------|-----------|
| `page_size` | int | 20 | Jumlah per halaman (1–100) |
| `page_token` | string | — | Token halaman berikutnya |
| `sort_field` | string | varies | Field untuk sorting |
| `sort_order` | string | `ASC` | `ASC` atau `DESC` |

---

## Authorization API — Get Authorized Shops

Mengambil daftar shop yang sudah di-authorize oleh seller.

```
GET /authorization/202309/shops
```

| Item | Detail |
|------|--------|
| **Base URL** | `https://open-api.tiktokglobalshop.com` |
| **Scope** | `seller.authorization.info` atau `test.scope.public` |
| **Target** | Seller (user_type = 0) |
| **shop_cipher** | Tidak required (endpoint ini untuk mendapatkannya) |

### Response `data.shops[]`

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | string | Shop ID |
| `name` | string | Nama shop |
| `region` | string | Kode region (ID, US, GB, dll) |
| `seller_type` | string | `CROSS_BORDER`, `LOCAL`, dll |
| `cipher` | string | **shop_cipher** — simpan ini untuk API lain |
| `code` | string | Shop code |

### Contoh Response

```json
{
  "code": 0,
  "data": {
    "shops": [
      {
        "id": "7000714532876273420",
        "name": "Toko Example",
        "region": "ID",
        "seller_type": "LOCAL",
        "cipher": "GCP_XF90igAAAABh00qsWgtvOiGFNqyubMt3",
        "code": "CNGBCBA4LLU8"
      }
    ]
  },
  "message": "Success",
  "request_id": "202203070749000101890810281E8C70B7"
}
```

---

## Finance API — Ringkasan

**Required Scope**: `seller.finance.info`
**Base URL**: `https://open-api.tiktokglobalshop.com`
**Data tersedia**: Hanya data setelah **2023-07-01**

| # | Endpoint | Path | Versi | Fungsi |
|---|----------|------|-------|--------|
| 1 | Get Statements | `/finance/202309/statements` | 202309 | Daftar statement harian |
| 2 | Get Payments | `/finance/202605/payments` | 202605 | Daftar pembayaran (payout) |
| 3 | Get Trans by Statement | `/finance/202501/statements/{id}/statement_transactions` | 202501 | Transaksi per statement |
| 4 | Get Trans by Order | `/finance/202501/orders/{id}/statement_transactions` | 202501 | Transaksi detail per order (SKU-level) |
| 5 | Get Unsettled Trans | `/finance/202507/orders/unsettled` | 202507 | Transaksi belum settle |

### Konsep Finance

- **Statement**: 1 laporan per hari, di-generate pukul 00:00 UTC
- **Payment**: Transfer dana dari TikTok ke seller (1 statement = 1 payment)
- **Settlement**: Proses penutupan statement dan initiate pembayaran
- **Unsettled**: Transaksi yang masih menunggu settlement (ESTIMASI, bukan final)

### Alur Penggunaan

```
Get Statements (date range)
    │
    ├─→ Get Transactions by Statement (statement_id)
    │       │
    │       └─→ Get Transactions by Order (order_id) — SKU-level detail
    │
    └─→ Get Payments (reconciliation dengan bank)

Get Unsettled Transactions (transaksi belum settle — ESTIMASI)
```

---

## Finance API — Get Statements

```
GET /finance/202309/statements
```

### Query Parameters

| Parameter | Tipe | Required | Deskripsi |
|-----------|------|----------|-----------|
| `statement_time_ge` | int | Tidak | Filter statement >= waktu ini (Unix timestamp) |
| `statement_time_lt` | int | Tidak | Filter statement < waktu ini (Unix timestamp) |
| `payment_status` | string | Tidak | `PAID`, `FAILED`, `PROCESSING` |
| `sort_field` | string | **Ya** | Harus `statement_time` |
| `sort_order` | string | Tidak | `ASC` (default) atau `DESC` |

### Response `data.statements[]`

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | string | Statement ID |
| `statement_time` | int | Waktu statement di-generate |
| `settlement_amount` | string | Jumlah settlement |
| `currency` | string | Mata uang |
| `revenue_amount` | string | Total pendapatan |
| `fee_amount` | string | Total biaya (negatif = potongan) |
| `adjustment_amount` | string | Total penyesuaian |
| `payment_status` | string | `PAID` / `FAILED` / `PROCESSING` |
| `payment_id` | string | ID pembayaran |
| `net_sales_amount` | string | Penjualan bersih |
| `shipping_cost_amount` | string | Biaya pengiriman |
| `payment_time` | int | Waktu pembayaran |

---

## Finance API — Get Payments

```
GET /finance/202605/payments
```

> ⚠️ **Tidak tersedia untuk market SEA**

### Query Parameters

| Parameter | Tipe | Required | Deskripsi |
|-----------|------|----------|-----------|
| `create_time_ge` | int | Tidak | Filter payment >= waktu ini |
| `create_time_lt` | int | Tidak | Filter payment < waktu ini |
| `sort_field` | string | **Ya** | Harus `create_time` |
| `sort_order` | string | Tidak | `ASC` (default) atau `DESC` |

### Response `data.payments[]`

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | string | Payment ID |
| `create_time` | int | Waktu payment dibuat |
| `status` | string | `PAID` / `FAILED` / `PROCESSING` |
| `amount` | object | `{ "value": "100", "currency": "GBP" }` |
| `settlement_amount` | object | `{ "value": "130", "currency": "GBP" }` |
| `exchange_rate` | string | Nilai tukar |
| `paid_time` | int | Waktu pembayaran berhasil |

---

## Finance API — Get Transactions by Statement

```
GET /finance/202501/statements/{statement_id}/statement_transactions
```

### Path Parameters

| Parameter | Tipe | Required | Deskripsi |
|-----------|------|----------|-----------|
| `statement_id` | string | **Ya** | Statement ID dari Get Statements |

### Query Parameters

| Parameter | Tipe | Required | Deskripsi |
|-----------|------|----------|-----------|
| `sort_field` | string | **Ya** | Harus `order_create_time` |
| `sort_order` | string | Tidak | `ASC` (default) atau `DESC` |

### Response `data`

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | string | Statement ID |
| `create_time` | int | Waktu statement dibuat |
| `status` | string | Status statement |
| `currency` | string | Mata uang |
| `payable_amount` | string | Jumlah yang harus dibayar |
| `total_reserve_amount` | string | Total dana cadangan |
| `total_settlement_amount` | string | Total settlement |
| `total_count` | int | Jumlah transaksi |
| `total_settlement_breakdown` | object | Breakdown detail |
| `transactions[]` | array | Daftar transaksi |

### `total_settlement_breakdown`

| Field | Deskripsi |
|-------|-----------|
| `total_revenue_amount` | Total pendapatan |
| `total_shipping_cost_amount` | Total ongkir |
| `total_fee_tax_amount` | Total pajak & biaya |
| `total_adjustment_amount` | Total penyesuaian |

### `transactions[]`

| Field | Deskripsi |
|-------|-----------|
| `id` | Transaction ID |
| `type` | `ORDER`, `ADJUSTMENT`, dll |
| `order_id` | Order ID terkait |

---

## Finance API — Get Transactions by Order

```
GET /finance/202501/orders/{order_id}/statement_transactions
```

Detail transaksi pada **level SKU**.

### Response `data`

| Field | Deskripsi |
|-------|-----------|
| `order_id` | Order ID |
| `order_create_time` | Waktu order dibuat |
| `currency` | Mata uang |
| `revenue_amount` | Total pendapatan |
| `fee_and_tax_amount` | Total biaya & pajak |
| `shipping_cost_amount` | Biaya pengiriman |
| `settlement_amount` | Jumlah settlement |
| `sku_transactions[]` | Detail per SKU |

### `sku_transactions[]`

| Field | Deskripsi |
|-------|-----------|
| `sku_id` | SKU ID |
| `sku_name` | Nama SKU |
| `statement_id` | Statement ID terkait |
| `product_name` | Nama produk |
| `quantity` | Jumlah unit |
| `settlement_amount` | Settlement untuk SKU |
| `revenue_amount` | Pendapatan SKU |
| `revenue_breakdown` | Detail breakdown pendapatan |

---

## Finance API — Get Unsettled Transactions

```
GET /finance/202507/orders/unsettled
```

> ⚠️ Data dari API ini adalah **ESTIMASI** — bisa berubah sebelum settlement final.
> Untuk jumlah pasti, gunakan Get Statements setelah order di-settle.

### Query Parameters

| Parameter | Tipe | Required | Deskripsi |
|-----------|------|----------|-----------|
| `search_time_ge` | int | Tidak | Filter transaksi >= waktu ini |
| `search_time_lt` | int | Tidak | Filter transaksi < waktu ini |
| `sort_field` | string | **Ya** | Harus `order_create_time` |
| `sort_order` | string | Tidak | `ASC` (default) atau `DESC` |

### Response `data`

| Field | Deskripsi |
|-------|-----------|
| `total_count` | Jumlah transaksi unsettled |
| `sum_est_settlement_amount` | Total estimasi settlement |
| `sum_est_revenue_amount` | Total estimasi pendapatan |
| `sum_est_adjustment_amount` | Total estimasi penyesuaian |
| `sum_est_fee_amount` | Total estimasi biaya |
| `transactions[]` | Daftar transaksi unsettled |

---

## Error Codes

| Code | Message | Penanganan |
|------|---------|------------|
| `0` | Success | OK |
| `106001` | Invalid sign parameter | Cek algoritma signature |
| `36009003` | Internal error | Retry dengan exponential backoff |
| `10002014` | Failed to get orders | Retry |
| `10002015` | Failed to get orders | Retry |
| `21008111` | Order doesn't belong to current seller | Cek shop_cipher dan order ID |

---

## Best Practices & Gotchas

### 1. Signature
- Selalu gunakan **HMAC-SHA256** (bukan plain SHA256)
- Concat params sebagai `key1value1key2value2` (TANPA `=`, `&`)
- Include `app_secret` di **depan dan belakang** message
- **Exclude** parameter `sign` dari perhitungan signature
- Timestamp harus dalam **GMT/UTC**

### 2. Token Management
- `auth_code` expired **30 menit**, pakai **sekali**
- `access_token` expired **7 hari** — auto-refresh setiap 6 hari
- Simpan `refresh_token` dengan aman
- Handle token expired di setiap API call (cek response code)

### 3. Pagination
- Loop `next_page_token` sampai kosong untuk ambil semua data
- `page_size` max **100**
- Simpan `next_page_token` untuk resume jika proses terputus

### 4. Rate Limiting
- Belum didokumentasikan secara resmi
- Gunakan pagination untuk mengurangi jumlah request
- Implementasi exponential backoff untuk retry

### 5. Market Restrictions
- **Get Payments** tidak tersedia untuk market SEA
- Beberapa data hanya tersedia setelah tanggal tertentu
- Cek scope yang di-authorize untuk setiap endpoint

### 6. Redirect URI
- Redirect URI di request **harus sama persis** dengan yang terdaftar di Partner Center
- Kalau beda, TikTok akan redirect ke URL yang terdaftar (bukan yang kita kirim)

### 7. Data Unsettled
- Data dari Get Unsettled Transactions adalah **ESTIMASI**
- Untuk jumlah final, selalu pakai Get Statements setelah order di-settle

---

## Referensi Implementasi (Node.js)

### Helper: Signature Generator

```typescript
import crypto from 'crypto';

function generateSign(path, params, appSecret, body = '') {
  const filteredParams = { ...params };
  delete filteredParams.sign;
  const sortedKeys = Object.keys(filteredParams).sort();
  const paramString = sortedKeys.map(key => `${key}${filteredParams[key]}`).join('');
  const message = `${appSecret}${path}${paramString}${body}${appSecret}`;
  return crypto.createHmac('sha256', appSecret).update(message).digest('hex');
}
```

### Helper: API Request Wrapper

```typescript
const BASE_URL = 'https://open-api.tiktokglobalshop.com';

async function tiktokApiGet(path, accessToken, shopCipher, appKey, appSecret, extraParams = {}) {
  const params = {
    app_key: appKey,
    shop_cipher: shopCipher,
    timestamp: Math.floor(Date.now() / 1000),
    ...extraParams,
  };

  params.sign = generateSign(path, params, appSecret);

  const queryString = new URLSearchParams(params).toString();
  const url = `${BASE_URL}${path}?${queryString}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'content-type': 'application/json',
      'x-tts-access-token': accessToken,
    },
  });

  return response.json();
}
```

### Helper: Paginate All Results

```typescript
async function fetchAllPages(path, accessToken, shopCipher, appKey, appSecret, extraParams = {}) {
  const allResults = [];
  let pageToken = null;

  while (true) {
    const params = { ...extraParams };
    if (pageToken) params.page_token = pageToken;
    params.page_size = 100;

    const result = await tiktokApiGet(path, accessToken, shopCipher, appKey, appSecret, params);

    if (result.code !== 0) {
      throw new Error(`API Error ${result.code}: ${result.message}`);
    }

    const items = result.data.statements || result.data.transactions || result.data.payments || [];
    allResults.push(...items);

    if (!result.data.next_page_token) break;
    pageToken = result.data.next_page_token;
  }

  return allResults;
}
```

---

## Sumber Referensi

- [TikTok Shop Partner Center](https://partner.tiktokshop.com)
- [Authorization Guide 202309](https://partner.tiktokshop.com/docv2/page/authorization-guide-202309)
- [Finance API Overview](https://partner.tiktokshop.com/docv2/page/finance-api-overview)
- [Order API Overview](https://partner.tiktokshop.com/docv2/page/order-api-overview)
- [npm: tiktok-shop](https://www.npmjs.com/package/tiktok-shop) — package referensi untuk signature

---

> **Dokumen ini dibuat berdasarkan hasil riset dan implementasi nyata pada 15 Juni 2026.**
> Selalu cek dokumentasi terbaru di TikTok Shop Partner Center karena API bisa berubah sewaktu-waktu.
