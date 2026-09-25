import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

// ==========================================
// 1. DATA TYPES & CONTRACTS
// ==========================================

export type UnitType = 'gr' | 'ml' | 'pcs' | 'pax' | 'kg' | 'liter';
export type ItemCategory = 'bahan' | 'kemasan' | 'operasional';

export interface RawMaterial {
  id: string;
  name: string;
  purchasePrice: number;
  purchaseVolume: number;
  unit: UnitType;
  category: ItemCategory;
}

export interface RecipeIngredient {
  materialId: string;
  amountUsed: number;
}

export interface ProductRecipe {
  id: string;
  name: string;
  yieldQty: number; // Jumlah porsi/pcs per batch
  targetSellingPrice: number;
  wastePercent: number; // % susut bahan
  ingredients: RecipeIngredient[];
  packaging: RecipeIngredient[];
  unitCost: number; // HPP per porsi
  netProfit: number; // Untung per porsi
  marginPercent: number;
  updatedAt: number;
}

export interface CapitalItem {
  id: string;
  name: string;
  qty: number;
  price: number;
  total: number;
}

export interface FixedExpense {
  id: string;
  name: string;
  amount: number;
  period: 'bulan' | 'hari';
}

export interface DailySalesTarget {
  productId: string;
  dailyQty: number;
}

export interface SaleItem {
  productId: string;
  productName: string;
  price: number;
  qty: number;
  cost: number;
}

// Storage keys
const STORAGE_PREFIX = '@meracik_ide_v2_';
const KEY_MATERIALS = `${STORAGE_PREFIX}materials`;
const KEY_RECIPES = `${STORAGE_PREFIX}recipes`;
const KEY_CAPITAL = `${STORAGE_PREFIX}capital`;
const KEY_EXPENSES = `${STORAGE_PREFIX}expenses`;
const KEY_TARGETS = `${STORAGE_PREFIX}targets`;
const KEY_SALES_TODAY = `${STORAGE_PREFIX}sales_today`;

// ==========================================
// 2. REALISTIC INDONESIAN UMKM SEED DATA
// ==========================================

const SEED_MATERIALS: RawMaterial[] = [
  { id: 'm-1', name: 'Alpukat Mentega Super', purchasePrice: 28000, purchaseVolume: 1000, unit: 'gr', category: 'bahan' },
  { id: 'm-2', name: 'Kelapa Muda Serut', purchasePrice: 20000, purchaseVolume: 1000, unit: 'gr', category: 'bahan' },
  { id: 'm-3', name: 'Nangka Manis', purchasePrice: 24000, purchaseVolume: 1000, unit: 'gr', category: 'bahan' },
  { id: 'm-4', name: 'Santan Kental Murni', purchasePrice: 32000, purchaseVolume: 1000, unit: 'ml', category: 'bahan' },
  { id: 'm-5', name: 'Susu Kental Manis', purchasePrice: 14500, purchaseVolume: 500, unit: 'gr', category: 'bahan' },
  { id: 'm-6', name: 'Sirup Gula Pandan', purchasePrice: 18000, purchaseVolume: 1000, unit: 'ml', category: 'bahan' },
  { id: 'm-7', name: 'Es Batu Kristal', purchasePrice: 8000, purchaseVolume: 5000, unit: 'gr', category: 'bahan' },
  { id: 'm-8', name: 'Cup Injection 500ml + Tutup', purchasePrice: 65000, purchaseVolume: 50, unit: 'pcs', category: 'kemasan' },
  { id: 'm-9', name: 'Sedotan Boba Steril', purchasePrice: 12000, purchaseVolume: 100, unit: 'pcs', category: 'kemasan' },
  { id: 'm-10', name: 'Kantong Kresek Takeaway', purchasePrice: 9000, purchaseVolume: 50, unit: 'pcs', category: 'kemasan' },
];

const SEED_RECIPES: ProductRecipe[] = [
  {
    id: 'r-1',
    name: 'Es Teler Sultan Spesial',
    yieldQty: 4,
    targetSellingPrice: 18000,
    wastePercent: 5,
    ingredients: [
      { materialId: 'm-1', amountUsed: 250 },
      { materialId: 'm-2', amountUsed: 200 },
      { materialId: 'm-3', amountUsed: 150 },
      { materialId: 'm-4', amountUsed: 200 },
      { materialId: 'm-5', amountUsed: 120 },
      { materialId: 'm-6', amountUsed: 150 },
      { materialId: 'm-7', amountUsed: 800 },
    ],
    packaging: [
      { materialId: 'm-8', amountUsed: 4 },
      { materialId: 'm-9', amountUsed: 4 },
      { materialId: 'm-10', amountUsed: 4 },
    ],
    unitCost: 8750,
    netProfit: 9250,
    marginPercent: 51.4,
    updatedAt: Date.now(),
  },
];

const SEED_CAPITAL: CapitalItem[] = [
  { id: 'c-1', name: 'Booth Portable Minimalis', qty: 1, price: 3200000, total: 3200000 },
  { id: 'c-2', name: 'Cup Sealer Digital Otomatis', qty: 1, price: 950000, total: 950000 },
  { id: 'c-3', name: 'Cooler Box 35 Liter Ice Max', qty: 2, price: 350000, total: 700000 },
  { id: 'c-4', name: 'Banner & Neon Box Toko', qty: 1, price: 450000, total: 450000 },
  { id: 'c-5', name: 'Sewa Tempat (3 Bulan)', qty: 1, price: 4500000, total: 4500000 },
];

const SEED_EXPENSES: FixedExpense[] = [
  { id: 'e-1', name: 'Gaji Karyawan Stand', amount: 1800000, period: 'bulan' },
  { id: 'e-2', name: 'Listrik & Kebersihan Stand', amount: 350000, period: 'bulan' },
  { id: 'e-3', name: 'Air Bersih Galonan', amount: 200000, period: 'bulan' },
];

const SEED_TARGETS: DailySalesTarget[] = [
  { productId: 'r-1', dailyQty: 35 },
];

// ==========================================
// 3. UTILITY HELPERS
// ==========================================

const formatRupiah = (val: number | string): string => {
  const num = typeof val === 'number' ? val : Number(String(val).replace(/[^0-9]/g, ''));
  if (isNaN(num)) return '0';
  return num.toLocaleString('id-ID');
};

const cleanNum = (val: unknown, max = 2_000_000_000): number => {
  if (typeof val === 'number') {
    if (isNaN(val) || !isFinite(val) || val < 0) return 0;
    return Math.min(val, max);
  }
  const cleanStr = String(val || '').replace(/[^0-9]/g, '');
  const parsed = Number(cleanStr);
  if (isNaN(parsed) || !isFinite(parsed) || parsed < 0) return 0;
  return Math.min(parsed, max);
};

// ==========================================
// 4. MAIN COMPONENT: MERACIK IDE
// ==========================================

export default function App() {
  // Navigation Tabs: 'resep' (HPP & Pricing) | 'balik_modal' (BEP) | 'kasir' (POS) | 'bahan' (Database)
  const [activeTab, setActiveTab] = useState<'resep' | 'balik_modal' | 'kasir' | 'bahan'>('resep');

  // Core Data State
  const [materials, setMaterials] = useState<RawMaterial[]>(SEED_MATERIALS);
  const [recipes, setRecipes] = useState<ProductRecipe[]>(SEED_RECIPES);
  const [capitalItems, setCapitalItems] = useState<CapitalItem[]>(SEED_CAPITAL);
  const [expenses, setExpenses] = useState<FixedExpense[]>(SEED_EXPENSES);
  const [dailyTargets, setDailyTargets] = useState<DailySalesTarget[]>(SEED_TARGETS);
  const [todaySales, setTodaySales] = useState<SaleItem[]>([]);

  // Feedback State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Active Modals
  const [showAddRecipeModal, setShowAddRecipeModal] = useState(false);
  const [showAddMaterialModal, setShowAddMaterialModal] = useState(false);
  const [showAddCapitalModal, setShowAddCapitalModal] = useState(false);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Recipe Builder Form State
  const [formRecipeName, setFormRecipeName] = useState('');
  const [formYield, setFormYield] = useState('1');
  const [formPrice, setFormPrice] = useState('15000');
  const [formWaste, setFormWaste] = useState('5');
  const [formRecipeIngredients, setFormRecipeIngredients] = useState<RecipeIngredient[]>([]);
  const [formRecipePackaging, setFormRecipePackaging] = useState<RecipeIngredient[]>([]);
  const [builderTab, setBuilderTab] = useState<'bahan' | 'kemasan'>('bahan');
  const [showPickerIngredient, setShowPickerIngredient] = useState(false);
  const [pickerSelectedMatId, setPickerSelectedMatId] = useState('');
  const [pickerAmountUsed, setPickerAmountUsed] = useState('');

  // Material Form State
  const [formMatName, setFormMatName] = useState('');
  const [formMatPrice, setFormMatPrice] = useState('');
  const [formMatVol, setFormMatVol] = useState('');
  const [formMatUnit, setFormMatUnit] = useState<UnitType>('gr');
  const [formMatCat, setFormMatCat] = useState<ItemCategory>('bahan');

  // Capital Form State
  const [formCapName, setFormCapName] = useState('');
  const [formCapQty, setFormCapQty] = useState('1');
  const [formCapPrice, setFormCapPrice] = useState('');

  // Expense Form State
  const [formExpName, setFormExpName] = useState('');
  const [formExpAmount, setFormExpAmount] = useState('');

  // POS Cart State: { [productId]: qty }
  const [posCart, setPosCart] = useState<{ [id: string]: number }>({});
  const [lastReceiptData, setLastReceiptData] = useState<{
    items: { name: string; qty: number; subtotal: number }[];
    total: number;
    time: string;
  } | null>(null);

  const receiptRef = useRef<View>(null);

  // ==========================================
  // 5. STORAGE & INITIALIZATION
  // ==========================================

  useEffect(() => {
    loadDatabase();
  }, []);

  const loadDatabase = async () => {
    try {
      const m = await AsyncStorage.getItem(KEY_MATERIALS);
      if (m) setMaterials(JSON.parse(m));
      const r = await AsyncStorage.getItem(KEY_RECIPES);
      if (r) setRecipes(JSON.parse(r));
      const c = await AsyncStorage.getItem(KEY_CAPITAL);
      if (c) setCapitalItems(JSON.parse(c));
      const e = await AsyncStorage.getItem(KEY_EXPENSES);
      if (e) setExpenses(JSON.parse(e));
      const t = await AsyncStorage.getItem(KEY_TARGETS);
      if (t) setDailyTargets(JSON.parse(t));
      const s = await AsyncStorage.getItem(KEY_SALES_TODAY);
      if (s) setTodaySales(JSON.parse(s));
    } catch (err) {
      console.warn('Storage load error', err);
    }
  };

  const persist = async (key: string, data: unknown) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(data));
    } catch (err) {
      console.warn(`Storage save error for ${key}`, err);
    }
  };

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setTimeout(() => setToastMessage(null), 2600);
  };

  const handleResetData = () => {
    Alert.alert(
      'Reset Data Aplikasi',
      'Apakah Anda ingin mengembalikan data ke format bawaan awal?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Reset',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.clear();
            setMaterials(SEED_MATERIALS);
            setRecipes(SEED_RECIPES);
            setCapitalItems(SEED_CAPITAL);
            setExpenses(SEED_EXPENSES);
            setDailyTargets(SEED_TARGETS);
            setTodaySales([]);
            setPosCart({});
            setShowSettingsModal(false);
            triggerToast('Data berhasil direset.');
          },
        },
      ]
    );
  };

  // ==========================================
  // 6. BUSINESS CALCULATION ENGINE
  // ==========================================

  // Calculate live recipe unit cost
  const computeBatchCost = (
    ings: RecipeIngredient[],
    packs: RecipeIngredient[],
    wastePct: number
  ) => {
    let ingCost = 0;
    let packCost = 0;

    ings.forEach((item) => {
      const mat = materials.find((m) => m.id === item.materialId);
      if (mat && mat.purchaseVolume > 0) {
        ingCost += (item.amountUsed / mat.purchaseVolume) * mat.purchasePrice;
      }
    });

    packs.forEach((item) => {
      const mat = materials.find((m) => m.id === item.materialId);
      if (mat && mat.purchaseVolume > 0) {
        packCost += (item.amountUsed / mat.purchaseVolume) * mat.purchasePrice;
      }
    });

    const adjustedIngCost = ingCost * (1 + wastePct / 100);
    return Math.round(adjustedIngCost + packCost);
  };

  const liveBatchCost = computeBatchCost(
    formRecipeIngredients,
    formRecipePackaging,
    cleanNum(formWaste)
  );
  const liveYield = Math.max(cleanNum(formYield), 1);
  const liveUnitHpp = Math.round(liveBatchCost / liveYield);
  const liveSellingPrice = cleanNum(formPrice);
  const liveNetProfit = liveSellingPrice - liveUnitHpp;
  const liveMarginPct = liveSellingPrice > 0 ? (liveNetProfit / liveSellingPrice) * 100 : 0;

  // Smart Pricing Recommendations
  const standardOfflinePrice = liveUnitHpp > 0 ? Math.ceil((liveUnitHpp / (1 - 0.35)) / 1000) * 1000 : 0;
  const ojolDeliveryPrice = liveUnitHpp > 0 ? Math.ceil(((liveUnitHpp / (1 - 0.35)) / 0.8) / 1000) * 1000 : 0;

  // BEP / Balik Modal Engine
  const totalCapex = capitalItems.reduce((acc, c) => acc + c.total, 0);

  // Revenue simulator per month (30 days)
  let simulatedMonthlyRevenue = 0;
  let simulatedMonthlyCogs = 0;

  recipes.forEach((rec) => {
    const target = dailyTargets.find((t) => t.productId === rec.id);
    const dailyQty = target ? target.dailyQty : 0;
    const monthlyQty = dailyQty * 30;
    simulatedMonthlyRevenue += monthlyQty * rec.targetSellingPrice;
    simulatedMonthlyCogs += monthlyQty * rec.unitCost;
  });

  const totalMonthlyFixedExpenses = expenses.reduce((acc, exp) => {
    return acc + (exp.period === 'hari' ? exp.amount * 30 : exp.amount);
  }, 0);

  const totalMonthlyExpenses = simulatedMonthlyCogs + totalMonthlyFixedExpenses;
  const monthlyOperatingProfit = simulatedMonthlyRevenue - totalMonthlyExpenses;
  const bepMonths = monthlyOperatingProfit > 0 ? (totalCapex / monthlyOperatingProfit).toFixed(1) : '-';
  const bepDays = monthlyOperatingProfit > 0 ? Math.round((totalCapex / monthlyOperatingProfit) * 30) : 0;

  // POS / Cashier Totals
  const posCartTotal = Object.entries(posCart).reduce((sum, [pId, qty]) => {
    const prod = recipes.find((r) => r.id === pId);
    return sum + (prod ? prod.targetSellingPrice * qty : 0);
  }, 0);

  // ==========================================
  // 7. USER ACTION HANDLERS
  // ==========================================

  // Save / Update Recipe
  const handleSaveRecipe = () => {
    const name = formRecipeName.trim();
    if (!name) {
      Alert.alert('Nama Menu', 'Masukkan nama menu atau resep Anda.');
      return;
    }

    const newRecipe: ProductRecipe = {
      id: `rec-${Date.now()}`,
      name,
      yieldQty: liveYield,
      targetSellingPrice: liveSellingPrice,
      wastePercent: cleanNum(formWaste),
      ingredients: formRecipeIngredients,
      packaging: formRecipePackaging,
      unitCost: liveUnitHpp,
      netProfit: liveNetProfit,
      marginPercent: Number(liveMarginPct.toFixed(1)),
      updatedAt: Date.now(),
    };

    const updated = [newRecipe, ...recipes.filter((r) => r.name.toLowerCase() !== name.toLowerCase())];
    setRecipes(updated);
    persist(KEY_RECIPES, updated);

    // Auto add target if none exists
    if (!dailyTargets.some((t) => t.productId === newRecipe.id)) {
      const updatedTargets = [...dailyTargets, { productId: newRecipe.id, dailyQty: 25 }];
      setDailyTargets(updatedTargets);
      persist(KEY_TARGETS, updatedTargets);
    }

    setShowAddRecipeModal(false);
    triggerToast('Resep & Kalkulasi HPP berhasil disimpan!');
  };

  // Add Item to Current Recipe Builder
  const handleConfirmIngredient = () => {
    const amt = cleanNum(pickerAmountUsed);
    if (!pickerSelectedMatId || amt <= 0) {
      Alert.alert('Periksa Input', 'Pilih bahan dan masukkan jumlah takaran yang dipakai.');
      return;
    }

    const newItem: RecipeIngredient = {
      materialId: pickerSelectedMatId,
      amountUsed: amt,
    };

    if (builderTab === 'bahan') {
      setFormRecipeIngredients([...formRecipeIngredients, newItem]);
    } else {
      setFormRecipePackaging([...formRecipePackaging, newItem]);
    }

    setShowPickerIngredient(false);
    setPickerSelectedMatId('');
    setPickerAmountUsed('');
  };

  // Save Raw Material
  const handleSaveMaterial = () => {
    const name = formMatName.trim();
    const price = cleanNum(formMatPrice);
    const vol = cleanNum(formMatVol);

    if (!name || price <= 0 || vol <= 0) {
      Alert.alert('Periksa Input', 'Lengkapi nama, harga beli, dan isi/volume kemasan.');
      return;
    }

    const newMat: RawMaterial = {
      id: `mat-${Date.now()}`,
      name,
      purchasePrice: price,
      purchaseVolume: vol,
      unit: formMatUnit,
      category: formMatCat,
    };

    const updated = [newMat, ...materials];
    setMaterials(updated);
    persist(KEY_MATERIALS, updated);

    setShowAddMaterialModal(false);
    setFormMatName('');
    setFormMatPrice('');
    setFormMatVol('');
    triggerToast('Bahan baku baru berhasil ditambahkan');
  };

  // Save Capital Item
  const handleSaveCapital = () => {
    const name = formCapName.trim();
    const qty = cleanNum(formCapQty) || 1;
    const price = cleanNum(formCapPrice);

    if (!name || price <= 0) {
      Alert.alert('Periksa Input', 'Lengkapi nama aset modal dan estimasi harganya.');
      return;
    }

    const newCap: CapitalItem = {
      id: `cap-${Date.now()}`,
      name,
      qty,
      price,
      total: qty * price,
    };

    const updated = [...capitalItems, newCap];
    setCapitalItems(updated);
    persist(KEY_CAPITAL, updated);

    setShowAddCapitalModal(false);
    setFormCapName('');
    setFormCapPrice('');
    triggerToast('Aset modal awal ditambahkan');
  };

  // Save Operational Expense
  const handleSaveExpense = () => {
    const name = formExpName.trim();
    const amt = cleanNum(formExpAmount);

    if (!name || amt <= 0) {
      Alert.alert('Periksa Input', 'Lengkapi nama pengeluaran rutin dan nominalnya.');
      return;
    }

    const newExp: FixedExpense = {
      id: `exp-${Date.now()}`,
      name,
      amount: amt,
      period: 'bulan',
    };

    const updated = [...expenses, newExp];
    setExpenses(updated);
    persist(KEY_EXPENSES, updated);

    setShowAddExpenseModal(false);
    setFormExpName('');
    setFormExpAmount('');
    triggerToast('Biaya operasional ditambahkan');
  };

  // POS Cart handlers
  const handleCartDelta = (pId: string, delta: number) => {
    const current = posCart[pId] || 0;
    const next = Math.max(0, current + delta);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    if (next === 0) {
      const copy = { ...posCart };
      delete copy[pId];
      setPosCart(copy);
    } else {
      setPosCart({ ...posCart, [pId]: next });
    }
  };

  const handleCheckoutPOS = () => {
    if (posCartTotal <= 0) return;

    const receiptItems = Object.entries(posCart).map(([pId, qty]) => {
      const prod = recipes.find((r) => r.id === pId)!;
      return {
        name: prod.name,
        qty,
        subtotal: prod.targetSellingPrice * qty,
      };
    });

    const receipt = {
      items: receiptItems,
      total: posCartTotal,
      time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    };

    setLastReceiptData(receipt);
    setPosCart({});
    setShowReceiptModal(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const handleShareReceipt = async () => {
    try {
      if (receiptRef.current) {
        const uri = await captureRef(receiptRef, { format: 'png', quality: 0.95 });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri);
        }
      }
    } catch (e) {
      triggerToast('Gagal membagikan struk.');
    }
  };

  // ==========================================
  // 8. RENDER: HEADER & TAB NAVIGATION
  // ==========================================

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* Brand Header */}
      <View style={styles.headerBar}>
        <View style={styles.headerBrandGroup}>
          <View style={styles.headerIconCircle}>
            <Text style={styles.headerEmoji}>💡</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>Meracik Ide</Text>
            <Text style={styles.headerSubtitle}>Kalkulator Modal & Smart Pricing UMKM</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.headerSettingsBtn}
          onPress={() => setShowSettingsModal(true)}
          testID="header-settings"
        >
          <Text style={styles.settingsGlyph}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Toast Alert */}
      {toastMessage && (
        <View style={styles.toast}>
          <Text style={styles.toastIcon}>✓</Text>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* Main Top Navigation Segment */}
      <View style={styles.navSegmentContainer}>
        <TouchableOpacity
          style={[styles.navSegment, activeTab === 'resep' && styles.navSegmentActive]}
          onPress={() => setActiveTab('resep')}
          testID="tab-resep"
        >
          <Text style={[styles.navSegmentText, activeTab === 'resep' && styles.navSegmentTextActive]}>
            🍲 Resep & HPP
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navSegment, activeTab === 'balik_modal' && styles.navSegmentActive]}
          onPress={() => setActiveTab('balik_modal')}
          testID="tab-balik-modal"
        >
          <Text style={[styles.navSegmentText, activeTab === 'balik_modal' && styles.navSegmentTextActive]}>
            📈 Balik Modal
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navSegment, activeTab === 'kasir' && styles.navSegmentActive]}
          onPress={() => setActiveTab('kasir')}
          testID="tab-kasir"
        >
          <Text style={[styles.navSegmentText, activeTab === 'kasir' && styles.navSegmentTextActive]}>
            ⚡ Kasir Struk
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navSegment, activeTab === 'bahan' && styles.navSegmentActive]}
          onPress={() => setActiveTab('bahan')}
          testID="tab-bahan"
        >
          <Text style={[styles.navSegmentText, activeTab === 'bahan' && styles.navSegmentTextActive]}>
            📦 Bahan
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content Area */}
      <View style={styles.contentBody}>
        {/* ========================================================= */}
        {/* TAB 1: RESEP & HPP PINTAR                                 */}
        {/* ========================================================= */}
        {activeTab === 'resep' && (
          <ScrollView style={styles.tabScroll} contentContainerStyle={styles.tabScrollContent}>
            {/* Quick Action Button */}
            <TouchableOpacity
              style={styles.primaryActionButton}
              onPress={() => {
                setFormRecipeName('');
                setFormYield('1');
                setFormPrice('15000');
                setFormWaste('5');
                setFormRecipeIngredients([]);
                setFormRecipePackaging([]);
                setShowAddRecipeModal(true);
              }}
              testID="btn-new-recipe"
            >
              <Text style={styles.primaryActionText}>+ Buat Resep / Hitung Menu Baru</Text>
            </TouchableOpacity>

            {/* List of Recipes */}
            {recipes.map((rec) => (
              <View key={rec.id} style={styles.recipeCard}>
                <View style={styles.recipeCardTopRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recipeCardTitle}>{rec.name}</Text>
                    <Text style={styles.recipeCardBatchInfo}>
                      Hasil: {rec.yieldQty} Porsi • Susut: {rec.wastePercent}%
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.marginBadge,
                      rec.marginPercent >= 40
                        ? styles.marginBadgeSuper
                        : rec.marginPercent >= 25
                        ? styles.marginBadgeHealthy
                        : styles.marginBadgeWarning,
                    ]}
                  >
                    <Text style={styles.marginBadgeText}>Margin {rec.marginPercent}%</Text>
                  </View>
                </View>

                {/* Metrics Breakdown */}
                <View style={styles.metricGrid}>
                  <View style={styles.metricCol}>
                    <Text style={styles.metricLabel}>HPP / Porsi</Text>
                    <Text style={styles.metricCostVal}>Rp {formatRupiah(rec.unitCost)}</Text>
                  </View>

                  <View style={styles.metricCol}>
                    <Text style={styles.metricLabel}>Harga Jual</Text>
                    <Text style={styles.metricPriceVal}>Rp {formatRupiah(rec.targetSellingPrice)}</Text>
                  </View>

                  <View style={styles.metricCol}>
                    <Text style={styles.metricLabel}>Profit Bersih</Text>
                    <Text style={styles.metricProfitVal}>+Rp {formatRupiah(rec.netProfit)}</Text>
                  </View>
                </View>

                {/* Smart Pricing Suggestion Banner */}
                <View style={styles.smartPricingPill}>
                  <Text style={styles.smartPricingEmoji}>💡</Text>
                  <Text style={styles.smartPricingText}>
                    Standar Offline: <Text style={styles.boldWhite}>Rp {formatRupiah(Math.ceil((rec.unitCost / 0.65) / 1000) * 1000)}</Text> • Ojol Komisi: <Text style={styles.boldWhite}>Rp {formatRupiah(Math.ceil(((rec.unitCost / 0.65) / 0.8) / 1000) * 1000)}</Text>
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        )}

        {/* ========================================================= */}
        {/* TAB 2: SIMULASI BALIK MODAL (BEP)                         */}
        {/* ========================================================= */}
        {activeTab === 'balik_modal' && (
          <ScrollView style={styles.tabScroll} contentContainerStyle={styles.tabScrollContent}>
            {/* Top BEP Milestone Card */}
            <View style={styles.bepHeroCard}>
              <View style={styles.bepHeroHeader}>
                <Text style={styles.bepHeroTitle}>ESTIMASI BALIK MODAL (BEP)</Text>
                <View style={styles.liveIndicator}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>SIMULASI RIIL</Text>
                </View>
              </View>

              <View style={styles.bepResultRow}>
                <View>
                  <Text style={styles.bepBigNumber}>
                    {bepMonths !== '-' ? `${bepMonths}` : '∞'}
                  </Text>
                  <Text style={styles.bepBigUnit}>Bulan {bepDays > 0 ? `(~${bepDays} hari)` : ''}</Text>
                </View>

                <View style={styles.bepStatsList}>
                  <View style={styles.bepMiniStat}>
                    <Text style={styles.bepMiniLabel}>Modal Awal (Capex)</Text>
                    <Text style={styles.bepMiniVal}>Rp {formatRupiah(totalCapex)}</Text>
                  </View>
                  <View style={styles.bepMiniStat}>
                    <Text style={styles.bepMiniLabel}>Profit Bersih / Bulan</Text>
                    <Text
                      style={[
                        styles.bepMiniVal,
                        monthlyOperatingProfit > 0 ? styles.colorGreen : styles.colorRed,
                      ]}
                    >
                      {monthlyOperatingProfit > 0 ? `Rp ${formatRupiah(monthlyOperatingProfit)}` : 'Belum Untung'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Monthly Flow Bar */}
              <View style={styles.flowSummaryBar}>
                <View style={styles.flowCol}>
                  <Text style={styles.flowLabel}>Omset / Bulan</Text>
                  <Text style={styles.flowVal}>Rp {formatRupiah(simulatedMonthlyRevenue)}</Text>
                </View>
                <View style={styles.flowDivider} />
                <View style={styles.flowCol}>
                  <Text style={styles.flowLabel}>Total Beban / Bulan</Text>
                  <Text style={styles.flowVal}>Rp {formatRupiah(totalMonthlyExpenses)}</Text>
                </View>
              </View>
            </View>

            {/* Target Penjualan Harian Section */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>1. Target Penjualan Harian</Text>
              <Text style={styles.sectionSubtitle}>Menentukan omset & biaya bahan baku bulanan</Text>
            </View>

            {recipes.map((rec) => {
              const target = dailyTargets.find((t) => t.productId === rec.id);
              const qty = target ? target.dailyQty : 0;
              return (
                <View key={rec.id} style={styles.targetRowCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.targetMenuName}>{rec.name}</Text>
                    <Text style={styles.targetMenuSub}>
                      Harga Jual: Rp {formatRupiah(rec.targetSellingPrice)} • HPP: Rp {formatRupiah(rec.unitCost)}
                    </Text>
                  </View>

                  <View style={styles.targetCounter}>
                    <TouchableOpacity
                      style={styles.targetBtn}
                      onPress={() => {
                        const next = Math.max(0, qty - 5);
                        const updated = dailyTargets.map((t) =>
                          t.productId === rec.id ? { ...t, dailyQty: next } : t
                        );
                        if (!dailyTargets.some((t) => t.productId === rec.id)) {
                          updated.push({ productId: rec.id, dailyQty: next });
                        }
                        setDailyTargets(updated);
                        persist(KEY_TARGETS, updated);
                      }}
                    >
                      <Text style={styles.targetBtnText}>-5</Text>
                    </TouchableOpacity>

                    <Text style={styles.targetQtyText}>{qty} <Text style={{ fontSize: 11, color: '#64748B' }}>/hari</Text></Text>

                    <TouchableOpacity
                      style={styles.targetBtn}
                      onPress={() => {
                        const next = qty + 5;
                        const updated = dailyTargets.map((t) =>
                          t.productId === rec.id ? { ...t, dailyQty: next } : t
                        );
                        if (!dailyTargets.some((t) => t.productId === rec.id)) {
                          updated.push({ productId: rec.id, dailyQty: next });
                        }
                        setDailyTargets(updated);
                        persist(KEY_TARGETS, updated);
                      }}
                    >
                      <Text style={styles.targetBtnText}>+5</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}

            {/* Modal Awal (Capex) Section */}
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>2. Rincian Modal Awal (Capex)</Text>
                <TouchableOpacity
                  style={styles.sectionSmallBtn}
                  onPress={() => setShowAddCapitalModal(true)}
                >
                  <Text style={styles.sectionSmallBtnText}>+ Tambah</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.sectionSubtitle}>Peralatan, sewa tempat, dan renovasi</Text>
            </View>

            {capitalItems.map((item) => (
              <View key={item.id} style={styles.simpleListCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.simpleItemTitle}>{item.name}</Text>
                  <Text style={styles.simpleItemSub}>
                    Jumlah: {item.qty} pcs @ Rp {formatRupiah(item.price)}
                  </Text>
                </View>
                <Text style={styles.simpleItemPrice}>Rp {formatRupiah(item.total)}</Text>
              </View>
            ))}

            {/* Beban Operasional Tetap Section */}
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>3. Beban Operasional Tetap (Opex)</Text>
                <TouchableOpacity
                  style={styles.sectionSmallBtn}
                  onPress={() => setShowAddExpenseModal(true)}
                >
                  <Text style={styles.sectionSmallBtnText}>+ Tambah</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.sectionSubtitle}>Gaji, listrik, dan biaya rutin per bulan</Text>
            </View>

            {expenses.map((exp) => (
              <View key={exp.id} style={styles.simpleListCard}>
                <Text style={styles.simpleItemTitle}>{exp.name}</Text>
                <Text style={styles.simpleItemPrice}>Rp {formatRupiah(exp.amount)}/bln</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* ========================================================= */}
        {/* TAB 3: KASIR CEPAT & STRUK DIGITAL                         */}
        {/* ========================================================= */}
        {activeTab === 'kasir' && (
          <View style={{ flex: 1 }}>
            <ScrollView style={styles.tabScroll} contentContainerStyle={styles.tabScrollContent}>
              <Text style={styles.posHelperBanner}>
                Sentuh (+) untuk memilih menu belanjaan pelanggan, lalu tekan tombol Bayar.
              </Text>

              {recipes.map((prod) => {
                const qty = posCart[prod.id] || 0;
                return (
                  <View key={prod.id} style={styles.posItemCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.posItemName}>{prod.name}</Text>
                      <Text style={styles.posItemPrice}>Rp {formatRupiah(prod.targetSellingPrice)}</Text>
                    </View>

                    <View style={styles.posCounterBox}>
                      <TouchableOpacity
                        style={styles.posBtnMinus}
                        onPress={() => handleCartDelta(prod.id, -1)}
                      >
                        <Text style={styles.posBtnSign}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.posQtyNum}>{qty}</Text>
                      <TouchableOpacity
                        style={styles.posBtnPlus}
                        onPress={() => handleCartDelta(prod.id, 1)}
                      >
                        <Text style={styles.posBtnSign}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            {/* Bottom Floating Bar */}
            <View style={styles.posCheckoutBar}>
              <View>
                <Text style={styles.posCheckoutLabel}>Total Pembayaran</Text>
                <Text style={styles.posCheckoutVal}>Rp {formatRupiah(posCartTotal)}</Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.posSubmitButton,
                  posCartTotal === 0 && styles.posSubmitButtonDisabled,
                ]}
                disabled={posCartTotal === 0}
                onPress={handleCheckoutPOS}
                testID="btn-checkout-pos"
              >
                <Text style={styles.posSubmitText}>⚡ Cetak Struk</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ========================================================= */}
        {/* TAB 4: DATABASE BAHAN BAKU & KEMASAN                      */}
        {/* ========================================================= */}
        {activeTab === 'bahan' && (
          <ScrollView style={styles.tabScroll} contentContainerStyle={styles.tabScrollContent}>
            <TouchableOpacity
              style={styles.primaryActionButton}
              onPress={() => {
                setFormMatName('');
                setFormMatPrice('');
                setFormMatVol('');
                setFormMatUnit('gr');
                setFormMatCat('bahan');
                setShowAddMaterialModal(true);
              }}
              testID="btn-new-material"
            >
              <Text style={styles.primaryActionText}>+ Tambah Bahan / Kemasan Baru</Text>
            </TouchableOpacity>

            {materials.map((m) => {
              const unitPrice = m.purchaseVolume > 0 ? (m.purchasePrice / m.purchaseVolume).toFixed(1) : '0';
              return (
                <View key={m.id} style={styles.materialItemCard}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.materialCategoryTag}>
                      <Text style={styles.materialCatText}>
                        {m.category === 'kemasan' ? 'Kemasan' : 'Bahan Baku'}
                      </Text>
                    </View>
                    <Text style={styles.materialItemName}>{m.name}</Text>
                    <Text style={styles.materialItemSub}>
                      Beli: Rp {formatRupiah(m.purchasePrice)} per {formatRupiah(m.purchaseVolume)} {m.unit}
                    </Text>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.materialUnitRate}>Rp {unitPrice}</Text>
                    <Text style={styles.materialPerUnit}>per {m.unit}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* ========================================================= */}
      {/* MODAL 1: RESEP / HPP BUILDER                               */}
      {/* ========================================================= */}
      <Modal visible={showAddRecipeModal} animationType="slide">
        <SafeAreaView style={styles.modalFullscreen}>
          {/* Header */}
          <View style={styles.modalHeaderRow}>
            <TouchableOpacity onPress={() => setShowAddRecipeModal(false)}>
              <Text style={styles.modalCloseIcon}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Kalkulator Resep & HPP</Text>
            <TouchableOpacity onPress={handleSaveRecipe}>
              <Text style={styles.modalSaveAction}>Simpan</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            {/* Input Nama & Porsi */}
            <Text style={styles.inputGroupLabel}>Nama Menu / Produk</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Contoh: Es Kopi Susu Aren"
              placeholderTextColor="#94A3B8"
              value={formRecipeName}
              onChangeText={setFormRecipeName}
            />

            <View style={styles.twoColumnRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.inputGroupLabel}>Hasil per Batch (Porsi)</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  placeholder="1"
                  placeholderTextColor="#94A3B8"
                  value={formYield}
                  onChangeText={(t) => setFormYield(t.replace(/[^0-9]/g, ''))}
                />
              </View>

              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.inputGroupLabel}>Target Jual (Rp)</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  placeholder="15000"
                  placeholderTextColor="#94A3B8"
                  value={formPrice ? `Rp ${formatRupiah(formPrice)}` : ''}
                  onChangeText={(t) => setFormPrice(t.replace(/[^0-9]/g, ''))}
                />
              </View>
            </View>

            {/* Susut Bahan */}
            <Text style={styles.inputGroupLabel}>Estimasi Susut / Tumpah (%)</Text>
            <TextInput
              style={styles.textInput}
              keyboardType="numeric"
              placeholder="5"
              placeholderTextColor="#94A3B8"
              value={formWaste}
              onChangeText={(t) => setFormWaste(t.replace(/[^0-9]/g, ''))}
            />

            {/* Live Calculation Banner */}
            <View style={styles.liveCardBanner}>
              <View style={styles.liveCardCol}>
                <Text style={styles.liveCardLabel}>HPP / Porsi</Text>
                <Text style={styles.liveCardValue}>Rp {formatRupiah(liveUnitHpp)}</Text>
              </View>

              <View style={styles.liveCardCol}>
                <Text style={styles.liveCardLabel}>Profit Bersih</Text>
                <Text
                  style={[
                    styles.liveCardValue,
                    liveNetProfit >= 0 ? styles.colorGreen : styles.colorRed,
                  ]}
                >
                  Rp {formatRupiah(liveNetProfit)}
                </Text>
              </View>

              <View style={styles.liveCardCol}>
                <Text style={styles.liveCardLabel}>Margin</Text>
                <Text style={styles.liveCardValue}>{liveMarginPct.toFixed(1)}%</Text>
              </View>
            </View>

            {/* Smart Pricing Recommendations */}
            <View style={styles.pricingRecommendationBox}>
              <Text style={styles.recTitle}>Rekomendasi Harga Jual Sehat:</Text>
              <Text style={styles.recLine}>
                • Offline (Margin 35%): <Text style={styles.boldDark}>Rp {formatRupiah(standardOfflinePrice)}</Text>
              </Text>
              <Text style={styles.recLine}>
                • Aplikasi Ojek Online (Komisi 20%): <Text style={styles.boldDark}>Rp {formatRupiah(ojolDeliveryPrice)}</Text>
              </Text>
            </View>

            {/* Ingredients Segment Tab */}
            <View style={styles.builderSegmentRow}>
              <TouchableOpacity
                style={[styles.builderSegBtn, builderTab === 'bahan' && styles.builderSegBtnActive]}
                onPress={() => setBuilderTab('bahan')}
              >
                <Text
                  style={[
                    styles.builderSegText,
                    builderTab === 'bahan' && styles.builderSegTextActive,
                  ]}
                >
                  Bahan Baku ({formRecipeIngredients.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.builderSegBtn, builderTab === 'kemasan' && styles.builderSegBtnActive]}
                onPress={() => setBuilderTab('kemasan')}
              >
                <Text
                  style={[
                    styles.builderSegText,
                    builderTab === 'kemasan' && styles.builderSegTextActive,
                  ]}
                >
                  Kemasan ({formRecipePackaging.length})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Active Items List */}
            {(builderTab === 'bahan' ? formRecipeIngredients : formRecipePackaging).map(
              (item, idx) => {
                const mat = materials.find((m) => m.id === item.materialId);
                if (!mat) return null;
                const cost = Math.round((item.amountUsed / mat.purchaseVolume) * mat.purchasePrice);
                return (
                  <View key={idx} style={styles.builderItemRow}>
                    <Text style={styles.builderItemName}>{mat.name}</Text>
                    <Text style={styles.builderItemAmt}>
                      {item.amountUsed} {mat.unit}
                    </Text>
                    <Text style={styles.builderItemCost}>Rp {formatRupiah(cost)}</Text>
                  </View>
                );
              }
            )}

            <TouchableOpacity
              style={styles.addIngredientTrigger}
              onPress={() => {
                setPickerSelectedMatId('');
                setPickerAmountUsed('');
                setShowPickerIngredient(true);
              }}
            >
              <Text style={styles.addIngredientTriggerText}>
                + Masukkan {builderTab === 'bahan' ? 'Bahan Baku' : 'Kemasan'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 2: PICKER BAHAN KE DALAM RESEP                      */}
      {/* ========================================================= */}
      <Modal visible={showPickerIngredient} transparent animationType="fade">
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogBox}>
            <Text style={styles.dialogHeading}>
              Pilih {builderTab === 'bahan' ? 'Bahan Baku' : 'Kemasan'}
            </Text>

            <ScrollView style={{ maxHeight: 200, marginBottom: 12 }}>
              {materials
                .filter((m) => m.category === builderTab)
                .map((mat) => (
                  <TouchableOpacity
                    key={mat.id}
                    style={[
                      styles.matPickerOption,
                      pickerSelectedMatId === mat.id && styles.matPickerOptionActive,
                    ]}
                    onPress={() => setPickerSelectedMatId(mat.id)}
                  >
                    <Text
                      style={[
                        styles.matPickerOptionText,
                        pickerSelectedMatId === mat.id && styles.matPickerOptionTextActive,
                      ]}
                    >
                      {mat.name} ({mat.unit})
                    </Text>
                    <Text style={styles.matPickerOptionSub}>
                      Rp {formatRupiah(mat.purchasePrice)}/{mat.purchaseVolume}{mat.unit}
                    </Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>

            <Text style={styles.inputGroupLabel}>Takaran yang Dipakai per Batch</Text>
            <TextInput
              style={styles.textInput}
              keyboardType="numeric"
              placeholder="Contoh: 150"
              placeholderTextColor="#94A3B8"
              value={pickerAmountUsed}
              onChangeText={(t) => setPickerAmountUsed(t.replace(/[^0-9]/g, ''))}
            />

            <View style={styles.dialogButtonRow}>
              <TouchableOpacity
                style={styles.dialogBtnCancel}
                onPress={() => setShowPickerIngredient(false)}
              >
                <Text style={styles.dialogBtnCancelText}>Batal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dialogBtnConfirm}
                onPress={handleConfirmIngredient}
              >
                <Text style={styles.dialogBtnConfirmText}>Tambahkan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 3: TAMBAH BAHAN BAKU BARU                           */}
      {/* ========================================================= */}
      <Modal visible={showAddMaterialModal} transparent animationType="fade">
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogBox}>
            <Text style={styles.dialogHeading}>Tambah Bahan / Kemasan</Text>

            <TextInput
              style={styles.textInput}
              placeholder="Nama Bahan (contoh: Kopi Arabika)"
              placeholderTextColor="#94A3B8"
              value={formMatName}
              onChangeText={setFormMatName}
            />

            <TextInput
              style={styles.textInput}
              placeholder="Harga Pembelian (Rp)"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              value={formMatPrice ? `Rp ${formatRupiah(formMatPrice)}` : ''}
              onChangeText={(t) => setFormMatPrice(t.replace(/[^0-9]/g, ''))}
            />

            <TextInput
              style={styles.textInput}
              placeholder="Isi / Volume Beli (angka)"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              value={formMatVol}
              onChangeText={(t) => setFormMatVol(t.replace(/[^0-9]/g, ''))}
            />

            {/* Unit Selector */}
            <View style={styles.unitSelectorRow}>
              {(['gr', 'ml', 'pcs', 'pax'] as UnitType[]).map((u) => (
                <TouchableOpacity
                  key={u}
                  style={[styles.unitBtn, formMatUnit === u && styles.unitBtnActive]}
                  onPress={() => setFormMatUnit(u)}
                >
                  <Text style={[styles.unitBtnText, formMatUnit === u && styles.unitBtnTextActive]}>
                    {u}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Category Toggle */}
            <View style={styles.unitSelectorRow}>
              <TouchableOpacity
                style={[styles.catBtn, formMatCat === 'bahan' && styles.catBtnActive]}
                onPress={() => setFormMatCat('bahan')}
              >
                <Text style={[styles.catBtnText, formMatCat === 'bahan' && styles.catBtnTextActive]}>
                  Bahan Baku
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.catBtn, formMatCat === 'kemasan' && styles.catBtnActive]}
                onPress={() => setFormMatCat('kemasan')}
              >
                <Text style={[styles.catBtnText, formMatCat === 'kemasan' && styles.catBtnTextActive]}>
                  Kemasan
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.dialogButtonRow}>
              <TouchableOpacity
                style={styles.dialogBtnCancel}
                onPress={() => setShowAddMaterialModal(false)}
              >
                <Text style={styles.dialogBtnCancelText}>Batal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dialogBtnConfirm}
                onPress={handleSaveMaterial}
              >
                <Text style={styles.dialogBtnConfirmText}>Simpan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 4: TAMBAH ASET MODAL (CAPEX)                        */}
      {/* ========================================================= */}
      <Modal visible={showAddCapitalModal} transparent animationType="fade">
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogBox}>
            <Text style={styles.dialogHeading}>Tambah Aset Modal Awal</Text>

            <TextInput
              style={styles.textInput}
              placeholder="Nama Aset / Peralatan (contoh: Mesin Espresso)"
              placeholderTextColor="#94A3B8"
              value={formCapName}
              onChangeText={setFormCapName}
            />

            <TextInput
              style={styles.textInput}
              placeholder="Jumlah (Qty)"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              value={formCapQty}
              onChangeText={(t) => setFormCapQty(t.replace(/[^0-9]/g, ''))}
            />

            <TextInput
              style={styles.textInput}
              placeholder="Harga per Unit (Rp)"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              value={formCapPrice ? `Rp ${formatRupiah(formCapPrice)}` : ''}
              onChangeText={(t) => setFormCapPrice(t.replace(/[^0-9]/g, ''))}
            />

            <View style={styles.dialogButtonRow}>
              <TouchableOpacity
                style={styles.dialogBtnCancel}
                onPress={() => setShowAddCapitalModal(false)}
              >
                <Text style={styles.dialogBtnCancelText}>Batal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dialogBtnConfirm}
                onPress={handleSaveCapital}
              >
                <Text style={styles.dialogBtnConfirmText}>Simpan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 5: TAMBAH BIAYA OPERASIONAL (OPEX)                  */}
      {/* ========================================================= */}
      <Modal visible={showAddExpenseModal} transparent animationType="fade">
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogBox}>
            <Text style={styles.dialogHeading}>Tambah Pengeluaran Rutin</Text>

            <TextInput
              style={styles.textInput}
              placeholder="Nama Pengeluaran (contoh: Gaji Karyawan)"
              placeholderTextColor="#94A3B8"
              value={formExpName}
              onChangeText={setFormExpName}
            />

            <TextInput
              style={styles.textInput}
              placeholder="Nominal per Bulan (Rp)"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              value={formExpAmount ? `Rp ${formatRupiah(formExpAmount)}` : ''}
              onChangeText={(t) => setFormExpAmount(t.replace(/[^0-9]/g, ''))}
            />

            <View style={styles.dialogButtonRow}>
              <TouchableOpacity
                style={styles.dialogBtnCancel}
                onPress={() => setShowAddExpenseModal(false)}
              >
                <Text style={styles.dialogBtnCancelText}>Batal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dialogBtnConfirm}
                onPress={handleSaveExpense}
              >
                <Text style={styles.dialogBtnConfirmText}>Simpan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 6: STRUK DIGITAL WHATSAPP (THERMAL RECEIPT)         */}
      {/* ========================================================= */}
      <Modal visible={showReceiptModal} transparent animationType="fade">
        <View style={styles.dialogOverlay}>
          <View style={styles.receiptModalCard}>
            {/* Capture Target Card */}
            <View ref={receiptRef} collapsable={false} style={styles.receiptPaper}>
              <Text style={styles.receiptHeaderStore}>MERACIK IDE • STRUK RESMI</Text>
              <Text style={styles.receiptSubStore}>Solusi Pintar Keuangan UMKM Indonesia</Text>
              <View style={styles.receiptDashedLine} />

              <Text style={styles.receiptDateText}>
                Waktu: {lastReceiptData?.time} • Kasir Pintar
              </Text>

              <View style={styles.receiptDashedLine} />

              {lastReceiptData?.items.map((it, idx) => (
                <View key={idx} style={styles.receiptItemLine}>
                  <Text style={styles.receiptItemTitle}>
                    {it.name} x{it.qty}
                  </Text>
                  <Text style={styles.receiptItemAmount}>Rp {formatRupiah(it.subtotal)}</Text>
                </View>
              ))}

              <View style={styles.receiptDashedLine} />

              <View style={styles.receiptTotalLine}>
                <Text style={styles.receiptTotalWord}>TOTAL BELANJA</Text>
                <Text style={styles.receiptTotalNumber}>
                  Rp {formatRupiah(lastReceiptData?.total || 0)}
                </Text>
              </View>

              <View style={styles.receiptDashedLine} />
              <Text style={styles.receiptFooterNote}>
                Terima kasih atas kunjungan Anda!{'\n'}Dibuat dengan Aplikasi Meracik Ide
              </Text>
            </View>

            <TouchableOpacity style={styles.whatsappShareButton} onPress={handleShareReceipt}>
              <Text style={styles.whatsappShareText}>📤 Bagikan Struk ke WhatsApp</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.closeReceiptBtn}
              onPress={() => setShowReceiptModal(false)}
            >
              <Text style={styles.closeReceiptText}>Tutup</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 7: PENGATURAN & RESET                                */}
      {/* ========================================================= */}
      <Modal visible={showSettingsModal} animationType="slide">
        <SafeAreaView style={styles.modalFullscreen}>
          <View style={styles.modalHeaderRow}>
            <TouchableOpacity onPress={() => setShowSettingsModal(false)}>
              <Text style={styles.modalCloseIcon}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Pengaturan Aplikasi</Text>
            <View style={{ width: 30 }} />
          </View>

          <View style={{ padding: 16 }}>
            <TouchableOpacity style={styles.settingsRowCard} onPress={handleResetData}>
              <Text style={styles.settingsRowIcon}>🔄</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingsRowTitle}>Reset Data Awal</Text>
                <Text style={styles.settingsRowSubtitle}>
                  Kembalikan resep dan simulasi ke data contoh
                </Text>
              </View>
              <Text style={styles.settingsRowChevron}>›</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ==========================================
// 9. PROFESSIONAL FINTECH STYLESHEET
// ==========================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerBar: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 44 : 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerBrandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerEmoji: {
    fontSize: 20,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  headerSettingsBtn: {
    padding: 8,
    borderRadius: 8,
  },
  settingsGlyph: {
    fontSize: 18,
  },

  // Toast
  toast: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 999,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  toastIcon: {
    color: '#10B981',
    fontWeight: '800',
    marginRight: 8,
    fontSize: 15,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },

  // Segment Navigation
  navSegmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  navSegment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  navSegmentActive: {
    backgroundColor: '#0F172A',
  },
  navSegmentText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  navSegmentTextActive: {
    color: '#FFFFFF',
  },

  contentBody: {
    flex: 1,
  },
  tabScroll: {
    flex: 1,
  },
  tabScrollContent: {
    padding: 16,
    paddingBottom: 40,
  },

  primaryActionButton: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  // Recipe Cards
  recipeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  recipeCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  recipeCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  recipeCardBatchInfo: {
    fontSize: 12,
    color: '#64748B',
  },
  marginBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  marginBadgeSuper: {
    backgroundColor: '#ECFDF5',
  },
  marginBadgeHealthy: {
    backgroundColor: '#EFF6FF',
  },
  marginBadgeWarning: {
    backgroundColor: '#FEF2F2',
  },
  marginBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#047857',
  },
  metricGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  metricCol: {
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 2,
  },
  metricCostVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  metricPriceVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  metricProfitVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#059669',
  },
  smartPricingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  smartPricingEmoji: {
    marginRight: 6,
    fontSize: 12,
  },
  smartPricingText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  boldWhite: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // BEP Hero Card
  bepHeroCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  bepHeroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bepHeroTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 5,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10B981',
  },
  bepResultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  bepBigNumber: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 46,
  },
  bepBigUnit: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
  },
  bepStatsList: {
    alignItems: 'flex-end',
  },
  bepMiniStat: {
    marginBottom: 6,
    alignItems: 'flex-end',
  },
  bepMiniLabel: {
    fontSize: 11,
    color: '#94A3B8',
  },
  bepMiniVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  flowSummaryBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 10,
    padding: 10,
  },
  flowCol: {
    flex: 1,
    alignItems: 'center',
  },
  flowDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  flowLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 2,
  },
  flowVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Sections
  sectionHeader: {
    marginTop: 10,
    marginBottom: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  sectionSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  sectionSmallBtn: {
    backgroundColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  sectionSmallBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },

  targetRowCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  targetMenuName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  targetMenuSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  targetCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 3,
  },
  targetBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  targetBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  targetQtyText: {
    marginHorizontal: 8,
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },

  simpleListCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  simpleItemTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  simpleItemSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  simpleItemPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },

  // POS
  posHelperBanner: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
    backgroundColor: '#EFF6FF',
    padding: 10,
    borderRadius: 8,
  },
  posItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  posItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  posItemPrice: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  posCounterBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  posBtnMinus: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  posBtnPlus: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  posBtnSign: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
  },
  posQtyNum: {
    width: 30,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  posCheckoutBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  posCheckoutLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  posCheckoutVal: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  posSubmitButton: {
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  posSubmitButtonDisabled: {
    backgroundColor: '#CBD5E1',
  },
  posSubmitText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  // Material List
  materialItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  materialCategoryTag: {
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  materialCatText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
  },
  materialItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  materialItemSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  materialUnitRate: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  materialPerUnit: {
    fontSize: 10,
    color: '#94A3B8',
  },

  // Fullscreen Modal
  modalFullscreen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalCloseIcon: {
    fontSize: 18,
    color: '#64748B',
    padding: 4,
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalSaveAction: {
    fontSize: 14,
    fontWeight: '700',
    color: '#059669',
    padding: 4,
  },
  inputGroupLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
    marginTop: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  twoColumnRow: {
    flexDirection: 'row',
  },
  liveCardBanner: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  liveCardCol: {
    flex: 1,
    alignItems: 'center',
  },
  liveCardLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 2,
  },
  liveCardValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  pricingRecommendationBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  recTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  recLine: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 2,
  },
  boldDark: {
    fontWeight: '700',
    color: '#0F172A',
  },
  builderSegmentRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 2,
    marginBottom: 10,
  },
  builderSegBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  builderSegBtnActive: {
    backgroundColor: '#FFFFFF',
  },
  builderSegText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  builderSegTextActive: {
    color: '#0F172A',
  },
  builderItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  builderItemName: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
  },
  builderItemAmt: {
    width: 80,
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
  builderItemCost: {
    width: 80,
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'right',
  },
  addIngredientTrigger: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  addIngredientTriggerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },

  // Dialog Modals
  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  dialogBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  dialogHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 14,
    textAlign: 'center',
  },
  dialogButtonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 10,
  },
  dialogBtnCancel: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dialogBtnCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  dialogBtnConfirm: {
    backgroundColor: '#0F172A',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  dialogBtnConfirmText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  matPickerOption: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  matPickerOptionActive: {
    backgroundColor: '#F1F5F9',
  },
  matPickerOptionText: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
  },
  matPickerOptionTextActive: {
    color: '#059669',
  },
  matPickerOptionSub: {
    fontSize: 11,
    color: '#64748B',
  },
  unitSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  unitBtn: {
    flex: 1,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    alignItems: 'center',
  },
  unitBtnActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  unitBtnText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  unitBtnTextActive: {
    color: '#FFFFFF',
  },
  catBtn: {
    flex: 1,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    alignItems: 'center',
  },
  catBtnActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  catBtnText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  catBtnTextActive: {
    color: '#FFFFFF',
  },

  // Receipt Modal
  receiptModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  receiptPaper: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  receiptHeaderStore: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  receiptSubStore: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 2,
  },
  receiptDashedLine: {
    height: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    marginVertical: 10,
  },
  receiptDateText: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
  },
  receiptItemLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  receiptItemTitle: {
    fontSize: 13,
    color: '#1E293B',
  },
  receiptItemAmount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  receiptTotalLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  receiptTotalWord: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  receiptTotalNumber: {
    fontSize: 16,
    fontWeight: '900',
    color: '#059669',
  },
  receiptFooterNote: {
    fontSize: 10,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 14,
  },
  whatsappShareButton: {
    width: '100%',
    backgroundColor: '#25D366',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 10,
  },
  whatsappShareText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  closeReceiptBtn: {
    paddingVertical: 8,
  },
  closeReceiptText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },

  // Settings
  settingsRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  settingsRowIcon: {
    fontSize: 20,
    marginRight: 14,
  },
  settingsRowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  settingsRowSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  settingsRowChevron: {
    fontSize: 20,
    color: '#94A3B8',
  },

  colorGreen: {
    color: '#059669',
  },
  colorRed: {
    color: '#DC2626',
  },
});