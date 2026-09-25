# Meracik Ide 💡
**Kalkulator Modal & Penentu Harga Jual Cerdas untuk UMKM**

Aplikasi mobile berbasis React Native (Expo) yang dirancang khusus untuk membantu pemilik bisnis dan UMKM (kuliner olahan, frozen food, fashion/kriya, kerajinan tangan, reseller, dll.) dalam menghitung HPP (Harga Pokok Penjualan) secara akurat, mengonversi satuan takaran pemakaian, mengantisipasi kenaikan harga pasar, dan menentukan harga jual yang menguntungkan tanpa risiko nombok modal.

---

## 🚀 Fitur Utama

1. **Dynamic Bill of Materials (BOM):**
   - Tambah komponen bahan baku mentah dan biaya kemasan/operasional secara dinamis.
   - Hapus komponen dengan cepat.
2. **Bantu Hitung Satuan (Unit Converter Pop-up):**
   - Mode Timbangan: Harga beli per Kg ➔ Takaran pakai per Gram.
   - Mode Kemasan: Harga beli per Pack ➔ Takaran pakai per Pcs/Sachet.
3. **Faktor Susut (*Waste/Shrinkage %*):**
   - Menghitung otomatis kenaikan modal akibat bahan mentah yang terbuang (pembersihan insang/kotoran, sisa perca kain, dll.).
4. **Stress-Test Inflasi Pasar (+% Buffer):**
   - Slider simulasi kenaikan harga pasar dari supplier (+5% s/d +30%) secara instan tanpa merombak resep.
5. **Simulator Rencana Harga Jual 2 Arah:**
   - Input rencana harga jual (misal Rp25.000) ➔ Menghitung nominal laba bersih dan persentase margin secara real-time.
6. **Margin Badge Status:**
   - `⛔ RUGI` (Margin < 0%)
   - `⚠️ Rawan Tekor / Terlalu Tipis` (Margin < 20%)
   - `✅ Sehat & Pas untuk Offline` (Margin 20% - 40%)
   - `🌟 Margin Tebal / Premium` (Margin > 40%)
7. **Rekomendasi Harga Cerdas:**
   - Rekomendasi Standar Sehat (Margin 35%).
   - Rekomendasi Buffer Fluktuasi (Margin 42%).
8. **Struk Digital & Share ke WhatsApp:**
   - Render nota rincian modal dan harga dalam format struk rapi (*Shareable Receipt Card*).
   - Tombol capture gambar otomatis memicu share sheet WhatsApp di smartphone.
9. **Penyimpanan Resep Lokal (Offline-First):**
   - Simpan hingga 20 resep produk di perangkat menggunakan `AsyncStorage`.
   - Dapat dibuka dan diedit kembali sewaktu-waktu tanpa koneksi internet.

---

## 🛠️ Cara Menjalankan Aplikasi

Pastikan Anda berada di direktori proyek:
```bash
cd C:\Proyek\meracik-ide
```

Jalankan Expo development server:
```bash
npm start
```

### Opsi Preview:
- **Di Smartphone (Android / iOS):**
  - Pasang aplikasi **Expo Go** dari Google Play Store atau App Store.
  - Scan QR Code yang muncul di terminal menggunakan kamera HP / Expo Go.
- **Di Emulator Android:**
  - Tekan tombol `a` di terminal.
- **Di Web Browser:**
  - Tekan tombol `w` di terminal.

---

## 📁 Struktur File

- [App.tsx](file:///C:/Proyek/meracik-ide/App.tsx) — Seluruh kode aplikasi (tipe data, logika perhitungan, komponen UI, modal konverter, struk, dan styles).
- [SPEC.md](file:///C:/Proyek/meracik-ide/SPEC.md) — Dokumen spesifikasi lengkap & PRD.
- [package.json](file:///C:/Proyek/meracik-ide/package.json) — Konfigurasi dependensi project Expo.
- [app.json](file:///C:/Proyek/meracik-ide/app.json) — Metadata & konfigurasi aplikasi.
