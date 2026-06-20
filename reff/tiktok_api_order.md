# TikTok Shop — Order API Documentation

> **Sumber**: [TikTok Shop Partner Center — Order API Overview](https://partner.tiktokshop.com/docv2/page/order-api-overview)
>
> **Tujuan**: Panduan lengkap untuk programmer dalam mengintegrasikan aplikasi dengan TikTok Shop Order API.

---

## Daftar Isi

1. [Ringkasan](#ringkasan)
2. [Konsep Penting](#konsep-penting)
3. [Order Status & Lifecycle](#order-status--lifecycle)
4. [Autentikasi & Common Parameters](#autentikasi--common-parameters)
5. [Endpoint: Get Order List](#1-get-order-list)
6. [Endpoint: Get Order Detail](#2-get-order-detail)
7. [Endpoint: Add External Order References](#3-add-external-order-references)
8. [Endpoint: Get External Order References](#4-get-external-order-references)
9. [Endpoint: Search Order By External Order Reference](#5-search-order-by-external-order-reference)
10. [Fulfillment Types & SLA](#fulfillment-types--sla)
11. [Webhooks](#webhooks)
12. [Error Codes](#error-codes)
13. [FAQ](#faq)
14. [Catatan Implementasi](#catatan-implementasi)

---

## Ringkasan

TikTok Shop Order API menyediakan endpoint untuk mengelola dan memantau order secara programmatic.

| # | Endpoint | Method | Path | Versi | Scope |
|---|----------|--------|------|-------|-------|
| 1 | Get Order List | `POST` | `/order/202309/orders/search` | 202309 | `seller.order.info` |
| 2 | Get Order Detail | `GET` | `/order/202507/orders` | 202507 | `seller.order.info` |
| 3 | Add External Order References | `POST` | `/order/202406/orders/external_orders` | 202406 | `seller.order.ext_ref.write` atau `seller.order.ext_ref.write.custom` |
| 4 | Get External Order References | `GET` | `/order/202406/orders/{order_id}/external_orders` | 202406 | `seller.order.ext_ref.read` |
| 5 | Search Order By External Order Reference | `POST` | `/order/202406/orders/external_order_search` | 202406 | `seller.order.ext_ref.read` |

**Base URL**: `https://open-api.tiktokglobalshop.com`

---

## Konsep Penting

### Order Structure

- **Order ID**: Identifier unik untuk setiap order yang dibuat oleh buyer
- **SKU ID**: Identifier unik untuk setiap variant produk dalam order line
- **Order Line Item ID**: Identifier untuk setiap item individual dalam order line

**Contoh**: Buyer memesan 5 produk: 2 Red Large T-shirts, 2 Red Medium T-shirts, 1 size 10 black shoes

```
Order ID: 12345678
├─ Red Large T Shirt (SKU)
│  ├─ 1x Red Large T Shirt (item 1) ← Order Line Item ID
│  └─ 1x Red Large T Shirt (item 2) ← Order Line Item ID
├─ Red Medium T Shirt (SKU)
│  ├─ 1x Red Medium T Shirt (item 3) ← Order Line Item ID
│  └─ 1x Red Medium T Shirt (item 4) ← Order Line Item ID
└─ Size 10 Black Shoes (SKU)
   └─ 1x size 10 black shoes (item 5) ← Order Line Item ID
```

### Kapan Order Dibuat?

Order dibuat ketika buyer klik **"Place Order"**. Saat order dibuat, buyer **belum melakukan pembayaran**, sehingga status order adalah `UNPAID`. Setelah order dibuat, seller harus **mengurangi atau menahan inventory** dari sistem manajemen inventory mereka.

---

## Order Status & Lifecycle

### Status Definitions

| Status | Deskripsi |
|--------|-----------|
| `UNPAID` | Order sudah dibuat tapi pembayaran belum dilakukan |
| `ON_HOLD` | Pembayaran selesai, order dalam periode remorse (1 jam). Buyer bisa cancel tanpa persetujuan seller. Order belum boleh di-fulfill |
| `AWAITING_SHIPMENT` | Menunggu seller membuat logistic order |
| `PARTIALLY_SHIPPING` | Satu atau lebih (tapi tidak semua) item sudah di-ship |
| `AWAITING_COLLECTION` | Logistic order sudah dibuat. Minimal 1 item masih menunggu di-collect oleh carrier |
| `IN_TRANSIT` | Semua item sudah di-collect carrier. Minimal 1 package belum sampai ke buyer |
| `DELIVERED` | Semua item sudah sampai ke buyer |
| `COMPLETED` | Order selesai. Tidak bisa return atau refund lagi |
| `CANCELLED` | Order dibatalkan (oleh buyer, seller, SYSTEM, atau OPERATOR) |

### Status Transitions

```
┌─────────────────────────────────────────────────────────────────┐
│                        ORDER LIFECYCLE                          │
└─────────────────────────────────────────────────────────────────┘

UNPAID ──────► ON_HOLD ──────► AWAITING_SHIPMENT ──────► AWAITING_COLLECTION
  │                │                    │                            │
  │                │                    │                            │
  │                │                    ▼                            │
  │                │          PARTIALLY_SHIPPING                     │
  │                │                    │                            │
  │                │                    └────────────┬───────────────┘
  │                │                                 │
  │                │                                 ▼
  │                │                          IN_TRANSIT
  │                │                                 │
  │                │                                 ▼
  │                │                          DELIVERED
  │                │                                 │
  │                │                                 ▼
  │                │                          COMPLETED
  │                │
  ▼                ▼
CANCELLED ◄────────┘
```

#### Detail Transitions:

**UNPAID → ON_HOLD**
- Trigger: Buyer melakukan pembayaran
- Note: Untuk order `ON_HOLD`, recipient address dan buyer info **tidak tersedia** via API

**ON_HOLD → AWAITING_SHIPMENT**
- Trigger: Setelah remorse window (1 jam setelah payment)
- Initiator: TikTok (otomatis)

**AWAITING_SHIPMENT → PARTIALLY_SHIPPING**
- Trigger: Seller ship sebagian item (split shipment)
- Note: Hanya split shipment yang punya status ini

**AWAITING_SHIPMENT/PARTIALLY_SHIPPING → AWAITING_COLLECTION**
- Trigger: Seller call API untuk ship semua item
- Initiator: Seller
- Note: Setelah seller arrange shipment, buyer **tidak bisa cancel** tanpa approval seller

**AWAITING_COLLECTION → IN_TRANSIT**
- Trigger: TikTok mendapat tracking info dari carrier
- Initiator: TikTok
- Note: Tracking info bisa delay hingga 24 jam

**IN_TRANSIT → DELIVERED**
- Trigger: Package berhasil dikirim
- Initiator: TikTok

**DELIVERED → COMPLETED**
- Trigger: Order amount fully refunded (jika ada refund)
- Initiator: Buyer/Seller/TikTok

**Any Status → CANCELLED**
- Bisa di-cancel oleh: Buyer, Seller, SYSTEM, atau OPERATOR
- Order status hanya berubah ke `CANCELLED` ketika **semua items** sudah di-cancel

---

## Autentikasi & Common Parameters

### Headers (Wajib)

| Header | Tipe | Deskripsi |
|--------|------|-----------|
| `content-type` | string | Harus `application/json` |
| `x-tts-access-token` | string | Seller access token dari API **Get Access Token** (`user_type = 0`) |

### Query Parameters (Wajib di Setiap Request)

| Parameter | Tipe | Deskripsi |
|-----------|------|-----------|
| `app_key` | string | Key unik app kamu |
| `shop_cipher` | string | Identifier shop. Didapat dari **Get Authorization Shop** |
| `sign` | string | Signature yang di-generate dengan **algoritma sign TTS** |
| `timestamp` | int | Unix timestamp GMT (UTC+00:00) |

### Pagination Parameters

| Parameter | Tipe | Default | Deskripsi |
|-----------|------|---------|-----------|
| `page_size` | int | 20 | Jumlah hasil per halaman. Range: **1–100** |
| `page_token` | string | — | Token untuk halaman berikutnya. Didapat dari response `next_page_token` |
| `sort_field` | string | varies | Field untuk sorting |
| `sort_order` | string | `DESC` | Urutan sort: `ASC` atau `DESC` |

---

## 1. Get Order List

> Mengambil daftar order yang dibuat atau di-update selama timeframe tertentu dengan filter criteria.

| | |
|---|---|
| **Method** | `POST` |
| **Path** | `/order/202309/orders/search` |
| **Version** | `202309` |
| **Scope** | `seller.order.info` |

### Deskripsi

Mengembalikan daftar order dengan berbagai filter criteria seperti: order status, delivery option, buyer user ID, dll.

### Request — Query Parameters

| Parameter | Tipe | Wajib | Deskripsi |
|-----------|------|-------|-----------|
| `page_size` | int | **Ya** | Default: 20, Range: 1-100 |
| `sort_order` | string | Tidak | `ASC` atau `DESC` (default) |
| `page_token` | string | Tidak | Token untuk halaman berikutnya |
| `sort_field` | string | Tidak | Default: `create_time`. Options: `create_time`, `update_time` |

### Request — Body Parameters

| Parameter | Tipe | Deskripsi |
|-----------|------|-----------|
| `order_status` | string | Filter by status: `UNPAID`, `ON_HOLD`, `AWAITING_SHIPMENT`, `PARTIALLY_SHIPPING`, `AWAITING_COLLECTION`, `IN_TRANSIT`, `DELIVERED`, `COMPLETED`, `CANCELLED` |
| `create_time_ge` | int | Filter order yang dibuat **pada atau setelah** waktu ini (Unix timestamp) |
| `create_time_lt` | int | Filter order yang dibuat **sebelum** waktu ini |
| `update_time_ge` | int | Filter order yang di-update **pada atau setelah** waktu ini |
| `update_time_lt` | int | Filter order yang di-update **sebelum** waktu ini |
| `shipping_type` | string | Filter by shipping type: `TIKTOK`, `SELLER`, `TIKTOK_DIGITAL` |
| `buyer_user_id` | string | Filter by buyer user ID |
| `is_buyer_request_cancel` | bool | Filter order yang buyer-nya request cancel |
| `warehouse_ids` | []string | Filter by warehouse IDs (max 100). Only if multi-warehouse enabled |

### Catatan Time Filter

- `create_time_ge` dan `create_time_lt` = creation time filter
- `update_time_ge` dan `update_time_lt` = update time filter
- Jika `create_time_ge` diisi tapi `create_time_lt` kosong → `create_time_lt` default ke waktu saat ini
- Jika `create_time_lt` diisi tapi `create_time_ge` kosong → `create_time_ge` default ke earliest shop time

### Contoh Request (cURL)

```bash
curl -X POST \
  'https://open-api.tiktokglobalshop.com/order/202309/orders/search?\
page_size=20&\
sort_order=ASC&\
sort_field=create_time&\
app_key=YOUR_APP_KEY&\
sign=YOUR_SIGN&\
timestamp=1623812664&\
shop_cipher=YOUR_SHOP_CIPHER' \
  -H 'x-tts-access-token: YOUR_ACCESS_TOKEN' \
  -H 'content-type: application/json' \
  -d '{
    "order_status": "AWAITING_SHIPMENT",
    "create_time_ge": 1623812664,
    "create_time_lt": 1623912664,
    "shipping_type": "TIKTOK",
    "warehouse_ids": ["7000714532876273888"]
  }'
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
| `next_page_token` | string | Token untuk halaman berikutnya |
| `total_count` | int | Total jumlah order |
| `orders` | array | Array of order objects |

#### `orders[]` object (partial):

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | string | Order ID |
| `buyer_message` | string | Pesan dari buyer |
| `cancellation_initiator` | string | Siapa yang initiate cancel: `BUYER`, `SELLER`, `SYSTEM`, `OPERATOR` |
| `shipping_provider_id` | string | Shipping provider ID |
| `create_time` | int | Waktu order dibuat |
| `shipping_provider` | string | Nama shipping provider |
| `packages` | array | Array of package IDs |
| `payment` | object | Detail pembayaran |

### Contoh Response

```json
{
  "code": 0,
  "data": {
    "next_page_token": "6AsPQsUMvH3RkchNUPPh22NROHkE0D8pmq/N5M1kHYcZmtRyv9aVrNv65W7Q6tFA...",
    "total_count": 22113,
    "orders": [
      {
        "id": "576461413038785752",
        "buyer_message": "Please ship asap!",
        "cancellation_initiator": "SELLER",
        "shipping_provider_id": "6617675021119438849",
        "create_time": 1619611561,
        "shipping_provider": "TT Virtual express",
        "packages": [
          {
            "id": "1152321127278713123"
          }
        ],
        "payment": {
          "currency": "IDR",
          "sub_total": "5000",
          "shipping_fee": "5000",
          "seller_discount": "5000"
        }
      }
    ]
  },
  "message": "Success",
  "request_id": "202203070749000101890810281E8C70B7"
}
```

---

## 2. Get Order Detail

> Mengambil detail lengkap dari satu atau beberapa order tertentu.

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/order/202507/orders` |
| **Version** | `202507` |
| **Scope** | `seller.order.info` |

### Deskripsi

Mengambil informasi detail order termasuk: status, shipping address, payment details, price & tax info, package information.

### Request — Query Parameters

| Parameter | Tipe | Wajib | Deskripsi |
|-----------|------|-------|-----------|
| `ids` | []string | **Ya** | List of order IDs (max 50) |

### Contoh Request (cURL)

```bash
curl -X GET \
  'https://open-api.tiktokglobalshop.com/order/202507/orders?\
ids=57668123555,57668123556&\
app_key=YOUR_APP_KEY&\
sign=YOUR_SIGN&\
timestamp=1623812664&\
shop_cipher=YOUR_SHOP_CIPHER' \
  -H 'x-tts-access-token: YOUR_ACCESS_TOKEN' \
  -H 'content-type: application/json'
```

### Response

#### `data.orders[]` object (detailed):

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | string | Order ID |
| `cancellation_initiator` | string | Initiator cancel: `BUYER`, `SELLER`, `SYSTEM`, `OPERATOR` |
| `shipping_provider` | string | Nama shipping provider |
| `shipping_provider_id` | string | Shipping provider ID |
| `user_id` | string | Buyer user ID |
| `status` | string | Order status |
| `rts_time` | int | Ready To Ship time |
| `payment` | object | Detail pembayaran lengkap |

#### `payment` object:

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `currency` | string | Mata uang |
| `sub_total` | string | Subtotal produk |
| `shipping_fee` | string | Biaya pengiriman |
| `seller_discount` | string | Diskon dari seller |
| `platform_discount` | string | Diskon dari platform |
| `payment_platform_discount` | string | Payment platform discount |
| `payment_discount_service_fee` | string | Service fee untuk discount |
| `total_amount` | string | Total amount |
| `original_total_product_price` | string | Harga produk original |
| `original_shipping_fee` | string | Ongkir original |

### Contoh Response

```json
{
  "code": 0,
  "data": {
    "orders": [
      {
        "id": "576461413038785752",
        "cancellation_initiator": "SELLER",
        "shipping_provider": "TT Virtual express",
        "shipping_provider_id": "6617675021119438849",
        "user_id": "7021436810468230477",
        "status": "AWAITING_SHIPMENT",
        "rts_time": 1619611563,
        "payment": {
          "currency": "IDR",
          "sub_total": "5000",
          "shipping_fee": "5000",
          "seller_discount": "5000",
          "platform_discount": "5000",
          "payment_platform_discount": "10",
          "payment_discount_service_fee": "10",
          "total_amount": "5000",
          "original_total_product_price": "5000",
          "original_shipping_fee": "5000"
        }
      }
    ]
  },
  "message": "Success",
  "request_id": "..."
}
```

---

## 3. Add External Order References

> Menghubungkan order di sistem OMS eksternal dengan order di TikTok Shop.

| | |
|---|---|
| **Method** | `POST` |
| **Path** | `/order/202406/orders/external_orders` |
| **Version** | `202406` |
| **Scope** | `seller.order.ext_ref.write` atau `seller.order.ext_ref.write.custom` |

### Deskripsi

Jika kamu menggunakan OMS (Order Management System) eksternal untuk mengelola TikTok Shop orders, order ID di OMS dan TikTok Shop bisa berbeda. Gunakan endpoint ini untuk **menghubungkan** informasi di OMS dengan order yang benar di TikTok Shop.

### Request — Body Parameters

| Parameter | Tipe | Wajib | Deskripsi |
|-----------|------|-------|-----------|
| `orders` | []object | **Ya** | Array of order mappings (max 100) |

#### `orders[]` object:

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | string | TikTok Shop order ID |
| `external_order` | object | External order info |
| `external_order.id` | string | External OMS order ID |
| `external_order.platform` | string | Platform alias: `SHOPIFY`, `WOOCOMMERCE`, `BIGCOMMERCE`, `MAGENTO`, `SALESFORCE_COMMERCE_CLOUD`, `CHANNEL_ADVISOR`, `AMAZON`, `ORDER_MANAGEMENT_SYSTEM`, `WAREHOUSE_MANAGEMENT_SYSTEM`, `ERP_SYSTEM` |
| `external_order.line_items` | []object | Mapping line items |
| `external_order.line_items[].id` | string | TikTok Shop line item ID |
| `external_order.line_items[].origin_id` | string | External OMS line item ID |

### Contoh Request (cURL)

```bash
curl -X POST \
  'https://open-api.tiktokglobalshop.com/order/202406/orders/external_orders?\
app_key=YOUR_APP_KEY&\
sign=YOUR_SIGN&\
timestamp=1623812664&\
shop_cipher=YOUR_SHOP_CIPHER' \
  -H 'content-type: application/json' \
  -H 'x-tts-access-token: YOUR_ACCESS_TOKEN' \
  -d '{
    "orders": [
      {
        "id": "576461413038785752",
        "external_order": {
          "id": "676461413038785752",
          "platform": "SHOPIFY",
          "line_items": [
            {
              "id": "577086512123755123",
              "origin_id": "677086512123755123"
            }
          ]
        }
      }
    ]
  }'
```

### Response

#### `data` object:

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `errors` | []object | Array of errors (jika ada order yang gagal) |

### Contoh Response

```json
{
  "code": 0,
  "data": {
    "errors": [
      {
        "code": "36020001",
        "message": "Invalid order_id",
        "detail": {
          "order_id": "576461413038785752",
          "external_order": {
            "id": "676461413038785752",
            "platform": "SHOPIFY"
          }
        }
      }
    ]
  },
  "message": "Success",
  "request_id": "202203070749000101890810281E8C70B7"
}
```

---

## 4. Get External Order References

> Mengambil external order references yang sudah di-sync sebelumnya.

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/order/202406/orders/{order_id}/external_orders` |
| **Version** | `202406` |
| **Scope** | `seller.order.ext_ref.read` |

### Deskripsi

Jika sudah pakai **Add External Order References**, gunakan API ini untuk mengambil informasi synced orders.

### Request — Path Parameters

| Parameter | Tipe | Wajib | Deskripsi |
|-----------|------|-------|-----------|
| `order_id` | string | **Ya** | TikTok Shop order ID |

### Request — Query Parameters

| Parameter | Tipe | Wajib | Deskripsi |
|-----------|------|-------|-----------|
| `platform` | string | **Ya** | Platform alias (SHOPIFY, WOOCOMMERCE, dll) |

### Contoh Request (cURL)

```bash
curl -X GET \
  'https://open-api.tiktokglobalshop.com/order/202406/orders/576461413038785752/external_orders?\
app_key=YOUR_APP_KEY&\
sign=YOUR_SIGN&\
timestamp=1623812664&\
shop_cipher=YOUR_SHOP_CIPHER&\
platform=SHOPIFY' \
  -H 'content-type: application/json' \
  -H 'x-tts-access-token: YOUR_ACCESS_TOKEN'
```

### Response

```json
{
  "code": 0,
  "data": {
    "external_orders": [
      {
        "id": "676461413038785752",
        "platform": "SHOPIFY",
        "line_items": [
          {
            "id": "577086512123755123",
            "origin_id": "677086512123755123"
          }
        ]
      }
    ]
  },
  "message": "Success",
  "request_id": "202203070749000101890810281E8C70B7"
}
```

---

## 5. Search Order By External Order Reference

> Mencari TikTok Shop order berdasarkan external OMS order ID.

| | |
|---|---|
| **Method** | `POST` |
| **Path** | `/order/202406/orders/external_order_search` |
| **Version** | `202406` |
| **Scope** | `seller.order.ext_ref.read` |

### Deskripsi

Jika sudah pakai **Add External Order References**, gunakan API ini untuk mencari TikTok Shop order berdasarkan information di OMS kamu.

### Request — Query Parameters

| Parameter | Tipe | Wajib | Deskripsi |
|-----------|------|-------|-----------|
| `platform` | string | **Ya** | Platform alias (SHOPIFY, WOOCOMMERCE, dll) |
| `external_order_id` | string | **Ya** | Order ID di OMS kamu |

### Contoh Request (cURL)

```bash
curl -X POST \
  'https://open-api.tiktokglobalshop.com/order/202406/orders/external_order_search?\
platform=SHOPIFY&\
external_order_id=676461413038785752&\
timestamp=1623812664&\
app_key=YOUR_APP_KEY&\
sign=YOUR_SIGN&\
shop_cipher=YOUR_SHOP_CIPHER' \
  -H 'x-tts-access-token: YOUR_ACCESS_TOKEN' \
  -H 'content-type: application/json' \
  -d '{}'
```

### Response

```json
{
  "code": 0,
  "data": {
    "orders": [
      {
        "id": "576461413038785752",
        "external_order": {
          "id": "676461413038785752",
          "platform": "SHOPIFY",
          "line_items": [
            {
              "id": "577086512123755123",
              "origin_id": "677086512123755123"
            }
          ]
        }
      }
    ]
  },
  "message": "Success",
  "request_id": "202203070749000101890810281E8C70B7"
}
```

---

## Fulfillment Types & SLA

### Fulfillment Types

TikTok Shop menyediakan 2 tipe fulfillment:

**1. FULFILLMENT_BY_SELLER**
- Seller fulfill orders langsung dari warehouse sendiri
- Seller bertanggung jawab: storing, packaging, shipping

**2. FULFILLMENT_BY_TIKTOK**
- Seller stock produk di fulfillment center TikTok
- TikTok bertanggung jawab: storing, picking, packing, shipping

### Shipping Types (untuk FULFILLMENT_BY_SELLER)

**1. TikTok Shipping**
- TikTok menyediakan shipping service
- Seller dapat shipping label dari TikTok

**2. Seller Shipping**
- Seller arrange shipping sendiri

### SLA (Service Level Agreement)

| SLA Type | Deskripsi |
|----------|-----------|
| `rts_sla` | **Ready To Ship** — Waktu maksimal seller harus ship order. Jika order belum `AWAITING_COLLECTION` sebelum `rts_sla`, akan dihitung late dispatch |
| `tts_sla` | **Transfer To Ship** — Waktu maksimal package harus di-collect carrier. Jika order belum `IN_TRANSIT` sebelum `tts_sla`, akan dihitung late dispatch |
| `delivery_sla` | Waktu maksimal package harus sampai ke buyer |
| `cancel_order_sla` | Jika seller gagal ship sebelum waktu ini, order akan auto-cancel oleh platform |

### Recipient Address

**Information Redaction** (data disamarkan):
- Order dengan `fulfillment_type = FULFILLMENT_BY_TIKTOK`
- Order dengan `fulfillment_type = FULFILLMENT_BY_SELLER` dan `shipping_type = TIKTOK`

**Localized Address**: Gunakan `district_info_list` untuk mendapat address dalam format lokal.

---

## Webhooks

Untuk mendapat notifikasi real-time tentang perubahan status order, **subscribe ke Order Status Webhook**.

### Cara Mendapat Order ID

Untuk menggunakan Order API, kamu harus subscribe ke **Orders Webhook** untuk mendapat order ID secara real-time ketika order dibuat.

---

## Error Codes

### Common Error

| Code | Message | Penanganan |
|------|---------|------------|
| `36009003` | Internal error. Please try again. | Retry request. Jika persisten, hubungi support |
| `10002014` | Failed to get orders | Retry. Jika persisten, hubungi platform |
| `10002015` | Failed to get orders | Retry. Jika persisten, hubungi platform |
| `10006402` | Internal error | Retry |
| `10037002` | Failed to get orders | Retry. Jika persisten, hubungi platform |
| `10037003` | Failed to get orders | Retry. Jika persisten, hubungi platform |
| `10037004` | Failed to get orders | Retry. Jika persisten, hubungi platform |
| `21008111` | Order/package does not belong to current seller | Cek `shop_cipher` dan order ID |

---

## FAQ

### How do I get order ID?
Subscribe ke **Orders Webhook** untuk mendapat notifikasi real-time saat order dibuat.

### My item is partially out of stock. Can I ship only part of the Order?
Saat ini belum tersedia. Hubungi CST team untuk akses beta API.

### Can I completely cancel an order?
Ya, gunakan **Cancel Order API**.

### How do I ship a new order which is a replacement for an existing one (package lost)?
Saat ini belum ada replacement functionality. Minta buyer cancel order dan buat order baru.

### How can I check the order line item information?
Gunakan **Get Order Detail** API dan lihat field `line_items`.

### How can I know if the order is fulfilled by TikTok?
Gunakan **Get Order Detail** API dan lihat field `fulfillment_type`.

### How can I know the order shipping service (platform or seller)?
Gunakan **Get Order Detail** API dan lihat field `delivery_option_id`.

### How can I know whether the order line item is a gift?
Gunakan **Get Order Detail** API dan lihat field `is_gift`.

### Can a Buyer place an order from multiple shops?
Ya! TikTok akan membuat **2 order terpisah** jika buyer beli dari 2 shop berbeda.

---

## Catatan Implementasi

### Marketplace Policies

**Cancel Policy**:
- **1-hour remorse period**: Buyer bisa cancel tanpa charge dalam 1 jam pertama
- **After 1-hour**: Buyer cancel request perlu approval seller

**Order Fulfillment SLA Policy**:
- Seller harus arrange shipment sebelum `rts_sla`
- Shipping provider harus update tracking info sebelum `tts_sla`
- Jika seller gagal fulfill dengan valid shipping ID sebelum `cancel_order_sla`, order akan auto-cancel

### Checklist Sebelum Go-Live

- [ ] Daftar app di TikTok Shop Partner Center → dapatkan `app_key`
- [ ] Setup OAuth flow → dapatkan `access_token` dan `shop_cipher`
- [ ] Implementasi algoritma **signature generation**
- [ ] Subscribe ke **Order Status Webhook** untuk real-time updates
- [ ] Test semua endpoint di **Sandbox** dulu
- [ ] Implementasi pagination (loop `next_page_token`)
- [ ] Implementasi error handling & retry logic
- [ ] Handle perbedaan timezone — semua timestamp dalam **UTC**
- [ ] Implementasi 1-hour remorse period logic

### Contoh Implementasi Node.js (Skeleton)

```javascript
const crypto = require('crypto');

const APP_KEY = 'YOUR_APP_KEY';
const APP_SECRET = 'YOUR_APP_SECRET';
const BASE_URL = 'https://open-api.tiktokglobalshop.com';

function generateSignature(path, params, appSecret) {
  const sortedParams = Object.keys(params).sort().map(
    key => `${key}=${params[key]}`
  ).join('&');

  const signString = `${appSecret}${path}${sortedParams}${appSecret}`;
  return crypto.createHash('sha256').update(signString).digest('hex');
}

// Get Order List
async function getOrderList(accessToken, shopCipher, filters = {}) {
  const queryParams = {
    app_key: APP_KEY,
    shop_cipher: shopCipher,
    page_size: 100,
    sort_field: 'create_time',
    sort_order: 'DESC',
    timestamp: Math.floor(Date.now() / 1000),
  };

  const path = '/order/202309/orders/search';
  queryParams.sign = generateSignature(path, queryParams, APP_SECRET);

  const queryString = new URLSearchParams(queryParams).toString();
  const url = `${BASE_URL}${path}?${queryString}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-tts-access-token': accessToken,
    },
    body: JSON.stringify(filters),
  });

  return response.json();
}

// Get Order Detail
async function getOrderDetail(accessToken, shopCipher, orderIds) {
  const queryParams = {
    app_key: APP_KEY,
    shop_cipher: shopCipher,
    ids: orderIds.join(','),
    timestamp: Math.floor(Date.now() / 1000),
  };

  const path = '/order/202507/orders';
  queryParams.sign = generateSignature(path, queryParams, APP_SECRET);

  const queryString = new URLSearchParams(queryParams).toString();
  const url = `${BASE_URL}${path}?${queryString}`;

  const response = await fetch(url, {
    headers: {
      'content-type': 'application/json',
      'x-tts-access-token': accessToken,
    },
  });

  return response.json();
}

// Paginate all orders
async function getAllOrders(accessToken, shopCipher, filters = {}) {
  const allOrders = [];
  let pageToken = null;

  while (true) {
    const result = await getOrderList(accessToken, shopCipher, {
      ...filters,
      page_token: pageToken,
    });

    if (result.code !== 0) {
      throw new Error(`Error: ${result.message}`);
    }

    allOrders.push(...result.data.orders);

    if (!result.data.next_page_token) break;
    pageToken = result.data.next_page_token;
  }

  return allOrders;
}
```

---

> **Dokumen ini dibuat berdasarkan scraping halaman resmi TikTok Shop Partner Center pada 14 Juni 2026.**
> Selalu cek dokumentasi terbaru di: https://partner.tiktokshop.com/docv2/page/order-api-overview
