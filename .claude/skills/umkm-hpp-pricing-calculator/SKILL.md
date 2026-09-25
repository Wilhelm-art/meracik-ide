---
name: umkm-hpp-pricing-calculator
description: "Rancang, hitung, dan evaluasi struktur modal HPP (Harga Pokok Penjualan), amortisasi aset, penentuan harga jual 3-tier (Dine-in, Ojol, Reseller), kalkulator BEP harian, dan proposal kelayakan usaha untuk UMKM kuliner dan kriya. Gunakan skill ini saat user meminta membuat kalkulator modal, menghitung HPP, mengonversi takaran bahan (kg ke gram, pack ke pcs), menghitung faktor susut bahan (waste rate), penyusutan alat/mesin, stress-test inflasi pasar, analisis komisi marketplace/ojol, simulasi BEP (Break-Even Point), ekspor proposal PDF investor, atau membuat struk analisis finansial shareable ke WhatsApp. Jangan gunakan untuk akuntansi korporat skala besar atau sistem inventaris POS kasir harian."
---

# UMKM HPP & Smart Pricing Calculator Engine

Pedoman dan instruksi komprehensif langkah demi langkah untuk merancang, mengimplementasikan, dan mengaudit modul kalkulator HPP (Harga Pokok Penjualan), penyusutan aset, simulasi multi-kanal, target harian BEP, serta proposal kelayakan usaha untuk UMKM.

---

## 1. Instructions (Urutan Pengerjaan Langkah Demi Langkah)

1. **Struktur Multi-Proyek & BOM (Bill of Materials)**:
   - Sediakan manajemen multi-proyek agar pemilik UMKM dapat mengelola lebih dari 1 menu/cabang secara terisolasi via storage lokal (`AsyncStorage`).
   - Pisahkan komponen biaya ke dalam kategori:
     - `Bahan Baku Mentah`: Bahan utama yang habis diolah (dikenakan faktor susut & buffer inflasi).
     - `Overhead & Kemasan`: Plastik, standing pouch, stiker, gas/listrik, dan upah tenaga kerja langsung per porsi.
     - `Aset Peralatan & Mesin`: Peralatan tahan lama yang dialokasikan melalui amortisasi umur ekonomis.

2. **Terapkan Konverter Satuan Grosir ke Takaran Porsi**:
   - Jika bahan dibeli dalam skala grosir (Kg / Pack), gunakan formula konversi otomatis:
     - **Mode Timbangan (Berat)**:
       $$\text{Biaya Bahan} = \frac{\text{Harga Beli Grosir}}{\text{Kapasitas Beli (Kg)} \times 1000} \times \text{Pemakaian (Gram)}$$
     - **Mode Kemasan (Pcs/Isi)**:
       $$\text{Biaya Kemasan} = \frac{\text{Harga Beli Kemasan}}{\text{Total Isi Kemasan (Pcs)}} \times \text{Pemakaian (Pcs)}$$

3. **Hitung Penyesuaian Ketahanan Modal & Amortisasi Aset**:
   - Terapkan faktor susut (*Waste Rate %*) terhadap bahan mentah (default 5% - 15% untuk kuliner).
   - Terapkan buffer inflasi pasar (*Inflation %*) (+0% s/d +20%):
     $$\text{Adjusted Raw Cost} = \text{Raw Cost} \times (1 + \frac{\text{Waste \%}}{100}) \times (1 + \frac{\text{Inflation \%}}{100})$$
   - Hitung beban penyusutan alat per porsi (*Amortization per portion*):
     $$\text{Beban Alat per Porsi} = \frac{\text{Harga Beli Aset}}{\text{Umur Ekonomis (Bulan)} \times \text{Target Penjualan Bulanan (Porsi)}}$$
   - Hitung Total HPP Lengkap:
     $$\text{Total HPP} = \text{Adjusted Raw Cost} + \text{Overhead Cost} + \text{Amortization Cost}$$

4. **Kalkulasi 3-Tier Multi-Channel Smart Pricing**:
   - **Tier 1: Dine-in / Offline (Margin Sehat 35%)**:
     $$\text{Harga Standar} = \lceil \frac{\text{Total HPP}}{0.65 \times 1000} \rceil \times 1000$$
   - **Tier 2: Online Delivery / Ojol (Komisi Platform 20%)**:
     - Memastikan laba bersih yang diterima penjual tetap utuh setelah dipotong komisi platform:
       $$\text{Harga Ojol} = \lceil \frac{\text{Harga Standar}}{0.80 \times 1000} \rceil \times 1000$$
     - Perhitungan margin bersih riil setelah komisi:
       $$\text{Net Received} = \text{Harga Ojol} \times 0.80$$
       $$\text{Margin Bersih Ojol} = \frac{\text{Net Received} - \text{Total HPP}}{\text{Net Received}} \times 100\%$$
   - **Tier 3: Reseller / Grosir (Margin Efisien 20%)**:
     $$\text{Harga Reseller} = \lceil \frac{\text{Total HPP}}{0.80 \times 1000} \rceil \times 1000$$

5. **Kalkulator Target Harian & BEP (Break-Even Point) Meter**:
   - Hitung Margin Kontribusi per porsi: $\text{Margin Kontribusi} = \text{Harga Jual Offline} - \text{Total HPP}$
   - Hitung BEP Unit per Bulan:
     $$\text{BEP Bulanan} = \lceil \frac{\text{Total Beban Operasional Tetap Bulanan}}{\text{Margin Kontribusi}} \rceil$$
   - Hitung Target Minimum Harian:
     $$\text{BEP Harian} = \lceil \frac{\text{BEP Bulanan}}{30} \rceil$$
   - Berikan visual meter progres penjualan harian vs titik impas modal.

6. **Generator Proposal Kelayakan Usaha & Struk Digital**:
   - Generate dokumen PDF profesional siap cetak/kirim ke calon investor atau mitra usaha (`expo-print` & `expo-sharing`).
   - Sertakan kalkulasi ROI (Return on Investment) dan estimasi dividen bagi hasil bulanan.
   - Wajib sanitasi seluruh input teks dinamis menggunakan fungsi escaping HTML (`escapeHtml`) guna mencegah celah XSS / injection pada webview rendering PDF.

---

## 2. Rules dan Constraint (Aturan Wajib)

1. **Zero Financial Confusion**: Gunakan istilah ramah UMKM ("Modal Dasar", "Untung Bersih", "Harga Ojol (Aman Potongan)", "Titik Impas Harian"), hindari jargon akuntansi rumit.
2. **Strict Sanitization & Guard Clauses**:
   - Lindungi aplikasi dari nilai `NaN`, `Infinity`, negatif, atau pembagian dengan nol (`divide by zero`) jika harga jual diisi 0.
   - Selalu sanitize input string pada generator PDF HTML (`&`, `<`, `>`, `"`, `'`).
3. **No Heavy Native Dependencies**: Hindari ketergantungan library screenshot view-shot berat yang rentan crash antar-versi OS. Utamakan generator dokumen native vektor (PDF) dan string printer thermal yang ringan.
4. **Data Persistence & Isolation**: Simpan resep dan profil UMKM secara lokal menggunakan `AsyncStorage` dengan key yang jelas, mendukung multiple projects tanpa saling menimpa.

---

## 3. Output Format Template (Struk WhatsApp & Summary)

```
=========================================
STRUK ANALISIS HPP & HARGA JUAL UMKM
=========================================
Proyek     : [Nama Menu / Usaha]
Tanggal    : [DD/MM/YYYY]

--- RINCIAN BIAYA MODAL POKOK ---
• Bahan Mentah Riil (Susut+Inflasi) : Rp [Adjusted Raw Cost]
• Kemasan & Operasional Langsung   : Rp [Overhead Cost]
• Amortisasi Alat / Mesin          : Rp [Amortization Cost]
-----------------------------------------
TOTAL HPP / MODAL PER PORSI        : Rp [Total HPP]
-----------------------------------------
REKOMENDASI 3-TIER SMART PRICING:
1. Dine-in / Offline (Margin 35%)  : Rp [Harga Dine-in]
2. Ojol / GoFood / ShopeeFood     : Rp [Harga Ojol] (Net Margin: [X]%)
3. Reseller / Mitra Grosir         : Rp [Harga Reseller]
-----------------------------------------
ANALISIS BEP & KELAYAKAN USAHA:
• Margin Kontribusi / Porsi        : Rp [Margin Kontribusi]
• Titik Impas Harian (BEP)         : [N] Porsi / Hari
• Estimasi Laba Bersih Bulanan     : Rp [Net Profit Monthly]
=========================================
```

---

## 4. Failure Modes & Mitigasi

1. **Divide by Zero Saat Harga Jual Diisi 0**:
   - *Penyebab*: `marginPercent = (profit / sellingPrice) * 100` menghasilkan `NaN` atau `Infinity` saat `sellingPrice === 0`.
   - *Mitigasi*: Berikan guard clause `if (sellingPrice <= 0) return 0;` sebelum menghitung persentase.
2. **Double Deduction pada Komisi Ojol**:
   - *Penyebab*: Menghitung harga ojol dengan markup sederhana `HPP * 1.20`, yang menyebabkan penjual tetap nombok saat dipotong komisi 20% oleh platform.
   - *Mitigasi*: Gunakan pembagian divisor `Harga Offline / 0.80` agar penerimaan bersih pasca-potongan komisi tetap sama dengan target harga offline.
3. **HTML Injection pada PDF Export**:
   - *Penyebab*: Karakter spesial seperti `<script>` atau tag HTML pada nama produk merusak layout PDF atau mengeksekusi script.
   - *Mitigasi*: Seluruh variabel dinamis wajib melalui `escapeHtml(value)` sebelum dimasukkan ke string template HTML.
