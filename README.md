# KasFlow

Aplikasi pembukuan keuangan UMKM berbasis **Ledger-First Accounting** dengan double-entry bookkeeping otomatis.

## ✨ Fitur Utama

- **Double-Entry Bookkeeping** - Setiap transaksi otomatis menghasilkan jurnal berpasangan
- **Real-time Sync** - Data tersinkronisasi secara real-time menggunakan Supabase Realtime
- **Authentication** - Sistem autentikasi lengkap dengan Supabase Auth
- **Chart of Accounts** - Struktur akun standar Indonesia (Kas, Bank, Piutang, Hutang, Modal, Pendapatan, Beban)
- **Financial Reports** - Laporan Laba Rugi, Neraca, Arus Kas
- **Multi-period Accounting** - Dukungan periode akuntansi bulanan/tahunan
- **Period Closing** - Tutup buku dengan penguncian jurnal
- **Audit Trail** - Log aktivitas lengkap untuk setiap transaksi
- **Soft Delete & Restore** - Data tidak dihapus permanen, bisa dipulihkan
- **Dark Mode** - Tampilan gelap untuk kenyamanan mata
- **Responsive Design** - Tampilan optimal di desktop dan mobile

## 🛠️ Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Real-time**: Supabase Realtime
- **Forms**: React Hook Form + Zod

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ dan npm
- Akun Supabase (gratis)

### Instalasi

1. Clone repository
```bash
git clone <repository-url>
cd kasflow-supabase
```

2. Install dependencies
```bash
npm install
```

3. Setup Supabase Database
   - Buat project baru di [Supabase Dashboard](https://supabase.com)
   - Buka SQL Editor di Supabase Dashboard
   - Copy-paste seluruh isi file `supabase-schema.sql` ke SQL Editor
   - Klik "Run" untuk menjalankan schema

4. Konfigurasi Environment Variables
   - Buat file `.env.local` berdasarkan `.env.example`
   - Isi dengan kredensial Supabase Anda:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

5. Jalankan development server
```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) di browser.

## 📝 Penggunaan

### Registrasi & Login
- Daftar dengan email, password, dan nama bisnis
- Sistem akan otomatis membuat company profile dan data awal
- Login dengan email dan password yang sudah terdaftar

### Transaksi
- **Income**: Catat pemasukan dengan memilih kategori dan akun kas
- **Expense**: Catat pengeluaran dengan memilih kategori dan akun kas
- **Transfer**: Pindahkan uang antar akun kas/bank

### Akuntansi
- **Journal & Ledger**: Lihat semua jurnal dan buku besar
- **Chart of Accounts**: Kelola struktur akun
- **Accounting Periods**: Atur periode akuntansi dan tutup buku

### Master Data
- **Categories**: Kelola kategori transaksi (penjualan, pembelian, dll)
- **Cash Accounts**: Kelola akun kas/bank/e-wallet
- **Contacts**: Kelola customer dan supplier

### Laporan
- **Laba Rugi**: Pendapatan - Beban = Laba/Rugi
- **Neraca**: Aset = Kewajiban + Ekuitas
- **Arus Kas**: Aliran kas masuk dan keluar

### Utilitas
- **Generate Dummy Data**: Buat data contoh untuk testing
- **Seed Demo Company**: Buat perusahaan demo lengkap
- **Backup & Restore**: Export/import data dalam format JSON
- **Recycle Bin**: Pulihkan data yang sudah dihapus

## 🗄️ Database Schema

Aplikasi ini menggunakan 12 tabel utama:

1. **users** - Data user dan relasi ke company
2. **business_profiles** - Profil perusahaan
3. **accounts** - Chart of Accounts (CoA)
4. **account_categories** - Kategori transaksi
5. **cash_accounts** - Akun kas/bank/e-wallet
6. **customers** - Data customer
7. **suppliers** - Data supplier
8. **transactions** - Transaksi keuangan
9. **journal_entries** - Jurnal akuntansi (source of truth)
10. **tax_settings** - Pengaturan pajak
11. **accounting_periods** - Periode akuntansi
12. **audit_logs** - Log aktivitas

Semua tabel dilindungi dengan Row Level Security (RLS) untuk memastikan data isolation antar perusahaan.

## 🔐 Keamanan

- **Row Level Security (RLS)** - Setiap user hanya bisa mengakses data perusahaannya sendiri
- **Password Hashing** - Password di-hash menggunakan bcrypt
- **JWT Tokens** - Session management menggunakan JWT
- **Environment Variables** - Kredensial disimpan di environment variables

## 📦 Build untuk Production

```bash
npm run build
npm start
```

## 🧪 Testing

```bash
npm run lint
npm run type-check
```

## 📄 License

MIT License - lihat file [LICENSE](LICENSE) untuk detail

## 🤝 Kontribusi

Kontribusi sangat diterima! Silakan buat pull request atau buka issue untuk diskusi.

## 📧 Support

Jika ada pertanyaan atau masalah, silakan buka issue di GitHub repository.

---

**KasFlow** - Aplikasi Pembukuan UMKM Modern dengan Ledger-First Approach
