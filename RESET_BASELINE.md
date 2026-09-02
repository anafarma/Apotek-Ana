# ANA FARMA — RESET FOUNDATION

Tanggal: 2026-09-02

## Status
Repository lama V2 dibekukan sebagai referensi historis. Tidak ada modul lama yang boleh menjadi dependency runtime baru tanpa audit ulang.

## Keputusan arsitektur
- Google Spreadsheet adalah sumber data utama.
- Data operasional dapat diedit Owner langsung melalui Spreadsheet.
- Nama dan istilah yang terlihat Owner diprioritaskan dalam Bahasa Indonesia.
- Owner memiliki akses penuh dengan fokus utama KELOLA STOK.
- Pegawai/Kasir memiliki fokus utama TRANSAKSI dan bekerja berdasarkan Shift.
- Penjualan multi-satuan mendukung harga independen per satuan untuk mendorong pembelian volume.
- Barcode dan cetak belum diimplementasikan, tetapi kontrak data tidak boleh menghalangi penambahan di masa depan.
- Frontend ditargetkan offline-first dan cepat.
- Tidak ada database tambahan sebagai source of truth.

## Larangan
- Jangan membuat sheet plural/Inggris baru jika konsep yang sama sudah memiliki sheet canonical Indonesia.
- Jangan mempertahankan dependency runtime ke V2 canonical lama.
- Jangan mengubah struktur spreadsheet hanya untuk mempermudah kode.
- Jangan meminta Owner menyalin potongan kode.

## Tahap berikut
1. Membuat registry spreadsheet canonical.
2. Membuat backend Apps Script modular.
3. Membuat kontrak API.
4. Membuat autentikasi dan role.
5. Membuat Shift dan Transaksi.
6. Membuat frontend offline-first.

Dokumen ini adalah baseline pembangunan ulang.
