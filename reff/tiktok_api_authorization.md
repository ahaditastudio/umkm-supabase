# TikTok Shop Authorization API Documentation

> **Sumber**: [TikTok Shop Partner Center](https://partner.tiktokshop.com/docv2/page/authorization-overview)
>
> **Tujuan**: Panduan lengkap untuk programmer dalam mengintegrasikan aplikasi dengan TikTok Shop Authorization API.

---

## Daftar Isi

1. [Ringkasan](#ringkasan)
2. [Konsep Penting](#konsep-penting)
3. [Authorization Flow](#authorization-flow)
4. [Endpoint: Get Authorized Shops](#1-get-authorized-shops)
5. [Endpoint: Get Authorized Category Assets](#2-get-authorized-category-assets)
6. [Autentikasi & Common Parameters](#autentikasi--common-parameters)
7. [Error Codes](#error-codes)
8. [Catatan Implementasi](#catatan-implementasi)

---

## Ringkasan

TikTok Shop Authorization API menyediakan endpoint untuk mengelola authorization antara seller/partner dengan aplikasi Anda.

| # | Endpoint | Method | Path | Versi | Scope | Target |
|---|----------|--------|------|-------|-------|--------|
| 1 | Get Authorized Shops | `GET` | `/authorization/202309/shops` | 202309 | `seller.authorization.info` atau `test.scope.public` | Seller |
| 2 | Get Authorized Category Assets | `GET` | `/authorization/202405/category_assets` | 202405 | `partner.authorization.info` | Partner |

**Base URL**: `https://open-api.tiktokglobalshop.com`

---

## Konsep Penting

### Apa itu Authorization?

Authorization adalah proses dimana **seller** atau **partner** memberikan izin kepada aplikasi Anda untuk mengakses data mereka. Ini adalah langkah kritis sebelum aplikasi dapat:

- Mengakses data shop seller
- Mengelola order, produk, atau informasi sensitif lainnya
- Berinteraksi dengan TikTok Shop API atas nama seller/partner

### Tipe Authorization

TikTok Shop memiliki 2 tipe authorization berdasarkan target user:

**1. Seller Authorization**
- Seller memberikan izin kepada aplikasi untuk mengakses data shop mereka
- Digunakan untuk aplikasi yang melayani seller (e.g., order management, inventory sync)
- Memerlukan `seller access_token` (user_type = 0)
- Menghasilkan `shop_cipher` yang digunakan di API terkait shop

**2. Partner Authorization**
- Partner (TSP, CAP, TAP, MCN) memberikan izin kepada aplikasi untuk mengakses data mereka
- Digunakan untuk aplikasi yang melayani partner (e.g., creator management, analytics)
- Memerlukan `partner access_token` (user_type = 3)
- Menghasilkan `category_asset_cipher` yang digunakan di API terkait partner

### Apa itu Cipher?

**Cipher** adalah token enkripsi yang mengidentifikasi shop atau category asset yang telah di-authorize:

- **shop_cipher**: Identifier unik untuk shop yang sudah di-authorize
  - Didapat dari: Get Authorized Shops API
  - Digunakan di: Semua API yang memerlukan akses ke data shop (Order, Product, Finance, dll)
  
- **category_asset_cipher**: Identifier unik untuk business category asset yang sudah di-authorize
  - Didapat dari: Get Authorized Category Assets API
  - Digunakan di: API yang terkait dengan affiliate partner

---

## Authorization Flow

### Flow untuk Seller

```
┌─────────────────────────────────────────────────────────────────┐
│                    SELLER AUTHORIZATION FLOW                     │
└─────────────────────────────────────────────────────────────────┘

1. SELLER LOGIN
   └─► Seller login ke aplikasi Anda dengan TikTok account

2. REDIRECT TO TIKTOK
   └─► Aplikasi redirect seller ke TikTok authorization page
   └─► URL: https://auth.tiktok.com/oauth/authorize?app_key=YOUR_KEY&state=UNIQUE_STATE

3. SELLER APPROVAL
   └─► Seller melihat permission yang diminta
   └─► Seller klik "Authorize" untuk memberikan izin

4. CALLBACK WITH AUTH CODE
   └─► TikTok redirect kembali ke aplikasi Anda
   └─► URL: https://your-app.com/callback?code=AUTH_CODE&state=UNIQUE_STATE

5. EXCHANGE CODE FOR ACCESS TOKEN
   └─► Aplikasi call Get Access Token API
   └─► Parameter: auth_code + app_key + app_secret
   └─► Response: access_token + refresh_token

6. GET AUTHORIZED SHOPS
   └─► Call Get Authorized Shops API
   └─► Gunakan seller access_token (user_type = 0)
   └─► Response: list of shops + shop_cipher

7. USE SHOP_CIPHER IN API CALLS
   └─► Simpan shop_cipher untuk digunakan di API lain
   └─► Contoh: Get Order List, Get Product List, dll
```

### Flow untuk Partner

```
┌─────────────────────────────────────────────────────────────────┐
│                   PARTNER AUTHORIZATION FLOW                     │
└─────────────────────────────────────────────────────────────────┘

1. PARTNER LOGIN
   └─► Partner login ke aplikasi Anda dengan TikTok account

2. REDIRECT TO TIKTOK
   └─► Aplikasi redirect partner ke TikTok authorization page
   └─► URL: https://auth.tiktok.com/oauth/authorize?app_key=YOUR_KEY&state=UNIQUE_STATE

3. PARTNER APPROVAL
   └─► Partner melihat permission yang diminta
   └─► Partner klik "Authorize" untuk memberikan izin

4. CALLBACK WITH AUTH CODE
   └─► TikTok redirect kembali ke aplikasi Anda
   └─► URL: https://your-app.com/callback?code=AUTH_CODE&state=UNIQUE_STATE

5. EXCHANGE CODE FOR ACCESS TOKEN
   └─► Aplikasi call Get Access Token API
   └─► Parameter: auth_code + app_key + app_secret + user_type=3
   └─► Response: access_token + refresh_token

6. GET AUTHORIZED CATEGORY ASSETS
   └─► Call Get Authorized Category Assets API
   └─► Gunakan partner access_token (user_type = 3)
   └─► Response: list of category assets + category_asset_cipher

7. USE CATEGORY_ASSET_CIPHER IN API CALLS
   └─► Simpan category_asset_cipher untuk digunakan di API lain
   └─► Contoh: Affiliate Partner APIs
```

---

## 1. Get Authorized Shops

> Mengambil daftar shop yang sudah di-authorize oleh seller untuk aplikasi Anda.

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/authorization/202309/shops` |
| **Version** | `202309` |
| **Scope** | `seller.authorization.info` atau `test.scope.public` |
| **Target** | Seller |

### Deskripsi

Seller authorization diperlukan sebelum aplikasi dapat mengakses data shop. Gunakan API ini untuk:
- Mengecek shop mana yang sudah di-authorize untuk aplikasi Anda
- Mendapatkan `shop_cipher` yang digunakan sebagai parameter input di API terkait shop

### Request — Query Parameters

| Parameter | Tipe | Wajib | Deskripsi |
|-----------|------|-------|-----------|
| `app_key` | string | **Ya** | Key unik aplikasi Anda |
| `sign` | string | **Ya** | Signature yang di-generate dengan algoritma sign TTS |
| `timestamp` | int | **Ya** | Unix timestamp GMT (UTC+00:00) |

### Request — Headers

| Header | Tipe | Wajib | Deskripsi |
|--------|------|-------|-----------|
| `content-type` | string | **Ya** | Harus `application/json` |
| `x-tts-access-token` | string | **Ya** | Seller access token dari **Get Access Token** (user_type = 0) |

### Contoh Request (cURL)

```bash
curl -X GET \
  'https://open-api.tiktokglobalshop.com/authorization/202309/shops?\
app_key=YOUR_APP_KEY&\
sign=YOUR_SIGN&\
timestamp=1623812664' \
  -H 'x-tts-access-token: SELLER_ACCESS_TOKEN' \
  -H 'content-type: application/json'
```

### Response

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `code` | int | Status code (0 = success) |
| `message` | string | Pesan status |
| `request_id` | string | ID log |
| `data` | object | Data response |

#### `data` object:

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `shops` | array | Array of authorized shop objects |

#### `shops[]` object:

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | string | Shop ID unik |
| `name` | string | Nama shop |
| `region` | string | Kode region (e.g., "GB", "US", "ID") |
| `seller_type` | string | Tipe seller: `CROSS_BORDER`, `LOCAL`, dll |
| `cipher` | string | **shop_cipher** — gunakan ini di API lain |
| `code` | string | Shop code |

### Contoh Response

```json
{
  "code": 0,
  "data": {
    "shops": [
      {
        "id": "7000714532876273420",
        "name": "Maomao beauty shop",
        "region": "GB",
        "seller_type": "CROSS_BORDER",
        "cipher": "GCP_XF90igAAAABh00qsWgtvOiGFNqyubMt3",
        "code": "CNGBCBA4LLU8"
      }
    ]
  },
  "message": "Success",
  "request_id": "202203070749000101890810281E8C70B7"
}
```

### Penggunaan shop_cipher

Setelah mendapat `shop_cipher`, simpan dan gunakan di semua API yang memerlukan akses shop:

```bash
# Contoh: Get Order List
curl -X POST \
  'https://open-api.tiktokglobalshop.com/order/202309/orders/search?\
shop_cipher=GCP_XF90igAAAABh00qsWgtvOiGFNqyubMt3&\
app_key=YOUR_APP_KEY&\
...'
```

---

## 2. Get Authorized Category Assets

> Mengambil daftar business category assets yang sudah di-authorize oleh partner untuk aplikasi Anda.

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/authorization/202405/category_assets` |
| **Version** | `202405` |
| **Scope** | `partner.authorization.info` |
| **Target** | Partner (semua tipe) |

### Deskripsi

Partner authorization diperlukan sebelum aplikasi dapat mengakses data partner, dan akses ini diberikan berdasarkan **business categories**. Gunakan API ini untuk:
- Mengecek business category assets mana yang sudah di-authorize untuk aplikasi Anda
- Mendapatkan `category_asset_cipher` yang digunakan sebagai parameter input di API terkait affiliate partner

### Request — Query Parameters

| Parameter | Tipe | Wajib | Deskripsi |
|-----------|------|-------|-----------|
| `app_key` | string | **Ya** | Key unik aplikasi Anda |
| `sign` | string | **Ya** | Signature yang di-generate dengan algoritma sign TTS |
| `timestamp` | int | **Ya** | Unix timestamp GMT (UTC+00:00) |

### Request — Headers

| Header | Tipe | Wajib | Deskripsi |
|--------|------|-------|-----------|
| `content-type` | string | **Ya** | Harus `application/json` |
| `x-tts-access-token` | string | **Ya** | Partner access token dari **Get Access Token** (user_type = 3) |

### Contoh Request (cURL)

```bash
curl -X GET \
  'https://open-api.tiktokglobalshop.com/authorization/202405/category_assets?\
app_key=YOUR_APP_KEY&\
sign=YOUR_SIGN&\
timestamp=1623812664' \
  -H 'x-tts-access-token: PARTNER_ACCESS_TOKEN' \
  -H 'content-type: application/json'
```

### Response

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `code` | int | Status code (0 = success) |
| `message` | string | Pesan status |
| `request_id` | string | ID log |
| `data` | object | Data response |

#### `data` object:

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `category_assets` | array | Array of authorized category asset objects |

#### `category_assets[]` object:

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `cipher` | string | **category_asset_cipher** — gunakan ini di API lain |
| `target_market` | string | Kode market (e.g., "US", "GB", "ID") |
| `category` | object | Informasi kategori bisnis |
| `category.id` | int | Category ID |
| `category.name` | string | Nama kategori (e.g., "Customer Support", "Order Management") |

### Contoh Response

```json
{
  "code": 0,
  "data": {
    "category_assets": [
      {
        "cipher": "TTP_XF90igAAAABh0sddwer0qsWgt233vOiG",
        "target_market": "US",
        "category": {
          "id": 3,
          "name": "Customer Support"
        }
      }
    ]
  },
  "message": "Success",
  "request_id": "202203070749000101890810281E8C70B7"
}
```

### Penggunaan category_asset_cipher

Setelah mendapat `category_asset_cipher`, gunakan di API yang terkait dengan affiliate partner:

```bash
# Contoh: Get Creator List (Affiliate Partner API)
curl -X GET \
  'https://open-api.tiktokglobalshop.com/affiliate_partner/202405/creators?\
category_asset_cipher=TTP_XF90igAAAABh0sddwer0qsWgt233vOiG&\
app_key=YOUR_APP_KEY&\
...'
```

---

## Autentikasi & Common Parameters

### Headers (Wajib di Semua Request)

| Header | Tipe | Deskripsi |
|--------|------|-----------|
| `content-type` | string | Harus `application/json` |
| `x-tts-access-token` | string | Access token (seller atau partner tergantung API) |

### Query Parameters (Wajib di Semua Request)

| Parameter | Tipe | Deskripsi |
|-----------|------|-----------|
| `app_key` | string | Key unik aplikasi Anda. Didapat saat registrasi app di Partner Center |
| `sign` | string | Signature yang di-generate dengan **algoritma sign TTS** |
| `timestamp` | int | Unix timestamp GMT (UTC+00:00) |

### Cara Mendapatkan Access Token

**Untuk Seller:**
```
1. Redirect seller ke TikTok authorization page
2. Seller authorize aplikasi Anda
3. TikTok callback dengan auth_code
4. Call Get Access Token API dengan user_type = 0
5. Response: seller access_token
```

**Untuk Partner:**
```
1. Redirect partner ke TikTok authorization page
2. Partner authorize aplikasi Anda
3. TikTok callback dengan auth_code
4. Call Get Access Token API dengan user_type = 3
5. Response: partner access_token
```

### Signature Generation

Semua request harus di-sign menggunakan algoritma signature TikTok Shop. Lihat dokumentasi **Authentication** untuk detail implementasi.

---

## Error Codes

### Common Error

| Code | Message | Penanganan |
|------|---------|------------|
| `36009003` | Internal error. Please try again. | Retry request. Jika persisten, hubungi support TikTok |

### Error Handling Tips

```javascript
// Contoh implementasi retry dengan exponential backoff
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      const data = await response.json();

      if (data.code === 0) return data;

      if (data.code === 36009003) {
        // Internal error — retry setelah delay (exponential backoff)
        const delay = 1000 * Math.pow(2, i); // 1s, 2s, 4s
        await new Promise(r => setTimeout(r, delay));
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

## Catatan Implementasi

### Best Practices

**1. Simpan Cipher dengan Aman**
- Simpan `shop_cipher` dan `category_asset_cipher` di database Anda
- Associate dengan user/shop yang sesuai
- Cipher ini tidak expire (kecuali authorization di-revoke)

**2. Handle Multiple Shops/Assets**
- Satu seller bisa authorize multiple shops
- Satu partner bisa authorize multiple category assets
- API mengembalikan array — iterate untuk dapat semua

**3. Refresh Token**
- Access token memiliki expiration time
- Gunakan refresh token untuk mendapat access token baru
- Implementasi auto-refresh sebelum token expired

**4. State Parameter untuk Security**
- Gunakan `state` parameter yang unik saat redirect ke TikTok
- Validasi state saat callback untuk mencegah CSRF attack
- Contoh: `state = uuid() + timestamp`

**5. Error Logging**
- Log semua `request_id` dari response
- Berguna untuk debugging dan support ticket

### Checklist Sebelum Go-Live

- [ ] Daftar app di TikTok Shop Partner Center → dapatkan `app_key` dan `app_secret`
- [ ] Setup OAuth redirect URI di Partner Center
- [ ] Implementasi OAuth flow (redirect, callback, token exchange)
- [ ] Implementasi algoritma **signature generation** sesuai docs TTS
- [ ] Test Get Authorized Shops/Category Assets di **Sandbox** dulu
- [ ] Simpan cipher di database dengan mapping yang benar
- [ ] Implementasi refresh token mechanism
- [ ] Implementasi error handling & retry logic
- [ ] Validasi `state` parameter untuk security
- [ ] Log semua request_id untuk debugging

### Contoh Implementasi Node.js (Complete Flow)

```javascript
const crypto = require('crypto');
const express = require('express');
const axios = require('axios');

const APP_KEY = 'YOUR_APP_KEY';
const APP_SECRET = 'YOUR_APP_SECRET';
const REDIRECT_URI = 'https://your-app.com/callback';
const BASE_URL = 'https://open-api.tiktokglobalshop.com';

const app = express();

// Generate signature
function generateSignature(path, params, appSecret) {
  const sortedParams = Object.keys(params).sort().map(
    key => `${key}=${params[key]}`
  ).join('&');

  const signString = `${appSecret}${path}${sortedParams}${appSecret}`;
  return crypto.createHash('sha256').update(signString).digest('hex');
}

// Step 1: Redirect to TikTok authorization
app.get('/auth/tiktok', (req, res) => {
  const state = crypto.randomUUID(); // Generate unique state
  // Save state to session or database for validation
  
  const authUrl = `https://auth.tiktok.com/oauth/authorize?` +
    `app_key=${APP_KEY}&` +
    `state=${state}&` +
    `redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
  
  res.redirect(authUrl);
});

// Step 2: Handle callback
app.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  
  // Validate state parameter
  // if (state !== savedState) throw new Error('Invalid state');
  
  // Exchange auth_code for access_token
  const tokenResponse = await axios.post(`${BASE_URL}/oauth/access_token`, {
    app_key: APP_KEY,
    app_secret: APP_SECRET,
    auth_code: code,
    grant_type: 'authorized_code',
  });
  
  const { access_token, refresh_token } = tokenResponse.data.data;
  
  // Save tokens securely
  // await saveTokens(userId, access_token, refresh_token);
  
  // Get authorized shops
  const shops = await getAuthorizedShops(access_token);
  
  res.json({ success: true, shops });
});

// Step 3: Get Authorized Shops
async function getAuthorizedShops(accessToken) {
  const params = {
    app_key: APP_KEY,
    timestamp: Math.floor(Date.now() / 1000),
  };

  const path = '/authorization/202309/shops';
  params.sign = generateSignature(path, params, APP_SECRET);

  const queryString = new URLSearchParams(params).toString();
  const url = `${BASE_URL}${path}?${queryString}`;

  const response = await axios.get(url, {
    headers: {
      'content-type': 'application/json',
      'x-tts-access-token': accessToken,
    },
  });

  return response.data.data.shops;
}

// Step 4: Get Authorized Category Assets (for Partner)
async function getAuthorizedCategoryAssets(partnerAccessToken) {
  const params = {
    app_key: APP_KEY,
    timestamp: Math.floor(Date.now() / 1000),
  };

  const path = '/authorization/202405/category_assets';
  params.sign = generateSignature(path, params, APP_SECRET);

  const queryString = new URLSearchParams(params).toString();
  const url = `${BASE_URL}${path}?${queryString}`;

  const response = await axios.get(url, {
    headers: {
      'content-type': 'application/json',
      'x-tts-access-token': partnerAccessToken,
    },
  });

  return response.data.data.category_assets;
}

// Usage Example
async function example() {
  const sellerAccessToken = 'SELLER_ACCESS_TOKEN';
  const shops = await getAuthorizedShops(sellerAccessToken);
  
  for (const shop of shops) {
    console.log(`Shop: ${shop.name} (${shop.region})`);
    console.log(`  ID: ${shop.id}`);
    console.log(`  Cipher: ${shop.cipher}`);
    console.log(`  Type: ${shop.seller_type}`);
    
    // Save to database
    // await db.saveShopCipher(shop.id, shop.cipher);
  }
}

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

### Contoh Database Schema

```sql
-- Tabel untuk menyimpan authorization data seller
CREATE TABLE seller_authorizations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  shop_id VARCHAR(50) NOT NULL,
  shop_name VARCHAR(255),
  shop_cipher VARCHAR(255) NOT NULL,
  region VARCHAR(10),
  seller_type VARCHAR(50),
  shop_code VARCHAR(50),
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, shop_id)
);

-- Tabel untuk menyimpan authorization data partner
CREATE TABLE partner_authorizations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  category_name VARCHAR(255),
  category_asset_cipher VARCHAR(255) NOT NULL,
  target_market VARCHAR(10),
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, category_id, target_market)
);

-- Index untuk query cepat
CREATE INDEX idx_shop_cipher ON seller_authorizations(shop_cipher);
CREATE INDEX idx_category_cipher ON partner_authorizations(category_asset_cipher);
```

### Troubleshooting

**Problem: Get Authorized Shops returns empty array**
- Pastikan seller sudah authorize aplikasi Anda
- Cek access_token masih valid (belum expired)
- Pastikan user_type = 0 saat Get Access Token

**Problem: Get Authorized Category Assets returns empty array**
- Pastikan partner sudah authorize aplikasi Anda
- Cek access_token masih valid
- Pastikan user_type = 3 saat Get Access Token
- Cek partner memiliki business category yang di-authorize

**Problem: Error 36009003 (Internal error)**
- Retry request dengan exponential backoff
- Jika persisten, hubungi TikTok support dengan request_id

**Problem: Signature validation failed**
- Cek algoritma signature generation sesuai dokumentasi
- Pastikan timestamp dalam GMT (UTC+00:00)
- Cek app_key dan app_secret benar

---

## Sumber Tambahan

- [Seller Authorization Guide](https://partner.tiktokshop.com/docv2/page/seller-authorization-guide)
- [Partner Authorization Guide](https://partner.tiktokshop.com/docv2/page/partner-authorization-guide)
- [Authentication & Signature](https://partner.tiktokshop.com/docv2/page/authentication)
- [Get Access Token API](https://partner.tiktokshop.com/docv2/page/get-access-token)

---

> **Dokumen ini dibuat berdasarkan scraping halaman resmi TikTok Shop Partner Center pada 14 Juni 2026.**
> Selalu cek dokumentasi terbaru di: https://partner.tiktokshop.com/docv2/page/authorization-overview
