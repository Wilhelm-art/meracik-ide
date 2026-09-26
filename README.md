# Meracik Ide 💡

[![Release](https://img.shields.io/github/v/release/Wilhelm-art/meracik-ide?label=APK%20Release&color=success&logo=android)](https://github.com/Wilhelm-art/meracik-ide/releases/latest)
[![Download APK](https://img.shields.io/badge/Download-APK%20(v1.0.0)-blue?logo=android&logoColor=white)](https://github.com/Wilhelm-art/meracik-ide/releases/download/v1.0.0/meracik-ide-v1.0.0.apk)
[![React Native](https://img.shields.io/badge/React_Native-0.86-61DAFB?logo=react&logoColor=black)](https://reactnative.dev/)
[![Expo SDK](https://img.shields.io/badge/Expo_SDK-57-black?logo=expo&logoColor=white)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/Tests-5%2F5%20Passing-brightgreen?logo=node.js&logoColor=white)](test/financial-engine.test.js)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)](LICENSE)

**Kalkulator Finansial, HPP Akurat, Smart Pricing 3-Tier, dan Generator Proposal Kelayakan Usaha untuk UMKM.**

Aplikasi mobile berbasis React Native dan Expo yang dirancang untuk mengatasi masalah mendasar pengusaha mikro dan kuliner di Indonesia: **salah hitung HPP, tekor karena potongan komisi ojek online, lupa memperhitungkan penyusutan alat, dan tidak tahu titik impas (BEP) harian usaha.**

---

## 🎯 Mengapa Meracik Ide Dibuat?

Banyak pengusaha UMKM merasa dagangannya laris tetapi uang kasnya tidak bertambah. Hal ini biasanya disebabkan oleh:
1. **Biaya Tak Terlihat:** Bahan yang terbuang saat dibersihkan (*waste rate*) dan kenaikan harga pasar (*inflation buffer*) tidak dihitung ke modal.
2. **Penyusutan Mesin/Alat Dilupakan:** Blender, wajan, oven, atau sealer rusak tanpa ada tabungan depresiasi modal pengganti.
3. **Jebakan Komisi Ojol:** Memberikan harga sama antara dine-in dengan delivery online, sehingga margin tergerus komisi 20% platform.
4. **Tidak Punya Angka BEP Harian:** Tidak tahu berapa porsi minimal yang wajib terjual per hari hanya agar usaha tidak tutup modal.

**Meracik Ide** menyederhanakan seluruh perhitungan akuntansi biaya kompleks tersebut ke dalam antarmuka mobile yang intuitif dan mudah dipahami.

---

## 🚀 Fitur Unggulan

### 1. Dynamic Bill of Materials (BOM) & Konverter Cerdas
- Pisahkan biaya bahan baku mentah vs. kemasan dan biaya operasional per porsi.
- **Konverter Takaran Instan:**
  - *Mode Timbangan:* Beli Rp 24.000 / 1 Kg ➔ Pakai 50 Gram ➔ Biaya terhitung otomatis.
  - *Mode Kemasan:* Beli Rp 30.000 / Pack (isi 50 pcs) ➔ Pakai 2 pcs ➔ Biaya terhitung otomatis.

### 2. Ketahanan Modal (Faktor Susut & Stress-Test Inflasi)
- **Waste Rate (% Susut):** Otomatis menaikkan HPP riil bahan yang mengalami penyusutan setelah dibersihkan (misal: ikan, ayam, sayur).
- **Inflation Buffer (+% Slider):** Simulasi ketahanan modal jika terjadi lonjakan harga bahan baku di pasar (+0% s/d +20%).

### 3. Amortisasi & Beban Penyusutan Alat/Mesin
- Hitung beban penyusutan alat tahan lama (contoh: mesin espresso, oven, cup sealer) berdasarkan harga beli, umur ekonomis bulanan, dan estimasi penjualan porsi bulanan.

### 4. 3-Tier Multi-Channel Smart Pricing
- **Tier 1: Dine-in / Offline:** Rekomendasi harga margin sehat 35% dan buffer 42%.
- **Tier 2: Ojek Online (GoFood / GrabFood / ShopeeFood):** Formula pembagi khusus (`Harga Offline / 0.80`) agar laba bersih yang diterima UMKM tetap utuh setelah dipotong komisi platform 20%.
- **Tier 3: Reseller / Grosir:** Penetapan harga volume khusus untuk kemitraan.

### 5. Simulator Target Harian & BEP Survival Meter
- Masukkan estimasi beban operasional tetap bulanan (sewa tempat, gaji karyawan, listrik/air).
- Aplikasi menghitung **Margin Kontribusi per Porsi** dan menentukan **Titik Impas Harian (BEP)**: berapa porsi minimal yang wajib terjual per hari agar usaha bertahan.

### 6. Generator Proposal Kelayakan Usaha (PDF Siap Cetak/Kirim)
- Ekspor dokumen analisis kelayakan usaha berformat PDF resmi langsung dari HP menggunakan `expo-print` dan `expo-sharing`.
- Dilengkapi analisis modal awal, HPP per menu, estimasi laba bulanan, simulasi bagi hasil dividen investor, dan proyeksi ROI.
- Dilengkapi perlindungan sanitasi HTML (`escapeHtml`) anti-injection.

### 7. Manajemen Multi-Proyek & Resep (Offline-First)
- Kelola beberapa cabang atau lini produk berbeda secara terisolasi.
- Penyimpanan lokal berkecepatan tinggi menggunakan `@react-native-async-storage/async-storage` tanpa ketergantungan internet.

---

## 🏗️ Arsitektur & Tech Stack

- **Framework:** [React Native 0.86](https://reactnative.dev/) with [Expo SDK 57](https://expo.dev/)
- **Bahasa:** [TypeScript 5.9](https://www.typescriptlang.org/) (Strict typing, 0 errors)
- **State & Local Persistence:** React Hooks (`useMemo`, `useCallback`, `useState`) + `@react-native-async-storage/async-storage`
- **Document Engine:** `expo-print` (Vector PDF rendering) & `expo-sharing`
- **Iconography & Styling:** `@expo/vector-icons` (Feather, Ionicons) + Modern Vanilla StyleSheet Design Tokens
- **Testing:** Custom Headless Financial Logic Test Suite (`test/financial-engine.test.js`)

---

## 🧪 Pengujian Fungsional

Seluruh rumus matematika dan algoritma finansial telah diuji secara otomatis melalui skrip pengujian fungsional tanpa ketergantungan browser:

```bash
npm run test:logic
```

**Hasil Pengujian:**
```text
✅ [Journey 1] Perhitungan HPP Riil (BOM + Susut + Inflasi + Upah + Utilitas): Rp 7879 PASSED
✅ [Journey 2] Rekomendasi 3-Tier (Eceran: Rp 8000, Ojol: Rp 10000) PASSED
✅ [Journey 3] Amortisasi Penyusutan Aset Fisik (Rp 200000/bln) PASSED
✅ [Journey 4] Ambang Batas BEP Harian (10 porsi/hari untuk tutup beban tetap) PASSED
✅ [Journey 5] Bagi Hasil Investor (30% : Rp 3000000 | Pemilik: Rp 7000000) PASSED
🎉 HASIL PENGUJIAN: 5/5 CRITICAL JOURNEYS LULUS (100% SUCCESS)
```

---

## 💻 Menjalankan Proyek Secara Lokal

### Prasyarat
- Node.js (v18 atau lebih baru)
- npm atau yarn
- Smartphone dengan aplikasi **Expo Go** terinstal (tersedia di Google Play Store & iOS App Store)

### Langkah Instalasi
```bash
# 1. Clone repositori
git clone https://github.com/Wilhelm-art/meracik-ide.git
cd meracik-ide

# 2. Pasang dependensi
npm install

# 3. Jalankan server pengembangan Expo
npm start
```

Scan QR code yang muncul di terminal menggunakan kamera ponsel atau aplikasi Expo Go.

---

## 🔒 Hak Cipta & Lisensi

Hak Cipta © 2026 **Adit Hardiansyah**. Seluruh hak dilindungi undang-undang (*All Rights Reserved*).

Kode sumber ini dipublikasikan secara terbuka di GitHub hanya untuk keperluan peninjauan portofolio dan verifikasi keahlian teknis. Dilarang keras menyalin, mendistribusikan ulang, memodifikasi, atau memperjualbelikan seluruh atau sebagian dari kode sumber ini tanpa izin tertulis dari pemilik hak cipta. Lihat berkas [LICENSE](LICENSE) untuk informasi selengkapnya.

---

**Dikembangkan oleh [Adit Hardiansyah](https://github.com/Wilhelm-art)** — *Full-Stack & Mobile Software Engineer*.
