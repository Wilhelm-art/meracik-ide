import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

// ==========================================
// 1. TIPE DATA (TYPES)
// ==========================================
export type CostType = 'material' | 'overhead';

export interface CostItem {
  id: string;
  type: CostType;
  name: string;
  amount: number;
}

export interface ProductCalculation {
  id: string;
  name: string;
  materials: CostItem[];
  overheads: CostItem[];
  wastePercentage: number;
  inflationBuffer: number;
  targetSellingPrice: number;
  createdAt: number;
}

export interface CalculationResult {
  rawCost: number;
  adjustedRawCost: number;
  overheadCost: number;
  totalHPP: number;
  netProfit: number;
  marginPercent: number;
  recommendedStandardPrice: number;
  recommendedBufferPrice: number;
}

// ==========================================
// 2. UTILITAS & LOGIKA HITUNG (CALCULATIONS)
// ==========================================
const STORAGE_KEY = '@umkm_calculator_recipes_v1';
const MAX_SAVED_PRODUCTS = 20;

const sanitizeNumber = (val: unknown, max = 1_000_000_000): number => {
  if (typeof val === 'number') {
    if (isNaN(val) || !isFinite(val) || val < 0) return 0;
    return Math.min(val, max);
  }
  const cleanStr = String(val || '').replace(/[^0-9]/g, '');
  const parsed = Number(cleanStr);
  if (isNaN(parsed) || !isFinite(parsed) || parsed < 0) return 0;
  return Math.min(parsed, max);
};

const formatRupiah = (val: number | string): string => {
  const num = typeof val === 'number' ? val : Number(String(val).replace(/[^0-9]/g, ''));
  if (isNaN(num)) return '0';
  return num.toLocaleString('id-ID');
};

const calculateFinance = (
  materials: CostItem[],
  overheads: CostItem[],
  wastePercent: number,
  inflationPercent: number,
  sellingPrice: number
): CalculationResult => {
  const safeWaste = Math.min(Math.max(sanitizeNumber(wastePercent), 0), 99);
  const safeInflation = Math.min(Math.max(sanitizeNumber(inflationPercent), 0), 100);
  const safeSellingPrice = sanitizeNumber(sellingPrice);

  const rawCost = materials.reduce((acc, item) => acc + sanitizeNumber(item.amount), 0);
  const adjustedRawCost = Math.round(rawCost * (1 + safeWaste / 100) * (1 + safeInflation / 100));
  const overheadCost = overheads.reduce((acc, item) => acc + sanitizeNumber(item.amount), 0);
  const totalHPP = adjustedRawCost + overheadCost;

  const netProfit = safeSellingPrice - totalHPP;
  const marginPercent = safeSellingPrice > 0 ? (netProfit / safeSellingPrice) * 100 : 0;

  const recommendedStandardPrice = totalHPP > 0 ? Math.ceil((totalHPP / (1 - 0.35)) / 1000) * 1000 : 0;
  const recommendedBufferPrice = totalHPP > 0 ? Math.ceil((totalHPP / (1 - 0.42)) / 1000) * 1000 : 0;

  return {
    rawCost,
    adjustedRawCost,
    overheadCost,
    totalHPP,
    netProfit,
    marginPercent: Number(isFinite(marginPercent) ? marginPercent.toFixed(1) : 0),
    recommendedStandardPrice,
    recommendedBufferPrice,
  };
};

const convertUnitCost = (
  mode: 'weight' | 'packaging',
  purchasePrice: number,
  packCapacity: number,
  usageAmount: number
): number => {
  const safePrice = sanitizeNumber(purchasePrice);
  const safeCapacity = sanitizeNumber(packCapacity);
  const safeUsage = sanitizeNumber(usageAmount);

  if (safePrice <= 0 || safeCapacity <= 0 || safeUsage <= 0) return 0;

  if (mode === 'weight') {
    const costPerGram = safePrice / (safeCapacity * 1000);
    return Math.round(costPerGram * safeUsage);
  } else {
    const costPerUnit = safePrice / safeCapacity;
    return Math.round(costPerUnit * safeUsage);
  }
};

// ==========================================
// 3. KOMPONEN PENDUKUNG (UI COMPONENTS)
// ==========================================

/**
 * Margin Badge dengan palet semantik shadcn & visual dot indikator
 */
const MarginBadge: React.FC<{ margin: number }> = ({ margin }) => {
  let bg = '#DCFCE7';
  let textCol = '#15803D';
  let borderCol = '#86EFAC';
  let dotCol = '#22C55E';
  let label = 'Sehat & Pas untuk Offline';

  if (margin < 0) {
    bg = '#FEE2E2';
    textCol = '#B91C1C';
    borderCol = '#FCA5A5';
    dotCol = '#EF4444';
    label = 'RUGI (Harga di bawah Modal!)';
  } else if (margin < 20) {
    bg = '#FEF3C7';
    textCol = '#B45309';
    borderCol = '#FCD34D';
    dotCol = '#F59E0B';
    label = 'Rawan Tekor / Terlalu Tipis';
  } else if (margin > 40) {
    bg = '#DBEAFE';
    textCol = '#1D4ED8';
    borderCol = '#93C5FD';
    dotCol = '#3B82F6';
    label = 'Margin Tebal / Premium';
  }

  return (
    <View
      testID="badge-margin"
      style={[styles.badge, { backgroundColor: bg, borderColor: borderCol }]}
    >
      <View style={[styles.badgeDot, { backgroundColor: dotCol }]} />
      <Text style={[styles.badgeText, { color: textCol }]}>
        {label} ({margin}%)
      </Text>
    </View>
  );
};

/**
 * Modal Pintar Konversi Satuan & Takaran Bahan Baku
 */
const UnitConverterModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onApply: (cost: number) => void;
}> = ({ visible, onClose, onApply }) => {
  const [mode, setMode] = useState<'weight' | 'packaging'>('weight');
  const [price, setPrice] = useState('');
  const [capacity, setCapacity] = useState('1');
  const [usage, setUsage] = useState('');

  const result = convertUnitCost(
    mode,
    sanitizeNumber(price),
    sanitizeNumber(capacity),
    sanitizeNumber(usage)
  );

  const handleApply = () => {
    onApply(result);
    setPrice('');
    setUsage('');
    onClose();
  };

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View testID="converter-modal" style={styles.modalSheet}>
          <View style={styles.modalGrabber} />

          <View style={styles.modalHeaderRow}>
            <View>
              <Text style={styles.modalTitle}>Bantu Hitung Satuan Takaran</Text>
              <Text style={styles.modalSubtitle}>Hitung otomatis modal bahan sachet / gram</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <Text style={styles.modalCloseBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Segmented Tab Bar */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              testID="converter-tab-weight"
              onPress={() => setMode('weight')}
              style={[styles.tab, mode === 'weight' && styles.tabActive]}
            >
              <Text style={[styles.tabText, mode === 'weight' && styles.tabTextActive]}>
                ⚖️ Timbangan (Kg ➔ Gram)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="converter-tab-packaging"
              onPress={() => setMode('packaging')}
              style={[styles.tab, mode === 'packaging' && styles.tabActive]}
            >
              <Text style={[styles.tabText, mode === 'packaging' && styles.tabTextActive]}>
                📦 Kemasan (Pack ➔ Sachet)
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.fieldLabel}>Harga Beli Kemasan / Grosir (Rp):</Text>
          <View style={styles.inputContainer}>
            <Text style={styles.inputPrefixSmall}>Rp</Text>
            <TextInput
              testID="converter-input-price"
              keyboardType="numeric"
              placeholder="Contoh: 40000"
              placeholderTextColor="#94A3B8"
              value={price}
              onChangeText={(t) => setPrice(t.replace(/[^0-9]/g, ''))}
              style={styles.inputInner}
            />
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>
                {mode === 'weight' ? 'Kapasitas (Kg):' : 'Isi Kemasan (Pcs):'}
              </Text>
              <View style={styles.inputContainer}>
                <TextInput
                  testID="converter-input-capacity"
                  keyboardType="numeric"
                  placeholderTextColor="#94A3B8"
                  value={capacity}
                  onChangeText={(t) => setCapacity(t.replace(/[^0-9]/g, ''))}
                  style={styles.inputInner}
                />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>
                {mode === 'weight' ? 'Pakai (Gram):' : 'Pakai (Sachet/Pcs):'}
              </Text>
              <View style={styles.inputContainer}>
                <TextInput
                  testID="converter-input-usage"
                  keyboardType="numeric"
                  placeholder={mode === 'weight' ? 'Misal: 25' : 'Misal: 1'}
                  placeholderTextColor="#94A3B8"
                  value={usage}
                  onChangeText={(t) => setUsage(t.replace(/[^0-9]/g, ''))}
                  style={styles.inputInner}
                />
              </View>
            </View>
          </View>

          {/* Preview Hasil Hitung */}
          <View style={styles.previewBox}>
            <Text style={styles.previewLabel}>Biaya Modal yang Terpakai:</Text>
            <Text testID="converter-preview-cost" style={styles.previewValue}>
              Rp {formatRupiah(result)}
            </Text>
            <Text style={styles.previewSub}>
              {mode === 'weight'
                ? `Biaya per gram dihitung proporsional dari ${capacity || 0} Kg`
                : `Biaya per satuan dihitung proporsional dari ${capacity || 0} pcs`}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <TouchableOpacity testID="converter-btn-cancel" onPress={onClose} style={styles.btnModalCancel}>
              <Text style={styles.textModalCancel}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="converter-btn-apply" onPress={handleApply} style={styles.btnModalApply}>
              <Text style={styles.textModalApply}>Terapkan Nilai</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

/**
 * Kartu Struk Ringkasan Modal & Harga (Exportable ke WhatsApp)
 */
const ShareableReceiptCard: React.FC<{
  productName: string;
  totalHPP: number;
  sellingPrice: number;
  netProfit: number;
  marginPercent: number;
  recommendedPrice: number;
}> = ({ productName, totalHPP, sellingPrice, netProfit, marginPercent, recommendedPrice }) => {
  const receiptRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    let tempUri = '';

    try {
      tempUri = await captureRef(receiptRef, { format: 'png', quality: 1.0 });
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Fitur share tidak didukung pada perangkat ini');
        return;
      }
      await Sharing.shareAsync(tempUri, {
        mimeType: 'image/png',
        dialogTitle: `Ringkasan Modal ${productName}`,
      });
    } catch (err) {
      Alert.alert('Gagal', 'Tidak dapat menyiapkan gambar struk.');
    } finally {
      if (tempUri) {
        FileSystem.deleteAsync(tempUri, { idempotent: true }).catch(() => {});
      }
      setSharing(false);
    }
  };

  return (
    <View style={{ marginTop: 16 }}>
      <View ref={receiptRef} collapsable={false} style={styles.receiptContainer}>
        {/* Header Struk */}
        <View style={styles.receiptTopHeader}>
          <View style={styles.receiptBrandBadge}>
            <Text style={styles.receiptTag}>MERACIK IDE • STRUK MODAL</Text>
          </View>
          <Text style={styles.receiptDate}>{new Date().toLocaleDateString('id-ID')}</Text>
        </View>

        <Text style={styles.receiptTitle}>{productName || 'Produk UMKM'}</Text>
        <Text style={styles.receiptDesc}>Kalkulasi Akurat HPP & Simulasi Margin Keuntungan</Text>

        <View style={styles.dashedDivider} />

        {/* Baris Rincian Keuangan */}
        <View style={styles.receiptRow}>
          <Text style={styles.receiptRowLabel}>Modal Pokok (HPP) / Pcs</Text>
          <Text style={styles.receiptRowValue}>Rp {formatRupiah(totalHPP)}</Text>
        </View>
        <View style={styles.receiptRow}>
          <Text style={styles.receiptRowLabel}>Rencana Harga Jual</Text>
          <Text style={styles.receiptRowValue}>Rp {formatRupiah(sellingPrice)}</Text>
        </View>
        <View style={styles.receiptRow}>
          <Text style={styles.receiptRowLabel}>Keuntungan Bersih / Pcs</Text>
          <Text
            style={[
              styles.receiptRowValue,
              { color: netProfit >= 0 ? '#16A34A' : '#DC2626' },
            ]}
          >
            Rp {formatRupiah(netProfit)} ({marginPercent}%)
          </Text>
        </View>

        <View style={styles.dashedDivider} />

        {/* Rekomendasi Harga Sehat */}
        <View style={styles.receiptRecBox}>
          <Text style={styles.receiptRecLabel}>Rekomendasi Standar Sehat (Margin 35%):</Text>
          <Text style={styles.receiptRecValue}>Rp {formatRupiah(recommendedPrice)}</Text>
        </View>

        <Text style={styles.receiptFooter}>
          Dibuat secara otomatis dengan Aplikasi Meracik Ide • Anti Rugi UMKM
        </Text>
      </View>

      <TouchableOpacity
        testID="btn-share-whatsapp"
        disabled={sharing}
        onPress={handleShare}
        style={styles.btnShareWA}
      >
        {sharing ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.btnShareWAText}>📤 Bagikan Gambar Struk ke WhatsApp</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

// ==========================================
// 4. APLIKASI UTAMA (MAIN APP COMPONENT)
// ==========================================
export default function App() {
  const [screen, setScreen] = useState<'home' | 'builder' | 'simulator'>('home');
  const [savedProducts, setSavedProducts] = useState<ProductCalculation[]>([]);

  // State Produk Aktif
  const [productId, setProductId] = useState('');
  const [productName, setProductName] = useState('');
  const [wastePercent, setWastePercent] = useState('0');
  const [materials, setMaterials] = useState<CostItem[]>([]);
  const [overheads, setOverheads] = useState<CostItem[]>([]);
  const [sellingPrice, setSellingPrice] = useState('25000');
  const [inflationBuffer, setInflationBuffer] = useState(0);

  // State Modal Konverter
  const [converterVisible, setConverterVisible] = useState(false);
  const [activeMaterialIdx, setActiveMaterialIdx] = useState<number | null>(null);

  // Load resep dari storage lokal saat app dibuka
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setSavedProducts(parsed);
          } else {
            setSavedProducts([]);
          }
        }
      } catch (e) {
        setSavedProducts([]);
      }
    })();
  }, []);

  // Simpan resep ke AsyncStorage
  const persistProducts = async (newList: ProductCalculation[]) => {
    try {
      setSavedProducts(newList);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newList));
    } catch (e) {
      Alert.alert('Gagal', 'Penyimpanan lokal penuh atau bermasalah.');
    }
  };

  // Navigasi ke Form Baru
  const handleStartNew = () => {
    setProductId(Date.now().toString());
    setProductName('');
    setWastePercent('0');
    setMaterials([
      { id: '1', type: 'material', name: 'Ikan Lele Segar (500g)', amount: 12000 },
      { id: '2', type: 'material', name: 'Bumbu Marinasi Bawang/Kunyit', amount: 3000 },
    ]);
    setOverheads([
      { id: '3', type: 'overhead', name: 'Plastik Vacuum + Stiker', amount: 1500 },
      { id: '4', type: 'overhead', name: 'Alokasi Gas / Listrik', amount: 1000 },
    ]);
    setSellingPrice('25000');
    setInflationBuffer(0);
    setScreen('builder');
  };

  // Membuka resep tersimpan
  const handleOpenProduct = (p: ProductCalculation) => {
    setProductId(p.id);
    setProductName(p.name);
    setWastePercent(p.wastePercentage.toString());
    setMaterials(p.materials);
    setOverheads(p.overheads);
    setSellingPrice(p.targetSellingPrice.toString());
    setInflationBuffer(p.inflationBuffer || 0);
    setScreen('simulator');
  };

  // Hapus resep
  const handleDeleteProduct = (id: string) => {
    Alert.alert('Hapus Resep', 'Yakin ingin menghapus resep ini?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: () => {
          const filtered = savedProducts.filter((item) => item.id !== id);
          persistProducts(filtered);
        },
      },
    ]);
  };

  // Perhitungan Keuangan Real-Time
  const finance = calculateFinance(
    materials,
    overheads,
    Number(wastePercent) || 0,
    inflationBuffer,
    Number(sellingPrice) || 0
  );

  // Trigger getaran saat margin bahaya
  useEffect(() => {
    if (screen === 'simulator') {
      if (finance.marginPercent > 0 && finance.marginPercent < 20) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else if (finance.netProfit < 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }
  }, [finance.marginPercent, finance.netProfit, screen]);

  // Simpan Resep
  const handleSaveRecipe = () => {
    if (!productName.trim()) {
      Alert.alert('Nama Wajib Diisi', 'Silakan beri nama produk ini.');
      return;
    }

    const payload: ProductCalculation = {
      id: productId || Date.now().toString(),
      name: productName.trim().slice(0, 80),
      materials: materials.slice(0, 50),
      overheads: overheads.slice(0, 20),
      wastePercentage: Number(wastePercent) || 0,
      inflationBuffer,
      targetSellingPrice: Number(sellingPrice) || 0,
      createdAt: Date.now(),
    };

    const exists = savedProducts.some((p) => p.id === payload.id);
    if (!exists && savedProducts.length >= MAX_SAVED_PRODUCTS) {
      Alert.alert('Batas Kuota', `Maksimal ${MAX_SAVED_PRODUCTS} resep telah tercapai.`);
      return;
    }

    const updated = exists
      ? savedProducts.map((p) => (p.id === payload.id ? payload : p))
      : [payload, ...savedProducts];

    persistProducts(updated);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Sukses Tersimpan', `Resep "${payload.name}" berhasil disimpan offline.`, [
      { text: 'OK', onPress: () => setScreen('home') },
    ]);
  };

  return (
    <View style={styles.safeArea}>
      <StatusBar style="dark" backgroundColor="#F8FAFC" />

      {/* Top Brand Bar */}
      <View style={styles.brandNavbar}>
        <View style={styles.brandLogoRow}>
          <View style={styles.brandIconBox}>
            <Text style={styles.brandIconText}>💡</Text>
          </View>
          <View>
            <Text style={styles.brandTitle}>Meracik Ide</Text>
            <Text style={styles.brandTagline}>Kalkulator Modal & Smart Pricing UMKM</Text>
          </View>
        </View>
      </View>

      {/* ================= LAYAR 1: HOME ================= */}
      {screen === 'home' && (
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.pageTitle}>Katalog Resep Modal</Text>
              <Text style={styles.pageSubtitle}>
                {savedProducts.length} / {MAX_SAVED_PRODUCTS} Resep Tersimpan Offline
              </Text>
            </View>
            <TouchableOpacity testID="btn-start-new" onPress={handleStartNew} style={styles.btnPrimarySmall}>
              <Text style={styles.btnPrimarySmallText}>✨ + Buat Baru</Text>
            </TouchableOpacity>
          </View>

          {savedProducts.length === 0 ? (
            <View style={styles.centerBox}>
              <View style={styles.emptyIconCircle}>
                <Text style={styles.emptyIconEmoji}>📋</Text>
              </View>
              <Text style={styles.emptyTitle}>Belum Ada Resep Tersimpan</Text>
              <Text style={styles.emptyDesc}>
                Mulai hitung HPP produk lele marinasi, kerajinan, atau jualan Anda agar tidak tekor saat pasang harga.
              </Text>
              <TouchableOpacity testID="empty-btn-start" onPress={handleStartNew} style={styles.btnLarge}>
                <Text style={styles.btnLargeText}>+ Mulai Hitung Modal Sekarang</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={savedProducts}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: 40 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  testID={`card-product-${item.id}`}
                  onPress={() => handleOpenProduct(item)}
                  style={styles.productCard}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.productName}>{item.name}</Text>
                    <View style={styles.productBadgeRow}>
                      <View style={styles.productPricePill}>
                        <Text style={styles.productPriceText}>
                          Rp {formatRupiah(item.targetSellingPrice)}
                        </Text>
                      </View>
                      <Text style={styles.productMeta}>
                        📦 {item.materials.length} Bahan • 🏷️ {item.overheads.length} Biaya
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    testID={`btn-delete-product-${item.id}`}
                    onPress={() => handleDeleteProduct(item.id)}
                    style={styles.btnDeleteTag}
                  >
                    <Text style={styles.btnDeleteTagText}>Hapus</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      )}

      {/* ================= LAYAR 2: RECIPE BUILDER ================= */}
      {screen === 'builder' && (
        <View style={styles.container}>
          <ScrollView contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
            <View style={{ marginBottom: 14 }}>
              <Text style={styles.pageTitle}>Rincian Modal Produk</Text>
              <Text style={styles.pageSubtitle}>Catat bahan mentah, takaran, dan biaya operasional</Text>
            </View>

            {/* Field Nama Produk */}
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Nama Produk:</Text>
              <TextInput
                testID="input-product-name"
                maxLength={80}
                placeholder="Misal: Lele Marinasi Spesial 500g"
                placeholderTextColor="#94A3B8"
                value={productName}
                onChangeText={setProductName}
                style={styles.input}
              />
            </View>

            {/* Field Susut Bahan */}
            <View style={styles.formGroup}>
              <View style={styles.labelWithHintRow}>
                <Text style={styles.fieldLabel}>Persentase Susut Bahan Mentah (%):</Text>
                <Text style={styles.labelHintText}>Insang, jeroan, tulang terbuang</Text>
              </View>
              <TextInput
                testID="input-waste-percent"
                keyboardType="numeric"
                maxLength={2}
                placeholder="Misal: 15 (ikan dibersihkan susut 15%)"
                placeholderTextColor="#94A3B8"
                value={wastePercent}
                onChangeText={(t) => setWastePercent(t.replace(/[^0-9]/g, ''))}
                style={styles.input}
              />
            </View>

            {/* Komponen Bahan Baku */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionRow}>
                <View>
                  <Text style={styles.sectionTitle}>Komponen Bahan Baku</Text>
                  <Text style={styles.sectionSubtitle}>{materials.length} Bahan Terdaftar</Text>
                </View>
                <TouchableOpacity
                  testID="btn-add-material"
                  onPress={() =>
                    setMaterials([
                      ...materials,
                      { id: Date.now().toString(), type: 'material', name: '', amount: 0 },
                    ])
                  }
                  style={styles.btnSectionAction}
                >
                  <Text style={styles.btnSectionActionText}>+ Tambah Bahan</Text>
                </TouchableOpacity>
              </View>

              {materials.map((item, idx) => (
                <View key={item.id} style={styles.dynamicRow}>
                  <TextInput
                    testID={`input-material-name-${idx}`}
                    maxLength={60}
                    placeholder="Nama Bahan (Bawang/Lele)"
                    placeholderTextColor="#94A3B8"
                    value={item.name}
                    onChangeText={(t) => {
                      const u = [...materials];
                      u[idx].name = t;
                      setMaterials(u);
                    }}
                    style={[styles.input, { flex: 2, marginBottom: 0, marginRight: 6 }]}
                  />
                  <TextInput
                    testID={`input-material-amount-${idx}`}
                    keyboardType="numeric"
                    maxLength={12}
                    placeholder="Biaya (Rp)"
                    placeholderTextColor="#94A3B8"
                    value={item.amount ? item.amount.toString() : ''}
                    onChangeText={(t) => {
                      const u = [...materials];
                      u[idx].amount = sanitizeNumber(Number(t.replace(/[^0-9]/g, '')));
                      setMaterials(u);
                    }}
                    style={[styles.input, { flex: 1.4, marginBottom: 0, marginRight: 6 }]}
                  />
                  <TouchableOpacity
                    testID={`btn-material-convert-${idx}`}
                    onPress={() => {
                      setActiveMaterialIdx(idx);
                      setConverterVisible(true);
                    }}
                    style={styles.btnConverterIcon}
                  >
                    <Text style={{ fontSize: 16 }}>⚖️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID={`btn-material-delete-${idx}`}
                    onPress={() => setMaterials(materials.filter((_, i) => i !== idx))}
                    style={styles.btnRowDelete}
                  >
                    <Text style={styles.btnRowDeleteText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            {/* Kemasan & Overhead */}
            <View style={[styles.sectionCard, { marginTop: 14 }]}>
              <View style={styles.sectionRow}>
                <View>
                  <Text style={styles.sectionTitle}>Kemasan & Operasional</Text>
                  <Text style={styles.sectionSubtitle}>{overheads.length} Biaya Tambahan</Text>
                </View>
                <TouchableOpacity
                  testID="btn-add-overhead"
                  onPress={() =>
                    setOverheads([
                      ...overheads,
                      { id: Date.now().toString(), type: 'overhead', name: '', amount: 0 },
                    ])
                  }
                  style={styles.btnSectionAction}
                >
                  <Text style={styles.btnSectionActionText}>+ Tambah Biaya</Text>
                </TouchableOpacity>
              </View>

              {overheads.map((item, idx) => (
                <View key={item.id} style={styles.dynamicRow}>
                  <TextInput
                    testID={`input-overhead-name-${idx}`}
                    maxLength={60}
                    placeholder="Kemasan / Stiker / Gas / Listrik"
                    placeholderTextColor="#94A3B8"
                    value={item.name}
                    onChangeText={(t) => {
                      const u = [...overheads];
                      u[idx].name = t;
                      setOverheads(u);
                    }}
                    style={[styles.input, { flex: 2, marginBottom: 0, marginRight: 6 }]}
                  />
                  <TextInput
                    testID={`input-overhead-amount-${idx}`}
                    keyboardType="numeric"
                    maxLength={12}
                    placeholder="Biaya (Rp)"
                    placeholderTextColor="#94A3B8"
                    value={item.amount ? item.amount.toString() : ''}
                    onChangeText={(t) => {
                      const u = [...overheads];
                      u[idx].amount = sanitizeNumber(Number(t.replace(/[^0-9]/g, '')));
                      setOverheads(u);
                    }}
                    style={[styles.input, { flex: 1.4, marginBottom: 0, marginRight: 6 }]}
                  />
                  <TouchableOpacity
                    testID={`btn-overhead-delete-${idx}`}
                    onPress={() => setOverheads(overheads.filter((_, i) => i !== idx))}
                    style={styles.btnRowDelete}
                  >
                    <Text style={styles.btnRowDeleteText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Sticky Bottom Actions */}
          <View style={styles.footerSticky}>
            <TouchableOpacity onPress={() => setScreen('home')} style={styles.btnFooterCancel}>
              <Text style={styles.textFooterCancel}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="btn-next-simulator"
              onPress={() => {
                if (!productName.trim()) {
                  Alert.alert('Nama Wajib Diisi', 'Silakan isi nama produk terlebih dahulu.');
                  return;
                }
                setScreen('simulator');
              }}
              style={styles.btnFooterNext}
            >
              <Text style={styles.textFooterNext}>Lanjut: Uji Harga ➔</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ================= LAYAR 3: PRICE SIMULATOR ================= */}
      {screen === 'simulator' && (
        <View style={styles.container}>
          <ScrollView contentContainerStyle={{ paddingBottom: 50 }} showsVerticalScrollIndicator={false}>
            {/* Header Simulator */}
            <View style={styles.headerRow}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={styles.pageTitle} numberOfLines={1}>
                  Uji Harga: {productName}
                </Text>
                <Text style={styles.pageSubtitle}>Simulasi margin keuntungan & stress-test inflasi</Text>
              </View>
              <TouchableOpacity
                testID="btn-edit-recipe"
                onPress={() => setScreen('builder')}
                style={styles.btnEditOutline}
              >
                <Text style={styles.btnEditOutlineText}>✏️ Edit Resep</Text>
              </TouchableOpacity>
            </View>

            {/* Stress Test Pasar (Inflasi) */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardLabel}>Pasar lagi naik harga? (Stress-Test Bahan):</Text>
                <Text style={styles.cardHelperBadge}>Buffer Fluktuasi</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                {[0, 10, 20, 30].map((rate) => (
                  <TouchableOpacity
                    testID={`chip-inflation-${rate}`}
                    key={rate}
                    onPress={() => setInflationBuffer(rate)}
                    style={[styles.chip, inflationBuffer === rate && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, inflationBuffer === rate && styles.chipTextActive]}>
                      +{rate}%
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Input Harga Jual Rencana (Hero Card) */}
            <View style={styles.heroCard}>
              <Text style={styles.heroCardLabel}>Rencana Harga Jual Anda:</Text>
              <View style={styles.heroPriceInputRow}>
                <View style={styles.heroCurrencyPill}>
                  <Text style={styles.heroCurrencyText}>Rp</Text>
                </View>
                <TextInput
                  testID="input-selling-price"
                  keyboardType="numeric"
                  maxLength={12}
                  value={sellingPrice}
                  onChangeText={(t) => setSellingPrice(t.replace(/[^0-9]/g, ''))}
                  style={styles.inputHeroPrice}
                />
              </View>
              <Text style={styles.heroCardHint}>Ketik harga rencana untuk melihat langsung margin laba</Text>
            </View>

            {/* Box Hasil Keuangan (Fintech Slate Dashboard) */}
            <View style={styles.fintechCard}>
              <View style={styles.fintechHeaderRow}>
                <Text style={styles.fintechBadge}>ANALISIS KEUANGAN RIIL</Text>
                <Text style={styles.fintechDot}>● LIVE</Text>
              </View>

              <View style={styles.fintechMetricRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.metricLabelLight}>Total Modal Riil (HPP):</Text>
                  <Text testID="metric-total-hpp" style={styles.metricValWhite}>
                    Rp {formatRupiah(finance.totalHPP)}
                  </Text>
                </View>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={styles.metricLabelLight}>Keuntungan Bersih:</Text>
                  <Text
                    testID="metric-net-profit"
                    style={[
                      styles.metricValWhite,
                      { color: finance.netProfit >= 0 ? '#4ADE80' : '#F87171' },
                    ]}
                  >
                    Rp {formatRupiah(finance.netProfit)}
                  </Text>
                </View>
              </View>

              {/* Status Margin Badge */}
              <View style={{ marginTop: 10 }}>
                <MarginBadge margin={finance.marginPercent} />
              </View>

              <View style={styles.darkDivider} />

              {/* Rekomendasi Harga Sehat Box */}
              <View style={styles.recPriceCardInside}>
                <View>
                  <Text style={styles.recPriceLabelLight}>Rekomendasi Standar Sehat (Margin 35%):</Text>
                  <Text testID="metric-recommended-price" style={styles.recPriceVal}>
                    Rp {formatRupiah(finance.recommendedStandardPrice)}
                  </Text>
                </View>
                <View style={styles.recCheckPill}>
                  <Text style={styles.recCheckText}>🛡️ Aman</Text>
                </View>
              </View>
            </View>

            {/* Tombol Simpan Resep */}
            <TouchableOpacity testID="btn-save-recipe" onPress={handleSaveRecipe} style={styles.btnSaveRecipe}>
              <Text style={styles.btnSaveRecipeText}>💾 Simpan Resep ke Memori HP</Text>
            </TouchableOpacity>

            {/* Kartu Struk WhatsApp */}
            <ShareableReceiptCard
              productName={productName}
              totalHPP={finance.totalHPP}
              sellingPrice={Number(sellingPrice) || 0}
              netProfit={finance.netProfit}
              marginPercent={finance.marginPercent}
              recommendedPrice={finance.recommendedStandardPrice}
            />
          </ScrollView>
        </View>
      )}

      {/* Modal Converter */}
      <UnitConverterModal
        visible={converterVisible}
        onClose={() => {
          setConverterVisible(false);
          setActiveMaterialIdx(null);
        }}
        onApply={(calculatedCost) => {
          if (activeMaterialIdx !== null) {
            const u = [...materials];
            u[activeMaterialIdx].amount = calculatedCost;
            setMaterials(u);
          }
        }}
      />
    </View>
  );
}

// ==========================================
// 5. STYLESHEET LENGKAP (SHADCN DESIGN TOKENS)
// ==========================================
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  brandNavbar: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 42,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  brandLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  brandIconText: {
    fontSize: 20,
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  brandTagline: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  pageSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  btnPrimarySmall: {
    backgroundColor: '#0F172A',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  btnPrimarySmallText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginTop: 30,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyIconEmoji: {
    fontSize: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 22,
  },
  btnLarge: {
    backgroundColor: '#0F172A',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  btnLargeText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  productBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  productPricePill: {
    backgroundColor: '#DCFCE7',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  productPriceText: {
    fontSize: 12,
    color: '#15803D',
    fontWeight: '700',
  },
  productMeta: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  btnDeleteTag: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  btnDeleteTagText: {
    color: '#DC2626',
    fontSize: 11,
    fontWeight: '700',
  },
  formGroup: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  labelWithHintRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  labelHintText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  inputPrefixSmall: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
    marginRight: 6,
  },
  inputInner: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  btnSectionAction: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  btnSectionActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  dynamicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  btnConverterIcon: {
    padding: 9,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    marginRight: 6,
  },
  btnRowDelete: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  btnRowDeleteText: {
    color: '#94A3B8',
    fontWeight: '700',
    fontSize: 13,
  },
  footerSticky: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
  },
  btnFooterCancel: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnFooterNext: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  textFooterCancel: {
    fontWeight: '600',
    color: '#475569',
    fontSize: 13,
  },
  textFooterNext: {
    fontWeight: '700',
    color: '#FFFFFF',
    fontSize: 14,
  },
  btnEditOutline: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  btnEditOutlineText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  cardHelperBadge: {
    fontSize: 10,
    color: '#64748B',
    backgroundColor: '#F1F5F9',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    fontWeight: '600',
  },
  chip: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  heroCardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroPriceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
  },
  heroCurrencyPill: {
    backgroundColor: '#E2E8F0',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginRight: 10,
  },
  heroCurrencyText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#334155',
  },
  inputHeroPrice: {
    flex: 1,
    fontSize: 26,
    fontWeight: '900',
    color: '#0F172A',
    paddingVertical: 8,
  },
  heroCardHint: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 6,
  },
  fintechCard: {
    backgroundColor: '#0F172A',
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 4,
  },
  fintechHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  fintechBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1,
  },
  fintechDot: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4ADE80',
  },
  fintechMetricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricLabelLight: {
    fontSize: 11,
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricValWhite: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
    letterSpacing: -0.3,
  },
  darkDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 12,
  },
  recPriceCardInside: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
    padding: 12,
    borderRadius: 10,
  },
  recPriceLabelLight: {
    fontSize: 11,
    color: '#7DD3FC',
    fontWeight: '600',
  },
  recPriceVal: {
    fontSize: 18,
    fontWeight: '900',
    color: '#38BDF8',
    marginTop: 2,
  },
  recCheckPill: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  recCheckText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38BDF8',
  },
  btnSaveRecipe: {
    backgroundColor: '#0F172A',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 2,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  btnSaveRecipeText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  modalGrabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseBtnText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '700',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 4,
    marginBottom: 14,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#0F172A',
    fontWeight: '700',
  },
  previewBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 10,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#15803D',
  },
  previewValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#16A34A',
    marginTop: 2,
  },
  previewSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },
  btnModalCancel: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnModalApply: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textModalCancel: {
    fontWeight: '600',
    color: '#475569',
    fontSize: 13,
  },
  textModalApply: {
    fontWeight: '700',
    color: '#FFFFFF',
    fontSize: 14,
  },
  receiptContainer: {
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  receiptTopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  receiptBrandBadge: {
    backgroundColor: '#EFF6FF',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  receiptTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2563EB',
    letterSpacing: 0.8,
  },
  receiptDate: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  receiptTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  receiptDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  dashedDivider: {
    height: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    marginVertical: 12,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  receiptRowLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  receiptRowValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  receiptRecBox: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  receiptRecLabel: {
    fontSize: 11,
    color: '#0369A1',
    fontWeight: '600',
  },
  receiptRecValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0284C7',
    marginTop: 2,
  },
  receiptFooter: {
    fontSize: 10,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 8,
  },
  btnShareWA: {
    backgroundColor: '#25D366',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#25D366',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  btnShareWAText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
});