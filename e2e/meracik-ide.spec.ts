import { test, expect } from './fixtures';

test.describe('Aplikasi Meracik Ide - End-to-End Test Suite', () => {

  // =========================================================================
  // JOURNEY 1: Happy Path - Buat Resep Baru & Hitung HPP + Laba (Lele Marinasi)
  // =========================================================================
  test('Journey 1: Happy Path - Membuat resep baru, hitung HPP, dan simpan ke katalog', async ({ cleanApp }) => {
    const page = cleanApp;

    // 1. Verifikasi halaman home terbuka dan tekan "+ Buat Baru"
    await expect(page.getByText('Katalog Resep Modal')).toBeVisible();
    await page.getByTestId('btn-start-new').click();

    // 2. Isi Nama Produk dan Persentase Susut Bahan
    await expect(page.getByText('Rincian Modal Produk')).toBeVisible();
    const inputName = page.getByTestId('input-product-name');
    await inputName.fill('Lele Marinasi Spesial 500g');

    const inputWaste = page.getByTestId('input-waste-percent');
    await inputWaste.fill('15');

    // 3. Verifikasi baris default bahan baku dan biaya kemasan terisi
    await expect(page.getByTestId('input-material-name-0')).toHaveValue('Ikan Lele Segar (500g)');
    await expect(page.getByTestId('input-material-amount-0')).toHaveValue('12000');

    // 4. Lanjut ke layar simulator harga
    await page.getByTestId('btn-next-simulator').click();
    await expect(page.getByText('Uji Harga: Lele Marinasi Spesial 500g')).toBeVisible();

    // 5. Masukkan rencana harga jual Rp 25.000
    const inputPrice = page.getByTestId('input-selling-price');
    await inputPrice.fill('25000');

    // 6. Verifikasi Metrik Keuangan dan Status Margin
    await expect(page.getByTestId('metric-total-hpp')).toBeVisible();
    await expect(page.getByTestId('metric-net-profit')).toBeVisible();
    await expect(page.getByTestId('badge-margin')).toContainText('Sehat & Pas untuk Offline');

    // 7. Simpan resep ke memori HP
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });
    await page.getByTestId('btn-save-recipe').click();

    // 8. Verifikasi kembali ke Home dan resep muncul di katalog tersimpan
    await expect(page.getByText('Katalog Resep Modal')).toBeVisible();
    await expect(page.getByText('Lele Marinasi Spesial 500g')).toBeVisible();
    await expect(page.getByText('1 / 20 Resep Tersimpan Offline')).toBeVisible();
  });

  // =========================================================================
  // JOURNEY 2: Unit Converter Modal (Bantu Hitung Satuan Takaran)
  // =========================================================================
  test('Journey 2: Unit Converter Modal - Konversi takaran kiloan ke gram', async ({ cleanApp }) => {
    const page = cleanApp;

    await page.getByTestId('btn-start-new').click();

    // Buka modal konversi pada bahan pertama (Lele)
    await page.getByTestId('btn-material-convert-0').click();
    await expect(page.getByTestId('converter-modal')).toBeVisible();
    await expect(page.getByText('Bantu Hitung Satuan Takaran')).toBeVisible();

    // Input beli lele 1 kg seharga Rp 24.000, dipakai 500 gram
    await page.getByTestId('converter-input-price').fill('24000');
    await page.getByTestId('converter-input-capacity').fill('1');
    await page.getByTestId('converter-input-usage').fill('500');

    // Verifikasi hasil preview modal adalah Rp 12.000
    await expect(page.getByTestId('converter-preview-cost')).toContainText('Rp 12.000');

    // Terapkan nilai ke baris bahan
    await page.getByTestId('converter-btn-apply').click();
    await expect(page.getByTestId('converter-modal')).not.toBeVisible();
    await expect(page.getByTestId('input-material-amount-0')).toHaveValue('12000');
  });

  // =========================================================================
  // JOURNEY 3: Failure State & Loss Prevention (Pencegahan Jual Rugi)
  // =========================================================================
  test('Journey 3: Failure State - Deteksi margin rugi dan penanganan input boundary 0', async ({ cleanApp }) => {
    const page = cleanApp;

    await page.getByTestId('btn-start-new').click();
    await page.getByTestId('input-product-name').fill('Produk Uji Rugi');
    await page.getByTestId('btn-next-simulator').click();

    // Pasang harga di bawah HPP (misal Rp 5.000 sementara modal > Rp 15.000)
    const inputPrice = page.getByTestId('input-selling-price');
    await inputPrice.fill('5000');

    // Verifikasi muncul badge peringatan RUGI berwarna merah
    const badge = page.getByTestId('badge-margin');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText('RUGI (Harga di bawah Modal!)');

    // Boundary Test: Kosongkan harga atau isi 0 (uji divide-by-zero)
    await inputPrice.fill('0');
    await expect(badge).toContainText('RUGI');
    await expect(page.getByTestId('metric-net-profit')).toBeVisible();
  });

  // =========================================================================
  // JOURNEY 4: Stress-Test Inflasi Pasar (+% Buffer)
  // =========================================================================
  test('Journey 4: Stress-Test Inflasi Pasar - Mengubah buffer fluktuasi bahan', async ({ cleanApp }) => {
    const page = cleanApp;

    await page.getByTestId('btn-start-new').click();
    await page.getByTestId('input-product-name').fill('Produk Uji Inflasi');
    await page.getByTestId('btn-next-simulator').click();

    // Ambil nilai HPP awal pada inflasi +0%
    const hppText0 = await page.getByTestId('metric-total-hpp').innerText();

    // Klik chip kenaikan pasar +30%
    await page.getByTestId('chip-inflation-30').click();

    // Verifikasi nilai HPP bertambah setelah stress-test diaktifkan
    const hppText30 = await page.getByTestId('metric-total-hpp').innerText();
    expect(hppText30).not.toEqual(hppText0);
  });

  // =========================================================================
  // JOURNEY 5: Manajemen Resep & Data Cleanup (Katalog Offline)
  // =========================================================================
  test('Journey 5: Katalog Offline - Membuka dan menghapus resep dari katalog', async ({ appPage }) => {
    const page = appPage;

    // 1. Verifikasi resep dari seeding muncul di katalog
    await expect(page.getByText('Lele Marinasi Siap Goreng 500g')).toBeVisible();

    // 2. Buka resep tersimpan
    await page.getByTestId('card-product-test-recipe-1').click();
    await expect(page.getByText('Uji Harga: Lele Marinasi Siap Goreng 500g')).toBeVisible();

    // 3. Kembali ke resep builder untuk memeriksa isinya
    await page.getByTestId('btn-edit-recipe').click();
    await expect(page.getByTestId('input-product-name')).toHaveValue('Lele Marinasi Siap Goreng 500g');

    // 4. Kembali ke Home dan hapus resep
    await page.getByText('Batal').click();
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });
    await page.getByTestId('btn-delete-product-test-recipe-1').click();

    // 5. Verifikasi Empty State muncul kembali
    await expect(page.getByText('Belum Ada Resep Tersimpan')).toBeVisible();
  });

});
