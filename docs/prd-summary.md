# PRD Summary - KasFlow

Source document: `KasFlow - Product Requirements Document.md` (file Word/docx dengan ekstensi `.md`).

KasFlow adalah aplikasi akuntansi UMKM Indonesia dengan teknologi Next.js 15 + Firebase. Core architecture adalah **Ledger First Accounting System**, di mana semua laporan dihasilkan dari jurnal.

Main modules:

1. Dashboard
2. Transaksi
3. Akuntansi
4. Master Data
5. Laporan
6. Pajak
7. Utilitas
8. Pengaturan

Key requirements:

- Mencatat uang masuk/keluar dan transfer antar akun kas.
- Membuat jurnal otomatis.
- Menyediakan COA default.
- Menghasilkan laporan keuangan dari jurnal.
- Pajak dinamis tanpa hardcoded rule.
- Accounting period, month-end closing, opening balance.
- Onboarding wizard.
- Dummy data generator, demo company seed, reset data.
- Audit log, recycle bin, backup/restore.
- Firebase security: user hanya bisa akses data company sendiri.
