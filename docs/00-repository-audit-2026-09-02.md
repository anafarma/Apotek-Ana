# Repository Audit — 2026-09-02

## Hasil inspeksi
Repository `anafarma/Apotek-Ana` memiliki sejarah implementasi V2 yang berfokus pada model canonical berbahasa Inggris/plural dan migrasi legacy.

Contoh konsep yang terdokumentasi:
- Products
- ProductUnits
- ProductPrices
- StockBalance
- StockLedger
- Sales
- SaleItems
- Payments

Arah ini tidak lagi menjadi runtime target karena keputusan proyek terbaru menetapkan Spreadsheet operasional yang dapat dipahami dan diedit Owner sebagai acuan utama.

## Temuan penting
1. README masih mendeskripsikan V2 Foundation.
2. Dokumentasi migrasi masih mengarahkan operator untuk menyalin file Apps Script secara manual.
3. Status historis menyatakan V2 belum siap production cutover.
4. Riwayat commit menunjukkan banyak eksperimen/revert/hardening pada boundary V2.
5. Repository memiliki branch eksperimen dan foundation sebelumnya.

## Keputusan
Kode/dokumen V2 diperlakukan sebagai referensi historis, bukan fondasi runtime baru.

## Branch rebuild
`foundation/reset-2026-09-02`

Semua implementasi baru harus:
- tidak bergantung pada model plural V2,
- menggunakan registry nama sheet canonical,
- mendukung Spreadsheet sebagai source of truth,
- memisahkan Owner dan Pegawai,
- mendukung harga independen per satuan jual,
- siap offline-first di frontend.

## Status
AUDIT FONDASI: SELESAI
REBUILD CORE: DIMULAI
