# PRODUCT REQUIREMENTS DOCUMENT & SYSTEM SPECIFICATION (SPEC.md)
# APLIKASI: MERACIK IDE

**Status Dokumen:** FINAL DRAFT  
**Versi:** v1.0  
**Nama Produk:** Meracik Ide (Kalkulator Modal & Penentu Harga Jual Cerdas UMKM)  
**Target Platform:** Mobile App (React Native / Expo - Android & iOS)  
**Lokasi Direktori:** `C:\Proyek\meracik-ide`  
**Tanggal:** 25 September 2026  

---

## 1. Ringkasan Produk (Overview)

### 1.1 Latar Belakang & Problem Statement
Banyak pelaku Usaha Mikro, Kecil, dan Menengah (UMKM)—khususnya yang berjualan secara langsung/offline (seperti kuliner olahan/frozen food, kerajinan tangan, kriya/fashion, dan reseller)—mengalami kesulitan dalam menentukan harga jual produk yang tepat. Masalah klasik yang sering terjadi:
1. **Modal Bocor:** Pelaku usaha lupa memasukkan biaya bumbu dapur takaran kecil, plastik kemasan, stiker label, gas/listrik, atau upah tenaga kerja ke dalam modal dasar (HPP).
2. **Fluktuasi Harga Pasar:** Harga bahan baku sering naik-turun (misal: cabai, bawang, lele, minyak, kain). Pengusaha bingung apakah harga jual mereka saat ini masih menghasilkan laba atau sudah nombok.
3. **Kesulitan Konversi Satuan:** Beli bahan dalam satuan besar (misal 1 kg kunyit seharga Rp20.000 atau 1 pack plastik seharga Rp35.000), tetapi bingung menghitung biaya riil pemakaian per bungkus lele marinasi yang hanya butuh 15 gram atau 1 lembar plastik.
4. **Perhitungan Laba yang Salah (Markup vs Margin):** Mengira untung 30% dari harga jual, padahal hanya melakukan markup 30% dari modal sehingga margin laba riilnya jauh lebih kecil dari ekspektasi.

### 1.2 Solusi: Meracik Ide
**Meracik Ide** adalah aplikasi mobile offline-first yang dirancang khusus untuk membantu pemilik UMKM meracik komposisi modal produk (Bill of Materials) secara dinamis, menguji kelayakan rencana harga jual secara dua arah, melakukan stress-test kenaikan harga bahan baku, mengonversi satuan grosir ke takaran porsi secara otomatis, serta menghasilkan struk digital (*Shareable Receipt Card*) yang siap dibagikan ke WhatsApp.

---

## 2. Tujuan & Sasaran (Goals & Non-Goals)

### 2.1 Business & Product Goals
- **Menghilangkan Risiko Jual Rugi:** Memberikan peringatan visual instan jika margin berada di bawah ambang batas aman (< 20%) atau merugi (< 0%).
- **Akurasi HPP hingga Satuan Terkecil:** Menyediakan konverter satuan gramasi dan pieces agar biaya bumbu dapur dan kemasan terhitung presisi.
- **Ketahanan Terhadap Inflasi:** Fitur simulasi lonjakan harga bahan baku (+5% s/d +30%) dalam 1 geseran tanpa perlu mengubah data master.
- **Rekomendasi Cerdas Sesuai Industri:** Memberikan saran harga standar sehat (margin 35%) dan buffer fluktuasi (margin 42%) yang sesuai untuk karakter bisnis offline.
- **Praktis & Mandiri:** 100% dapat berjalan offline tanpa kewajiban login server di awal, data tersimpan aman di perangkat pengguna.

### 2.2 Non-Goals
- Aplikasi ini bukan POS (Point of Sale) kasir lengkap dengan pencatatan inventaris stok keluar-masuk harian.
- Aplikasi ini bukan platform marketplace jual-beli barang.
- Aplikasi ini tidak memproses pembayaran digital payment gateway (hanya simulator kalkulasi finansial).

---

## 3. Target Pengguna & Persona

### Persona 1: Pak Joko (52 Tahun) — Pedagang Lele Marinasi Siap Masak (Kuliner Offline)
- **Karakteristik:** Menjual lele marinasi beku per pack 500 gram langsung ke warga perumahan dan pasar pagi. Tidak berjualan di GoFood/Shopee.
- **Pain Point:** Harga ikan lele dan bumbu (bawang putih, kunyit, jahe) sering berubah-ubah di pasar induk. Bingung menghitung biaya bumbu yang dipakai cuma beberapa gram. Ingin tahu jika menjual di harga Rp25.000/pack untungnya berapa persen.
- **Kebutuhan di Aplikasi:** Input bahan cepat, modal bumbu sachet/gram otomatis terhitung, status apakah harga Rp25.000 sudah untung aman.

### Persona 2: Rina (28 Tahun) — Pengrajin Totebag & Kriya Tekstil (Fashion & Craft)
- **Karakteristik:** Membeli kain kanvas per roll (50 meter), resleting lusinan, dan benang. Menjual langsung via WhatsApp & bazar mingguan.
- **Pain Point:** Sering ada potongan kain yang terbuang (waste susut pola 10-15%) dan lupa menghitung upah tenaga jahitnya sendiri, sehingga sering merasa uang hasil penjualan habis tidak bersisa.
- **Kebutuhan di Aplikasi:** Fitur persentase bahan terbuang (*waste rate*), alokasi biaya tenaga kerja, dan pembuatan 3 tier harga (eceran, titip toko/reseller, grosir).

---

## 4. Ruang Lingkup (Scope)

### 4.1 Termasuk (MVP - Rilis Awal)
1. **Dynamic Bill of Materials (BOM):** Input dinamis bahan baku (materials) dan biaya overhead/kemasan (packaging/operational).
2. **Kalkulator Konversi Satuan (Unit Converter Modal):** Konversi Kg ➔ Gram dan Pack/Roll ➔ Pcs/Lembar.
3. **Faktor Susut (Waste %):** Perhitungan otomatis kenaikan modal akibat bahan yang terbuang.
4. **Stress-Test Inflasi Pasar (+% Buffer):** Slider simulasi kenaikan harga bahan (+0% s/d +30%).
5. **Simulator Harga Jual 2 Arah:** Input rencana harga jual (misal Rp25.000) ➔ output laba bersih (Rp) dan margin laba (%).
6. **Margin Badge System:** Indikator visual status laba (*Rugi*, *Rawan/Tipis*, *Sehat*, *Premium*).
7. **Rekomendasi Harga Standar & Buffer:** Perhitungan harga jual otomatis dengan margin 35% dan 42%.
8. **Katalog Resep Offline (Local Storage):** Simpan, edit, dan hapus resep produk di perangkat via `AsyncStorage`.
9. **Shareable Receipt Card:** Kartu ringkasan finansial berdesain struk modern yang dapat di-capture dan dibagikan langsung ke WhatsApp.

### 4.2 Di Luar Lingkup Awal (Fase 2 / Lanjutan)
- Tier Pricing 3 Level (Eceran, Reseller, Grosir Partai) terpisah dalam printout.
- Sinkronisasi Cloud Multi-device & Backup Google Drive.
- Multi-bahasa dan Multi-mata uang.
- Perhitungan pajak PPh UMKM final 0.5%.

---

## 5. Asumsi & Batasan Teknis (Assumptions & Constraints)

1. **Stack Teknologi:** React Native dengan Expo SDK 52+, TypeScript, Tailwind CSS / React Native StyleSheet.
2. **Penyimpanan Data:** `@react-native-async-storage/async-storage` (maksimal 20 resep produk tersimpan untuk MVP lokal).
3. **Ekspor Gambar:** `react-native-view-shot` dan `expo-sharing` untuk menghasilkan struk gambar PNG dan membukanya di sheet sharing native HP.
4. **Haptic Feedback:** `expo-haptics` untuk getaran tactile responsif saat menyimpan produk atau menghitung modal.
5. **Sanitasi Input:** Semua angka dibersihkan dari karakter non-numerik, dilindungi dari `NaN`, infinity, dan nilai negatif. Batas maksimum input Rp1.000.000.000.

---

## 6. Kebutuhan Fungsional (Functional Requirements)

### 6.1 Modul Perhitungan Finansial & HPP (CALC)
| ID | Kebutuhan Fungsional | Prioritas |
| --- | --- | --- |
| **CALC-1** | Sistem dapat menghitung Total Modal Bahan Baku (`adjustedRawCost`) dengan memasukkan faktor persentase susut (`wastePercentage`) dan faktor inflasi pasar (`inflationBuffer`). | **Wajib** |
| **CALC-2** | Sistem dapat menjumlahkan biaya bahan baku dengan biaya overhead/kemasan untuk menghasilkan Total HPP per unit produk. | **Wajib** |
| **CALC-3** | Sistem dapat menghitung nominal laba bersih (`netProfit = sellingPrice - totalHPP`). | **Wajib** |
| **CALC-4** | Sistem dapat menghitung persentase margin laba riil (`marginPercent = (netProfit / sellingPrice) * 100`). | **Wajib** |
| **CALC-5** | Sistem dapat menghitung rekomendasi harga jual standar (margin target 35%) dengan pembulatan ke atas kelipatan Rp1.000 terdekat. | **Wajib** |
| **CALC-6** | Sistem dapat menghitung rekomendasi harga jual aman fluktuasi (margin target 42%) dengan pembulatan ke atas kelipatan Rp1.000 terdekat. | **Wajib** |
| **CALC-7** | Sistem menampilkan lencana indikator status margin secara real-time: Rugi (< 0%), Rawan (0 - 19.9%), Sehat (20 - 40%), dan Premium (> 40%). | **Wajib** |

### 6.2 Modul Konverter Satuan & Takaran (CONV)
| ID | Kebutuhan Fungsional | Prioritas |
| --- | --- | --- |
| **CONV-1** | Sistem menyediakan modal pop-up konverter untuk membagi harga pembelian grosir ke dalam takaran pemakaian per unit produk. | **Wajib** |
| **CONV-2** | Mode Timbangan (Berat): Menghitung biaya dari harga beli per Kg dan kapasitas Kg terhadap pemakaian dalam gram (`cost = (harga / (kapasitas * 1000)) * pemakaian_gram`). | **Wajib** |
| **CONV-3** | Mode Kemasan (Pcs/Isi): Menghitung biaya dari harga beli per pack dan total isi terhadap pemakaian dalam pcs (`cost = (harga / total_isi) * pemakaian_pcs`). | **Wajib** |
| **CONV-4** | Pengguna dapat langsung menekan tombol "Terapkan" untuk menyalin hasil hitung konversi ke dalam baris bahan baku aktif. | **Wajib** |

### 6.3 Modul Manajemen Produk & Resep (PROD)
| ID | Kebutuhan Fungsional | Prioritas |
| --- | --- | --- |
| **PROD-1** | Pengguna dapat menambahkan baris bahan baku dinamis tanpa batas dengan input: Nama Bahan dan Nilai Modal (Rp). | **Wajib** |
| **PROD-2** | Pengguna dapat menambahkan baris biaya kemasan & operasional dinamis dengan input: Nama Biaya dan Nilai Biaya (Rp). | **Wajib** |
| **PROD-3** | Pengguna dapat menghapus baris bahan baku atau overhead yang tidak diinginkan. | **Wajib** |
| **PROD-4** | Pengguna dapat menyimpan resep produk ke penyimpanan lokal perangkat dengan nama produk unik. | **Wajib** |
| **PROD-5** | Pengguna dapat melihat daftar katalog resep produk yang tersimpan di halaman utama. | **Wajib** |
| **PROD-6** | Pengguna dapat memilih produk tersimpan untuk dimuat kembali ke kalkulator dan diedit. | **Wajib** |
| **PROD-7** | Pengguna dapat menghapus produk dari katalog dengan konfirmasi proteksi. | **Wajib** |

### 6.4 Modul Berbagi & Struk Digital (SHAR)
| ID | Kebutuhan Fungsional | Prioritas |
| --- | --- | --- |
| **SHAR-1** | Sistem merender tampilan struk rapi (*Shareable Receipt Card*) yang berisi: Nama Produk, Rincian HPP, Rencana Harga Jual, Laba Bersih per Pcs, Persentase Margin, dan Rekomendasi Harga Sehat. | **Wajib** |
| **SHAR-2** | Pengguna dapat menekan tombol "Bagikan Struk ke WhatsApp" untuk meng-capture kartu struk menjadi gambar PNG dan memicu share sheet native HP. | **Wajib** |
| **SHAR-3** | Memberikan feedback haptic dan indikator loading saat proses capture gambar berlangsung. | **Penting** |

---

## 7. Desain UI/UX & Design Tokens (Sesuai Panduan Desain)

### 7.1 Design Principles
1. **Zero Financial Confusion:** Hindari istilah akuntansi yang membingungkan. Gunakan istilah ramah UMKM: "Modal Bersih", "Untung Bersih", "Harga Rekomendasi Pasar".
2. **High-Contrast Clarity:** Angka moneter dan metrik utama harus sangat jelas terbaca di layar HP dalam kondisi outdoor/pasar (kontras tajam antara teks dan latar belakang).
3. **No Hidden Formula:** Setiap angka rekomendasi selalu disertai penjelasan persentase margin yang mendasarinya (misal: "Rekomendasi Margin 35%").

### 7.2 Design Tokens
- **Palet Warna:**
  - *Primary (Brand / Dark Accent):* `#0F172A` (Slate 900) - Memberikan kesan kokoh dan elegan.
  - *Secondary / Interactive Accent:* `#2563EB` (Blue 600) & `#38BDF8` (Sky 400).
  - *Success (Profit / Sehat):* `#16A34A` (Green 600) & Background `#DCFCE7` (Green 100).
  - *Warning (Rawan / Tipis):* `#D97706` (Amber 600) & Background `#FEF3C7` (Amber 100).
  - *Danger (Rugi):* `#DC2626` (Red 600) & Background `#FEE2E2` (Red 100).
  - *Neutral Surface:*
    - Background Kanvas: `#F8FAFC` (Slate 50)
    - Card Background: `#FFFFFF` (White)
    - Border / Divider: `#E2E8F0` (Slate 200) & `#CBD5E1` (Slate 300)
    - Subtitle / Label Text: `#64748B` (Slate 500) & `#334155` (Slate 700)
- **Tipografi:** System Sans-Serif (Inter / Roboto / System Default)
  - Display / Big Price: 24pt - 28pt (FontWeight 800)
  - Page Title / Modal Title: 18pt - 20pt (FontWeight 700)
  - Section Header: 15pt - 16pt (FontWeight 700)
  - Body Text / Inputs: 13pt - 14pt (FontWeight 500 - 600)
  - Microcopy / Tag / Metadata: 10pt - 12pt (FontWeight 600 - 800)
- **Spasial & Spacing:** Grid 8px (padding: 8px, 12px, 16px, 20px).
- **Radius & Elevation:**
  - Button & Input: `BorderRadius: 8px - 10px`
  - Card & Container: `BorderRadius: 12px - 16px`
  - Bottom Sheet Modal: `TopLeft & TopRight: 20px`

### 7.3 Screen Inventory
1. **Screen 1: Katalog Produk & Resep (Home Screen)**
   - Header aplikasi "Meracik Ide" dengan tombol "+ Buat Resep Baru".
   - Daftar kartu produk tersimpan (Nama produk, harga rencana, HPP, margin).
   - Empty State jika belum ada resep yang dibuat dengan ilustrasi dan tombol aksi cepat.
2. **Screen 2: Form Input Resep & Biaya (Recipe Builder)**
   - Input Nama Produk.
   - List Komponen Bahan Baku (Tombol konversi satuan di tiap baris).
   - List Biaya Overhead & Kemasan.
   - Slider / Tombol cepat Persentase Susut Bahan (0%, 5%, 10%, 15%, 20%).
   - Slider / Tombol cepat Buffer Inflasi Pasar (0%, 5%, 10%, 15%).
3. **Screen 3: Evaluasi Finansial & Simulator Harga Jual**
   - Kartu Hitung HPP Total.
   - Input Rencana Harga Jual (hero input dengan prefix "Rp").
   - Lencana status margin otomatis (*Sehat*, *Rawan*, *Rugi*, *Premium*).
   - Kotak Rekomendasi Cerdas (Standar 35% dan Buffer 42%).
4. **Modal Component 1: Unit Converter Modal**
   - Tab pilihan: "Timbangan (Kg ➔ Gram)" vs "Kemasan (Pack ➔ Sachet/Pcs)".
   - Kolom harga beli grosir, kapasitas kemasan, dan takaran yang dipakai.
   - Preview hasil biaya secara instan sebelum diterapkan ke resep.
5. **Modal Component 2: Struk Digital & Share WA (Receipt Card)**
   - Tampilan struk nota putih bersih dengan garis putus-putus.
   - Tombol utama "Bagikan Struk ke WhatsApp" warna hijau kontras.

---

## 8. Model Data (High-Level Schema)

### 8.1 TypeScript Data Interfaces
```typescript
export type CostType = 'material' | 'overhead';

export interface CostItem {
  id: string;
  type: CostType;
  name: string;
  amount: number; // Rupiah per unit produk
}

export interface ProductCalculation {
  id: string;
  name: string;
  materials: CostItem[];
  overheads: CostItem[];
  wastePercentage: number;   // Persentase susut bahan (misal 15%)
  inflationBuffer: number;   // Persentase antisipasi kenaikan pasar (misal 10%)
  targetSellingPrice: number;// Rencana harga jual pengguna (misal 25000)
  createdAt: number;
}

export interface CalculationResult {
  rawCost: number;                  // Biaya bahan baku mentah
  adjustedRawCost: number;          // Bahan baku setelah susut & inflasi
  overheadCost: number;             // Biaya kemasan + operasional
  totalHPP: number;                 // Total modal dasar per 1 pcs
  netProfit: number;                // Nominal keuntungan bersih per pcs
  marginPercent: number;            // Persentase margin riil (%)
  recommendedStandardPrice: number; // Harga margin 35% (dibulatkan ke ribuan)
  recommendedBufferPrice: number;   // Harga margin 42% (dibulatkan ke ribuan)
}
```

### 8.2 Struktur LocalStorage
- **Key:** `@umkm_calculator_recipes_v1`
- **Tipe:** `ProductCalculation[]` (Disimpan dalam format JSON Stringified)

---

## 9. Alur Pengguna Utama (Key User Flows)

### Flow 1: Menghitung Modal Produk Baru (Happy Path)
1. Pengguna membuka aplikasi Meracik Ide, menekan tombol **"+ Buat Resep Baru"**.
2. Pengguna mengisi nama produk: *"Lele Marinasi 500g"*.
3. Pengguna menambahkan bahan baku:
   - Ikan Lele: Beli Rp24.000/kg, tekan ikon timbangan, isi 1 kg pakai 500 gram ➔ sistem mengisi Rp12.000.
   - Bumbu Marinasi Halus: Rp3.500.
4. Pengguna menambahkan overhead kemasan:
   - Plastik Klip Vacuum: Rp1.200.
   - Stiker Label Logo: Rp600.
   - Listrik Freezer: Rp500.
5. Pengguna mengatur *Susut Bahan* ke 15% (kotoran & insang lele dibuang).
6. Pengguna menekan tombol **"Lanjut ke Evaluasi Harga"**.
7. Sistem menampilkan Total HPP per bungkus (misal Rp19.200).
8. Pengguna memasukkan rencana harga jual: *Rp25.000*.
9. Sistem langsung menampilkan:
   - Keuntungan Bersih: **Rp5.800 / bungkus**
   - Margin Laba: **23.2%** (Badge: `✅ Sehat & Pas untuk Offline`)
   - Rekomendasi Standar: **Rp30.000** (Margin 35%)
10. Pengguna menekan tombol **"Simpan Resep"**. Data tersimpan di HP.

### Flow 2: Menghindari Jual Rugi (Loss Prevention)
1. Pengguna memasukkan rencana harga jual di bawah HPP (misal HPP Rp19.200, diisi harga jual Rp18.000).
2. Sistem langsung bereaksi:
   - Warna lencana berubah menjadi merah menyala: `⛔ RUGI (Harga di bawah Modal!)`.
   - Nominal laba bersih menampilkan minus `-Rp1.200`.
   - Tombol Rekomendasi memberikan highlight harga minimal yang wajib dipasang agar tidak nombok modal.

### Flow 3: Berbagi Struk Perhitungan ke Partner / WhatsApp
1. Dari hasil evaluasi, pengguna menekan kartu struk atau tombol **"Lihat Struk Rincian"**.
2. Layar membuka modal struk nota elegan.
3. Pengguna menekan tombol hijau **"Bagikan Struk ke WhatsApp"**.
4. Komponen struk di-capture menjadi file gambar PNG, dan HP otomatis membuka daftar kontak WhatsApp untuk dikirimkan.

---

## 10. Kebutuhan Non-Fungsional & Keamanan

1. **Performa:**
   - Perhitungan matematis harus instan (< 16ms / 60 FPS) tanpa ada jeda saat mengetik angka atau menggeser persentase.
2. **Offline-First:**
   - Aplikasi tidak memerlukan koneksi internet untuk melakukan seluruh kalkulasi dan penyimpanan resep.
3. **Keamanan & Validasi Input:**
   - Sanitasi ketat terhadap input harga (mencegah karakter huruf, simbol injeksi, dan angka eksponensial).
   - Pengamanan pembagian dengan nol (`divide by zero`) pada perhitungan margin jika harga jual diisi 0.
4. **Ukuran Aplikasi:**
   - Ringan dan tidak membebani memori smartphone UMKM level *entry-level* (RAM 2GB-3GB).

---

## 11. Glosarium

- **HPP (Harga Pokok Penjualan / COGS):** Seluruh biaya riil yang dikeluarkan untuk menghasilkan 1 unit produk siap jual (bahan baku + kemasan + porsi operasional).
- **Bill of Materials (BOM):** Daftar seluruh komponen bahan mentah dan overhead yang dibutuhkan untuk menyusun suatu produk.
- **Margin Laba:** Persentase keuntungan yang dihitung dari Harga Jual Akhir `((Harga Jual - Modal) / Harga Jual) * 100%`.
- **Markup:** Persentase kenaikan yang ditambahkan di atas modal dasar `((Harga Jual - Modal) / Modal) * 100%`.
- **Waste / Shrinkage Rate:** Persentase bobot atau bahan mentah yang terbuang selama proses pengolahan (pembersihan insang, pemotongan pola kain, dll).
- **Stress-Test Inflasi:** Pengujian ketahanan laba produk jika terjadi lonjakan harga belanja di pasar.

---

## 12. Checklist Eksekusi Selanjutnya (Next Implementation Steps)

1. [ ] Inisialisasi proyek React Native / Expo di `C:\Proyek\meracik-ide`.
2. [ ] Pemasangan dependensi:
   ```bash
   npx expo install @react-native-async-storage/async-storage react-native-view-shot expo-sharing expo-file-system expo-haptics
   ```
3. [ ] Penulisan implementasi lengkap ke dalam `App.tsx` sesuai spesifikasi di atas.
4. [ ] Uji coba fungsional kalkulator (konversi gramasi, persentase margin, validasi input).
5. [ ] Verifikasi ekspor struk digital WhatsApp.
