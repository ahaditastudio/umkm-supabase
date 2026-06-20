# Skill: Puppeteer Web Scraper for SPA/JavaScript Pages

## Deskripsi
Skill ini digunakan untuk **scrape halaman web yang dibangun dengan JavaScript (SPA/Single Page Application)** menggunakan Puppeteer (Node.js headless browser). Halaman SPA tidak bisa di-scrape dengan fetch/curl biasa karena kontennya di-render oleh JavaScript di browser.

## Kapan Digunakan
- Halaman web target menggunakan **JavaScript framework** (React, Vue, Angular, dll)
- Tool WebFetch hanya mengembalikan konten kosong atau shell HTML tanpa konten utama
- Halaman memerlukan **interaksi** (klik tab, scroll, navigasi sidebar) untuk memuat konten
- Target adalah **dokumentasi API**, **portal admin**, atau **dashboard** berbasis SPA

## Prasyarat
- **Node.js** harus terinstall di sistem
- **Puppeteer** di-install per-proyek di `/tmp/` (tidak global)

## Langkah-Langkah

### 1. Install Puppeteer (jika belum)
```bash
cd /tmp && npm install puppeteer 2>&1 | tail -5
```
Verifikasi:
```bash
ls /tmp/node_modules/puppeteer/package.json
```

### 2. Buat Script Scraper
Simpan script di `/tmp/` (directory sementara). Berikut adalah **template dasar** yang bisa disesuaikan:

#### Template A: Scrape 1 Halaman Tunggal
```javascript
// /tmp/scrape_page.js
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Navigate ke halaman target
  await page.goto('TARGET_URL', {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  // Tunggu JavaScript selesai render (adjust sesuai kecepatan halaman)
  await new Promise(r => setTimeout(r, 8000));

  // Scroll untuk load lazy content
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const timer = setInterval(() => {
        window.scrollBy(0, 300);
        totalHeight += 300;
        if (totalHeight >= document.body.scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 150);
    });
  });
  await new Promise(r => setTimeout(r, 3000));

  // Scroll back to top
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise(r => setTimeout(r, 1000));

  // Extract konten utama
  const content = await page.evaluate(() => {
    // Selector umum untuk konten utama (sesuaikan per situs)
    const selectors = [
      '[class*="scroll-intersection-center"]',
      '[class*="content"]',
      '.markdown-body',
      'main', 'article',
      'body'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.innerText.length > 200) return el.innerText;
    }
    return document.body.innerText;
  });

  console.log(content);
  await browser.close();
})();
```

#### Template B: Scrape Multiple Halaman (dari sidebar/navigation)
```javascript
// /tmp/scrape_multi.js
const puppeteer = require('puppeteer');

const pages = [
  { name: 'Page 1', url: 'https://example.com/page1' },
  { name: 'Page 2', url: 'https://example.com/page2' },
  // ... tambahkan halaman lain
];

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  for (const p of pages) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`SCRAPING: ${p.name} -> ${p.url}`);
    console.log(`${'='.repeat(80)}\n`);

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    try {
      await page.goto(p.url, { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise(r => setTimeout(r, 8000));

      // Scroll
      await page.evaluate(async () => {
        await new Promise((resolve) => {
          let totalHeight = 0;
          const timer = setInterval(() => {
            window.scrollBy(0, 300);
            totalHeight += 300;
            if (totalHeight >= document.body.scrollHeight) {
              clearInterval(timer);
              resolve();
            }
          }, 150);
        });
      });
      await new Promise(r => setTimeout(r, 3000));
      await page.evaluate(() => window.scrollTo(0, 0));
      await new Promise(r => setTimeout(r, 1000));

      const text = await page.evaluate(() => document.body.innerText);
      console.log(text);
    } catch(e) {
      console.log(`ERROR: ${e.message}`);
    }

    await page.close();
  }

  await browser.close();
})();
```

#### Template C: Scrape via Sidebar Click (untuk SPA dengan tab navigation)
```javascript
// /tmp/scrape_sidebar.js
// Gunakan ini ketika halaman SPA tidak bisa diakses via URL langsung,
// tapi harus diklik dari sidebar/navigation terlebih dahulu.

const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Buka halaman overview terlebih dahulu
  await page.goto('OVERVIEW_URL', {
    waitUntil: 'networkidle2',
    timeout: 60000
  });
  await new Promise(r => setTimeout(r, 8000));

  // Temukan semua link yang relevan di sidebar
  const links = await page.evaluate(() => {
    const allLinks = [...document.querySelectorAll('a')];
    return allLinks
      .filter(a => a.href && a.textContent.trim().length > 0)
      .map(a => ({ text: a.textContent.trim(), href: a.href }));
  });

  console.log('Links found:', JSON.stringify(links, null, 2));

  // Klik setiap link dan scrape kontennya
  const clickedUrls = new Set();
  for (const link of links) {
    if (clickedUrls.has(link.href)) continue;
    clickedUrls.add(link.href);

    console.log(`\n${'='.repeat(80)}`);
    console.log(`CLICKING: ${link.text}`);
    console.log(`${'='.repeat(80)}\n`);

    try {
      // Klik link via JavaScript evaluate
      await page.evaluate((href) => {
        const el = document.querySelector(`a[href="${href}"]`);
        if (el) el.click();
      }, link.href);

      // Tunggu konten di-load
      await new Promise(r => setTimeout(r, 5000));

      // Scroll
      await page.evaluate(async () => {
        await new Promise((resolve) => {
          let totalHeight = 0;
          const timer = setInterval(() => {
            window.scrollBy(0, 300);
            totalHeight += 300;
            if (totalHeight >= document.body.scrollHeight) {
              clearInterval(timer);
              resolve();
            }
          }, 100);
        });
      });
      await new Promise(r => setTimeout(r, 2000));
      await page.evaluate(() => window.scrollTo(0, 0));
      await new Promise(r => setTimeout(r, 1000));

      // Extract konten panel kanan (konten utama)
      const content = await page.evaluate(() => {
        const el = document.querySelector('[class*="scroll-intersection-center"]');
        return el ? el.innerText : document.body.innerText;
      });

      console.log(content.substring(0, 10000));
      console.log('\nCurrent URL:', page.url());

    } catch(e) {
      console.log(`ERROR: ${e.message}`);
    }
  }

  await browser.close();
})();
```

### 3. Jalankan Scraper
```bash
cd /tmp && node scrape_page.js > /tmp/scrape_output.txt 2>&1
```

### 4. Baca Hasil dan Buat Dokumentasi
- Baca output dari `/tmp/scrape_output.txt` menggunakan Read tool
- Parse dan strukturkan data yang di-scrape
- Tulis dokumentasi dalam format Markdown di direktori yang ditentukan user

## Tips & Troubleshooting

### Konten tidak muncul / kosong
- **Tingkatkan wait time** setelah `page.goto()` dari 8000ms ke 12000ms atau lebih
- Pastikan `waitUntil: 'networkidle2'` digunakan (bukan `'load'` atau `'domcontentloaded'`)
- Beberapa halaman memerlukan **interaksi** (klik, hover) untuk memuat konten

### Halaman tidak bisa diakses via URL langsung (SPA routing)
- Gunakan **Template C** (sidebar click approach)
- Buka halaman overview dulu, lalu klik link di sidebar
- Konten SPA sering kali tidak bisa diakses dengan `page.goto(url)` ke sub-page

### Output terpotong
- Gunakan `page.evaluate()` untuk extract text, bukan screenshot
- Jika konten sangat panjang, split `console.log` menjadi beberapa bagian:
  ```javascript
  console.log(content.substring(0, 8000));
  console.log(content.substring(8000, 16000));
  ```

### Selectors umum untuk konten utama
Berikut selectors yang sering digunakan berdasarkan platform:
| Platform | Selector |
|----------|----------|
| TikTok Shop Partner Center | `[class*="scroll-intersection-center"]` |
| General SPA | `[class*="content"]`, `main`, `article` |
| Documentation sites | `.markdown-body`, `.doc-content` |
| Generic fallback | `document.body.innerText` |

### Menghindari rate limiting
- Tambahkan delay antar halaman: `await new Promise(r => setTimeout(r, 2000))`
- Jangan buka terlalu banyak page bersamaan
- Jika scrape 10+ halaman, pertimbangkan batch per 5 halaman

### Timeout configuration
| Situasi | Timeout |
|---------|---------|
| Halaman ringan | 30000ms (30 detik) |
| Halaman berat (banyak JS) | 60000ms (1 menit) |
| Sangat lambat / banyak gambar | 90000ms (1.5 menit) |

## Contoh Penggunaan (Riwayat)

Skill ini sudah berhasil digunakan untuk scrape:

1. **TikTok Shop Finance API** (https://partner.tiktokshop.com/docv2/page/finance-api-overview)
   - Scrape overview + 5 endpoint detail pages
   - Output: `tiktok-shop-finance-api.md`

2. **TikTok Shop Order API** (https://partner.tiktokshop.com/docv2/page/order-api-overview)
   - Scrape overview + 5 endpoint detail pages
   - Output: `tiktok_api_order.md`

3. **TikTok Shop Authorization API** (https://partner.tiktokshop.com/docv2/page/get-authorized-shops-202309)
   - Scrape overview + 2 endpoint detail pages
   - Output: `tiktok_api_authorization.md`

## Quick Reference Command

Untuk scrape halaman baru, tinggal bilang:
> "Scrape halaman [URL] dan buatkan dokumentasinya di [PATH]"

Atau gunakan template di atas dan jalankan:
```bash
cd /tmp && npm install puppeteer 2>/dev/null; node scrape_page.js > output.txt 2>&1
```
