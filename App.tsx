import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView,
  StatusBar,
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
// 3. KOMPONEN PENDUKUNG (COMPONENTS)
// ==========================================
const MarginBadge: React.FC<{ margin: number }> = ({ margin }) => {
  let bg = '#DCFCE7';
  let textCol = '#16A34A';
  let label = '✅ Sehat & Pas untuk Offline';

  if (margin < 0) {
    bg = '#FEE2E2';
    textCol = '#DC2626';
    label = '⛔ RUGI (Harga di bawah Modal!)';
  } else if (margin < 20) {
    bg = '#FEF3C7';
    textCol = '#D97706';
    label = '⚠️ Rawan Tekor / Terlalu Tipis';
  } else if (margin > 40) {
    bg = '#DBEAFE';
    textCol = '#2563EB';
    label = '🌟 Margin Tebal / Premium';
  }

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: textCol }]}>
        {label} ({margin}%)
      </Text>
    </View>
  );
};

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
        <View style={styles.modalSheet}>
          <Text style={styles.modalTitle}>Bantu Hitung Satuan Takaran</Text>
          <Text style={styles.modalSubtitle}>Hitung otomatis modal bahan sachet / gram</Text>

          <View style={styles.tabContainer}>
            <TouchableOpacity
              onPress={() => setMode('weight')}
              style={[styles.tab, mode === 'weight' && styles.tabActive]}
            >
              <Text style={[styles.tabText, mode === 'weight' && styles.tabTextActive]}>
                Timbangan (Kg ➔ Gram)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setMode('packaging')}
              style={[styles.tab, mode === 'packaging' && styles.tabActive]}
            >
              <Text style={[styles.tabText, mode === 'packaging' && styles.tabTextActive]}>
                Kemasan (Pack ➔ Sachet)
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.fieldLabel}>Harga Beli Kemasan / Grosir (Rp):</Text>
          <TextInput
            keyboardType="numeric"
            placeholder="Contoh: 40000"
            value={price}
            onChangeText={(t) => setPrice(t.replace(/[^0-9]/g, ''))}
            style={styles.input}
          />

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>
                {mode === 'weight' ? 'Kapasitas (Kg):' : 'Isi Kemasan (Pcs):'}
              </Text>
              <TextInput
                keyboardType="numeric"
                value={capacity}
                onChangeText={(t) => setCapacity(t.replace(/[^0-9]/g, ''))}
                style={styles.input}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>
                {mode === 'weight' ? 'Pakai (Gram):' : 'Pakai (Sachet/Pcs):'}
              </Text>
              <TextInput
                keyboardType="numeric"
                placeholder={mode === 'weight' ? 'Misal: 25' : 'Misal: 1'}
                value={usage}
                onChangeText={(t) => setUsage(t.replace(/[^0-9]/g, ''))}
                style={styles.input}
              />
            </View>
          </View>

          <View style={styles.previewBox}>
            <Text style={styles.previewLabel}>Biaya Modal yang Terpakai:</Text>
            <Text style={styles.previewValue}>Rp {formatRupiah(result)}</Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <TouchableOpacity onPress={onClose} style={styles.btnModalCancel}>
              <Text style={styles.textModalCancel}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleApply} style={styles.btnModalApply}>
              <Text style={styles.textModalApply}>Pakai Nilai Ini</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

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
    <View style={{ marginTop: 14 }}>
      <View ref={receiptRef} collapsable={false} style={styles.receiptContainer}>
        <Text style={styles.receiptTag}>RINGKASAN HARGA UMKM</Text>
        <Text style={styles.receiptTitle}>{productName || 'Produk UMKM'}</Text>
        <View style={styles.divider} />

        <View style={styles.rowBetween}>
          <Text style={styles.textGray}>Modal Pokok (HPP) / Pcs:</Text>
          <Text style={styles.textBold}>Rp {formatRupiah(totalHPP)}</Text>
        </View>
        <View style={styles.rowBetween}>
          <Text style={styles.textGray}>Rencana Harga Jual:</Text>
          <Text style={styles.textBold}>Rp {formatRupiah(sellingPrice)}</Text>
        </View>
        <View style={styles.rowBetween}>
          <Text style={styles.textGray}>Keuntungan Bersih:</Text>
          <Text style={[styles.textBold, { color: netProfit >= 0 ? '#16A34A' : '#DC2626' }]}>
            Rp {formatRupiah(netProfit)} ({marginPercent}%)
          </Text>
        </View>
        <View style={styles.divider} />

        <Text style={{ fontSize: 12, color: '#64748B' }}>Rekomendasi Standar Sehat (Margin 35%):</Text>
        <Text style={styles.recPriceText}>Rp {formatRupiah(recommendedPrice)}</Text>
        <Text style={styles.receiptFooter}>Dihitung via Kalkulator Modal UMKM</Text>
      </View>

      <TouchableOpacity disabled={sharing} onPress={handleShare} style={styles.btnShareWA}>
        {sharing ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.btnShareWAText}>Bagikan Gambar Struk ke WhatsApp</Text>
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
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {/* ================= LAYAR 1: HOME ================= */}
      {screen === 'home' && (
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.pageTitle}>Katalog Resep Modal</Text>
              <Text style={styles.pageSubtitle}>{savedProducts.length} / {MAX_SAVED_PRODUCTS} Resep Tersimpan Offline</Text>
            </View>
            <TouchableOpacity onPress={handleStartNew} style={styles.btnPrimarySmall}>
              <Text style={styles.btnPrimarySmallText}>+ Buat Baru</Text>
            </TouchableOpacity>
          </View>

          {savedProducts.length === 0 ? (
            <View style={styles.centerBox}>
              <Text style={styles.emptyTitle}>Belum Ada Resep Tersimpan</Text>
              <Text style={styles.emptyDesc}>
                Mulai hitung HPP produk lele marinasi, kerajinan, atau jualan Anda agar tidak rugi pasang harga.
              </Text>
              <TouchableOpacity onPress={handleStartNew} style={styles.btnLarge}>
                <Text style={styles.btnLargeText}>Mulai Hitung Modal</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={savedProducts}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: 30 }}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => handleOpenProduct(item)} style={styles.productCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.productName}>{item.name}</Text>
                    <Text style={styles.productPrice}>Rencana Jual: Rp {formatRupiah(item.targetSellingPrice)}</Text>
                    <Text style={styles.productMeta}>
                      {item.materials.length} Bahan • {item.overheads.length} Biaya Tambahan
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => handleDeleteProduct(item.id)} style={styles.btnDeleteTag}>
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
          <ScrollView contentContainerStyle={{ paddingBottom: 90 }}>
            <Text style={styles.pageTitle}>Rincian Modal Produk</Text>

            <Text style={styles.fieldLabel}>Nama Produk:</Text>
            <TextInput
              maxLength={80}
              placeholder="Misal: Lele Marinasi Siap Masak 500g"
              value={productName}
              onChangeText={setProductName}
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>Persentase Susut Bahan Mentah (%):</Text>
            <TextInput
              keyboardType="numeric"
              maxLength={2}
              placeholder="Misal: 15 (ikan dibersihkan insang susut 15%)"
              value={wastePercent}
              onChangeText={(t) => setWastePercent(t.replace(/[^0-9]/g, ''))}
              style={styles.input}
            />

            {/* Bahan Baku */}
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Komponen Bahan Baku</Text>
              <TouchableOpacity
                onPress={() =>
                  setMaterials([
                    ...materials,
                    { id: Date.now().toString(), type: 'material', name: '', amount: 0 },
                  ])
                }
              >
                <Text style={styles.linkText}>+ Tambah Bahan</Text>
              </TouchableOpacity>
            </View>

            {materials.map((item, idx) => (
              <View key={item.id} style={styles.dynamicRow}>
                <TextInput
                  maxLength={60}
                  placeholder="Nama Bahan (Bawang/Lele)"
                  value={item.name}
                  onChangeText={(t) => {
                    const u = [...materials];
                    u[idx].name = t;
                    setMaterials(u);
                  }}
                  style={[styles.input, { flex: 2, marginBottom: 0, marginRight: 6 }]}
                />
                <TextInput
                  keyboardType="numeric"
                  maxLength={12}
                  placeholder="Biaya (Rp)"
                  value={item.amount ? item.amount.toString() : ''}
                  onChangeText={(t) => {
                    const u = [...materials];
                    u[idx].amount = sanitizeNumber(Number(t.replace(/[^0-9]/g, '')));
                    setMaterials(u);
                  }}
                  style={[styles.input, { flex: 1.4, marginBottom: 0, marginRight: 6 }]}
                />
                <TouchableOpacity
                  onPress={() => {
                    setActiveMaterialIdx(idx);
                    setConverterVisible(true);
                  }}
                  style={styles.btnSmallIcon}
                >
                  <Text style={{ fontSize: 16 }}>⚖️</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setMaterials(materials.filter((_, i) => i !== idx))}
                  style={styles.btnRowDelete}
                >
                  <Text style={styles.btnRowDeleteText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}

            {/* Kemasan & Overhead */}
            <View style={[styles.sectionRow, { marginTop: 18 }]}>
              <Text style={styles.sectionTitle}>Kemasan & Operasional</Text>
              <TouchableOpacity
                onPress={() =>
                  setOverheads([
                    ...overheads,
                    { id: Date.now().toString(), type: 'overhead', name: '', amount: 0 },
                  ])
                }
              >
                <Text style={styles.linkText}>+ Tambah Biaya</Text>
              </TouchableOpacity>
            </View>

            {overheads.map((item, idx) => (
              <View key={item.id} style={styles.dynamicRow}>
                <TextInput
                  maxLength={60}
                  placeholder="Kemasan / Stiker / Gas / Listrik"
                  value={item.name}
                  onChangeText={(t) => {
                    const u = [...overheads];
                    u[idx].name = t;
                    setOverheads(u);
                  }}
                  style={[styles.input, { flex: 2, marginBottom: 0, marginRight: 6 }]}
                />
                <TextInput
                  keyboardType="numeric"
                  maxLength={12}
                  placeholder="Biaya (Rp)"
                  value={item.amount ? item.amount.toString() : ''}
                  onChangeText={(t) => {
                    const u = [...overheads];
                    u[idx].amount = sanitizeNumber(Number(t.replace(/[^0-9]/g, '')));
                    setOverheads(u);
                  }}
                  style={[styles.input, { flex: 1.4, marginBottom: 0, marginRight: 6 }]}
                />
                <TouchableOpacity
                  onPress={() => setOverheads(overheads.filter((_, i) => i !== idx))}
                  style={styles.btnRowDelete}
                >
                  <Text style={styles.btnRowDeleteText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          {/* Sticky Bottom Actions */}
          <View style={styles.footerSticky}>
            <TouchableOpacity onPress={() => setScreen('home')} style={styles.btnFooterCancel}>
              <Text style={styles.textFooterCancel}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity
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
          <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
            <View style={styles.headerRow}>
              <Text style={[styles.pageTitle, { flex: 1 }]}>Uji Harga: {productName}</Text>
              <TouchableOpacity onPress={() => setScreen('builder')} style={styles.btnEditOutline}>
                <Text style={styles.btnEditOutlineText}>Edit Resep</Text>
              </TouchableOpacity>
            </View>

            {/* Stress Test Pasar */}
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Pasar lagi naik harga? (Stress Test Bahan Mentah):</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                {[0, 10, 20, 30].map((rate) => (
                  <TouchableOpacity
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

            {/* Input Harga Jual Rencana */}
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Rencana Harga Jual Anda:</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.inputPrefix}>Rp</Text>
                <TextInput
                  keyboardType="numeric"
                  maxLength={12}
                  value={sellingPrice}
                  onChangeText={(t) => setSellingPrice(t.replace(/[^0-9]/g, ''))}
                  style={styles.inputHeroPrice}
                />
              </View>
            </View>

            {/* Box Hasil Keuangan */}
            <View style={[styles.card, { backgroundColor: '#0F172A' }]}>
              <View style={styles.rowBetween}>
                <View>
                  <Text style={styles.metricLabelLight}>Total Modal Riil (HPP):</Text>
                  <Text style={styles.metricValWhite}>Rp {formatRupiah(finance.totalHPP)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.metricLabelLight}>Keuntungan Bersih:</Text>
                  <Text
                    style={[
                      styles.metricValWhite,
                      { color: finance.netProfit >= 0 ? '#4ADE80' : '#F87171' },
                    ]}
                  >
                    Rp {formatRupiah(finance.netProfit)}
                  </Text>
                </View>
              </View>

              <MarginBadge margin={finance.marginPercent} />
              <View style={styles.darkDivider} />

              <Text style={styles.metricLabelLight}>Rekomendasi Standar Sehat (Margin 35%):</Text>
              <Text style={styles.recPriceVal}>Rp {formatRupiah(finance.recommendedStandardPrice)}</Text>
            </View>

            <TouchableOpacity onPress={handleSaveRecipe} style={styles.btnSaveRecipe}>
              <Text style={styles.btnSaveRecipeText}>Simpan Resep ke Memori HP</Text>
            </TouchableOpacity>

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
    </SafeAreaView>
  );
}

// ==========================================
// 5. STYLESHEET LENGKAP
// ==========================================
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { flex: 1, padding: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  pageTitle: { fontSize: 20, fontWeight: '700', color: '#0F172A' },
  pageSubtitle: { fontSize: 12, color: '#64748B', marginTop: 2 },
  btnPrimarySmall: { backgroundColor: '#0F172A', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8 },
  btnPrimarySmallText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B', marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: '#64748B', textAlign: 'center', marginBottom: 18 },
  btnLarge: { backgroundColor: '#0F172A', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10 },
  btnLargeText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  productCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  productName: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  productPrice: { fontSize: 13, color: '#16A34A', fontWeight: '600', marginTop: 4 },
  productMeta: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  btnDeleteTag: { paddingVertical: 6, paddingHorizontal: 10, backgroundColor: '#FEE2E2', borderRadius: 6 },
  btnDeleteTagText: { color: '#DC2626', fontSize: 12, fontWeight: '700' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 4 },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 12,
  },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  linkText: { fontSize: 13, fontWeight: '700', color: '#2563EB' },
  dynamicRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  btnSmallIcon: { padding: 10, backgroundColor: '#F1F5F9', borderRadius: 8, marginRight: 6 },
  btnRowDelete: { padding: 10 },
  btnRowDeleteText: { color: '#DC2626', fontWeight: '700', fontSize: 14 },
  footerSticky: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 10,
  },
  btnFooterCancel: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#F1F5F9', alignItems: 'center' },
  btnFooterNext: { flex: 2, paddingVertical: 12, borderRadius: 8, backgroundColor: '#0F172A', alignItems: 'center' },
  textFooterCancel: { fontWeight: '600', color: '#475569' },
  textFooterNext: { fontWeight: '700', color: '#FFF' },
  btnEditOutline: { paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8 },
  btnEditOutlineText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  card: { backgroundColor: '#FFF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 12 },
  cardLabel: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 6 },
  chip: { flex: 1, paddingVertical: 8, alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 8 },
  chipActive: { backgroundColor: '#0F172A' },
  chipText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  chipTextActive: { color: '#FFF' },
  inputPrefix: { fontSize: 22, fontWeight: '700', color: '#64748B', marginRight: 6 },
  inputHeroPrice: { flex: 1, fontSize: 24, fontWeight: '800', color: '#0F172A' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metricLabelLight: { fontSize: 12, color: '#94A3B8' },
  metricValWhite: { fontSize: 20, fontWeight: '700', color: '#FFF', marginTop: 2 },
  darkDivider: { height: 1, backgroundColor: '#334155', marginVertical: 10 },
  recPriceVal: { fontSize: 18, fontWeight: '800', color: '#38BDF8', marginTop: 2 },
  btnSaveRecipe: { backgroundColor: '#0F172A', paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  btnSaveRecipeText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  badge: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, alignSelf: 'flex-start', marginVertical: 8 },
  badgeText: { fontSize: 13, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  modalSubtitle: { fontSize: 13, color: '#64748B', marginBottom: 14 },
  tabContainer: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 8, padding: 4, marginBottom: 14 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  tabActive: { backgroundColor: '#FFF' },
  tabText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  tabTextActive: { color: '#0F172A' },
  previewBox: { backgroundColor: '#F8FAFC', padding: 12, borderRadius: 8, alignItems: 'center', marginVertical: 8 },
  previewLabel: { fontSize: 12, color: '#64748B' },
  previewValue: { fontSize: 20, fontWeight: '700', color: '#16A34A', marginTop: 2 },
  btnModalCancel: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#F1F5F9', alignItems: 'center' },
  btnModalApply: { flex: 2, paddingVertical: 12, borderRadius: 8, backgroundColor: '#0F172A', alignItems: 'center' },
  textModalCancel: { fontWeight: '600', color: '#475569' },
  textModalApply: { fontWeight: '700', color: '#FFF' },
  receiptContainer: { backgroundColor: '#FFF', padding: 18, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  receiptTag: { fontSize: 10, fontWeight: '800', color: '#2563EB', letterSpacing: 1 },
  receiptTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 10 },
  textGray: { fontSize: 13, color: '#64748B' },
  textBold: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  recPriceText: { fontSize: 16, fontWeight: '800', color: '#0284C7', marginTop: 2 },
  receiptFooter: { fontSize: 10, color: '#94A3B8', textAlign: 'center', marginTop: 12 },
  btnShareWA: { backgroundColor: '#16A34A', paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  btnShareWAText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
});