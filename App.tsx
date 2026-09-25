import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Share,
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Line, Circle, G, Text as SvgText } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ==========================================
// 1. DATA TYPES & STRUCTURES
// ==========================================

export type UnitType = 'gr' | 'ml' | 'pcs' | 'pax' | 'kg' | 'liter';
export type ItemCategory = 'bahan' | 'kemasan';

export interface RawMaterial {
  id: string;
  name: string;
  purchasePrice: number;
  purchaseVolume: number;
  unit: UnitType;
  category: ItemCategory;
  currentStock?: number; // Sisa stok riil saat ini
  minStockAlert?: number; // Batas minimum peringatan belanja
}

export interface RecipeIngredient {
  materialId: string;
  amountUsed: number;
}

export interface ProductRecipe {
  id: string;
  name: string;
  category: string;
  yieldQty: number; // Jumlah porsi/pcs per batch
  targetSellingPrice: number;
  wastePercent: number; // % susut bahan
  inflationBuffer?: number; // % buffer kenaikan harga pasar (+0%, +5%, +10%, etc.)
  laborCost?: number; // Upah tenaga kerja per batch (Anti Modal Bocor)
  utilityCost?: number; // Biaya gas, listrik, air per batch (Anti Modal Bocor)
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
  lifespanMonths?: number; // Estimasi masa pakai aset (default 24 bulan untuk depresiasi)
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

export interface StoreProfile {
  name: string;
  phone: string;
  address: string;
  footerNote: string;
  retailMarginPercent?: number;
  resellerMarginPercent?: number;
  ojolCommissionPercent?: number;
  priceRounding?: 500 | 1000;
  workingCapital?: number; // Modal Kas & Belanja Perdana (Working Capital)
  operatingDaysPerMonth?: number; // Hari Buka Operasional per Bulan
  defaultInflationBuffer?: number; // Default buffer kenaikan harga pasar (0%, 5%, 10%, 15%)
  investorSharePercent?: number; // Porsi bagi hasil investor (misal 30% atau 40%)
  includeDepreciationInOpex?: boolean; // Alokasi penyusutan alat dihitung ke beban rutin bulanan
  logoBase64?: string; // Data URI Base64 logo toko untuk proposal PDF & header
}

export const DEFAULT_PROFILE: StoreProfile = {
  name: '',
  phone: '',
  address: '',
  footerNote: 'Diajukan untuk Pengajuan Modal Usaha & Analisis Kelayakan Bisnis',
  retailMarginPercent: 35,
  resellerMarginPercent: 20,
  ojolCommissionPercent: 20,
  priceRounding: 1000,
  workingCapital: 0,
  operatingDaysPerMonth: 30,
  defaultInflationBuffer: 5,
  investorSharePercent: 30,
  includeDepreciationInOpex: false,
  logoBase64: undefined,
};

// Checklist Kesiapan Buka Usaha (Pre-Launch Checklist)
export interface PreLaunchChecklistItem {
  id: string;
  title: string;
  category: 'legalitas' | 'branding' | 'operasional';
  isCompleted: boolean;
  notes?: string;
}

export const DEFAULT_CHECKLIST: PreLaunchChecklistItem[] = [
  { id: 'chk-1', title: 'Buat NIB (Nomor Induk Berusaha) via OSS.go.id (Wajib & Gratis)', category: 'legalitas', isCompleted: false },
  { id: 'chk-2', title: 'Pendaftaran Sertifikasi Halal (Self-Declare BPJPH Kemenag)', category: 'legalitas', isCompleted: false },
  { id: 'chk-3', title: 'Pendaftaran Izin Edar P-IRT Dinkes (bila produk makanan tahan lama)', category: 'legalitas', isCompleted: false },
  { id: 'chk-4', title: 'Buat Akun Instagram / TikTok Bisnis & Pasang Logo Usaha', category: 'branding', isCompleted: false },
  { id: 'chk-5', title: 'Daftarkan Titik Lokasi Toko di Google Maps (Google Profil Bisnis)', category: 'branding', isCompleted: false },
  { id: 'chk-6', title: 'Cetak Spanduk Banner, Lembar Menu, & Stiker Kemasan', category: 'branding', isCompleted: false },
  { id: 'chk-7', title: 'Blind Taste Test (Uji Rasa) ke minimal 10 calon konsumen objektif', category: 'operasional', isCompleted: false },
  { id: 'chk-8', title: 'Kunci Supplier Bahan Baku Utama (siapkan minimal 2 cadangan)', category: 'operasional', isCompleted: false },
  { id: 'chk-9', title: 'Buat Lembar SOP Gramatur Resep agar rasa & takaran selalu seragam', category: 'operasional', isCompleted: false },
  { id: 'chk-10', title: 'Simulasi Latihan Kecepatan Penyajian (Target < 3 menit per porsi)', category: 'operasional', isCompleted: false },
];

// Gudang Ide / Multi-Proyek Bisnis
export interface BusinessProject {
  id: string;
  name: string;
  category: string;
  createdAt: number;
  updatedAt: number;
  profile: StoreProfile;
  materials: RawMaterial[];
  recipes: ProductRecipe[];
  dailyTargets: DailySalesTarget[];
  capitalItems: CapitalItem[];
  expenses: FixedExpense[];
  checklists: PreLaunchChecklistItem[];
}

// Starter Pack Presets (Template Ide Siap Pakai)
export interface StarterPackPreset {
  id: string;
  name: string;
  category: string;
  icon: 'coffee' | 'target' | 'zap';
  badge: string;
  desc: string;
  description?: string;
  estimatedCapex: number;
  estimatedOpex: number;
  materials: RawMaterial[];
  recipes: ProductRecipe[];
  capitalItems: CapitalItem[];
  expenses: FixedExpense[];
  dailyTargets: DailySalesTarget[];
}

export const STARTER_PACKS: StarterPackPreset[] = [
  {
    id: 'pack-kopi',
    name: 'Kedai Kopi Susu Gula Aren',
    category: 'Minuman Kopi',
    icon: 'coffee',
    badge: 'Paling Populer',
    desc: 'Konsep kedai kopi susu kekinian gerobak/booth dengan margin tinggi dan perputaran cepat.',
    estimatedCapex: 6500000,
    estimatedOpex: 2700000,
    materials: [
      { id: 'mat-k1', name: 'Biji Kopi House Blend (Espresso)', purchasePrice: 120000, purchaseVolume: 1000, unit: 'gr', category: 'bahan', currentStock: 2000, minStockAlert: 500 },
      { id: 'mat-k2', name: 'Susu UHT Full Cream', purchasePrice: 19000, purchaseVolume: 1000, unit: 'ml', category: 'bahan', currentStock: 5000, minStockAlert: 2000 },
      { id: 'mat-k3', name: 'Gula Aren Cair Organik', purchasePrice: 45000, purchaseVolume: 1000, unit: 'ml', category: 'bahan', currentStock: 2000, minStockAlert: 500 },
      { id: 'mat-k4', name: 'Krimer Nabati Bubuk', purchasePrice: 38000, purchaseVolume: 1000, unit: 'gr', category: 'bahan', currentStock: 1000, minStockAlert: 200 },
      { id: 'mat-k5', name: 'Cup Sablon 16oz + Tutup Datar', purchasePrice: 28000, purchaseVolume: 50, unit: 'pcs', category: 'kemasan', currentStock: 200, minStockAlert: 50 },
      { id: 'mat-k6', name: 'Sedotan Steril Bungkus Kertas', purchasePrice: 15000, purchaseVolume: 100, unit: 'pcs', category: 'kemasan', currentStock: 300, minStockAlert: 50 },
      { id: 'mat-k7', name: 'Kantong Plastik Kresek T (Gelas)', purchasePrice: 12000, purchaseVolume: 100, unit: 'pcs', category: 'kemasan', currentStock: 200, minStockAlert: 50 },
      { id: 'mat-k8', name: 'Es Batu Kristal Higienis', purchasePrice: 10000, purchaseVolume: 10000, unit: 'gr', category: 'bahan', currentStock: 20000, minStockAlert: 5000 },
    ],
    recipes: [
      {
        id: 'rec-k1',
        name: 'Kopi Susu Aren Klasik',
        category: 'Minuman Kopi',
        yieldQty: 1,
        targetSellingPrice: 15000,
        wastePercent: 3,
        inflationBuffer: 5,
        laborCost: 1000,
        utilityCost: 300,
        unitCost: 5650,
        netProfit: 9350,
        marginPercent: 62.3,
        updatedAt: Date.now(),
        ingredients: [
          { materialId: 'mat-k1', amountUsed: 18 },
          { materialId: 'mat-k2', amountUsed: 120 },
          { materialId: 'mat-k3', amountUsed: 25 },
          { materialId: 'mat-k4', amountUsed: 10 },
          { materialId: 'mat-k8', amountUsed: 150 },
        ],
        packaging: [
          { materialId: 'mat-k5', amountUsed: 1 },
          { materialId: 'mat-k6', amountUsed: 1 },
          { materialId: 'mat-k7', amountUsed: 1 },
        ],
      },
    ],
    capitalItems: [
      { id: 'cap-k1', name: 'Mesin Espresso Portafilter Komersil', qty: 1, price: 3200000, total: 3200000, lifespanMonths: 24 },
      { id: 'cap-k2', name: 'Grinder Kopi Listrik Conical Burr', qty: 1, price: 850000, total: 850000, lifespanMonths: 24 },
      { id: 'cap-k3', name: 'Kulkas Showcase Minuman 1 Pintu', qty: 1, price: 1600000, total: 1600000, lifespanMonths: 36 },
      { id: 'cap-k4', name: 'Timbangan Digital 0.1gr & Shaker', qty: 2, price: 125000, total: 250000, lifespanMonths: 12 },
      { id: 'cap-k5', name: 'Neon Box & Spanduk Menu Akrilik', qty: 1, price: 600000, total: 600000, lifespanMonths: 24 },
    ],
    expenses: [
      { id: 'exp-k1', name: 'Sewa Teras Minimarket / Titik Booth', amount: 800000, period: 'bulan' },
      { id: 'exp-k2', name: 'Upah Penjaga / Barista Part-Time', amount: 1500000, period: 'bulan' },
      { id: 'exp-k3', name: 'Listrik & Air Operasional', amount: 250000, period: 'bulan' },
      { id: 'exp-k4', name: 'Internet / Kuota Kasir', amount: 150000, period: 'bulan' },
    ],
    dailyTargets: [
      { productId: 'rec-k1', dailyQty: 30 },
    ],
  },
  {
    id: 'pack-geprek',
    name: 'Ayam Geprek Sambal Bawang',
    category: 'Kuliner Makanan',
    icon: 'target',
    badge: 'Cepat Laku',
    desc: 'Menu kuliner favorit sejuta umat dengan omset tinggi dan bahan baku mudah didapat.',
    estimatedCapex: 7800000,
    estimatedOpex: 3750000,
    materials: [
      { id: 'mat-g1', name: 'Daging Ayam Broiler Potong Segar', purchasePrice: 38000, purchaseVolume: 1000, unit: 'gr', category: 'bahan', currentStock: 10000, minStockAlert: 2000 },
      { id: 'mat-g2', name: 'Beras Pulen Premium', purchasePrice: 16000, purchaseVolume: 1000, unit: 'gr', category: 'bahan', currentStock: 25000, minStockAlert: 5000 },
      { id: 'mat-g3', name: 'Tepung Bumbu Krispi Ayam', purchasePrice: 22000, purchaseVolume: 1000, unit: 'gr', category: 'bahan', currentStock: 5000, minStockAlert: 1000 },
      { id: 'mat-g4', name: 'Minyak Goreng Jerigen', purchasePrice: 72000, purchaseVolume: 5000, unit: 'ml', category: 'bahan', currentStock: 10000, minStockAlert: 2000 },
      { id: 'mat-g5', name: 'Cabai Rawit Merah Segar', purchasePrice: 45000, purchaseVolume: 1000, unit: 'gr', category: 'bahan', currentStock: 2000, minStockAlert: 500 },
      { id: 'mat-g6', name: 'Bawang Putih & Garam Rempah', purchasePrice: 35000, purchaseVolume: 1000, unit: 'gr', category: 'bahan', currentStock: 1000, minStockAlert: 200 },
      { id: 'mat-g7', name: 'Box Bento Kraft Anti Minyak', purchasePrice: 42000, purchaseVolume: 50, unit: 'pcs', category: 'kemasan', currentStock: 200, minStockAlert: 50 },
      { id: 'mat-g8', name: 'Kertas Nasi Pembungkus & Plastik', purchasePrice: 15000, purchaseVolume: 100, unit: 'pcs', category: 'kemasan', currentStock: 300, minStockAlert: 50 },
    ],
    recipes: [
      {
        id: 'rec-g1',
        name: 'Paket Nasi Ayam Geprek Sambal Bawang',
        category: 'Kuliner Makanan',
        yieldQty: 1,
        targetSellingPrice: 18000,
        wastePercent: 4,
        inflationBuffer: 5,
        laborCost: 1500,
        utilityCost: 500,
        unitCost: 8900,
        netProfit: 9100,
        marginPercent: 50.6,
        updatedAt: Date.now(),
        ingredients: [
          { materialId: 'mat-g1', amountUsed: 125 },
          { materialId: 'mat-g2', amountUsed: 80 },
          { materialId: 'mat-g3', amountUsed: 40 },
          { materialId: 'mat-g4', amountUsed: 35 },
          { materialId: 'mat-g5', amountUsed: 20 },
          { materialId: 'mat-g6', amountUsed: 10 },
        ],
        packaging: [
          { materialId: 'mat-g7', amountUsed: 1 },
          { materialId: 'mat-g8', amountUsed: 1 },
        ],
      },
    ],
    capitalItems: [
      { id: 'cap-g1', name: 'Wajan Deep Fryer Baja Stainless Komersil', qty: 1, price: 2400000, total: 2400000, lifespanMonths: 24 },
      { id: 'cap-g2', name: 'Kompor Gas Komersil High Pressure', qty: 1, price: 1200000, total: 1200000, lifespanMonths: 24 },
      { id: 'cap-g3', name: 'Etalase Penghangat Ayam (Warmer Showcase)', qty: 1, price: 1800000, total: 1800000, lifespanMonths: 36 },
      { id: 'cap-g4', name: 'Cobek Batu Jumbo & Ulekan (2 set)', qty: 2, price: 200000, total: 400000, lifespanMonths: 36 },
      { id: 'cap-g5', name: 'Meja Preparasi Stainless & Spanduk Booth', qty: 1, price: 2000000, total: 2000000, lifespanMonths: 24 },
    ],
    expenses: [
      { id: 'exp-g1', name: 'Sewa Kios / Teras Warung', amount: 1200000, period: 'bulan' },
      { id: 'exp-g2', name: 'Gas LPG 3kg Operasional Goreng', amount: 450000, period: 'bulan' },
      { id: 'exp-g3', name: 'Upah Juru Masak / Penjaga Toko', amount: 1800000, period: 'bulan' },
      { id: 'exp-g4', name: 'Listrik & Air Bersih', amount: 300000, period: 'bulan' },
    ],
    dailyTargets: [
      { productId: 'rec-g1', dailyQty: 35 },
    ],
  },
  {
    id: 'pack-esteh',
    name: 'Booth Es Teh Manis Jumbo Solo',
    category: 'Minuman Segar',
    icon: 'zap',
    badge: 'Modal Hemat',
    desc: 'Usaha paling hemat modal dengan margin untung tinggi dan operasional sangat sederhana.',
    estimatedCapex: 3900000,
    estimatedOpex: 1950000,
    materials: [
      { id: 'mat-t1', name: 'Daun Teh Wangi Melati Racikan Khusus', purchasePrice: 40000, purchaseVolume: 1000, unit: 'gr', category: 'bahan', currentStock: 3000, minStockAlert: 500 },
      { id: 'mat-t2', name: 'Gula Pasir Tebu Murni', purchasePrice: 17500, purchaseVolume: 1000, unit: 'gr', category: 'bahan', currentStock: 20000, minStockAlert: 5000 },
      { id: 'mat-t3', name: 'Cup Sablon Ukuran 22oz Jumbo', purchasePrice: 32000, purchaseVolume: 50, unit: 'pcs', category: 'kemasan', currentStock: 300, minStockAlert: 100 },
      { id: 'mat-t4', name: 'Plastik Lid Cup Sealer Motif Roll', purchasePrice: 65000, purchaseVolume: 1200, unit: 'pcs', category: 'kemasan', currentStock: 1200, minStockAlert: 200 },
      { id: 'mat-t5', name: 'Sedotan Runcing Panjang 22cm', purchasePrice: 14000, purchaseVolume: 100, unit: 'pcs', category: 'kemasan', currentStock: 300, minStockAlert: 50 },
      { id: 'mat-t6', name: 'Es Batu Kristal Higienis', purchasePrice: 10000, purchaseVolume: 10000, unit: 'gr', category: 'bahan', currentStock: 25000, minStockAlert: 5000 },
      { id: 'mat-t7', name: 'Kresek Bening 1 Gelas', purchasePrice: 10000, purchaseVolume: 100, unit: 'pcs', category: 'kemasan', currentStock: 300, minStockAlert: 50 },
    ],
    recipes: [
      {
        id: 'rec-t1',
        name: 'Es Teh Manis Jumbo Solo 22oz',
        category: 'Minuman Segar',
        yieldQty: 1,
        targetSellingPrice: 5000,
        wastePercent: 2,
        inflationBuffer: 5,
        laborCost: 500,
        utilityCost: 150,
        unitCost: 1850,
        netProfit: 3150,
        marginPercent: 63.0,
        updatedAt: Date.now(),
        ingredients: [
          { materialId: 'mat-t1', amountUsed: 10 },
          { materialId: 'mat-t2', amountUsed: 35 },
          { materialId: 'mat-t6', amountUsed: 250 },
        ],
        packaging: [
          { materialId: 'mat-t3', amountUsed: 1 },
          { materialId: 'mat-t4', amountUsed: 1 },
          { materialId: 'mat-t5', amountUsed: 1 },
          { materialId: 'mat-t7', amountUsed: 1 },
        ],
      },
    ],
    capitalItems: [
      { id: 'cap-t1', name: 'Booth Lipat Portable Aluminium + Branding', qty: 1, price: 1600000, total: 1600000, lifespanMonths: 24 },
      { id: 'cap-t2', name: 'Mesin Cup Sealer Manual Presisi', qty: 1, price: 750000, total: 750000, lifespanMonths: 24 },
      { id: 'cap-t3', name: 'Termos Es Batu Jumbo 30 Liter', qty: 1, price: 350000, total: 350000, lifespanMonths: 18 },
      { id: 'cap-t4', name: 'Panci Stainless Rebus Teh & Saringan Kain', qty: 1, price: 400000, total: 400000, lifespanMonths: 36 },
      { id: 'cap-t5', name: 'Banner Standee Promosi & Lampu Sorot', qty: 1, price: 300000, total: 300000, lifespanMonths: 12 },
    ],
    expenses: [
      { id: 'exp-t1', name: 'Sewa Titik Teras Toko / Depan Ruko', amount: 500000, period: 'bulan' },
      { id: 'exp-t2', name: 'Upah Jaga Booth (Shift)', amount: 1200000, period: 'bulan' },
      { id: 'exp-t3', name: 'Es Batu & Air Galon Tambahan', amount: 250000, period: 'bulan' },
    ],
    dailyTargets: [
      { productId: 'rec-t1', dailyQty: 50 },
    ],
  },
];

export interface CompletedTransaction {
  id: string;
  timestamp: number;
  dateStr: string;
  timeStr: string;
  cashierName?: string;
  paymentMethod: 'tunai' | 'qris';
  items: {
    productId: string;
    name: string;
    qty: number;
    price: number;
    subtotal: number;
  }[];
  subtotal?: number;
  taxAmount?: number;
  total: number;
  cashReceived: number;
  change: number;
}

// Storage keys
const STORAGE_PREFIX = '@meracik_ide_clean_v4_';
const KEY_MATERIALS = `${STORAGE_PREFIX}materials`;
const KEY_RECIPES = `${STORAGE_PREFIX}recipes`;
const KEY_CAPITAL = `${STORAGE_PREFIX}capital`;
const KEY_EXPENSES = `${STORAGE_PREFIX}expenses`;
const KEY_TARGETS = `${STORAGE_PREFIX}targets`;
const KEY_TRANSACTIONS = `${STORAGE_PREFIX}transactions`;
const KEY_PROFILE = `${STORAGE_PREFIX}profile`;
const KEY_PROJECTS_LIST = `${STORAGE_PREFIX}projects_list`;
const KEY_ACTIVE_PROJECT_ID = `${STORAGE_PREFIX}active_project_id`;
const KEY_CHECKLISTS = `${STORAGE_PREFIX}checklists`;

// ==========================================
// 2. REALISTIC INDONESIAN UMKM SEED DATA
// ==========================================

// 100% BERSIH (Zero Dummy Data - Siap Diisi Sendiri)

// ==========================================
// 3. UTILITY HELPERS
// ==========================================

const formatRupiah = (val: number | string): string => {
  const num = typeof val === 'number' ? val : Number(String(val).replace(/[^0-9]/g, ''));
  if (isNaN(num)) return '0';
  return num.toLocaleString('id-ID');
};

const escapeHtml = (str: unknown): string => {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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

const computeSmartPricing = (unitCost: number, profile: StoreProfile) => {
  if (unitCost <= 0) {
    return { offlinePrice: 0, resellerPrice: 0, grosirPrice: 0, ojolPrice: 0 };
  }
  const roundStep = profile.priceRounding || 1000;
  const rMargin = (profile.retailMarginPercent || 35) / 100;
  const resMargin = (profile.resellerMarginPercent || 20) / 100;
  const ojolComm = (profile.ojolCommissionPercent || 20) / 100;

  const offlinePrice = Math.ceil((unitCost / Math.max(0.01, 1 - rMargin)) / roundStep) * roundStep;
  const resellerPrice = Math.ceil((unitCost / Math.max(0.01, 1 - resMargin)) / roundStep) * roundStep;
  const grosirPrice = Math.ceil((unitCost / 0.85) / roundStep) * roundStep;
  const ojolPrice = Math.ceil((offlinePrice / Math.max(0.01, 1 - ojolComm)) / roundStep) * roundStep;

  return { offlinePrice, resellerPrice, grosirPrice, ojolPrice };
};

// ==========================================
// 4. MAIN COMPONENT (MOBILE SHELL)
// ==========================================

export default function App() {
  return (
    <SafeAreaProvider>
      <MainAppScreen />
    </SafeAreaProvider>
  );
}

function MainAppScreen() {
  const insets = useSafeAreaInsets();

  // Bottom Navigation: 'resep' | 'bep' | 'bahan'
  const [activeTab, setActiveTab] = useState<'resep' | 'bep' | 'bahan'>('resep');

  // Core Data: 100% BERSIH (Zero Dummy Data - Siap Diisi Sendiri)
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [recipes, setRecipes] = useState<ProductRecipe[]>([]);
  const [capitalItems, setCapitalItems] = useState<CapitalItem[]>([]);
  const [expenses, setExpenses] = useState<FixedExpense[]>([]);
  const [dailyTargets, setDailyTargets] = useState<DailySalesTarget[]>([]);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [matCategoryFilter, setMatCategoryFilter] = useState<'all' | 'bahan' | 'kemasan' | 'menipis'>('all');
  const [recipeCategoryFilter, setRecipeCategoryFilter] = useState<'all' | 'Minuman' | 'Makanan' | 'Lainnya'>('all');
  const [bepSubTab, setBepSubTab] = useState<'target' | 'capex' | 'opex' | 'grafik' | 'checklist'>('target');

  // Multi-Project / Gudang Ide State
  const [projects, setProjects] = useState<BusinessProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>('proj-default');
  const [showProjectsModal, setShowProjectsModal] = useState(false);
  const [formNewProjectName, setFormNewProjectName] = useState('');
  const [formNewProjectCategory, setFormNewProjectCategory] = useState('Kuliner & Minuman');
  const [showStarterPackModal, setShowStarterPackModal] = useState(false);

  // Pre-Launch Checklist State
  const [checklists, setChecklists] = useState<PreLaunchChecklistItem[]>(DEFAULT_CHECKLIST);
  const [checklistFilter, setChecklistFilter] = useState<'all' | 'legalitas' | 'branding' | 'operasional'>('all');
  const [formCustomChecklistTitle, setFormCustomChecklistTitle] = useState('');
  const [formCustomChecklistCat, setFormCustomChecklistCat] = useState<'legalitas' | 'branding' | 'operasional'>('operasional');

  // Capital Form State (with Depreciation)
  const [formCapLifespan, setFormCapLifespan] = useState<number>(24);

  // Store Profile & Settings State
  const [storeProfile, setStoreProfile] = useState<StoreProfile>(DEFAULT_PROFILE);
  const [formProfileName, setFormProfileName] = useState(DEFAULT_PROFILE.name);
  const [formProfilePhone, setFormProfilePhone] = useState(DEFAULT_PROFILE.phone);
  const [formProfileAddress, setFormProfileAddress] = useState(DEFAULT_PROFILE.address);
  const [formProfileFooter, setFormProfileFooter] = useState(DEFAULT_PROFILE.footerNote);
  const [formRetailMargin, setFormRetailMargin] = useState(String(DEFAULT_PROFILE.retailMarginPercent || 35));
  const [formResellerMargin, setFormResellerMargin] = useState(String(DEFAULT_PROFILE.resellerMarginPercent || 20));
  const [formOjolCommission, setFormOjolCommission] = useState(String(DEFAULT_PROFILE.ojolCommissionPercent || 20));
  const [formPriceRounding, setFormPriceRounding] = useState<500 | 1000>(DEFAULT_PROFILE.priceRounding || 1000);
  const [formWorkingCapital, setFormWorkingCapital] = useState(String(DEFAULT_PROFILE.workingCapital || ''));
  const [formOperatingDays, setFormOperatingDays] = useState(String(DEFAULT_PROFILE.operatingDaysPerMonth || 30));
  const [formDefaultInflation, setFormDefaultInflation] = useState<number>(DEFAULT_PROFILE.defaultInflationBuffer || 5);
  const [formInvestorShare, setFormInvestorShare] = useState<number>(DEFAULT_PROFILE.investorSharePercent || 30);
  const [formIncludeDepreciation, setFormIncludeDepreciation] = useState<boolean>(DEFAULT_PROFILE.includeDepreciationInOpex || false);
  const [bepScenario, setBepScenario] = useState<'pesimis' | 'normal' | 'optimis'>('normal');
  const [shoppingPortions, setShoppingPortions] = useState<number>(50);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreJsonInput, setRestoreJsonInput] = useState('');

  // Modals
  const [showAddRecipeModal, setShowAddRecipeModal] = useState(false);
  const [showAddMaterialModal, setShowAddMaterialModal] = useState(false);
  const [showAddCapitalModal, setShowAddCapitalModal] = useState(false);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showRecipeDetailModal, setShowRecipeDetailModal] = useState(false);
  const [selectedDetailRecipe, setSelectedDetailRecipe] = useState<ProductRecipe | null>(null);
  const [testInflationBuffer, setTestInflationBuffer] = useState<number>(0);

  // Recipe Builder Form State
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);
  const [formRecipeName, setFormRecipeName] = useState('');
  const [formRecipeCat, setFormRecipeCat] = useState('Minuman');
  const [formYield, setFormYield] = useState('1');
  const [formPrice, setFormPrice] = useState('');
  const [formWaste, setFormWaste] = useState('0');
  const [formInflation, setFormInflation] = useState<number>(0);
  const [formLaborCost, setFormLaborCost] = useState('0');
  const [formUtilityCost, setFormUtilityCost] = useState('0');
  const [formRecipeIngredients, setFormRecipeIngredients] = useState<RecipeIngredient[]>([]);
  const [formRecipePackaging, setFormRecipePackaging] = useState<RecipeIngredient[]>([]);
  const [builderTab, setBuilderTab] = useState<'bahan' | 'kemasan'>('bahan');
  const [showPickerModal, setShowPickerModal] = useState(false);
  const [pickerSelectedMatId, setPickerSelectedMatId] = useState('');
  const [pickerAmountUsed, setPickerAmountUsed] = useState('');

  // Material Form State
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [formMatName, setFormMatName] = useState('');
  const [formMatPrice, setFormMatPrice] = useState('');
  const [formMatVol, setFormMatVol] = useState('');
  const [formMatUnit, setFormMatUnit] = useState<UnitType>('gr');
  const [formMatCat, setFormMatCat] = useState<ItemCategory>('bahan');
  const [formCurrentStock, setFormCurrentStock] = useState('');
  const [formMinAlert, setFormMinAlert] = useState('');

  // Capital Form State
  const [formCapName, setFormCapName] = useState('');
  const [formCapQty, setFormCapQty] = useState('1');
  const [formCapPrice, setFormCapPrice] = useState('');

  // Expense Form State
  const [formExpName, setFormExpName] = useState('');
  const [formExpAmount, setFormExpAmount] = useState('');

  // Unit Converter Modal State (CONV)
  const [showConverterModal, setShowConverterModal] = useState(false);
  const [convMode, setConvMode] = useState<'timbangan' | 'kemasan'>('timbangan');
  const [convBulkPrice, setConvBulkPrice] = useState('');
  const [convBulkCapacity, setConvBulkCapacity] = useState('');
  const [convPortionUsage, setConvPortionUsage] = useState('');
  const [convTarget, setConvTarget] = useState<'material' | 'picker' | null>(null);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
      const chk = await AsyncStorage.getItem(KEY_CHECKLISTS);
      const loadedChecklists: PreLaunchChecklistItem[] = chk ? JSON.parse(chk) : DEFAULT_CHECKLIST;
      setChecklists(loadedChecklists);

      let loadedProfile: StoreProfile = DEFAULT_PROFILE;
      const p = await AsyncStorage.getItem(KEY_PROFILE);
      if (p) {
        const parsed = JSON.parse(p);
        loadedProfile = { ...DEFAULT_PROFILE, ...parsed };
        setStoreProfile(loadedProfile);
        setFormProfileName(loadedProfile.name || '');
        setFormProfilePhone(loadedProfile.phone || '');
        setFormProfileAddress(loadedProfile.address || '');
        setFormProfileFooter(loadedProfile.footerNote || DEFAULT_PROFILE.footerNote);
        setFormRetailMargin(String(loadedProfile.retailMarginPercent ?? 35));
        setFormResellerMargin(String(loadedProfile.resellerMarginPercent ?? 20));
        setFormOjolCommission(String(loadedProfile.ojolCommissionPercent ?? 20));
        setFormPriceRounding(loadedProfile.priceRounding || 1000);
        setFormWorkingCapital(loadedProfile.workingCapital ? String(loadedProfile.workingCapital) : '');
        setFormOperatingDays(String(loadedProfile.operatingDaysPerMonth || 30));
        setFormDefaultInflation(loadedProfile.defaultInflationBuffer ?? 5);
        setFormInvestorShare(loadedProfile.investorSharePercent ?? 30);
        setFormIncludeDepreciation(!!loadedProfile.includeDepreciationInOpex);
      }

      // Load Projects List & Active Project
      const projStr = await AsyncStorage.getItem(KEY_PROJECTS_LIST);
      const activeProjId = await AsyncStorage.getItem(KEY_ACTIVE_PROJECT_ID);

      let currentProjects: BusinessProject[] = [];
      if (projStr) {
        currentProjects = JSON.parse(projStr);
      }

      if (currentProjects.length === 0) {
        const initialProject: BusinessProject = {
          id: 'proj-default',
          name: loadedProfile.name || 'Ide Usaha Utama',
          category: 'Kuliner & Minuman',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          profile: loadedProfile,
          materials: m ? JSON.parse(m) : [],
          recipes: r ? JSON.parse(r) : [],
          dailyTargets: t ? JSON.parse(t) : [],
          capitalItems: c ? JSON.parse(c) : [],
          expenses: e ? JSON.parse(e) : [],
          checklists: loadedChecklists,
        };
        currentProjects = [initialProject];
        persist(KEY_PROJECTS_LIST, currentProjects);
        persist(KEY_ACTIVE_PROJECT_ID, initialProject.id);
        setActiveProjectId(initialProject.id);
      } else {
        const found = currentProjects.find((x) => x.id === activeProjId) || currentProjects[0];
        setActiveProjectId(found.id);
      }
      setProjects(currentProjects);
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
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Synchronize state with current project in projects list
  const syncToActiveProject = (updatedState: Partial<BusinessProject>) => {
    setProjects((prev) => {
      const updated = prev.map((proj) => {
        if (proj.id === activeProjectId) {
          return {
            ...proj,
            updatedAt: Date.now(),
            ...updatedState,
          };
        }
        return proj;
      });
      persist(KEY_PROJECTS_LIST, updated);
      return updated;
    });
  };

  // Switch Active Project
  const handleSwitchProject = (targetId: string) => {
    const target = projects.find((p) => p.id === targetId);
    if (!target) return;

    // Save current active project state before switching
    const updatedProjects = projects.map((p) => {
      if (p.id === activeProjectId) {
        return {
          ...p,
          updatedAt: Date.now(),
          profile: storeProfile,
          materials,
          recipes,
          dailyTargets,
          capitalItems,
          expenses,
          checklists,
        };
      }
      return p;
    });
    setProjects(updatedProjects);
    persist(KEY_PROJECTS_LIST, updatedProjects);

    // Switch to target
    setActiveProjectId(target.id);
    persist(KEY_ACTIVE_PROJECT_ID, target.id);

    const prof: StoreProfile = { ...DEFAULT_PROFILE, ...(target.profile || {}) };
    setStoreProfile(prof);
    setFormProfileName(prof.name || '');
    setFormProfilePhone(prof.phone || '');
    setFormProfileAddress(prof.address || '');
    setFormProfileFooter(prof.footerNote || DEFAULT_PROFILE.footerNote);
    setFormRetailMargin(String(prof.retailMarginPercent ?? 35));
    setFormResellerMargin(String(prof.resellerMarginPercent ?? 20));
    setFormOjolCommission(String(prof.ojolCommissionPercent ?? 20));
    setFormPriceRounding(prof.priceRounding || 1000);
    setFormWorkingCapital(prof.workingCapital ? String(prof.workingCapital) : '');
    setFormOperatingDays(String(prof.operatingDaysPerMonth || 30));
    setFormDefaultInflation(prof.defaultInflationBuffer ?? 5);
    setFormInvestorShare(prof.investorSharePercent ?? 30);
    setFormIncludeDepreciation(!!prof.includeDepreciationInOpex);

    const m = target.materials || [];
    const r = target.recipes || [];
    const t = target.dailyTargets || [];
    const c = target.capitalItems || [];
    const e = target.expenses || [];
    const chk = target.checklists && target.checklists.length > 0 ? target.checklists : DEFAULT_CHECKLIST;

    setMaterials(m);
    setRecipes(r);
    setDailyTargets(t);
    setCapitalItems(c);
    setExpenses(e);
    setChecklists(chk);

    persist(KEY_MATERIALS, m);
    persist(KEY_RECIPES, r);
    persist(KEY_TARGETS, t);
    persist(KEY_CAPITAL, c);
    persist(KEY_EXPENSES, e);
    persist(KEY_PROFILE, prof);
    persist(KEY_CHECKLISTS, chk);

    setShowProjectsModal(false);
    triggerToast(`Beralih ke ide: ${target.name}`);
  };

  // Create New Project (Blank or from Starter Pack)
  const handleCreateNewProject = (name: string, category: string, starterPack?: StarterPackPreset) => {
    const trimmed = name.trim() || (starterPack ? starterPack.name : 'Ide Bisnis Baru');
    const newId = `proj-${Date.now()}`;

    const newProfile: StoreProfile = {
      ...DEFAULT_PROFILE,
      name: trimmed,
      operatingDaysPerMonth: 30,
    };

    const newProject: BusinessProject = {
      id: newId,
      name: trimmed,
      category: category.trim() || (starterPack ? starterPack.category : 'Kuliner & Minuman'),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      profile: newProfile,
      materials: starterPack ? [...starterPack.materials] : [],
      recipes: starterPack ? [...starterPack.recipes] : [],
      dailyTargets: starterPack ? [...starterPack.dailyTargets] : [],
      capitalItems: starterPack ? [...starterPack.capitalItems] : [],
      expenses: starterPack ? [...starterPack.expenses] : [],
      checklists: DEFAULT_CHECKLIST.map((chk) => ({ ...chk, isCompleted: false })),
    };

    const updatedProjects = projects.map((p) => {
      if (p.id === activeProjectId) {
        return {
          ...p,
          updatedAt: Date.now(),
          profile: storeProfile,
          materials,
          recipes,
          dailyTargets,
          capitalItems,
          expenses,
          checklists,
        };
      }
      return p;
    });

    const combined = [...updatedProjects, newProject];
    setProjects(combined);
    persist(KEY_PROJECTS_LIST, combined);

    setActiveProjectId(newId);
    persist(KEY_ACTIVE_PROJECT_ID, newId);

    setStoreProfile(newProfile);
    setFormProfileName(newProfile.name);
    setFormProfilePhone('');
    setFormProfileAddress('');
    setFormWorkingCapital('');
    setFormIncludeDepreciation(false);
    setMaterials(newProject.materials);
    setRecipes(newProject.recipes);
    setDailyTargets(newProject.dailyTargets);
    setCapitalItems(newProject.capitalItems);
    setExpenses(newProject.expenses);
    setChecklists(newProject.checklists);

    persist(KEY_MATERIALS, newProject.materials);
    persist(KEY_RECIPES, newProject.recipes);
    persist(KEY_TARGETS, newProject.dailyTargets);
    persist(KEY_CAPITAL, newProject.capitalItems);
    persist(KEY_EXPENSES, newProject.expenses);
    persist(KEY_PROFILE, newProfile);
    persist(KEY_CHECKLISTS, newProject.checklists);

    setShowProjectsModal(false);
    setShowStarterPackModal(false);
    setFormNewProjectName('');
    triggerToast(`Ide baru berhasil dibuat: ${trimmed}`);
  };

  // Duplicate Project
  const handleDuplicateProject = (projId: string) => {
    const source = projects.find((p) => p.id === projId);
    if (!source) return;

    const dupId = `proj-${Date.now()}`;
    const dupName = `${source.name} (Salinan)`;
    const duplicated: BusinessProject = {
      ...source,
      id: dupId,
      name: dupName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      profile: { ...source.profile, name: dupName },
      materials: JSON.parse(JSON.stringify(source.materials)),
      recipes: JSON.parse(JSON.stringify(source.recipes)),
      dailyTargets: JSON.parse(JSON.stringify(source.dailyTargets)),
      capitalItems: JSON.parse(JSON.stringify(source.capitalItems)),
      expenses: JSON.parse(JSON.stringify(source.expenses)),
      checklists: JSON.parse(JSON.stringify(source.checklists || DEFAULT_CHECKLIST)),
    };

    const updated = [...projects, duplicated];
    setProjects(updated);
    persist(KEY_PROJECTS_LIST, updated);
    triggerToast(`Ide berhasil disalin: ${dupName}`);
  };

  // Delete Project
  const handleDeleteProject = (projId: string) => {
    if (projects.length <= 1) {
      Alert.alert('Tidak Bisa Dihapus', 'Minimal harus ada 1 ide bisnis tersimpan.');
      return;
    }
    const target = projects.find((p) => p.id === projId);
    Alert.alert(
      'Hapus Ide Bisnis?',
      `Seluruh data pada "${target?.name || 'Ide ini'}" akan dihapus permanen. Lanjutkan?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Hapus',
          style: 'destructive',
          onPress: () => {
            const filtered = projects.filter((p) => p.id !== projId);
            setProjects(filtered);
            persist(KEY_PROJECTS_LIST, filtered);
            if (activeProjectId === projId) {
              handleSwitchProject(filtered[0].id);
            } else {
              triggerToast('Ide bisnis berhasil dihapus.');
            }
          },
        },
      ]
    );
  };

  // Logo Picker & Remover
  const handlePickLogo = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Izin Galeri Diperlukan', 'Izinkan akses galeri untuk memilih foto logo usaha.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0].base64) {
        const base64Data = `data:image/jpeg;base64,${result.assets[0].base64}`;
        const updated = { ...storeProfile, logoBase64: base64Data };
        setStoreProfile(updated);
        persist(KEY_PROFILE, updated);
        syncToActiveProject({ profile: updated });
        triggerToast('Logo usaha berhasil disimpan.');
      }
    } catch {
      triggerToast('Gagal memuat gambar logo.');
    }
  };

  const handleRemoveLogo = () => {
    const updated = { ...storeProfile, logoBase64: undefined };
    setStoreProfile(updated);
    persist(KEY_PROFILE, updated);
    syncToActiveProject({ profile: updated });
    triggerToast('Logo usaha dihapus.');
  };

  // Checklist Helpers
  const handleToggleChecklist = (id: string) => {
    const updated = checklists.map((c) => (c.id === id ? { ...c, isCompleted: !c.isCompleted } : c));
    setChecklists(updated);
    persist(KEY_CHECKLISTS, updated);
    syncToActiveProject({ checklists: updated });
    Haptics.selectionAsync().catch(() => {});
  };

  const handleAddCustomChecklist = () => {
    if (!formCustomChecklistTitle.trim()) return;
    const newItem: PreLaunchChecklistItem = {
      id: `chk-${Date.now()}`,
      title: formCustomChecklistTitle.trim(),
      category: formCustomChecklistCat,
      isCompleted: false,
    };
    const updated = [...checklists, newItem];
    setChecklists(updated);
    persist(KEY_CHECKLISTS, updated);
    syncToActiveProject({ checklists: updated });
    setFormCustomChecklistTitle('');
    triggerToast('Kesiapan baru ditambahkan.');
  };

  const completedChecklistCount = checklists.filter((c) => c.isCompleted).length;
  const checklistProgressPercent = checklists.length > 0 ? Math.round((completedChecklistCount / checklists.length) * 100) : 0;

  const handleSaveStoreProfile = () => {
    const rMargin = cleanNum(formRetailMargin) || 35;
    const resMargin = cleanNum(formResellerMargin) || 20;
    const ojolComm = cleanNum(formOjolCommission) || 20;
    const opDays = Math.min(31, Math.max(1, cleanNum(formOperatingDays) || 30));

    const updated: StoreProfile = {
      name: formProfileName.trim(),
      phone: formProfilePhone.trim(),
      address: formProfileAddress.trim(),
      footerNote: formProfileFooter.trim() || DEFAULT_PROFILE.footerNote,
      retailMarginPercent: Math.min(99, Math.max(1, rMargin)),
      resellerMarginPercent: Math.min(99, Math.max(1, resMargin)),
      ojolCommissionPercent: Math.min(99, Math.max(0, ojolComm)),
      priceRounding: formPriceRounding,
      workingCapital: cleanNum(formWorkingCapital),
      operatingDaysPerMonth: opDays,
      defaultInflationBuffer: formDefaultInflation,
      investorSharePercent: formInvestorShare,
      includeDepreciationInOpex: formIncludeDepreciation,
      logoBase64: storeProfile.logoBase64,
    };
    setStoreProfile(updated);
    persist(KEY_PROFILE, updated);
    syncToActiveProject({ profile: updated, name: updated.name });
    setShowSettingsModal(false);
    triggerToast('Seluruh pengaturan berhasil disimpan.');
  };

  const handleSaveWorkingCapital = () => {
    const cap = cleanNum(formWorkingCapital);
    const updated: StoreProfile = { ...storeProfile, workingCapital: cap };
    setStoreProfile(updated);
    persist(KEY_PROFILE, updated);
    syncToActiveProject({ profile: updated });
    triggerToast('Modal kas operasional berhasil disimpan.');
  };

  const handleResetData = () => {
    Alert.alert(
      'Reset Data Aplikasi',
      'Hapus seluruh data resep, bahan baku, modal awal, dan beban rutin menjadi bersih (0)?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Reset',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.clear();
            setMaterials([]);
            setRecipes([]);
            setCapitalItems([]);
            setExpenses([]);
            setDailyTargets([]);
            setStoreProfile(DEFAULT_PROFILE);
            setFormProfileName(DEFAULT_PROFILE.name);
            setFormProfilePhone(DEFAULT_PROFILE.phone);
            setFormProfileAddress(DEFAULT_PROFILE.address);
            setFormProfileFooter(DEFAULT_PROFILE.footerNote);
            setFormRetailMargin(String(DEFAULT_PROFILE.retailMarginPercent || 35));
            setFormResellerMargin(String(DEFAULT_PROFILE.resellerMarginPercent || 20));
            setFormOjolCommission(String(DEFAULT_PROFILE.ojolCommissionPercent || 20));
            setFormPriceRounding(DEFAULT_PROFILE.priceRounding || 1000);
            setFormWorkingCapital('');
            setFormOperatingDays(String(DEFAULT_PROFILE.operatingDaysPerMonth || 30));
            setFormDefaultInflation(DEFAULT_PROFILE.defaultInflationBuffer || 5);
            setFormInvestorShare(DEFAULT_PROFILE.investorSharePercent || 30);
            setShowSettingsModal(false);
            triggerToast('Data berhasil direset bersih.');
          },
        },
      ]
    );
  };

  // Full JSON Database Export
  const handleExportJsonBackup = async () => {
    try {
      const backupPayload = {
        app: 'Meracik Ide',
        schemaVersion: 4,
        exportedAt: new Date().toISOString(),
        storeProfile,
        materials,
        recipes,
        capitalItems,
        expenses,
        dailyTargets,
      };

      const jsonString = JSON.stringify(backupPayload, null, 2);
      const fileName = `meracik_ide_backup_${Date.now()}.json`;
      const filePath = `${FileSystem.cacheDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(filePath, jsonString, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filePath, {
          mimeType: 'application/json',
          dialogTitle: 'Cadangkan Berkas Database Meracik Ide',
        });
      } else {
        await Share.share({
          message: jsonString,
          title: 'Cadangan Database Meracik Ide',
        });
      }
      triggerToast('Berkas cadangan JSON berhasil dibuat.');
    } catch (err) {
      console.warn('Export JSON error', err);
      triggerToast('Gagal membuat berkas cadangan.');
    }
  };

  // Full JSON Database Restore
  const handleExecuteRestore = async () => {
    if (!restoreJsonInput.trim()) {
      Alert.alert('Data Kosong', 'Tempelkan (paste) teks kode JSON cadangan terlebih dahulu.');
      return;
    }

    try {
      const parsed = JSON.parse(restoreJsonInput.trim());

      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Bukan objek JSON valid');
      }

      const recCount = Array.isArray(parsed.recipes) ? parsed.recipes.length : 0;
      const matCount = Array.isArray(parsed.materials) ? parsed.materials.length : 0;
      const capCount = Array.isArray(parsed.capitalItems) ? parsed.capitalItems.length : 0;
      const expCount = Array.isArray(parsed.expenses) ? parsed.expenses.length : 0;

      Alert.alert(
        'Pulihkan Data Cadangan?',
        `Ditemukan data cadangan valid:\n• ${recCount} Resep & HPP\n• ${matCount} Bahan Baku\n• ${capCount} Aset Modal (Capex)\n• ${expCount} Beban Rutin (Opex)\n\nSeluruh data saat ini akan ditimpa dengan data cadangan ini. Lanjutkan?`,
        [
          { text: 'Batal', style: 'cancel' },
          {
            text: 'Ya, Pulihkan Data',
            style: 'destructive',
            onPress: async () => {
              if (Array.isArray(parsed.materials)) {
                setMaterials(parsed.materials);
                await persist(KEY_MATERIALS, parsed.materials);
              }
              if (Array.isArray(parsed.recipes)) {
                setRecipes(parsed.recipes);
                await persist(KEY_RECIPES, parsed.recipes);
              }
              if (Array.isArray(parsed.capitalItems)) {
                setCapitalItems(parsed.capitalItems);
                await persist(KEY_CAPITAL, parsed.capitalItems);
              }
              if (Array.isArray(parsed.expenses)) {
                setExpenses(parsed.expenses);
                await persist(KEY_EXPENSES, parsed.expenses);
              }
              if (Array.isArray(parsed.dailyTargets)) {
                setDailyTargets(parsed.dailyTargets);
                await persist(KEY_TARGETS, parsed.dailyTargets);
              }
              if (parsed.storeProfile && typeof parsed.storeProfile === 'object') {
                const merged = { ...DEFAULT_PROFILE, ...parsed.storeProfile };
                setStoreProfile(merged);
                await persist(KEY_PROFILE, merged);
                setFormProfileName(merged.name || '');
                setFormProfilePhone(merged.phone || '');
                setFormProfileAddress(merged.address || '');
                setFormProfileFooter(merged.footerNote || DEFAULT_PROFILE.footerNote);
                setFormRetailMargin(String(merged.retailMarginPercent ?? 35));
                setFormResellerMargin(String(merged.resellerMarginPercent ?? 20));
                setFormOjolCommission(String(merged.ojolCommissionPercent ?? 20));
                setFormPriceRounding(merged.priceRounding || 1000);
                setFormWorkingCapital(merged.workingCapital ? String(merged.workingCapital) : '');
                setFormOperatingDays(String(merged.operatingDaysPerMonth || 30));
                setFormDefaultInflation(merged.defaultInflationBuffer ?? 5);
                setFormInvestorShare(merged.investorSharePercent ?? 30);
              }

              setShowRestoreModal(false);
              setShowSettingsModal(false);
              setRestoreJsonInput('');
              triggerToast('Data berhasil dipulihkan secara utuh!');
            },
          },
        ]
      );
    } catch {
      Alert.alert(
        'Format Tidak Valid',
        'Teks yang Anda masukkan bukan berkas JSON cadangan Meracik Ide yang valid. Mohon periksa kembali.'
      );
    }
  };

  // ==========================================
  // 6. BUSINESS CALCULATION ENGINE
  // ==========================================

  // Live Recipe Calculation with Labor & Utility Costs
  const computeBatchCost = (
    ings: RecipeIngredient[],
    packs: RecipeIngredient[],
    wastePct: number,
    inflationPct: number = 0,
    laborCost: number = 0,
    utilityCost: number = 0
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

    const inflatedIngCost = ingCost * (1 + inflationPct / 100);
    const adjustedIngCost = inflatedIngCost * (1 + wastePct / 100);
    return Math.round(adjustedIngCost + packCost + laborCost + utilityCost);
  };

  const liveLabor = cleanNum(formLaborCost);
  const liveUtility = cleanNum(formUtilityCost);
  const liveBatchCost = computeBatchCost(
    formRecipeIngredients,
    formRecipePackaging,
    cleanNum(formWaste),
    formInflation,
    liveLabor,
    liveUtility
  );
  const liveYield = Math.max(cleanNum(formYield), 1);
  const liveUnitHpp = Math.round(liveBatchCost / liveYield);
  const liveSellingPrice = cleanNum(formPrice);
  const liveNetProfit = liveSellingPrice - liveUnitHpp;
  const liveMarginPct = liveSellingPrice > 0 ? (liveNetProfit / liveSellingPrice) * 100 : 0;
  
  // 3-Tier Prices + Ojol (Dynamic from storeProfile settings):
  const liveSmartPrices = computeSmartPricing(liveUnitHpp, storeProfile);
  const tierEceran = liveSmartPrices.offlinePrice;
  const tierReseller = liveSmartPrices.resellerPrice;
  const tierGrosir = liveSmartPrices.grosirPrice;
  const ojolDeliveryPrice = liveSmartPrices.ojolPrice;

  // BEP / Balik Modal Engine (Capex + Working Capital + Dynamic Days + 3-Scenario Risk)
  const totalCapex = useMemo(() => {
    return capitalItems.reduce((acc, c) => acc + c.total, 0);
  }, [capitalItems]);

  const totalWorkingCapital = storeProfile.workingCapital || 0;
  const totalInitialCapital = totalCapex + totalWorkingCapital;
  const operatingDays = storeProfile.operatingDaysPerMonth || 30;

  const baseMonthlyRevenue = useMemo(() => {
    return recipes.reduce((acc, rec) => {
      const target = dailyTargets.find((t) => t.productId === rec.id);
      const dailyQty = target ? target.dailyQty : 0;
      return acc + dailyQty * operatingDays * rec.targetSellingPrice;
    }, 0);
  }, [recipes, dailyTargets, operatingDays]);

  const baseMonthlyCogs = useMemo(() => {
    return recipes.reduce((acc, rec) => {
      const target = dailyTargets.find((t) => t.productId === rec.id);
      const dailyQty = target ? target.dailyQty : 0;
      return acc + dailyQty * operatingDays * rec.unitCost;
    }, 0);
  }, [recipes, dailyTargets, operatingDays]);

  const totalMonthlyFixedExpenses = useMemo(() => {
    return expenses.reduce((acc, exp) => {
      return acc + (exp.period === 'hari' ? exp.amount * operatingDays : exp.amount);
    }, 0);
  }, [expenses, operatingDays]);

  // Feature 3: Asset Depreciation
  const totalMonthlyDepreciation = useMemo(() => {
    return capitalItems.reduce((acc, c) => {
      const months = c.lifespanMonths && c.lifespanMonths > 0 ? c.lifespanMonths : 24;
      return acc + Math.round(c.total / months);
    }, 0);
  }, [capitalItems]);

  const effectiveMonthlyFixedExpenses = useMemo(() => {
    return totalMonthlyFixedExpenses + (storeProfile.includeDepreciationInOpex ? totalMonthlyDepreciation : 0);
  }, [totalMonthlyFixedExpenses, totalMonthlyDepreciation, storeProfile.includeDepreciationInOpex]);

  // Scenario Multiplier: Pesimis (-30%), Normal (Target), Optimis (+30%)
  const scenarioMultiplier = bepScenario === 'pesimis' ? 0.7 : bepScenario === 'optimis' ? 1.3 : 1.0;
  const simulatedMonthlyRevenue = Math.round(baseMonthlyRevenue * scenarioMultiplier);
  const simulatedMonthlyCogs = Math.round(baseMonthlyCogs * scenarioMultiplier);

  const totalMonthlyExpenses = simulatedMonthlyCogs + effectiveMonthlyFixedExpenses;
  const monthlyOperatingProfit = simulatedMonthlyRevenue - totalMonthlyExpenses;
  const bepMonths = monthlyOperatingProfit > 0 ? (totalInitialCapital / monthlyOperatingProfit).toFixed(1) : '-';
  const bepDays = monthlyOperatingProfit > 0 ? Math.round((totalInitialCapital / monthlyOperatingProfit) * operatingDays) : 0;

  // Daily Operational BEP Indicator Calculations
  const dailyFixedCost = useMemo(() => {
    return Math.round(effectiveMonthlyFixedExpenses / operatingDays);
  }, [effectiveMonthlyFixedExpenses, operatingDays]);

  const avgProfitPerUnit = useMemo(() => {
    if (recipes.length === 0) return 0;
    const totalProf = recipes.reduce((acc, r) => acc + Math.max(0, r.netProfit), 0);
    return Math.round(totalProf / recipes.length);
  }, [recipes]);

  const dailyBepTargetUnits = useMemo(() => {
    if (dailyFixedCost <= 0 || avgProfitPerUnit <= 0) return 0;
    return Math.ceil(dailyFixedCost / avgProfitPerUnit);
  }, [dailyFixedCost, avgProfitPerUnit]);

  // Visual Chart Averages
  const avgSellingPrice = useMemo(() => {
    if (recipes.length === 0) return 0;
    return Math.round(recipes.reduce((acc, r) => acc + r.targetSellingPrice, 0) / recipes.length);
  }, [recipes]);

  const avgUnitCost = useMemo(() => {
    if (recipes.length === 0) return 0;
    return Math.round(recipes.reduce((acc, r) => acc + r.unitCost, 0) / recipes.length);
  }, [recipes]);

  const currentProject = useMemo(() => {
    return projects.find((p) => p.id === activeProjectId) || projects[0] || null;
  }, [projects, activeProjectId]);

  // Low Stock Counter
  const lowStockCount = useMemo(() => {
    return materials.filter(
      (m) => m.currentStock !== undefined && m.minStockAlert !== undefined && m.minStockAlert > 0 && m.currentStock <= m.minStockAlert
    ).length;
  }, [materials]);

  // ==========================================
  // 7. USER ACTION HANDLERS
  // ==========================================

  // Open Recipe Detail
  const handleOpenRecipeDetail = (rec: ProductRecipe) => {
    setSelectedDetailRecipe(rec);
    setTestInflationBuffer(rec.inflationBuffer || 0);
    setShowRecipeDetailModal(true);
    Haptics.selectionAsync().catch(() => {});
  };

  // Edit Recipe
  const handleEditRecipe = (rec: ProductRecipe) => {
    setEditingRecipeId(rec.id);
    setFormRecipeName(rec.name);
    setFormRecipeCat(rec.category);
    setFormYield(String(rec.yieldQty));
    setFormPrice(String(rec.targetSellingPrice));
    setFormWaste(String(rec.wastePercent));
    setFormInflation(rec.inflationBuffer || 0);
    setFormLaborCost(String(rec.laborCost || 0));
    setFormUtilityCost(String(rec.utilityCost || 0));
    setFormRecipeIngredients([...rec.ingredients]);
    setFormRecipePackaging([...rec.packaging]);
    setShowRecipeDetailModal(false);
    setShowAddRecipeModal(true);
    Haptics.selectionAsync().catch(() => {});
  };

  // Delete Recipe
  const handleDeleteRecipe = (id: string) => {
    const rec = recipes.find((r) => r.id === id);
    Alert.alert(
      'Hapus Resep?',
      `Yakin ingin menghapus resep "${rec?.name || 'ini'}"?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: () => {
            const updated = recipes.filter((r) => r.id !== id);
            setRecipes(updated);
            persist(KEY_RECIPES, updated);

            const updatedTargets = dailyTargets.filter((t) => t.productId !== id);
            setDailyTargets(updatedTargets);
            persist(KEY_TARGETS, updatedTargets);

            setShowRecipeDetailModal(false);
            triggerToast(`Resep ${rec?.name || ''} dihapus.`);
          },
        },
      ]
    );
  };

  // Share Recipe Financial Analysis to WhatsApp (with 3-Tier Pricing)
  const handleShareRecipeAnalysis = async (rec: ProductRecipe) => {
    try {
      const { offlinePrice: offlineStd, resellerPrice: resellerStd, grosirPrice: grosirStd, ojolPrice: ojolStd } =
        computeSmartPricing(rec.unitCost, storeProfile);
      
      const ingLines = rec.ingredients
        .map((ing) => {
          const mat = materials.find((m) => m.id === ing.materialId);
          if (!mat) return '';
          const c = Math.round((ing.amountUsed / mat.purchaseVolume) * mat.purchasePrice);
          return `  • ${mat.name}: ${ing.amountUsed} ${mat.unit} (~Rp ${formatRupiah(c)})`;
        })
        .filter(Boolean)
        .join('\n');

      const packLines = rec.packaging
        .map((pk) => {
          const mat = materials.find((m) => m.id === pk.materialId);
          if (!mat) return '';
          const c = Math.round((pk.amountUsed / mat.purchaseVolume) * mat.purchasePrice);
          return `  • ${mat.name}: ${pk.amountUsed} ${mat.unit} (~Rp ${formatRupiah(c)})`;
        })
        .filter(Boolean)
        .join('\n');

      const statusBadge = rec.marginPercent >= 35 ? '💎 SANGAT SEHAT' : rec.marginPercent >= 20 ? '✅ SEHAT' : rec.marginPercent >= 0 ? '⚠️ RAWAN / TIPIS' : '⛔ RUGI';

      const message = `📊 *ANALISIS HPP & REKOMENDASI HARGA JUAL*\n` +
        `*Usaha:* ${storeProfile.name || 'Usaha Saya'}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🏷️ *Produk:* ${rec.name}\n` +
        `📂 *Kategori:* ${rec.category}\n` +
        `📦 *Hasil per Batch:* ${rec.yieldQty} Porsi\n` +
        `📉 *Faktor Susut:* ${rec.wastePercent}%\n` +
        (rec.inflationBuffer ? `📈 *Buffer Inflasi:* +${rec.inflationBuffer}%\n` : '') +
        (rec.laborCost ? `👷 *Upah Kerja / Batch:* Rp ${formatRupiah(rec.laborCost)}\n` : '') +
        (rec.utilityCost ? `⚡ *Gas/Listrik/Utilitas:* Rp ${formatRupiah(rec.utilityCost)}\n` : '') +
        `\n` +
        `💰 *ANALISIS KEUANGAN PER PORSI:*\n` +
        `• HPP Dasar: Rp ${formatRupiah(rec.unitCost)} / porsi\n` +
        `• Harga Jual Rencana: Rp ${formatRupiah(rec.targetSellingPrice)}\n` +
        `• Laba Bersih: +Rp ${formatRupiah(rec.netProfit)} / porsi\n` +
        `• Margin Laba: ${rec.marginPercent}% (${statusBadge})\n` +
        `\n` +
        `⚡ *STRUKTUR HARGA JUAL 3-TIER:*\n` +
        `• 🛍️ Eceran (Margin ${storeProfile.retailMarginPercent || 35}%): Rp ${formatRupiah(offlineStd)} (+Rp ${formatRupiah(offlineStd - rec.unitCost)}/porsi)\n` +
        `• 🤝 Reseller / Agen (Margin ${storeProfile.resellerMarginPercent || 20}%): Rp ${formatRupiah(resellerStd)} (+Rp ${formatRupiah(resellerStd - rec.unitCost)}/porsi)\n` +
        `• 🏢 Grosir Partai Besar (Margin 15%): Rp ${formatRupiah(grosirStd)} (+Rp ${formatRupiah(grosirStd - rec.unitCost)}/porsi)\n` +
        `• 🛵 Aplikasi Ojol (Komisi ${storeProfile.ojolCommissionPercent || 20}%): Rp ${formatRupiah(ojolStd)}\n` +
        `\n` +
        (ingLines ? `🧪 *Komposisi Bahan:*\n${ingLines}\n\n` : '') +
        (packLines ? `📦 *Kemasan:*\n${packLines}\n\n` : '') +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `_Dihitung otomatis via Aplikasi Meracik Ide_`;

      await Share.share({ message });
    } catch {
      triggerToast('Gagal membagikan analisis resep.');
    }
  };

  // Feature 3: Share Batch Shopping List to WhatsApp / Clipboard
  const handleShareShoppingList = async (rec: ProductRecipe, portions: number) => {
    try {
      const targetPortions = Math.max(1, portions);
      const batchMultiplier = targetPortions / Math.max(1, rec.yieldQty || 1);

      let totalCash = 0;
      const ingItems = rec.ingredients
        .map((ing) => {
          const mat = materials.find((m) => m.id === ing.materialId);
          if (!mat) return null;
          const totalNeeded = Number((ing.amountUsed * batchMultiplier).toFixed(1));
          const cost =
            mat.purchaseVolume > 0
              ? Math.round((totalNeeded / mat.purchaseVolume) * mat.purchasePrice)
              : 0;
          totalCash += cost;
          return `  • ${mat.name}: ${totalNeeded} ${mat.unit} (~Rp ${formatRupiah(cost)})`;
        })
        .filter(Boolean);

      const packItems = rec.packaging
        .map((pk) => {
          const mat = materials.find((m) => m.id === pk.materialId);
          if (!mat) return null;
          const totalNeeded = Math.ceil(pk.amountUsed * batchMultiplier);
          const cost =
            mat.purchaseVolume > 0
              ? Math.round((totalNeeded / mat.purchaseVolume) * mat.purchasePrice)
              : 0;
          totalCash += cost;
          return `  • ${mat.name}: ${totalNeeded} ${mat.unit} (~Rp ${formatRupiah(cost)})`;
        })
        .filter(Boolean);

      const message =
        `🛒 *DAFTAR BELANJA PASAR & BAHAN BAKU*\n` +
        `*Usaha:* ${storeProfile.name || 'Usaha Saya'}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🏷️ *Menu:* ${rec.name}\n` +
        `🎯 *Target Produksi:* ${targetPortions} Porsi\n` +
        `💵 *Estimasi Uang Belanja:* Rp ${formatRupiah(totalCash)}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        (ingItems.length > 0 ? `\n🧪 *Bahan Baku Diperlukan:*\n${ingItems.join('\n')}\n` : '') +
        (packItems.length > 0 ? `\n📦 *Kemasan Diperlukan:*\n${packItems.join('\n')}\n` : '') +
        `\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `_Dibuat otomatis via Kalkulator Belanja Meracik Ide UMKM_`;

      await Share.share({ message });
    } catch {
      triggerToast('Gagal membagikan daftar belanja.');
    }
  };

  // Feature 4A: Professional Business Feasibility Proposal PDF Export
  const handleExportFeasibilityProposalPdf = async () => {
    try {
      const totalWorkingCap = storeProfile.workingCapital || 0;
      const initialCap = totalCapex + totalWorkingCap;
      const opDays = storeProfile.operatingDaysPerMonth || 30;

      // Normal scenario calculations
      const normRev = baseMonthlyRevenue;
      const normCogs = baseMonthlyCogs;
      const normProfit = normRev - (normCogs + totalMonthlyFixedExpenses);
      const normBep = normProfit > 0 ? (initialCap / normProfit).toFixed(1) : '-';
      const normDays = normProfit > 0 ? Math.round((initialCap / normProfit) * opDays) : 0;
      const normMarginPct = normRev > 0 ? ((normProfit / normRev) * 100).toFixed(1) : '0';

      // Pessimistic scenario (-30%)
      const pesRev = Math.round(baseMonthlyRevenue * 0.7);
      const pesCogs = Math.round(baseMonthlyCogs * 0.7);
      const pesProfit = pesRev - (pesCogs + totalMonthlyFixedExpenses);
      const pesBep = pesProfit > 0 ? (initialCap / pesProfit).toFixed(1) : '-';

      // Optimistic scenario (+30%)
      const optRev = Math.round(baseMonthlyRevenue * 1.3);
      const optCogs = Math.round(baseMonthlyCogs * 1.3);
      const optProfit = optRev - (optCogs + totalMonthlyFixedExpenses);
      const optBep = optProfit > 0 ? (initialCap / optProfit).toFixed(1) : '-';

      // Investor Profit Sharing calculations
      const investorPct = storeProfile.investorSharePercent || 30;
      const ownerPct = 100 - investorPct;
      const baseProfit = normProfit > 0 ? normProfit : 0;
      const investorDiv = Math.round(baseProfit * (investorPct / 100));
      const ownerDiv = baseProfit - investorDiv;
      const invRoiMonths = investorDiv > 0 ? (initialCap / investorDiv).toFixed(1) : '-';
      const invRoiDays = investorDiv > 0 ? Math.round((initialCap / investorDiv) * opDays) : 0;

      const todayStr = new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

      const capexRows =
        capitalItems.length > 0
          ? capitalItems
              .map(
                (c, i) => `
            <tr>
              <td style="text-align: center;">${i + 1}</td>
              <td><strong>${escapeHtml(c.name)}</strong><br/><span style="font-size: 7.5pt; color: #64748b;">Masa pakai: ${c.lifespanMonths || 24} bln • Susut: Rp ${formatRupiah(Math.round(c.total / (c.lifespanMonths || 24)))}/bln</span></td>
              <td style="text-align: center;">${c.qty} unit</td>
              <td style="text-align: right;">Rp ${formatRupiah(c.price)}</td>
              <td style="text-align: right;"><strong>Rp ${formatRupiah(c.total)}</strong></td>
            </tr>
          `
              )
              .join('')
          : `<tr><td colspan="5" style="text-align: center; color: #94a3b8; font-style: italic;">Belum ada peralatan tercatat</td></tr>`;

      const deprecOpexRow =
        storeProfile.includeDepreciationInOpex && totalMonthlyDepreciation > 0
          ? `
            <tr style="background-color: #fefce8;">
              <td style="text-align: center;">*</td>
              <td><strong>Cadangan Penyusutan Peralatan (Amortisasi)</strong><br/><span style="font-size: 7.5pt; color: #854d0e;">Alokasi kas cadangan penggantian alat rusak</span></td>
              <td style="text-align: center;">Bulanan</td>
              <td style="text-align: right;">Rp ${formatRupiah(totalMonthlyDepreciation)}</td>
              <td style="text-align: right;"><strong>Rp ${formatRupiah(totalMonthlyDepreciation)}</strong></td>
            </tr>
          `
          : '';

      const expenseRows =
        expenses.length > 0
          ? expenses
              .map((e, i) => {
                const monthlyAmt = e.period === 'hari' ? e.amount * opDays : e.amount;
                return `
              <tr>
                <td style="text-align: center;">${i + 1}</td>
                <td><strong>${escapeHtml(e.name)}</strong></td>
                <td style="text-align: center;">${e.period === 'hari' ? `Harian (${opDays} hari)` : 'Bulanan'}</td>
                <td style="text-align: right;">Rp ${formatRupiah(e.amount)}</td>
                <td style="text-align: right;"><strong>Rp ${formatRupiah(monthlyAmt)}</strong></td>
              </tr>
            `;
              })
              .join('')
          : `<tr><td colspan="5" style="text-align: center; color: #94a3b8; font-style: italic;">Belum ada beban rutin tercatat</td></tr>`;

      const recipeRows =
        recipes.length > 0
          ? recipes
              .map((r, i) => {
                const target = dailyTargets.find((t) => t.productId === r.id);
                const qty = target ? target.dailyQty : 0;
                const prices = computeSmartPricing(r.unitCost, storeProfile);
                return `
              <tr>
                <td style="text-align: center;">${i + 1}</td>
                <td>
                  <strong>${escapeHtml(r.name)}</strong>
                  <div style="font-size: 8pt; color: #64748b;">${escapeHtml(r.category)} • Batch: ${r.yieldQty} porsi</div>
                </td>
                <td style="text-align: right;">Rp ${formatRupiah(r.unitCost)}</td>
                <td style="text-align: right;"><strong>Rp ${formatRupiah(r.targetSellingPrice)}</strong></td>
                <td style="text-align: right; color: #0284c7;">Rp ${formatRupiah(prices.resellerPrice)}</td>
                <td style="text-align: right; color: #d97706;">Rp ${formatRupiah(prices.ojolPrice)}</td>
                <td style="text-align: center;"><strong>${qty}</strong>/hari</td>
                <td style="text-align: right;"><strong>Rp ${formatRupiah(qty * opDays * r.targetSellingPrice)}</strong></td>
              </tr>
            `;
              })
              .join('')
          : `<tr><td colspan="8" style="text-align: center; color: #94a3b8; font-style: italic;">Belum ada resep produk tercatat</td></tr>`;

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <title>Proposal Kelayakan Usaha - ${storeProfile.name || 'UMKM'}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 12mm 14mm;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
              color: #0f172a;
              font-size: 9.5pt;
              line-height: 1.45;
              background-color: #ffffff;
            }
            .header {
              border-bottom: 2.5px solid #0f172a;
              padding-bottom: 12px;
              margin-bottom: 16px;
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
            }
            .brand-title {
              font-size: 18pt;
              font-weight: 800;
              color: #0f172a;
              letter-spacing: -0.5px;
            }
            .badge-proposal {
              display: inline-block;
              background-color: #0f172a;
              color: #ffffff;
              font-size: 7.5pt;
              font-weight: 700;
              padding: 2px 7px;
              border-radius: 4px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-top: 3px;
            }
            .header-meta {
              text-align: right;
              font-size: 8.5pt;
              color: #475569;
            }
            .section-heading {
              font-size: 10.5pt;
              font-weight: 800;
              color: #0f172a;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-top: 14px;
              margin-bottom: 8px;
              border-left: 3.5px solid #0284c7;
              padding-left: 7px;
            }
            .kpi-row {
              display: flex;
              gap: 8px;
              margin-bottom: 14px;
            }
            .kpi-box {
              flex: 1;
              background-color: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              padding: 8px;
              text-align: center;
            }
            .kpi-title {
              font-size: 7pt;
              font-weight: 700;
              color: #64748b;
              text-transform: uppercase;
            }
            .kpi-val {
              font-size: 12pt;
              font-weight: 800;
              color: #0f172a;
              margin-top: 2px;
            }
            .kpi-val.green { color: #059669; }
            .kpi-sub {
              font-size: 7pt;
              color: #94a3b8;
              margin-top: 2px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 12px;
              font-size: 8.5pt;
            }
            th {
              background-color: #0f172a;
              color: #ffffff;
              font-weight: 700;
              text-align: left;
              padding: 6px 8px;
              font-size: 7.8pt;
              text-transform: uppercase;
            }
            td {
              padding: 5.5px 8px;
              border-bottom: 1px solid #e2e8f0;
              color: #334155;
            }
            tr:nth-child(even) td {
              background-color: #f8fafc;
            }
            .total-row td {
              font-weight: 800;
              background-color: #f1f5f9 !important;
              border-top: 1.5px solid #0f172a;
              color: #0f172a;
            }
            .scenario-row {
              display: flex;
              gap: 8px;
              margin-bottom: 14px;
            }
            .scen-card {
              flex: 1;
              border-radius: 6px;
              padding: 8px 10px;
              border: 1px solid #cbd5e1;
            }
            .scen-pesimis { background-color: #fff1f2; border-color: #fecdd3; }
            .scen-normal { background-color: #f0fdf4; border-color: #bbf7d0; }
            .scen-optimis { background-color: #eff6ff; border-color: #bfdbfe; }
            .scen-head {
              font-size: 8.5pt;
              font-weight: 800;
              margin-bottom: 4px;
            }
            .scen-pesimis .scen-head { color: #be123c; }
            .scen-normal .scen-head { color: #15803d; }
            .scen-optimis .scen-head { color: #1d4ed8; }
            .scen-item {
              font-size: 8pt;
              display: flex;
              justify-content: space-between;
              margin-top: 2px;
            }
            .safety-box {
              background-color: #fffbeb;
              border: 1px solid #fde68a;
              border-radius: 6px;
              padding: 8px 12px;
              margin-bottom: 16px;
              font-size: 8.5pt;
              color: #78350f;
            }
            .signatures {
              margin-top: 24px;
              display: flex;
              justify-content: space-around;
              page-break-inside: avoid;
            }
            .sig-box {
              text-align: center;
              width: 180px;
            }
            .sig-line {
              border-bottom: 1px solid #0f172a;
              margin-top: 48px;
              margin-bottom: 4px;
            }
            .sig-name {
              font-size: 8.5pt;
              font-weight: 700;
              color: #0f172a;
            }
            .sig-title {
              font-size: 7.5pt;
              color: #64748b;
            }
            .footer-bar {
              border-top: 1px solid #e2e8f0;
              margin-top: 20px;
              padding-top: 6px;
              display: flex;
              justify-content: space-between;
              font-size: 7pt;
              color: #94a3b8;
            }
          </style>
        </head>
        <body>
          <!-- Kop Surat / Header -->
          <div class="header">
            <div style="display: flex; align-items: center; gap: 14px;">
              ${storeProfile.logoBase64 ? `<img src="${storeProfile.logoBase64}" style="width: 58px; height: 58px; border-radius: 8px; object-fit: contain; border: 1.5px solid #0f172a; background: #ffffff;" />` : ''}
              <div>
                <div class="brand-title">${escapeHtml(storeProfile.name || 'Usaha UMKM Mandiri')}</div>
                <div class="badge-proposal">Dokumen Studi Kelayakan & Rencana Modal Usaha</div>
                ${storeProfile.address ? `<div style="font-size: 8pt; color: #64748b; margin-top: 3px;">📍 ${escapeHtml(storeProfile.address)}</div>` : ''}
                ${storeProfile.phone ? `<div style="font-size: 8pt; color: #64748b;">📞 Kontak: ${escapeHtml(storeProfile.phone)}</div>` : ''}
              </div>
            </div>
            <div class="header-meta">
              <div><strong>Tanggal:</strong> ${todayStr}</div>
              <div><strong>Jadwal Operasional:</strong> ${opDays} Hari / Bulan</div>
              <div><strong>Format:</strong> Standar Analisis Finansial UMKM</div>
            </div>
          </div>

          <!-- Ringkasan Eksekutif (Executive Summary KPIs) -->
          <div class="kpi-row">
            <div class="kpi-box">
              <div class="kpi-title">Total Modal Dibutuhkan</div>
              <div class="kpi-val">Rp ${formatRupiah(initialCap)}</div>
              <div class="kpi-sub">Capex: ${formatRupiah(totalCapex)} • Kas: ${formatRupiah(totalWorkingCap)}</div>
            </div>
            <div class="kpi-box">
              <div class="kpi-title">Target Omset / Bulan</div>
              <div class="kpi-val">Rp ${formatRupiah(normRev)}</div>
              <div class="kpi-sub">${opDays} hari kerja efektif</div>
            </div>
            <div class="kpi-box">
              <div class="kpi-title">Proyeksi Laba Bersih / Bln</div>
              <div class="kpi-val green">+Rp ${formatRupiah(normProfit)}</div>
              <div class="kpi-sub">Margin Laba: ${normMarginPct}%</div>
            </div>
            <div class="kpi-box">
              <div class="kpi-title">Periode Balik Modal (BEP)</div>
              <div class="kpi-val green">${normBep !== '-' ? `${normBep} Bulan` : 'Belum Untung'}</div>
              <div class="kpi-sub">${normDays > 0 ? `~${normDays} Hari operasional` : ''}</div>
            </div>
          </div>

          <!-- 1. Struktur Modal Investasi Awal -->
          <div class="section-heading">1. Struktur Modal Investasi Awal (Initial Capital)</div>
          <table>
            <thead>
              <tr>
                <th style="width: 30px; text-align: center;">No</th>
                <th>Nama Peralatan & Aset Fisik (Capex)</th>
                <th style="width: 70px; text-align: center;">Kuantitas</th>
                <th style="width: 100px; text-align: right;">Harga Satuan</th>
                <th style="width: 110px; text-align: right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${capexRows}
              <tr class="total-row">
                <td colspan="4">Subtotal Peralatan & Aset Fisik (Capex)</td>
                <td style="text-align: right;">Rp ${formatRupiah(totalCapex)}</td>
              </tr>
              <tr style="background-color: #f0fdf4;">
                <td colspan="4"><strong>Modal Kerja Likuid & Kas Cadangan Operasional</strong> (Belanja bahan awal & talangan)</td>
                <td style="text-align: right; font-weight: 800; color: #059669;">Rp ${formatRupiah(totalWorkingCap)}</td>
              </tr>
              <tr class="total-row" style="background-color: #e2e8f0 !important;">
                <td colspan="4" style="font-size: 9pt; text-transform: uppercase;">🔥 TOTAL MODAL AWAL YANG DIBUTUHKAN</td>
                <td style="text-align: right; font-size: 9.5pt; color: #0f172a;">Rp ${formatRupiah(initialCap)}</td>
              </tr>
            </tbody>
          </table>

          <!-- 2. Beban Operasional Tetap (Opex) -->
          <div class="section-heading">2. Biaya Operasional Tetap Bulanan (Opex)</div>
          <table>
            <thead>
              <tr>
                <th style="width: 30px; text-align: center;">No</th>
                <th>Pos Beban Operasional</th>
                <th style="width: 100px; text-align: center;">Siklus Biaya</th>
                <th style="width: 100px; text-align: right;">Tarif Satuan</th>
                <th style="width: 110px; text-align: right;">Total / Bulan</th>
              </tr>
            </thead>
            <tbody>
              ${expenseRows}
              ${deprecOpexRow}
              <tr class="total-row">
                <td colspan="4">Total Beban Tetap Operasional per Bulan</td>
                <td style="text-align: right;">Rp ${formatRupiah(effectiveMonthlyFixedExpenses)}</td>
              </tr>
              <tr>
                <td colspan="4" style="font-size: 8pt; color: #64748b;">Beban Tetap Harian (Safety Burden / Hari)</td>
                <td style="text-align: right; font-weight: 700; color: #64748b;">Rp ${formatRupiah(dailyFixedCost)} / hari</td>
              </tr>
            </tbody>
          </table>

          <!-- 3. Portofolio Produk & Target Jual -->
          <div class="section-heading">3. Portofolio Produk & Penetapan Harga Jual (Smart Pricing)</div>
          <table>
            <thead>
              <tr>
                <th style="width: 25px; text-align: center;">No</th>
                <th>Nama Produk Menu</th>
                <th style="text-align: right;">HPP Riil</th>
                <th style="text-align: right;">Harga Eceran</th>
                <th style="text-align: right;">Reseller</th>
                <th style="text-align: right;">Ojol (GoFood)</th>
                <th style="text-align: center;">Target/Hari</th>
                <th style="text-align: right;">Omset/Bulan</th>
              </tr>
            </thead>
            <tbody>
              ${recipeRows}
              <tr class="total-row">
                <td colspan="7">Total Proyeksi Omset Penjualan Normal / Bulan</td>
                <td style="text-align: right;">Rp ${formatRupiah(normRev)}</td>
              </tr>
            </tbody>
          </table>

          <!-- 4. Laporan Proyeksi Laba Rugi Bulanan -->
          <div class="section-heading">4. Laporan Proyeksi Laba Rugi Bulanan (P&L Pro-Forma)</div>
          <table>
            <tbody>
              <tr>
                <td><strong>1. Omset Penjualan Kotor (Gross Revenue)</strong></td>
                <td style="text-align: right; font-weight: 700;">Rp ${formatRupiah(normRev)}</td>
              </tr>
              <tr>
                <td style="padding-left: 20px;">2. Harga Pokok Penjualan Bahan & Kemasan (HPP COGS)</td>
                <td style="text-align: right; color: #be123c;">- Rp ${formatRupiah(normCogs)}</td>
              </tr>
              <tr style="background-color: #f1f5f9; font-weight: 700;">
                <td><strong>3. Laba Kotor Usaha (Gross Profit)</strong></td>
                <td style="text-align: right; color: #0f172a;">Rp ${formatRupiah(normRev - normCogs)}</td>
              </tr>
              <tr>
                <td style="padding-left: 20px;">4. Beban Operasional Tetap Rutin (Opex)</td>
                <td style="text-align: right; color: #be123c;">- Rp ${formatRupiah(totalMonthlyFixedExpenses)}</td>
              </tr>
              <tr class="total-row" style="background-color: #f0fdf4 !important;">
                <td style="font-size: 9pt;"><strong>5. LABA BERSIH OPERASIONAL (NET PROFIT)</strong></td>
                <td style="text-align: right; font-size: 9.5pt; color: #059669;"><strong>+ Rp ${formatRupiah(normProfit)} / bln</strong></td>
              </tr>
            </tbody>
          </table>

          <!-- 5. Analisis Sensitivitas Risiko 3-Skenario -->
          <div class="section-heading">5. Analisis Sensitivitas Risiko (Uji Ketahanan Bisnis)</div>
          <div class="scenario-row">
            <div class="scen-card scen-pesimis">
              <div class="scen-head">📉 Skenario Pesimis (-30%)</div>
              <div class="scen-item"><span>Omset:</span><strong>Rp ${formatRupiah(pesRev)}</strong></div>
              <div class="scen-item"><span>Laba:</span><strong style="color: ${pesProfit >= 0 ? '#15803d' : '#be123c'};">${pesProfit >= 0 ? '+' : ''}Rp ${formatRupiah(pesProfit)}</strong></div>
              <div class="scen-item"><span>Balik Modal:</span><strong>${pesBep !== '-' ? `${pesBep} Bln` : 'Tidak Balik'}</strong></div>
            </div>
            <div class="scen-card scen-normal">
              <div class="scen-head">🎯 Skenario Normal (Target 100%)</div>
              <div class="scen-item"><span>Omset:</span><strong>Rp ${formatRupiah(normRev)}</strong></div>
              <div class="scen-item"><span>Laba:</span><strong style="color: #15803d;">+Rp ${formatRupiah(normProfit)}</strong></div>
              <div class="scen-item"><span>Balik Modal:</span><strong>${normBep !== '-' ? `${normBep} Bln` : '-'}</strong></div>
            </div>
            <div class="scen-card scen-optimis">
              <div class="scen-head">🚀 Skenario Optimis (+30%)</div>
              <div class="scen-item"><span>Omset:</span><strong>Rp ${formatRupiah(optRev)}</strong></div>
              <div class="scen-item"><span>Laba:</span><strong style="color: #1d4ed8;">+Rp ${formatRupiah(optProfit)}</strong></div>
              <div class="scen-item"><span>Balik Modal:</span><strong>${optBep !== '-' ? `${optBep} Bln` : '-'}</strong></div>
            </div>
          </div>

          <!-- 6. Simulasi Skema Bagi Hasil Mitra Pemodal (Investor ROI) -->
          <div class="section-heading">6. Simulasi Skema Bagi Hasil Mitra Pemodal (Investor ROI)</div>
          <table>
            <thead>
              <tr>
                <th>Pihak Kemitraan</th>
                <th style="width: 100px; text-align: center;">Porsi Bagi Hasil</th>
                <th style="width: 140px; text-align: right;">Estimasi Dividen / Bln</th>
                <th style="width: 150px; text-align: right;">Estimasi Balik Modal</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Mitra Pemodal (Investor)</strong><br/><span style="font-size: 7.5pt; color: #64748b;">Mendanai Modal Awal (Capex + Kas Cadangan)</span></td>
                <td style="text-align: center; font-weight: 700; color: #7c3aed;">${investorPct}%</td>
                <td style="text-align: right; font-weight: 700; color: #7c3aed;">+Rp ${formatRupiah(investorDiv)} / bln</td>
                <td style="text-align: right; font-weight: 700;">${invRoiMonths !== '-' ? `${invRoiMonths} Bulan` : '-'} ${invRoiDays > 0 ? `(~${invRoiDays} hr)` : ''}</td>
              </tr>
              <tr>
                <td><strong>Pengelola Usaha (Founder / Operator)</strong><br/><span style="font-size: 7.5pt; color: #64748b;">Pengelola operasional toko harian</span></td>
                <td style="text-align: center; font-weight: 700; color: #059669;">${ownerPct}%</td>
                <td style="text-align: right; font-weight: 700; color: #059669;">+Rp ${formatRupiah(ownerDiv)} / bln</td>
                <td style="text-align: right; font-size: 8pt; color: #64748b;">Penghasilan bersih bulanan</td>
              </tr>
            </tbody>
          </table>

          <!-- Ambang Batas Titik Aman Harian -->
          <div class="safety-box">
            <strong>🎯 Ambang Batas Aman Harian (Daily Break-Even Point):</strong><br/>
            Untuk menutup beban operasional harian sebesar <strong>Rp ${formatRupiah(dailyFixedCost)} / hari</strong>, usaha wajib menjual minimal <strong>${dailyBepTargetUnits} porsi per hari</strong>.
          </div>

          <!-- Lembar Pengesahan / Tanda Tangan -->
          <div class="signatures">
            <div class="sig-box">
              <div class="sig-title">Diajukan Oleh,</div>
              <div class="sig-line"></div>
              <div class="sig-name">${escapeHtml(storeProfile.name || 'Pemilik Usaha')}</div>
              <div class="sig-role">Pengelola / Pemilik Usaha</div>
            </div>
            <div class="sig-box">
              <div class="sig-title">Disetujui / Ditinjau Oleh,</div>
              <div class="sig-line"></div>
              <div class="sig-name">(........................................)</div>
              <div class="sig-role">Mitra Kerjasama / Calon Investor</div>
            </div>
          </div>

          <!-- Footer -->
          <div class="footer-bar">
            <div>${escapeHtml(storeProfile.footerNote || 'Dokumen Resmi Analisis Kelayakan Usaha')}</div>
            <div>Disusun Otomatis dengan Aplikasi Meracik Ide UMKM • Berkas Asli Terverifikasi</div>
          </div>
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
        dialogTitle: `Proposal Kelayakan Usaha - ${storeProfile.name || 'UMKM'}`,
      });
      triggerToast('Proposal PDF berhasil dibuat!');
    } catch (err) {
      console.warn('PDF generation error', err);
      triggerToast('Gagal membuat berkas PDF proposal.');
    }
  };

  // Feature 4B: Business Feasibility Proposal Text Export
  const handleShareBusinessFeasibilityReport = async () => {
    try {
      const totalWorkingCap = storeProfile.workingCapital || 0;
      const initialCap = totalCapex + totalWorkingCap;
      const opDays = storeProfile.operatingDaysPerMonth || 30;

      // Normal scenario calculations
      const normRev = baseMonthlyRevenue;
      const normCogs = baseMonthlyCogs;
      const normProfit = normRev - (normCogs + totalMonthlyFixedExpenses);
      const normBep = normProfit > 0 ? (initialCap / normProfit).toFixed(1) : '-';

      // Pessimistic scenario (-30%)
      const pesRev = Math.round(baseMonthlyRevenue * 0.7);
      const pesCogs = Math.round(baseMonthlyCogs * 0.7);
      const pesProfit = pesRev - (pesCogs + totalMonthlyFixedExpenses);
      const pesBep = pesProfit > 0 ? (initialCap / pesProfit).toFixed(1) : '-';

      // Optimistic scenario (+30%)
      const optRev = Math.round(baseMonthlyRevenue * 1.3);
      const optCogs = Math.round(baseMonthlyCogs * 1.3);
      const optProfit = optRev - (optCogs + totalMonthlyFixedExpenses);
      const optBep = optProfit > 0 ? (initialCap / optProfit).toFixed(1) : '-';

      // Investor calculations
      const investorPct = storeProfile.investorSharePercent || 30;
      const ownerPct = 100 - investorPct;
      const baseProfit = normProfit > 0 ? normProfit : 0;
      const investorDiv = Math.round(baseProfit * (investorPct / 100));
      const ownerDiv = baseProfit - investorDiv;
      const invRoiMonths = investorDiv > 0 ? (initialCap / investorDiv).toFixed(1) : '-';
      const invRoiDays = investorDiv > 0 ? Math.round((initialCap / investorDiv) * opDays) : 0;

      const capexLines =
        capitalItems.length > 0
          ? capitalItems.map((c) => `  • ${c.name} (${c.qty}x): Rp ${formatRupiah(c.total)}`).join('\n')
          : '  • (Belum mencatat aset & peralatan)';

      const expLines =
        expenses.length > 0
          ? expenses
              .map((e) => `  • ${e.name}: Rp ${formatRupiah(e.period === 'hari' ? e.amount * opDays : e.amount)}/bln`)
              .join('\n')
          : '  • (Belum mencatat beban rutin)';

      const recipeLines =
        recipes.length > 0
          ? recipes
              .map((r) => {
                const target = dailyTargets.find((t) => t.productId === r.id);
                const qty = target ? target.dailyQty : 0;
                return `  • ${r.name}\n    - HPP: Rp ${formatRupiah(r.unitCost)} | Jual: Rp ${formatRupiah(
                  r.targetSellingPrice
                )} (Margin: ${r.marginPercent}%)\n    - Target: ${qty} porsi/hari (~Rp ${formatRupiah(
                  qty * opDays * r.targetSellingPrice
                )}/bln)`;
              })
              .join('\n')
          : '  • (Belum ada resep produk)';

      const todayStr = new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

      const message =
        `📊 *PROPOSAL KELAYAKAN USAHA & PERHITUNGAN MODAL*\n` +
        `*Nama Usaha:* ${storeProfile.name || 'Usaha UMKM'}\n` +
        (storeProfile.phone ? `*Kontak / WhatsApp:* ${storeProfile.phone}\n` : '') +
        (storeProfile.address ? `*Lokasi:* ${storeProfile.address}\n` : '') +
        `*Tanggal Analisis:* ${todayStr}\n` +
        `*Hari Operasional:* ${opDays} Hari / Bulan\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `💰 *1. STRUKTUR MODAL AWAL (INITIAL CAPITAL)*\n` +
        `A. Peralatan & Aset Fisik (Capex): Rp ${formatRupiah(totalCapex)}\n` +
        `${capexLines}\n` +
        `B. Modal Kas Kerja & Cadangan Operasional: Rp ${formatRupiah(totalWorkingCap)}\n` +
        `------------------------------------------\n` +
        `🔥 *TOTAL MODAL INVESTASI AWAL:* Rp ${formatRupiah(initialCap)}\n\n` +
        `🏢 *2. BIAYA OPERASIONAL TETAP (OPEX / BULAN)*\n` +
        `${expLines}\n` +
        `------------------------------------------\n` +
        `*Total Beban Rutin:* Rp ${formatRupiah(totalMonthlyFixedExpenses)} / bulan\n` +
        `*(Beban Tetap Harian: Rp ${formatRupiah(dailyFixedCost)} / hari)*\n\n` +
        `📋 *3. PORTOFOLIO PRODUK & TARGET JUAL*\n` +
        `${recipeLines}\n\n` +
        `📈 *4. PROYEKSI KEUANGAN BULANAN (TARGET NORMAL)*\n` +
        `• Target Omset Penjualan: Rp ${formatRupiah(normRev)} / bln\n` +
        `• Total Modal Bahan (HPP): Rp ${formatRupiah(normCogs)} / bln\n` +
        `• Total Beban Operasional: Rp ${formatRupiah(totalMonthlyFixedExpenses)} / bln\n` +
        `• Estimasi Laba Bersih Operasional: Rp ${formatRupiah(normProfit)} / bln\n` +
        `• Titik Balik Modal (BEP): ${normBep !== '-' ? `${normBep} Bulan` : 'Belum tercapai'} ` +
        `${normProfit > 0 ? `(~${Math.round((initialCap / normProfit) * opDays)} Hari)` : ''}\n\n` +
        `⚖️ *5. SIMULASI UJI KETAHANAN RISIKO (3 SKENARIO)*\n` +
        `• 📉 *Pesimis (-30%):*\n` +
        `  - Omset: Rp ${formatRupiah(pesRev)} | Laba: Rp ${formatRupiah(pesProfit)}\n` +
        `  - BEP: ${pesBep !== '-' ? `${pesBep} Bulan` : 'Tidak tercapai'}\n` +
        `• 🎯 *Normal (Target 100%):*\n` +
        `  - Omset: Rp ${formatRupiah(normRev)} | Laba: Rp ${formatRupiah(normProfit)}\n` +
        `  - BEP: ${normBep !== '-' ? `${normBep} Bulan` : 'Tidak tercapai'}\n` +
        `• 🚀 *Optimis (+30%):*\n` +
        `  - Omset: Rp ${formatRupiah(optRev)} | Laba: Rp ${formatRupiah(optProfit)}\n` +
        `  - BEP: ${optBep !== '-' ? `${optBep} Bulan` : 'Tidak tercapai'}\n\n` +
        `🤝 *6. SIMULASI BAGI HASIL INVESTOR (${investorPct}% : ${ownerPct}%):*\n` +
        `• Porsi Dividen Investor (${investorPct}%): Rp ${formatRupiah(investorDiv)} / bln\n` +
        `• Estimasi Balik Modal Investor: ${invRoiMonths !== '-' ? `${invRoiMonths} Bulan` : 'Belum untung'} ${invRoiDays > 0 ? `(~${invRoiDays} hr)` : ''}\n` +
        `• Porsi Laba Pemilik Usaha (${ownerPct}%): Rp ${formatRupiah(ownerDiv)} / bln\n\n` +
        `🎯 *TARGET MINIMAL HARIAN (SAFETY THRESHOLD):*\n` +
        `Usaha wajib menjual minimal *${dailyBepTargetUnits} porsi/hari* untuk menutup beban operasional harian.\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `_${storeProfile.footerNote || 'Dihitung dengan Aplikasi Meracik Ide UMKM'}_`;

      await Share.share({ message });
    } catch {
      triggerToast('Gagal membagikan proposal kelayakan.');
    }
  };

  // Edit Material
  const handleEditMaterial = (m: RawMaterial) => {
    setEditingMaterialId(m.id);
    setFormMatName(m.name);
    setFormMatPrice(String(m.purchasePrice));
    setFormMatVol(String(m.purchaseVolume));
    setFormMatUnit(m.unit);
    setFormMatCat(m.category);
    setFormCurrentStock(m.currentStock !== undefined ? String(m.currentStock) : '');
    setFormMinAlert(m.minStockAlert !== undefined ? String(m.minStockAlert) : '');
    setShowAddMaterialModal(true);
    Haptics.selectionAsync().catch(() => {});
  };

  // Delete Material
  const handleDeleteMaterial = (id: string) => {
    const mat = materials.find((m) => m.id === id);
    Alert.alert(
      'Hapus Bahan Baku?',
      `Yakin ingin menghapus "${mat?.name || 'ini'}"? Pastikan tidak sedang digunakan dalam resep.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: () => {
            const updated = materials.filter((m) => m.id !== id);
            setMaterials(updated);
            persist(KEY_MATERIALS, updated);
            triggerToast(`Bahan ${mat?.name || ''} dihapus.`);
          },
        },
      ]
    );
  };

  // Delete Capital
  const handleDeleteCapital = (id: string) => {
    const updated = capitalItems.filter((c) => c.id !== id);
    setCapitalItems(updated);
    persist(KEY_CAPITAL, updated);
    triggerToast('Item modal awal dihapus.');
  };

  // Delete Expense
  const handleDeleteExpense = (id: string) => {
    const updated = expenses.filter((e) => e.id !== id);
    setExpenses(updated);
    persist(KEY_EXPENSES, updated);
    triggerToast('Beban rutin dihapus.');
  };

  // Master Export Data to WhatsApp
  const handleExportWhatsAppBackup = async () => {
    try {
      const recipeText = recipes.map((r, i) => {
        const { offlinePrice: offlineStd, resellerPrice: resellerStd, ojolPrice: ojolStd } =
          computeSmartPricing(r.unitCost, storeProfile);
        return (
          `${i + 1}. *${r.name}* (${r.category})\n` +
          `   • HPP: Rp ${formatRupiah(r.unitCost)} | Jual: Rp ${formatRupiah(r.targetSellingPrice)} | Margin: ${r.marginPercent}%\n` +
          `   • Rekomendasi Eceran (M${storeProfile.retailMarginPercent || 35}%): Rp ${formatRupiah(offlineStd)} | Reseller (M${storeProfile.resellerMarginPercent || 20}%): Rp ${formatRupiah(resellerStd)} | Ojol: Rp ${formatRupiah(ojolStd)}`
        );
      }).join('\n\n');

      const msg = `📦 *CADANGAN DATA MERACIK IDE — UMKM*\n` +
        `Toko: ${storeProfile.name || 'Toko Saya'}\n` +
        `Tanggal: ${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📋 *DAFTAR RESEP & HARGA JUAL (${recipes.length}):*\n` +
        (recipeText || '_Belum ada resep terdaftar._') + `\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💼 *SIMULASI KEUANGAN:*\n` +
        `• Total Modal Awal (Capex): Rp ${formatRupiah(totalCapex)}\n` +
        `• Beban Tetap Bulanan (Opex): Rp ${formatRupiah(totalMonthlyFixedExpenses)}\n` +
        `• Target Impas Harian: ${dailyBepTargetUnits} Porsi/hari\n` +
        `• Proyeksi Omset Bulanan: Rp ${formatRupiah(simulatedMonthlyRevenue)}\n` +
        `• Estimasi Balik Modal (BEP): ${bepMonths} Bulan\n\n` +
        `_Cadangan data mandiri aplikasi Meracik Ide_`;

      await Share.share({ message: msg });
    } catch {
      triggerToast('Gagal mencadangkan data.');
    }
  };

  // Unit Converter Apply
  const applyConverterResult = () => {
    const price = cleanNum(convBulkPrice);
    const capacity = Math.max(cleanNum(convBulkCapacity), 1);
    const usage = Math.max(cleanNum(convPortionUsage), 1);

    if (convMode === 'timbangan') {
      if (convTarget === 'material') {
        setFormMatPrice(String(price));
        setFormMatVol(String(capacity * 1000));
        setFormMatUnit('gr');
      } else if (convTarget === 'picker') {
        setPickerAmountUsed(String(usage));
      }
    } else {
      if (convTarget === 'material') {
        setFormMatPrice(String(price));
        setFormMatVol(String(capacity));
        setFormMatUnit('pcs');
      } else if (convTarget === 'picker') {
        setPickerAmountUsed(String(usage));
      }
    }
    setShowConverterModal(false);
    triggerToast('Hasil konversi diterapkan.');
  };

  // Save Recipe (Create or Edit)
  const handleSaveRecipe = () => {
    const name = formRecipeName.trim();
    const yld = Math.max(cleanNum(formYield), 1);
    const prc = cleanNum(formPrice);
    const wst = cleanNum(formWaste);
    const labor = cleanNum(formLaborCost);
    const utility = cleanNum(formUtilityCost);

    if (!name || prc <= 0) {
      Alert.alert('Input Belum Lengkap', 'Nama produk dan target harga jual wajib diisi.');
      return;
    }

    const unitCost = Math.round(
      computeBatchCost(formRecipeIngredients, formRecipePackaging, wst, formInflation, labor, utility) / yld
    );
    const netProfit = prc - unitCost;
    const marginPercent = prc > 0 ? Number(((netProfit / prc) * 100).toFixed(1)) : 0;

    if (editingRecipeId) {
      const updated = recipes.map((r) =>
        r.id === editingRecipeId
          ? {
              ...r,
              name,
              category: formRecipeCat.trim() || 'Minuman',
              yieldQty: yld,
              targetSellingPrice: prc,
              wastePercent: wst,
              inflationBuffer: formInflation,
              laborCost: labor,
              utilityCost: utility,
              ingredients: formRecipeIngredients,
              packaging: formRecipePackaging,
              unitCost,
              netProfit,
              marginPercent,
              updatedAt: Date.now(),
            }
          : r
      );
      setRecipes(updated);
      persist(KEY_RECIPES, updated);
      if (selectedDetailRecipe && selectedDetailRecipe.id === editingRecipeId) {
        setSelectedDetailRecipe({
          ...selectedDetailRecipe,
          name,
          category: formRecipeCat.trim() || 'Minuman',
          yieldQty: yld,
          targetSellingPrice: prc,
          wastePercent: wst,
          inflationBuffer: formInflation,
          laborCost: labor,
          utilityCost: utility,
          ingredients: formRecipeIngredients,
          packaging: formRecipePackaging,
          unitCost,
          netProfit,
          marginPercent,
          updatedAt: Date.now(),
        });
      }
      setEditingRecipeId(null);
      setShowAddRecipeModal(false);
      triggerToast(`Resep ${name} diperbarui.`);
      return;
    }

    const newRec: ProductRecipe = {
      id: `r-${Date.now()}`,
      name,
      category: formRecipeCat.trim() || 'Minuman',
      yieldQty: yld,
      targetSellingPrice: prc,
      wastePercent: wst,
      inflationBuffer: formInflation,
      laborCost: labor,
      utilityCost: utility,
      ingredients: formRecipeIngredients,
      packaging: formRecipePackaging,
      unitCost,
      netProfit,
      marginPercent,
      updatedAt: Date.now(),
    };

    const updated = [newRec, ...recipes];
    setRecipes(updated);
    persist(KEY_RECIPES, updated);

    // Add default sales target
    const updatedTargets = [...dailyTargets, { productId: newRec.id, dailyQty: 0 }];
    setDailyTargets(updatedTargets);
    persist(KEY_TARGETS, updatedTargets);

    setShowAddRecipeModal(false);
    triggerToast(`Resep ${name} tersimpan.`);
  };

  // Save Raw Material (Create or Edit)
  const handleSaveMaterial = () => {
    const name = formMatName.trim();
    const price = cleanNum(formMatPrice);
    const vol = cleanNum(formMatVol);
    const currentStock = formCurrentStock !== '' ? cleanNum(formCurrentStock) : undefined;
    const minAlert = formMinAlert !== '' ? cleanNum(formMinAlert) : undefined;

    if (!name || price <= 0 || vol <= 0) {
      Alert.alert('Data Belum Lengkap', 'Lengkapi nama, harga beli, dan volume bahan.');
      return;
    }

    if (editingMaterialId) {
      const updated = materials.map((m) =>
        m.id === editingMaterialId
          ? {
              ...m,
              name,
              purchasePrice: price,
              purchaseVolume: vol,
              unit: formMatUnit,
              category: formMatCat,
              currentStock,
              minStockAlert: minAlert,
            }
          : m
      );
      setMaterials(updated);
      persist(KEY_MATERIALS, updated);
      setEditingMaterialId(null);
      setShowAddMaterialModal(false);
      setFormMatName('');
      setFormMatPrice('');
      setFormMatVol('');
      setFormCurrentStock('');
      setFormMinAlert('');
      triggerToast(`Bahan ${name} diperbarui.`);
      return;
    }

    const newMat: RawMaterial = {
      id: `m-${Date.now()}`,
      name,
      purchasePrice: price,
      purchaseVolume: vol,
      unit: formMatUnit,
      category: formMatCat,
      currentStock,
      minStockAlert: minAlert,
    };

    const updated = [newMat, ...materials];
    setMaterials(updated);
    persist(KEY_MATERIALS, updated);

    setShowAddMaterialModal(false);
    setFormMatName('');
    setFormMatPrice('');
    setFormMatVol('');
    setFormCurrentStock('');
    setFormMinAlert('');
    triggerToast(`Bahan ${name} ditambahkan.`);
  };

  // Save Capital Item
  const handleSaveCapital = () => {
    const name = formCapName.trim();
    const qty = Math.max(cleanNum(formCapQty), 1);
    const price = cleanNum(formCapPrice);

    if (!name || price <= 0) {
      Alert.alert('Lengkapi Data', 'Nama aset modal dan estimasi biaya harus diisi.');
      return;
    }

    const newCap: CapitalItem = {
      id: `c-${Date.now()}`,
      name,
      qty,
      price,
      total: qty * price,
      lifespanMonths: formCapLifespan || 24,
    };

    const updated = [...capitalItems, newCap];
    setCapitalItems(updated);
    persist(KEY_CAPITAL, updated);
    syncToActiveProject({ capitalItems: updated });

    setShowAddCapitalModal(false);
    setFormCapName('');
    setFormCapPrice('');
    setFormCapLifespan(24);
    triggerToast('Aset modal awal dicatat.');
  };

  // Save Operational Expense
  const handleSaveExpense = () => {
    const name = formExpName.trim();
    const amt = cleanNum(formExpAmount);

    if (!name || amt <= 0) {
      Alert.alert('Periksa Input', 'Lengkapi nama pengeluaran rutin dan nominal bulanan.');
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
    syncToActiveProject({ expenses: updated });

    setShowAddExpenseModal(false);
    setFormExpName('');
    setFormExpAmount('');
    triggerToast('Beban operasional ditambahkan.');
  };

  // Confirm Ingredient in Recipe Builder
  const handleConfirmIngredient = () => {
    const amt = cleanNum(pickerAmountUsed);
    if (!pickerSelectedMatId || amt <= 0) {
      Alert.alert('Pilih Bahan', 'Tentukan bahan dan takaran yang digunakan.');
      return;
    }

    const entry: RecipeIngredient = { materialId: pickerSelectedMatId, amountUsed: amt };

    if (builderTab === 'bahan') {
      const filtered = formRecipeIngredients.filter((x) => x.materialId !== pickerSelectedMatId);
      setFormRecipeIngredients([...filtered, entry]);
    } else {
      const filtered = formRecipePackaging.filter((x) => x.materialId !== pickerSelectedMatId);
      setFormRecipePackaging([...filtered, entry]);
    }

    setShowPickerModal(false);
    setPickerSelectedMatId('');
    setPickerAmountUsed('');
  };

  // ==========================================
  // 8. RENDER: HEADER & NAVIGATION
  // ==========================================

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* Top Mobile App Bar with Logo & Gudang Ide */}
      <View style={styles.topAppBar}>
        <View style={styles.appBarBrand}>
          <TouchableOpacity
            style={styles.brandLogoCircle}
            onPress={() => setShowSettingsModal(true)}
          >
            {storeProfile.logoBase64 ? (
              <Image
                source={{ uri: storeProfile.logoBase64 }}
                style={styles.brandLogoImg}
                resizeMode="cover"
              />
            ) : (
              <Image
                source={require('./assets/icon.png')}
                style={styles.brandLogoImg}
                resizeMode="cover"
              />
            )}
          </TouchableOpacity>
          <View style={{ flexShrink: 1 }}>
            <View style={styles.brandTitleRow}>
              <Text style={styles.brandTitle} numberOfLines={1}>{storeProfile.name || 'Meracik Ide'}</Text>
              <View style={styles.brandBadge}>
                <Text style={styles.brandBadgeText}>PRO</Text>
              </View>
            </View>
            <Text style={styles.brandSub} numberOfLines={1}>
              {currentProject?.name ? `Ide: ${currentProject.name}` : 'Kalkulator Modal & HPP'}
            </Text>
          </View>
        </View>

        <View style={styles.appBarRightGroup}>
          <TouchableOpacity
            style={styles.gudangIdeBtn}
            onPress={() => setShowProjectsModal(true)}
          >
            <Feather name="folder" size={14} color="#0284C7" />
            <Text style={styles.gudangIdeBtnText}>Gudang Ide</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={() => setShowSettingsModal(true)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="settings" size={20} color="#334155" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Toast Notification */}
      {toastMessage && (
        <View style={styles.floatingToast}>
          <Feather name="check-circle" size={16} color="#10B981" />
          <Text style={styles.floatingToastText}>{toastMessage}</Text>
        </View>
      )}

      {/* Main Screen Body */}
      <View style={styles.screenBody}>
        {/* ========================================================= */}
        {/* TAB 1: RESEP & HPP PINTAR                                 */}
        {/* ========================================================= */}
        {activeTab === 'resep' && (
          <View style={styles.tabContentFull}>
            {/* Search Bar */}
            <View style={styles.searchBarWrapper}>
              <Feather name="search" size={16} color="#94A3B8" />
              <TextInput
                style={styles.searchBarInput}
                placeholder="Cari resep menu..."
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            {/* Category Filter Chips */}
            <View style={styles.filterChipsRow}>
              <TouchableOpacity
                style={[styles.filterChip, recipeCategoryFilter === 'all' && styles.filterChipActive]}
                onPress={() => setRecipeCategoryFilter('all')}
              >
                <Text style={[styles.filterChipText, recipeCategoryFilter === 'all' && styles.filterChipTextActive]}>
                  Semua ({recipes.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterChip, recipeCategoryFilter === 'Minuman' && styles.filterChipActive]}
                onPress={() => setRecipeCategoryFilter('Minuman')}
              >
                <Text style={[styles.filterChipText, recipeCategoryFilter === 'Minuman' && styles.filterChipTextActive]}>
                  Minuman ({recipes.filter((r) => r.category.toLowerCase().includes('minum')).length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterChip, recipeCategoryFilter === 'Makanan' && styles.filterChipActive]}
                onPress={() => setRecipeCategoryFilter('Makanan')}
              >
                <Text style={[styles.filterChipText, recipeCategoryFilter === 'Makanan' && styles.filterChipTextActive]}>
                  Makanan ({recipes.filter((r) => r.category.toLowerCase().includes('makan')).length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterChip, recipeCategoryFilter === 'Lainnya' && styles.filterChipActive]}
                onPress={() => setRecipeCategoryFilter('Lainnya')}
              >
                <Text style={[styles.filterChipText, recipeCategoryFilter === 'Lainnya' && styles.filterChipTextActive]}>
                  Lainnya ({recipes.filter((r) => !r.category.toLowerCase().includes('minum') && !r.category.toLowerCase().includes('makan')).length})
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.scrollList}
              contentContainerStyle={[styles.scrollInner, { paddingBottom: 80 }]}
              showsVerticalScrollIndicator={false}
            >
              {recipes.length === 0 ? (
                <View style={styles.emptyStateBox}>
                  <Feather name="book-open" size={40} color="#CBD5E1" />
                  <Text style={styles.emptyStateTitle}>Belum Ada Resep Menu</Text>
                  <Text style={styles.emptyStateSub}>
                    Mulai racik resep pertama Anda untuk menghitung HPP otomatis, susut bahan, dan rekomendasi harga jual offline & online.
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyActionBtn}
                    onPress={() => {
                      setEditingRecipeId(null);
                      setFormRecipeName('');
                      setFormRecipeCat('Minuman');
                      setFormYield('1');
                      setFormPrice('');
                      setFormWaste('0');
                      setFormInflation(storeProfile.defaultInflationBuffer ?? 5);
                      setFormLaborCost('0');
                      setFormUtilityCost('0');
                      setFormRecipeIngredients([]);
                      setFormRecipePackaging([]);
                      setShowAddRecipeModal(true);
                    }}
                  >
                    <Feather name="plus" size={16} color="#FFFFFF" />
                    <Text style={styles.emptyActionBtnText}>Buat Resep Pertama</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                recipes
                  .filter((r) => {
                    const matchQuery = r.name.toLowerCase().includes(searchQuery.toLowerCase());
                    const isMinum = r.category.toLowerCase().includes('minum');
                    const isMakan = r.category.toLowerCase().includes('makan');
                    const matchCat =
                      recipeCategoryFilter === 'all' ||
                      (recipeCategoryFilter === 'Minuman' && isMinum) ||
                      (recipeCategoryFilter === 'Makanan' && isMakan) ||
                      (recipeCategoryFilter === 'Lainnya' && !isMinum && !isMakan);
                    return matchQuery && matchCat;
                  })
                  .map((rec) => (
                    <TouchableOpacity
                      key={rec.id}
                      style={styles.recipeCard}
                      activeOpacity={0.88}
                      onPress={() => handleOpenRecipeDetail(rec)}
                    >
                      {/* Header */}
                      <View style={styles.recipeHeaderRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.recipeTitle}>{rec.name}</Text>
                          <Text style={styles.recipeBatchInfo}>
                            Hasil: {rec.yieldQty} Porsi/Batch • Susut: {rec.wastePercent}%
                            {rec.inflationBuffer ? ` • Buffer: +${rec.inflationBuffer}%` : ''}
                          </Text>
                        </View>

                        <View
                          style={[
                            styles.marginBadge,
                            rec.marginPercent >= 35
                              ? styles.marginBadgeSuper
                              : rec.marginPercent >= 20
                              ? styles.marginBadgeHealthy
                              : styles.marginBadgeWarn,
                          ]}
                        >
                          <Feather
                            name={rec.marginPercent >= 35 ? 'trending-up' : 'alert-circle'}
                            size={12}
                            color={rec.marginPercent >= 35 ? '#065F46' : '#92400E'}
                          />
                          <Text
                            style={[
                              styles.marginBadgeText,
                              rec.marginPercent >= 35
                                ? { color: '#065F46' }
                                : { color: '#92400E' },
                            ]}
                          >
                            Margin {rec.marginPercent}%
                          </Text>
                        </View>
                      </View>

                      {/* Financial Metric Grid */}
                      <View style={styles.metricRow}>
                        <View style={styles.metricBox}>
                          <Text style={styles.metricLabel}>HPP / Porsi</Text>
                          <Text style={styles.metricHppVal}>Rp {formatRupiah(rec.unitCost)}</Text>
                        </View>
                        <View style={styles.metricBox}>
                          <Text style={styles.metricLabel}>Harga Jual</Text>
                          <Text style={styles.metricPriceVal}>Rp {formatRupiah(rec.targetSellingPrice)}</Text>
                        </View>
                        <View style={styles.metricBox}>
                          <Text style={styles.metricLabel}>Laba Bersih</Text>
                          <Text style={styles.metricProfitVal}>+Rp {formatRupiah(rec.netProfit)}</Text>
                        </View>
                      </View>

                      {/* Smart Pricing Suggestion Box */}
                      <View style={styles.smartPricingBanner}>
                        <Feather name="zap" size={14} color="#059669" />
                        <Text style={styles.smartPricingNote}>
                          Offline (M35%): <Text style={styles.boldText}>Rp {formatRupiah(Math.ceil((rec.unitCost / 0.65) / 1000) * 1000)}</Text> • Ojol (Komisi 20%): <Text style={styles.boldText}>Rp {formatRupiah(Math.ceil(((rec.unitCost / 0.65) / 0.8) / 1000) * 1000)}</Text>
                        </Text>
                      </View>

                      {/* Quick Action Footer in Card */}
                      <View style={styles.recipeCardFooterAction}>
                        <Text style={styles.recipeCardHintText}>Ketuk kartu untuk rincian & tes inflasi</Text>
                        <View style={styles.recipeCardFooterButtons}>
                          <TouchableOpacity
                            style={styles.cardMiniBtn}
                            onPress={() => handleShareRecipeAnalysis(rec)}
                          >
                            <Feather name="share-2" size={12} color="#059669" />
                            <Text style={styles.cardMiniBtnText}>Bagikan</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.cardMiniBtn}
                            onPress={() => handleEditRecipe(rec)}
                          >
                            <Feather name="edit-2" size={12} color="#0284C7" />
                            <Text style={[styles.cardMiniBtnText, { color: '#0284C7' }]}>Edit</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.cardMiniBtn}
                            onPress={() => handleDeleteRecipe(rec.id)}
                          >
                            <Feather name="trash-2" size={12} color="#EF4444" />
                            <Text style={[styles.cardMiniBtnText, { color: '#EF4444' }]}>Hapus</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))
              )}
            </ScrollView>

            {/* Floating Action Button (FAB) */}
            <TouchableOpacity
              style={styles.floatingFab}
              onPress={() => {
                setEditingRecipeId(null);
                setFormRecipeName('');
                setFormRecipeCat('Minuman');
                setFormYield('1');
                setFormPrice('');
                setFormWaste('0');
                setFormInflation(storeProfile.defaultInflationBuffer ?? 5);
                setFormLaborCost('0');
                setFormUtilityCost('0');
                setFormRecipeIngredients([]);
                setFormRecipePackaging([]);
                setShowAddRecipeModal(true);
              }}
            >
              <Feather name="plus" size={20} color="#FFFFFF" />
              <Text style={styles.floatingFabText}>Buat Resep</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ========================================================= */}
        {/* TAB 3: SIMULASI BALIK MODAL (BEP)                         */}
        {/* ========================================================= */}
        {activeTab === 'bep' && (
          <View style={styles.tabContentFull}>
            <ScrollView
              style={styles.scrollList}
              contentContainerStyle={[styles.scrollInner, { paddingBottom: 60 }]}
              showsVerticalScrollIndicator={false}
            >
              {/* Hero BEP Milestone Card */}
              <View style={styles.bepHeroCard}>
                <View style={styles.bepHeroTop}>
                  <Text style={styles.bepHeroTitle}>ESTIMASI BALIK MODAL (BEP)</Text>
                  <View style={styles.bepBadge}>
                    <Text style={styles.bepBadgeText}>SIMULASI RIIL</Text>
                  </View>
                </View>

                <View style={styles.bepMainNumberRow}>
                  <View>
                    <Text style={styles.bepBigNumber}>
                      {bepMonths !== '-' ? `${bepMonths}` : '∞'}
                    </Text>
                    <Text style={styles.bepBigUnit}>
                      Bulan {bepDays > 0 ? `(~${bepDays} hari)` : ''}
                    </Text>
                  </View>

                  <View style={styles.bepSubMetrics}>
                    <View style={styles.bepSubMetricItem}>
                      <Text style={styles.bepSubLabel}>Total Modal Awal</Text>
                      <Text style={styles.bepSubVal}>Rp {formatRupiah(totalInitialCapital)}</Text>
                      <Text style={styles.bepSubNote}>
                        Aset: {formatRupiah(totalCapex)} • Kas: {formatRupiah(totalWorkingCapital)}
                      </Text>
                    </View>
                    <View style={styles.bepSubMetricItem}>
                      <Text style={styles.bepSubLabel}>Laba Bersih/Bulan</Text>
                      <Text
                        style={[
                          styles.bepSubVal,
                          monthlyOperatingProfit > 0 ? { color: '#10B981' } : { color: '#EF4444' },
                        ]}
                      >
                        {monthlyOperatingProfit > 0 ? `+Rp ${formatRupiah(monthlyOperatingProfit)}` : 'Belum Untung'}
                      </Text>
                      <Text style={styles.bepSubNote}>
                        {bepScenario === 'pesimis'
                          ? 'Skenario -30%'
                          : bepScenario === 'optimis'
                          ? 'Skenario +30%'
                          : 'Target normal'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Monthly Flow Row */}
                <View style={styles.bepFlowRow}>
                  <View style={styles.flowItem}>
                    <Text style={styles.flowLabel}>
                      {bepScenario === 'pesimis'
                        ? 'Omset (-30%)/Bln'
                        : bepScenario === 'optimis'
                        ? 'Omset (+30%)/Bln'
                        : 'Target Omset/Bln'}
                    </Text>
                    <Text style={styles.flowVal}>Rp {formatRupiah(simulatedMonthlyRevenue)}</Text>
                  </View>
                  <View style={styles.flowDivider} />
                  <View style={styles.flowItem}>
                    <Text style={styles.flowLabel}>Total Beban/Bln</Text>
                    <Text style={styles.flowVal}>Rp {formatRupiah(totalMonthlyExpenses)}</Text>
                  </View>
                </View>

                {/* 3-Scenario Risk Simulator Toggle (Feature 2) */}
                <View style={styles.scenarioBar}>
                  <Text style={styles.scenarioLabel}>UJI SKENARIO RISIKO PENJUALAN:</Text>
                  <View style={styles.scenarioToggleGroup}>
                    <TouchableOpacity
                      style={[
                        styles.scenarioBtn,
                        bepScenario === 'pesimis' && styles.scenarioBtnPesimisActive,
                      ]}
                      onPress={() => {
                        setBepScenario('pesimis');
                        Haptics.selectionAsync().catch(() => {});
                      }}
                    >
                      <Text
                        style={[
                          styles.scenarioBtnText,
                          bepScenario === 'pesimis' && styles.scenarioBtnTextActive,
                        ]}
                      >
                        📉 Pesimis (-30%)
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.scenarioBtn,
                        bepScenario === 'normal' && styles.scenarioBtnNormalActive,
                      ]}
                      onPress={() => {
                        setBepScenario('normal');
                        Haptics.selectionAsync().catch(() => {});
                      }}
                    >
                      <Text
                        style={[
                          styles.scenarioBtnText,
                          bepScenario === 'normal' && styles.scenarioBtnTextActive,
                        ]}
                      >
                        🎯 Target Normal
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.scenarioBtn,
                        bepScenario === 'optimis' && styles.scenarioBtnOptimisActive,
                      ]}
                      onPress={() => {
                        setBepScenario('optimis');
                        Haptics.selectionAsync().catch(() => {});
                      }}
                    >
                      <Text
                        style={[
                          styles.scenarioBtnText,
                          bepScenario === 'optimis' && styles.scenarioBtnTextActive,
                        ]}
                      >
                        🚀 Optimis (+30%)
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Proposal Export Actions: PDF (Professional) & WA Text */}
                <View style={styles.proposalActionGroup}>
                  <TouchableOpacity
                    style={styles.proposalPdfBtn}
                    onPress={handleExportFeasibilityProposalPdf}
                  >
                    <Feather name="printer" size={15} color="#FFFFFF" />
                    <Text style={styles.proposalPdfBtnText}>Cetak / Unduh Proposal (PDF)</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.proposalTextBtn}
                    onPress={handleShareBusinessFeasibilityReport}
                  >
                    <Feather name="share-2" size={14} color="#059669" />
                    <Text style={styles.proposalTextBtnText}>Kirim WA</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Daily Survival Meter / Indikator Titik Impas Harian */}
              <View style={styles.dailySurvivalCard}>
                <View style={styles.dailySurvivalTopRow}>
                  <View style={styles.dailySurvivalIconWrap}>
                    <Feather name="shield" size={18} color="#059669" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dailySurvivalTitle}>TITIK AMAN HARIAN (SURVIVAL NET)</Text>
                    <Text style={styles.dailySurvivalSub}>
                      Target minimal penjualan harian agar operasional toko tidak nombok
                    </Text>
                  </View>
                  <View style={styles.dailySurvivalBadge}>
                    <Text style={styles.dailySurvivalBadgeNum}>{dailyBepTargetUnits}</Text>
                    <Text style={styles.dailySurvivalBadgeUnit}>porsi/hari</Text>
                  </View>
                </View>
                <View style={styles.dailySurvivalBottomRow}>
                  <Feather name="info" size={13} color="#0284C7" />
                  <Text style={styles.dailySurvivalBottomText}>
                    Menutup beban operasional <Text style={{ fontWeight: '800', color: '#0F172A' }}>Rp {formatRupiah(dailyFixedCost)}/hari</Text> (sewa tempat, upah kerja, energi utilitas).
                  </Text>
                </View>
              </View>

              {/* Sub-Segments for BEP */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.segmentScroll}
                contentContainerStyle={styles.segmentScrollInner}
              >
                <TouchableOpacity
                  style={[styles.segmentScrollBtn, bepSubTab === 'target' && styles.segmentBtnActive]}
                  onPress={() => setBepSubTab('target')}
                >
                  <Text style={[styles.segmentBtnText, bepSubTab === 'target' && styles.segmentBtnTextActive]}>
                    1. Target Jual
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segmentScrollBtn, bepSubTab === 'capex' && styles.segmentBtnActive]}
                  onPress={() => setBepSubTab('capex')}
                >
                  <Text style={[styles.segmentBtnText, bepSubTab === 'capex' && styles.segmentBtnTextActive]}>
                    2. Modal Awal
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segmentScrollBtn, bepSubTab === 'opex' && styles.segmentBtnActive]}
                  onPress={() => setBepSubTab('opex')}
                >
                  <Text style={[styles.segmentBtnText, bepSubTab === 'opex' && styles.segmentBtnTextActive]}>
                    3. Beban Rutin
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segmentScrollBtn, bepSubTab === 'grafik' && styles.segmentBtnActive]}
                  onPress={() => setBepSubTab('grafik')}
                >
                  <Text style={[styles.segmentBtnText, bepSubTab === 'grafik' && styles.segmentBtnTextActive]}>
                    4. Grafik BEP
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segmentScrollBtn, bepSubTab === 'checklist' && styles.segmentBtnActive]}
                  onPress={() => setBepSubTab('checklist')}
                >
                  <Text style={[styles.segmentBtnText, bepSubTab === 'checklist' && styles.segmentBtnTextActive]}>
                    5. Kesiapan Buka
                  </Text>
                </TouchableOpacity>
              </ScrollView>

              {/* Sub-Tab 1: Target Penjualan Harian */}
              {bepSubTab === 'target' && (
                <View>
                  <Text style={styles.sectionHelper}>
                    Atur target porsi terjual per hari untuk mensimulasikan pemasukan dan HPP bulanan.
                  </Text>
                  {recipes.length === 0 ? (
                    <View style={styles.emptyStateBox}>
                      <Feather name="target" size={40} color="#CBD5E1" />
                      <Text style={styles.emptyStateTitle}>Belum Ada Menu Jualan</Text>
                      <Text style={styles.emptyStateSub}>
                        Buat resep produk di tab 'Resep & HPP' terlebih dahulu untuk mensimulasikan target penjualan harian dan omset bulanan.
                      </Text>
                      <TouchableOpacity
                        style={styles.emptyActionBtn}
                        onPress={() => setActiveTab('resep')}
                      >
                        <Feather name="plus" size={16} color="#FFFFFF" />
                        <Text style={styles.emptyActionBtnText}>Buka Tab Resep & HPP</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    recipes.map((rec) => {
                      const target = dailyTargets.find((t) => t.productId === rec.id);
                      const qty = target ? target.dailyQty : 0;
                      return (
                        <View key={rec.id} style={styles.bepItemCard}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.bepItemTitle}>{rec.name}</Text>
                            <Text style={styles.bepItemSub}>
                              Jual: Rp {formatRupiah(rec.targetSellingPrice)} • HPP: Rp {formatRupiah(rec.unitCost)}
                            </Text>
                            <Text style={styles.bepItemMonthly}>
                              Omset: Rp {formatRupiah(qty * 30 * rec.targetSellingPrice)}/bln
                            </Text>
                          </View>

                          <View style={styles.targetStepper}>
                            <TouchableOpacity
                              style={styles.targetStepBtn}
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
                              <Text style={styles.targetStepSign}>-5</Text>
                            </TouchableOpacity>

                            <View style={styles.targetCountCol}>
                              <Text style={styles.targetCountNum}>{qty}</Text>
                              <Text style={styles.targetCountSub}>/hari</Text>
                            </View>

                            <TouchableOpacity
                              style={styles.targetStepBtn}
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
                              <Text style={styles.targetStepSign}>+5</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              )}

              {/* Sub-Tab 2: Modal Awal (Capex & Kas Cadangan) */}
              {bepSubTab === 'capex' && (
                <View>
                  {/* Working Capital (Kas Operasional) Card (Feature 1) */}
                  <View style={styles.workingCapCard}>
                    <View style={styles.workingCapHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.workingCapTitle}>Kas Cadangan & Modal Kerja</Text>
                        <Text style={styles.workingCapSub}>
                          Dana kas likuid untuk belanja bahan perdana dan talangan operasional awal.
                        </Text>
                      </View>
                      <View style={styles.workingCapIconBadge}>
                        <Feather name="shield" size={18} color="#0284C7" />
                      </View>
                    </View>

                    <View style={styles.workingCapInputRow}>
                      <View style={styles.workingCapInputWrap}>
                        <Text style={styles.workingCapPrefix}>Rp</Text>
                        <TextInput
                          style={styles.workingCapInput}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor="#94A3B8"
                          value={formWorkingCapital ? formatRupiah(formWorkingCapital) : ''}
                          onChangeText={(txt) => setFormWorkingCapital(txt.replace(/[^0-9]/g, ''))}
                        />
                      </View>
                      <TouchableOpacity
                        style={styles.workingCapSaveBtn}
                        onPress={handleSaveWorkingCapital}
                      >
                        <Feather name="check" size={15} color="#FFFFFF" />
                        <Text style={styles.workingCapSaveText}>Simpan</Text>
                      </TouchableOpacity>
                    </View>

                    {storeProfile.workingCapital ? (
                      <View style={styles.workingCapSavedNotice}>
                        <Feather name="check-circle" size={13} color="#059669" />
                        <Text style={styles.workingCapSavedText}>
                          Tersimpan: Rp {formatRupiah(storeProfile.workingCapital)} masuk dalam perhitungan modal awal
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.subSectionHeader}>
                    <Text style={styles.subSectionTitle}>Aset & Peralatan Awal</Text>
                    <TouchableOpacity
                      style={styles.subSectionAddBtn}
                      onPress={() => setShowAddCapitalModal(true)}
                    >
                      <Feather name="plus" size={14} color="#059669" />
                      <Text style={styles.subSectionAddText}>Tambah</Text>
                    </TouchableOpacity>
                  </View>

                  {capitalItems.length === 0 ? (
                    <View style={styles.emptyStateBox}>
                      <Feather name="archive" size={40} color="#CBD5E1" />
                      <Text style={styles.emptyStateTitle}>Belum Ada Modal Awal</Text>
                      <Text style={styles.emptyStateSub}>
                        Catat aset atau peralatan usaha awal (misal: mesin espresso, gerobak, blender) untuk menghitung perkiraan titik balik modal.
                      </Text>
                      <TouchableOpacity
                        style={styles.emptyActionBtn}
                        onPress={() => setShowAddCapitalModal(true)}
                      >
                        <Feather name="plus" size={16} color="#FFFFFF" />
                        <Text style={styles.emptyActionBtnText}>Tambah Modal Awal</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    capitalItems.map((item) => {
                      const lifespan = item.lifespanMonths || 24;
                      const monthlyDeprec = Math.round(item.total / lifespan);
                      return (
                        <View key={item.id} style={styles.bepItemCard}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.bepItemTitle}>{item.name}</Text>
                            <Text style={styles.bepItemSub}>
                              {item.qty} unit @ Rp {formatRupiah(item.price)}
                            </Text>
                            <Text style={styles.deprecBadgeSub}>
                              Penyusutan: Rp {formatRupiah(monthlyDeprec)}/bln ({lifespan} bln)
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <Text style={styles.bepItemTotal}>Rp {formatRupiah(item.total)}</Text>
                            <TouchableOpacity
                              style={styles.trashMiniBtn}
                              onPress={() => handleDeleteCapital(item.id)}
                            >
                              <Feather name="trash-2" size={14} color="#EF4444" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })
                  )}

                  {/* Cadangan Penyusutan Peralatan (Amortisasi) Card */}
                  <View style={styles.deprecSummaryCard}>
                    <View style={styles.deprecSummaryHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.deprecSummaryTitle}>Cadangan Penyusutan Alat</Text>
                        <Text style={styles.deprecSummarySub}>
                          Total beban keausan alat: <Text style={{ fontWeight: '800', color: '#B45309' }}>Rp {formatRupiah(totalMonthlyDepreciation)} / bln</Text>
                        </Text>
                      </View>
                      <View style={styles.deprecIconBadge}>
                        <Feather name="refresh-cw" size={16} color="#D97706" />
                      </View>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.deprecToggleRow,
                        storeProfile.includeDepreciationInOpex && styles.deprecToggleRowActive,
                      ]}
                      onPress={() => {
                        const nextVal = !storeProfile.includeDepreciationInOpex;
                        const updated: StoreProfile = { ...storeProfile, includeDepreciationInOpex: nextVal };
                        setStoreProfile(updated);
                        persist(KEY_PROFILE, updated);
                        syncToActiveProject({ profile: updated });
                        Haptics.selectionAsync().catch(() => {});
                        triggerToast(nextVal ? 'Penyusutan dihitung ke beban rutin (Opex).' : 'Penyusutan dipisahkan dari beban bulanan.');
                      }}
                    >
                      <Feather
                        name={storeProfile.includeDepreciationInOpex ? 'check-square' : 'square'}
                        size={18}
                        color={storeProfile.includeDepreciationInOpex ? '#D97706' : '#94A3B8'}
                      />
                      <Text style={styles.deprecToggleText}>
                        Hitung otomatis ke beban operasional bulanan (Opex)
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {/* Simulasi Kerjasama Pemodal (Investor ROI & Profit Sharing) */}
                  <View style={styles.investorSimCard}>
                    <View style={styles.investorSimHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.investorSimTitle}>Simulasi Bagi Hasil Investor (ROI)</Text>
                        <Text style={styles.investorSimSub}>
                          Bagi hasil laba bersih bulanan untuk mitra pemodal yang mendanai modal awal
                        </Text>
                      </View>
                      <View style={styles.investorSimIconBadge}>
                        <Feather name="pie-chart" size={18} color="#7C3AED" />
                      </View>
                    </View>

                    {/* Preset Chips Porsi Investor */}
                    <Text style={styles.investorSimPorsiLabel}>Porsi Laba Investor:</Text>
                    <View style={styles.investorPorsiRow}>
                      {[10, 20, 30, 40, 50].map((pct) => (
                        <TouchableOpacity
                          key={pct}
                          style={[
                            styles.investorPorsiChip,
                            formInvestorShare === pct && styles.investorPorsiChipActive,
                          ]}
                          onPress={() => {
                            setFormInvestorShare(pct);
                            const updated: StoreProfile = { ...storeProfile, investorSharePercent: pct };
                            setStoreProfile(updated);
                            persist(KEY_PROFILE, updated);
                            Haptics.selectionAsync().catch(() => {});
                          }}
                        >
                          <Text
                            style={[
                              styles.investorPorsiChipText,
                              formInvestorShare === pct && styles.investorPorsiChipTextActive,
                            ]}
                          >
                            {pct}%
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Result Metrics */}
                    {(() => {
                      const sharePct = formInvestorShare || 30;
                      const ownerPct = 100 - sharePct;
                      const normProfit = monthlyOperatingProfit > 0 ? monthlyOperatingProfit : 0;
                      const investorDiv = Math.round(normProfit * (sharePct / 100));
                      const ownerProfit = normProfit - investorDiv;
                      const invRoiMonths = investorDiv > 0 ? (totalInitialCapital / investorDiv).toFixed(1) : '-';
                      const invRoiDays = investorDiv > 0 ? Math.round((totalInitialCapital / investorDiv) * operatingDays) : 0;

                      return (
                        <View style={styles.investorMetricsBox}>
                          <View style={styles.investorMetricCol}>
                            <Text style={styles.investorMetricLabel}>Dividen Investor ({sharePct}%)</Text>
                            <Text style={[styles.investorMetricVal, { color: '#7C3AED' }]}>
                              +Rp {formatRupiah(investorDiv)}/bln
                            </Text>
                            <Text style={styles.investorMetricSub}>
                              Balik Modal: {invRoiMonths !== '-' ? `${invRoiMonths} Bulan` : 'Belum untung'} {invRoiDays > 0 ? `(~${invRoiDays} hr)` : ''}
                            </Text>
                          </View>
                          <View style={styles.investorMetricDivider} />
                          <View style={styles.investorMetricCol}>
                            <Text style={styles.investorMetricLabel}>Laba Pemilik Toko ({ownerPct}%)</Text>
                            <Text style={[styles.investorMetricVal, { color: '#059669' }]}>
                              +Rp {formatRupiah(ownerProfit)}/bln
                            </Text>
                            <Text style={styles.investorMetricSub}>Pendapatan bersih pengelola</Text>
                          </View>
                        </View>
                      );
                    })()}
                  </View>
                </View>
              )}

              {/* Sub-Tab 3: Beban Tetap (Opex) */}
              {bepSubTab === 'opex' && (
                <View>
                  <View style={styles.subSectionHeader}>
                    <Text style={styles.subSectionTitle}>Beban Rutin Bulanan</Text>
                    <TouchableOpacity
                      style={styles.subSectionAddBtn}
                      onPress={() => setShowAddExpenseModal(true)}
                    >
                      <Feather name="plus" size={14} color="#059669" />
                      <Text style={styles.subSectionAddText}>Tambah</Text>
                    </TouchableOpacity>
                  </View>

                  {expenses.length === 0 ? (
                    <View style={styles.emptyStateBox}>
                      <Feather name="calendar" size={40} color="#CBD5E1" />
                      <Text style={styles.emptyStateTitle}>Belum Ada Beban Rutin</Text>
                      <Text style={styles.emptyStateSub}>
                        Catat biaya operasional bulanan seperti sewa tempat, gaji karyawan, listrik, air, atau kuota internet.
                      </Text>
                      <TouchableOpacity
                        style={styles.emptyActionBtn}
                        onPress={() => setShowAddExpenseModal(true)}
                      >
                        <Feather name="plus" size={16} color="#FFFFFF" />
                        <Text style={styles.emptyActionBtnText}>Tambah Beban Bulanan</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    expenses.map((exp) => (
                      <View key={exp.id} style={styles.bepItemCard}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.bepItemTitle}>{exp.name}</Text>
                          <Text style={styles.bepItemSub}>Biaya rutin per bulan</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <Text style={styles.bepItemTotal}>Rp {formatRupiah(exp.amount)}/bln</Text>
                          <TouchableOpacity
                            style={styles.trashMiniBtn}
                            onPress={() => handleDeleteExpense(exp.id)}
                          >
                            <Feather name="trash-2" size={14} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              )}

              {/* Sub-Tab 4: Grafik Titik Impas (BEP) & Struktur Beban */}
              {bepSubTab === 'grafik' && (
                <View>
                  <View style={styles.subSectionHeader}>
                    <Text style={styles.subSectionTitle}>Grafik Kurva Titik Impas (BEP)</Text>
                    <View style={styles.bepLiveTag}>
                      <Text style={styles.bepLiveTagText}>SVG INTERAKTIF</Text>
                    </View>
                  </View>

                  {/* SVG Chart Card */}
                  <View style={styles.chartCard}>
                    <Text style={styles.chartCardTitle}>Kurva Omset vs Total Beban</Text>
                    <Text style={styles.chartCardSub}>
                      Titik potong (pertemuan) antara garis hijau (Omset) dan garis merah (Beban) adalah Titik Impas (BEP).
                    </Text>

                    {(() => {
                      const unitContribution = Math.max(1, avgSellingPrice - avgUnitCost);
                      const monthlyBepUnits = unitContribution > 0 ? Math.ceil(effectiveMonthlyFixedExpenses / unitContribution) : 0;
                      const targetMonthlyUnits = recipes.reduce((acc, rec) => {
                        const target = dailyTargets.find((t) => t.productId === rec.id);
                        return acc + (target ? target.dailyQty : 0) * operatingDays;
                      }, 0);

                      const maxXUnits = Math.max(monthlyBepUnits * 1.5, targetMonthlyUnits * 1.3, 100);
                      const maxYVal = Math.max(maxXUnits * avgSellingPrice, effectiveMonthlyFixedExpenses + maxXUnits * avgUnitCost, 1000000);

                      const chartW = Math.max(260, SCREEN_WIDTH - 64);
                      const chartH = 190;
                      const padL = 40;
                      const padR = 20;
                      const padT = 20;
                      const padB = 30;
                      const plotW = chartW - padL - padR;
                      const plotH = chartH - padT - padB;

                      const toX = (u: number) => padL + (Math.min(u, maxXUnits) / maxXUnits) * plotW;
                      const toY = (v: number) => padT + plotH - (Math.min(v, maxYVal) / maxYVal) * plotH;

                      const bepX = toX(monthlyBepUnits);
                      const bepY = toY(monthlyBepUnits * avgSellingPrice);

                      const targetX = toX(targetMonthlyUnits);
                      const targetY = toY(targetMonthlyUnits * avgSellingPrice);

                      return (
                        <View style={styles.chartSvgWrap}>
                          <Svg width={chartW} height={chartH}>
                            {/* Grid Lines */}
                            <Line x1={padL} y1={padT} x2={padL + plotW} y2={padT} stroke="#F1F5F9" strokeWidth="1" />
                            <Line x1={padL} y1={padT + plotH / 2} x2={padL + plotW} y2={padT + plotH / 2} stroke="#F1F5F9" strokeWidth="1" />
                            <Line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke="#CBD5E1" strokeWidth="1.5" />
                            <Line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="#CBD5E1" strokeWidth="1.5" />

                            {/* Y-Axis Labels */}
                            <SvgText x={padL - 6} y={padT + 10} fontSize="9" fill="#94A3B8" textAnchor="end">
                              {maxYVal >= 1000000 ? `${(maxYVal / 1000000).toFixed(0)}jt` : `${(maxYVal / 1000).toFixed(0)}k`}
                            </SvgText>
                            <SvgText x={padL - 6} y={padT + plotH / 2 + 3} fontSize="9" fill="#94A3B8" textAnchor="end">
                              {maxYVal >= 2000000 ? `${(maxYVal / 2000000).toFixed(0)}jt` : `${(maxYVal / 2000).toFixed(0)}k`}
                            </SvgText>
                            <SvgText x={padL - 6} y={padT + plotH} fontSize="9" fill="#94A3B8" textAnchor="end">
                              0
                            </SvgText>

                            {/* X-Axis Labels */}
                            <SvgText x={padL} y={chartH - 8} fontSize="9" fill="#94A3B8" textAnchor="middle">
                              0
                            </SvgText>
                            <SvgText x={padL + plotW / 2} y={chartH - 8} fontSize="9" fill="#94A3B8" textAnchor="middle">
                              {(maxXUnits / 2).toFixed(0)} pcs
                            </SvgText>
                            <SvgText x={padL + plotW} y={chartH - 8} fontSize="9" fill="#94A3B8" textAnchor="middle">
                              {maxXUnits.toFixed(0)} pcs
                            </SvgText>

                            {/* Fixed Cost Line (Dashed Slate) */}
                            <Line
                              x1={toX(0)}
                              y1={toY(effectiveMonthlyFixedExpenses)}
                              x2={toX(maxXUnits)}
                              y2={toY(effectiveMonthlyFixedExpenses)}
                              stroke="#94A3B8"
                              strokeWidth="1.5"
                              strokeDasharray="4, 4"
                            />

                            {/* Total Cost Line (Rose / Red) */}
                            <Line
                              x1={toX(0)}
                              y1={toY(effectiveMonthlyFixedExpenses)}
                              x2={toX(maxXUnits)}
                              y2={toY(effectiveMonthlyFixedExpenses + maxXUnits * avgUnitCost)}
                              stroke="#EF4444"
                              strokeWidth="2.5"
                            />

                            {/* Total Revenue Line (Emerald / Green) */}
                            <Line
                              x1={toX(0)}
                              y1={toY(0)}
                              x2={toX(maxXUnits)}
                              y2={toY(maxXUnits * avgSellingPrice)}
                              stroke="#10B981"
                              strokeWidth="2.5"
                            />

                            {/* BEP Intersection Dot */}
                            {monthlyBepUnits > 0 && (
                              <G>
                                <Circle cx={bepX} cy={bepY} r={6} fill="#F59E0B" stroke="#FFFFFF" strokeWidth="2" />
                              </G>
                            )}

                            {/* Target Dot */}
                            {targetMonthlyUnits > 0 && (
                              <G>
                                <Circle cx={targetX} cy={targetY} r={6} fill="#3B82F6" stroke="#FFFFFF" strokeWidth="2" />
                              </G>
                            )}
                          </Svg>
                        </View>
                      );
                    })()}

                    {/* Chart Legend */}
                    <View style={styles.chartLegendRow}>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendIndicator, { backgroundColor: '#10B981' }]} />
                        <Text style={styles.legendLabel}>Omset</Text>
                      </View>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendIndicator, { backgroundColor: '#EF4444' }]} />
                        <Text style={styles.legendLabel}>Beban Total</Text>
                      </View>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendIndicator, { backgroundColor: '#94A3B8' }]} />
                        <Text style={styles.legendLabel}>Beban Tetap</Text>
                      </View>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendDotIndicator, { backgroundColor: '#F59E0B' }]} />
                        <Text style={styles.legendLabel}>Titik Impas (BEP)</Text>
                      </View>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendDotIndicator, { backgroundColor: '#3B82F6' }]} />
                        <Text style={styles.legendLabel}>Target Jual</Text>
                      </View>
                    </View>
                  </View>

                  {/* Komposisi Struktur Beban & Omset Stacked Bar */}
                  <View style={styles.proportionCard}>
                    <Text style={styles.proportionCardTitle}>Komposisi Pengeluaran vs Omset</Text>
                    <Text style={styles.proportionCardSub}>
                      Porsi pemakaian omset untuk bahan baku, operasional, penyusutan, dan sisa laba bersih.
                    </Text>

                    {(() => {
                      const totalRev = simulatedMonthlyRevenue > 0 ? simulatedMonthlyRevenue : 1;
                      const pctCogs = Math.min(100, Math.round((simulatedMonthlyCogs / totalRev) * 100));
                      const pctOpex = Math.min(100 - pctCogs, Math.round((totalMonthlyFixedExpenses / totalRev) * 100));
                      const pctDeprec = storeProfile.includeDepreciationInOpex && totalMonthlyDepreciation > 0
                        ? Math.min(100 - pctCogs - pctOpex, Math.round((totalMonthlyDepreciation / totalRev) * 100))
                        : 0;
                      const pctNet = Math.max(0, 100 - pctCogs - pctOpex - pctDeprec);

                      return (
                        <View>
                          {/* Multi-Segment Stacked Bar */}
                          <View style={styles.stackedBarWrap}>
                            {pctCogs > 0 && <View style={[styles.barSegment, { flex: pctCogs, backgroundColor: '#F59E0B' }]} />}
                            {pctOpex > 0 && <View style={[styles.barSegment, { flex: pctOpex, backgroundColor: '#3B82F6' }]} />}
                            {pctDeprec > 0 && <View style={[styles.barSegment, { flex: pctDeprec, backgroundColor: '#8B5CF6' }]} />}
                            {pctNet > 0 && <View style={[styles.barSegment, { flex: pctNet, backgroundColor: '#10B981' }]} />}
                            {monthlyOperatingProfit < 0 && <View style={[styles.barSegment, { flex: 100, backgroundColor: '#EF4444' }]} />}
                          </View>

                          {/* Legend Grid */}
                          <View style={styles.stackedLegendGrid}>
                            <View style={styles.stackedLegendCol}>
                              <View style={[styles.legendBox, { backgroundColor: '#F59E0B' }]} />
                              <View>
                                <Text style={styles.stackedLegendName}>Bahan Baku (COGS)</Text>
                                <Text style={styles.stackedLegendVal}>{pctCogs}% (Rp {formatRupiah(simulatedMonthlyCogs)})</Text>
                              </View>
                            </View>

                            <View style={styles.stackedLegendCol}>
                              <View style={[styles.legendBox, { backgroundColor: '#3B82F6' }]} />
                              <View>
                                <Text style={styles.stackedLegendName}>Beban Rutin (Opex)</Text>
                                <Text style={styles.stackedLegendVal}>{pctOpex}% (Rp {formatRupiah(totalMonthlyFixedExpenses)})</Text>
                              </View>
                            </View>

                            {storeProfile.includeDepreciationInOpex && totalMonthlyDepreciation > 0 && (
                              <View style={styles.stackedLegendCol}>
                                <View style={[styles.legendBox, { backgroundColor: '#8B5CF6' }]} />
                                <View>
                                  <Text style={styles.stackedLegendName}>Depresiasi Alat</Text>
                                  <Text style={styles.stackedLegendVal}>{pctDeprec}% (Rp {formatRupiah(totalMonthlyDepreciation)})</Text>
                                </View>
                              </View>
                            )}

                            <View style={styles.stackedLegendCol}>
                              <View style={[styles.legendBox, { backgroundColor: monthlyOperatingProfit >= 0 ? '#10B981' : '#EF4444' }]} />
                              <View>
                                <Text style={styles.stackedLegendName}>{monthlyOperatingProfit >= 0 ? 'Laba Bersih' : 'Defisit (Rugi)'}</Text>
                                <Text style={[styles.stackedLegendVal, { color: monthlyOperatingProfit >= 0 ? '#059669' : '#EF4444' }]}>
                                  {monthlyOperatingProfit >= 0 ? `${pctNet}%` : 'Rugi'} (Rp {formatRupiah(Math.abs(monthlyOperatingProfit))})
                                </Text>
                              </View>
                            </View>
                          </View>
                        </View>
                      );
                    })()}
                  </View>

                  {/* Summary Metric KPI */}
                  <View style={styles.bepKpiGrid}>
                    <View style={styles.bepKpiBox}>
                      <Text style={styles.bepKpiLabel}>TARGET AMBANG BEP</Text>
                      <Text style={styles.bepKpiValue}>{dailyBepTargetUnits * operatingDays} Porsi/Bln</Text>
                      <Text style={styles.bepKpiSub}>~{dailyBepTargetUnits} porsi/hari kerja</Text>
                    </View>
                    <View style={styles.bepKpiBox}>
                      <Text style={styles.bepKpiLabel}>OMSET MINIMAL BEP</Text>
                      <Text style={styles.bepKpiValue}>Rp {formatRupiah(dailyBepTargetUnits * operatingDays * avgSellingPrice)}</Text>
                      <Text style={styles.bepKpiSub}>Untuk tutup seluruh beban</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Sub-Tab 5: Checklist Kesiapan Buka Usaha */}
              {bepSubTab === 'checklist' && (
                <View>
                  {/* Progress Header Card */}
                  <View style={styles.checkHeaderCard}>
                    <View style={styles.checkHeaderTopRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.checkHeaderTitle}>Kesiapan Buka Usaha</Text>
                        <Text style={styles.checkHeaderSub}>
                          {completedChecklistCount} dari {checklists.length} tugas persiapan selesai
                        </Text>
                      </View>
                      <View style={styles.checkProgressBadge}>
                        <Text style={styles.checkProgressBadgeText}>{checklistProgressPercent}%</Text>
                      </View>
                    </View>

                    {/* Progress Bar */}
                    <View style={styles.checkProgressBarTrack}>
                      <View style={[styles.checkProgressBarFill, { width: `${checklistProgressPercent}%` }]} />
                    </View>

                    <Text style={styles.checkAdviceText}>
                      {checklistProgressPercent < 40
                        ? '🌱 Tahap Perencanaan: Siapkan izin dasar, branding, dan konsep produk.'
                        : checklistProgressPercent < 80
                        ? '⚡ Tahap Operasional: Matangkan peralatan, supplier, dan SOP harian.'
                        : checklistProgressPercent < 100
                        ? '🔥 Hampir Siap: Cek ulang kebersihan, promosi pembukaan, dan modal kas.'
                        : '🎉 100% Siap Buka Usaha! Seluruh checklist persiapan telah terpenuhi.'}
                    </Text>
                  </View>

                  {/* Category Filter Chips */}
                  <View style={styles.checkFilterRow}>
                    <TouchableOpacity
                      style={[styles.checkFilterChip, checklistFilter === 'all' && styles.checkFilterChipActive]}
                      onPress={() => setChecklistFilter('all')}
                    >
                      <Text style={[styles.checkFilterChipText, checklistFilter === 'all' && styles.checkFilterChipTextActive]}>
                        Semua ({checklists.length})
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.checkFilterChip, checklistFilter === 'legalitas' && styles.checkFilterChipActive]}
                      onPress={() => setChecklistFilter('legalitas')}
                    >
                      <Text style={[styles.checkFilterChipText, checklistFilter === 'legalitas' && styles.checkFilterChipTextActive]}>
                        Legalitas ({checklists.filter((c) => c.category === 'legalitas').length})
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.checkFilterChip, checklistFilter === 'branding' && styles.checkFilterChipActive]}
                      onPress={() => setChecklistFilter('branding')}
                    >
                      <Text style={[styles.checkFilterChipText, checklistFilter === 'branding' && styles.checkFilterChipTextActive]}>
                        Branding ({checklists.filter((c) => c.category === 'branding').length})
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.checkFilterChip, checklistFilter === 'operasional' && styles.checkFilterChipActive]}
                      onPress={() => setChecklistFilter('operasional')}
                    >
                      <Text style={[styles.checkFilterChipText, checklistFilter === 'operasional' && styles.checkFilterChipTextActive]}>
                        Operasional ({checklists.filter((c) => c.category === 'operasional').length})
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Quick Add Custom Task Input */}
                  <View style={styles.checkAddRow}>
                    <TextInput
                      style={styles.checkAddInput}
                      placeholder="Tambah tugas persiapan baru..."
                      placeholderTextColor="#94A3B8"
                      value={formCustomChecklistTitle}
                      onChangeText={setFormCustomChecklistTitle}
                    />
                    <TouchableOpacity style={styles.checkAddBtn} onPress={handleAddCustomChecklist}>
                      <Feather name="plus" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>

                  {/* Checklist Items List */}
                  {checklists
                    .filter((c) => checklistFilter === 'all' || c.category === checklistFilter)
                    .map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        style={[styles.checkItemCard, item.isCompleted && styles.checkItemCardDone]}
                        onPress={() => handleToggleChecklist(item.id)}
                        activeOpacity={0.7}
                      >
                        <Feather
                          name={item.isCompleted ? 'check-square' : 'square'}
                          size={20}
                          color={item.isCompleted ? '#10B981' : '#94A3B8'}
                        />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={[styles.checkItemTitle, item.isCompleted && styles.checkItemTitleDone]}>
                            {item.title}
                          </Text>
                          <View style={styles.checkItemMetaRow}>
                            <View
                              style={[
                                styles.checkItemCatBadge,
                                item.category === 'legalitas'
                                  ? { backgroundColor: '#EDE9FE' }
                                  : item.category === 'branding'
                                  ? { backgroundColor: '#E0F2FE' }
                                  : { backgroundColor: '#FEF3C7' },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.checkItemCatText,
                                  item.category === 'legalitas'
                                    ? { color: '#7C3AED' }
                                    : item.category === 'branding'
                                    ? { color: '#0284C7' }
                                    : { color: '#D97706' },
                                ]}
                              >
                                {item.category.toUpperCase()}
                              </Text>
                            </View>
                            {item.isCompleted && (
                              <Text style={styles.checkCompletedLabel}>✓ Selesai</Text>
                            )}
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                </View>
              )}
            </ScrollView>
          </View>
        )}

        {/* ========================================================= */}
        {/* TAB 3: DATABASE BAHAN BAKU & KEMASAN                      */}
        {/* ========================================================= */}
        {activeTab === 'bahan' && (
          <View style={styles.tabContentFull}>
            {/* Search Bar */}
            <View style={styles.searchBarWrapper}>
              <Feather name="search" size={16} color="#94A3B8" />
              <TextInput
                style={styles.searchBarInput}
                placeholder="Cari bahan baku atau kemasan..."
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            {/* Category Filter Chips */}
            <View style={styles.filterChipsRow}>
              <TouchableOpacity
                style={[styles.filterChip, matCategoryFilter === 'all' && styles.filterChipActive]}
                onPress={() => setMatCategoryFilter('all')}
              >
                <Text style={[styles.filterChipText, matCategoryFilter === 'all' && styles.filterChipTextActive]}>
                  Semua ({materials.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterChip, matCategoryFilter === 'bahan' && styles.filterChipActive]}
                onPress={() => setMatCategoryFilter('bahan')}
              >
                <Text style={[styles.filterChipText, matCategoryFilter === 'bahan' && styles.filterChipTextActive]}>
                  Bahan Baku ({materials.filter((m) => m.category === 'bahan').length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterChip, matCategoryFilter === 'kemasan' && styles.filterChipActive]}
                onPress={() => setMatCategoryFilter('kemasan')}
              >
                <Text style={[styles.filterChipText, matCategoryFilter === 'kemasan' && styles.filterChipTextActive]}>
                  Kemasan ({materials.filter((m) => m.category === 'kemasan').length})
                </Text>
              </TouchableOpacity>

              {lowStockCount > 0 && (
                <TouchableOpacity
                  style={[styles.filterChip, matCategoryFilter === 'menipis' && styles.filterChipWarnActive]}
                  onPress={() => setMatCategoryFilter('menipis')}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      matCategoryFilter === 'menipis' ? { color: '#FFFFFF', fontWeight: '700' } : { color: '#DC2626', fontWeight: '700' },
                    ]}
                  >
                    ⚠️ Menipis ({lowStockCount})
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Material List */}
            <ScrollView
              style={styles.scrollList}
              contentContainerStyle={[styles.scrollInner, { paddingBottom: 80 }]}
              showsVerticalScrollIndicator={false}
            >
              {materials.length === 0 ? (
                <View style={styles.emptyStateBox}>
                  <Feather name="layers" size={40} color="#CBD5E1" />
                  <Text style={styles.emptyStateTitle}>Belum Ada Bahan Baku</Text>
                  <Text style={styles.emptyStateSub}>
                    Daftarkan bahan baku (kopi, susu, bumbu) dan kemasan (cup, standing pouch, paper bag) Anda di sini.
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyActionBtn}
                    onPress={() => {
                      setFormMatName('');
                      setFormMatPrice('');
                      setFormMatVol('');
                      setFormMatUnit('gr');
                      setFormMatCat('bahan');
                      setFormCurrentStock('');
                      setFormMinAlert('');
                      setShowAddMaterialModal(true);
                    }}
                  >
                    <Feather name="plus" size={16} color="#FFFFFF" />
                    <Text style={styles.emptyActionBtnText}>Tambah Bahan Pertama</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                materials
                  .filter((m) => {
                    const matchSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase());
                    const isLow =
                      m.currentStock !== undefined &&
                      m.minStockAlert !== undefined &&
                      m.minStockAlert > 0 &&
                      m.currentStock <= m.minStockAlert;
                    const matchCat =
                      matCategoryFilter === 'all' ||
                      m.category === matCategoryFilter ||
                      (matCategoryFilter === 'menipis' && isLow);
                    return matchSearch && matchCat;
                  })
                  .map((m) => {
                    const unitPrice = m.purchaseVolume > 0 ? (m.purchasePrice / m.purchaseVolume).toFixed(1) : '0';
                    const isLow =
                      m.currentStock !== undefined &&
                      m.minStockAlert !== undefined &&
                      m.minStockAlert > 0 &&
                      m.currentStock <= m.minStockAlert;
                    return (
                      <View key={m.id} style={styles.materialCard}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <View style={styles.matCategoryTag}>
                              <Text style={styles.matCategoryTagText}>
                                {m.category === 'kemasan' ? 'KEMASAN' : 'BAHAN BAKU'}
                              </Text>
                            </View>
                            {isLow && (
                              <View style={styles.lowStockBadge}>
                                <Feather name="alert-triangle" size={10} color="#DC2626" />
                                <Text style={styles.lowStockBadgeText}>Stok Menipis!</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.matName}>{m.name}</Text>
                          <Text style={styles.matPurchaseInfo}>
                            Beli: Rp {formatRupiah(m.purchasePrice)} per {formatRupiah(m.purchaseVolume)} {m.unit}
                          </Text>
                          {m.currentStock !== undefined && (
                            <Text style={[styles.matStockText, isLow && styles.matStockTextWarn]}>
                              Sisa Stok: <Text style={{ fontWeight: '700' }}>{formatRupiah(m.currentStock)} {m.unit}</Text>
                              {m.minStockAlert ? ` (Min: ${formatRupiah(m.minStockAlert)} ${m.unit})` : ''}
                            </Text>
                          )}
                        </View>

                        <View style={styles.matUnitCostCol}>
                          <Text style={styles.matUnitCostLabel}>HPP Satuan</Text>
                          <Text style={styles.matUnitCostVal}>Rp {unitPrice}</Text>
                          <Text style={styles.matUnitCostUnit}>per {m.unit}</Text>
                          <View style={styles.matActionMiniRow}>
                            <TouchableOpacity
                              style={styles.matActionMiniBtn}
                              onPress={() => handleEditMaterial(m)}
                            >
                              <Feather name="edit-2" size={13} color="#0284C7" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.matActionMiniBtn}
                              onPress={() => handleDeleteMaterial(m.id)}
                            >
                              <Feather name="trash-2" size={13} color="#EF4444" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    );
                  })
              )}
            </ScrollView>

            {/* Floating Action Button (FAB) */}
            <TouchableOpacity
              style={styles.floatingFab}
              onPress={() => {
                setEditingMaterialId(null);
                setFormMatName('');
                setFormMatPrice('');
                setFormMatVol('');
                setFormMatUnit('gr');
                setFormMatCat('bahan');
                setFormCurrentStock('');
                setFormMinAlert('');
                setShowAddMaterialModal(true);
              }}
            >
              <Feather name="plus" size={20} color="#FFFFFF" />
              <Text style={styles.floatingFabText}>Tambah Bahan</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ========================================================= */}
      {/* NATIVE BOTTOM NAVIGATION BAR                              */}
      {/* ========================================================= */}
      <View style={[styles.bottomNavBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <TouchableOpacity
          style={styles.navBarItem}
          onPress={() => {
            setActiveTab('resep');
            Haptics.selectionAsync().catch(() => {});
          }}
        >
          <Feather
            name="book-open"
            size={22}
            color={activeTab === 'resep' ? '#059669' : '#64748B'}
          />
          <Text style={[styles.navBarLabel, activeTab === 'resep' && styles.navBarLabelActive]}>
            Resep & HPP
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navBarItem}
          onPress={() => {
            setActiveTab('bep');
            Haptics.selectionAsync().catch(() => {});
          }}
        >
          <Feather
            name="trending-up"
            size={22}
            color={activeTab === 'bep' ? '#059669' : '#64748B'}
          />
          <Text style={[styles.navBarLabel, activeTab === 'bep' && styles.navBarLabelActive]}>
            Modal & BEP
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navBarItem}
          onPress={() => {
            setActiveTab('bahan');
            Haptics.selectionAsync().catch(() => {});
          }}
        >
          <Feather
            name="layers"
            size={22}
            color={activeTab === 'bahan' ? '#059669' : '#64748B'}
          />
          <Text style={[styles.navBarLabel, activeTab === 'bahan' && styles.navBarLabelActive]}>
            Bahan Baku
          </Text>
        </TouchableOpacity>
      </View>

      {/* ========================================================= */}
      {/* MODAL 3: BUILDER RESEP & HPP LENGKAP                      */}
      {/* ========================================================= */}
      <Modal visible={showAddRecipeModal} animationType="slide">
        <View style={[styles.modalScreen, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAddRecipeModal(false)}>
              <Feather name="arrow-left" size={22} color="#0F172A" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>
              {editingRecipeId ? 'Edit Resep & HPP' : 'Kalkulator Resep & HPP'}
            </Text>
            <TouchableOpacity onPress={handleSaveRecipe}>
              <Text style={styles.modalHeaderAction}>Simpan</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            <Text style={styles.inputLabel}>Nama Menu / Produk</Text>
            <TextInput
              style={styles.nativeInput}
              placeholder="Contoh: Es Teler Sultan"
              placeholderTextColor="#94A3B8"
              value={formRecipeName}
              onChangeText={setFormRecipeName}
            />

            {/* Kategori Resep */}
            <Text style={styles.inputLabel}>Kategori Produk</Text>
            <View style={styles.unitSelectorRow}>
              {['Minuman', 'Makanan', 'Lainnya'].map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.unitChip, formRecipeCat === cat && styles.unitChipActive]}
                  onPress={() => setFormRecipeCat(cat)}
                >
                  <Text style={[styles.unitChipText, formRecipeCat === cat && styles.unitChipTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.twoColRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.inputLabel}>Hasil per Batch (Porsi)</Text>
                <TextInput
                  style={styles.nativeInput}
                  keyboardType="numeric"
                  placeholder="1"
                  placeholderTextColor="#94A3B8"
                  value={formYield}
                  onChangeText={(t) => setFormYield(t.replace(/[^0-9]/g, ''))}
                />
              </View>

              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.inputLabel}>Target Jual (Rp)</Text>
                <TextInput
                  style={styles.nativeInput}
                  keyboardType="numeric"
                  placeholder="Contoh: 15000"
                  placeholderTextColor="#94A3B8"
                  value={formPrice ? `Rp ${formatRupiah(formPrice)}` : ''}
                  onChangeText={(t) => setFormPrice(t.replace(/[^0-9]/g, ''))}
                />
              </View>
            </View>

            <Text style={styles.inputLabel}>Estimasi Susut / Tumpah (%)</Text>
            <TextInput
              style={styles.nativeInput}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="#94A3B8"
              value={formWaste}
              onChangeText={(t) => setFormWaste(t.replace(/[^0-9]/g, ''))}
            />

            {/* Biaya Upah & Utilitas (Anti Modal Bocor) */}
            <View style={styles.twoColRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.inputLabel}>Upah Tenaga Kerja / Batch</Text>
                <TextInput
                  style={styles.nativeInput}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#94A3B8"
                  value={formLaborCost !== '0' && formLaborCost !== '' ? `Rp ${formatRupiah(formLaborCost)}` : ''}
                  onChangeText={(t) => setFormLaborCost(t.replace(/[^0-9]/g, ''))}
                />
              </View>

              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.inputLabel}>Gas & Utilitas / Batch</Text>
                <TextInput
                  style={styles.nativeInput}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#94A3B8"
                  value={formUtilityCost !== '0' && formUtilityCost !== '' ? `Rp ${formatRupiah(formUtilityCost)}` : ''}
                  onChangeText={(t) => setFormUtilityCost(t.replace(/[^0-9]/g, ''))}
                />
              </View>
            </View>

            {/* Stress-Test Inflasi Buffer (+%) */}
            <Text style={styles.inputLabel}>Buffer Fluktuasi / Inflasi Harga Bahan Baku</Text>
            <View style={styles.inflationChipsRow}>
              {[0, 5, 10, 15, 20, 30].map((pct) => (
                <TouchableOpacity
                  key={pct}
                  style={[
                    styles.inflationChip,
                    formInflation === pct && styles.inflationChipActive,
                  ]}
                  onPress={() => setFormInflation(pct)}
                >
                  <Text
                    style={[
                      styles.inflationChipText,
                      formInflation === pct && styles.inflationChipTextActive,
                    ]}
                  >
                    {pct === 0 ? 'Normal' : `+${pct}%`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {formInflation > 0 && (
              <Text style={styles.inflationNote}>
                ⚡ Simulasi lonjakan harga pasar +{formInflation}% diterapkan pada HPP bahan baku.
              </Text>
            )}

            {/* Live Calculation Banner */}
            <View style={styles.builderLiveCard}>
              <View style={styles.liveCardCol}>
                <Text style={styles.liveLabel}>HPP / Porsi</Text>
                <Text style={styles.liveVal}>Rp {formatRupiah(liveUnitHpp)}</Text>
              </View>
              <View style={styles.liveCardCol}>
                <Text style={styles.liveLabel}>Profit Bersih</Text>
                <Text
                  style={[
                    styles.liveVal,
                    liveNetProfit >= 0 ? { color: '#10B981' } : { color: '#EF4444' },
                  ]}
                >
                  Rp {formatRupiah(liveNetProfit)}
                </Text>
              </View>
              <View style={styles.liveCardCol}>
                <Text style={styles.liveLabel}>Margin</Text>
                <Text style={styles.liveVal}>{liveMarginPct.toFixed(1)}%</Text>
              </View>
            </View>

            {/* Rekomendasi Struktur Harga 3-Tier */}
            <View style={styles.recommendationCard}>
              <Text style={styles.recommendationTitle}>Rekomendasi Struktur Harga (3-Tier):</Text>
              <Text style={styles.recommendationLine}>
                • 🛍️ Eceran (Margin 35%): <Text style={styles.boldDark}>Rp {formatRupiah(tierEceran)}</Text>
              </Text>
              <Text style={styles.recommendationLine}>
                • 🤝 Reseller / Agen (Margin 20%): <Text style={styles.boldDark}>Rp {formatRupiah(tierReseller)}</Text>
              </Text>
              <Text style={styles.recommendationLine}>
                • 🏢 Grosir Partai Besar (Margin 15%): <Text style={styles.boldDark}>Rp {formatRupiah(tierGrosir)}</Text>
              </Text>
              <Text style={styles.recommendationLine}>
                • 🛵 Ojek Online (Komisi 20%): <Text style={styles.boldDark}>Rp {formatRupiah(ojolDeliveryPrice)}</Text>
              </Text>
            </View>

            {/* Segment: Bahan vs Kemasan */}
            <View style={styles.segmentContainer}>
              <TouchableOpacity
                style={[styles.segmentBtn, builderTab === 'bahan' && styles.segmentBtnActive]}
                onPress={() => setBuilderTab('bahan')}
              >
                <Text style={[styles.segmentBtnText, builderTab === 'bahan' && styles.segmentBtnTextActive]}>
                  Bahan Baku ({formRecipeIngredients.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segmentBtn, builderTab === 'kemasan' && styles.segmentBtnActive]}
                onPress={() => setBuilderTab('kemasan')}
              >
                <Text style={[styles.segmentBtnText, builderTab === 'kemasan' && styles.segmentBtnTextActive]}>
                  Kemasan ({formRecipePackaging.length})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Ingredients in Recipe */}
            {(builderTab === 'bahan' ? formRecipeIngredients : formRecipePackaging).map((item, idx) => {
              const mat = materials.find((m) => m.id === item.materialId);
              if (!mat) return null;
              const cost = Math.round((item.amountUsed / mat.purchaseVolume) * mat.purchasePrice);
              return (
                <View key={idx} style={styles.recipeIngItemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recipeIngName}>{mat.name}</Text>
                    <Text style={styles.recipeIngUsage}>
                      {item.amountUsed} {mat.unit}
                    </Text>
                  </View>
                  <Text style={styles.recipeIngCost}>Rp {formatRupiah(cost)}</Text>
                  <TouchableOpacity
                    style={styles.ingRemoveBtn}
                    onPress={() => {
                      if (builderTab === 'bahan') {
                        setFormRecipeIngredients(formRecipeIngredients.filter((_, i) => i !== idx));
                      } else {
                        setFormRecipePackaging(formRecipePackaging.filter((_, i) => i !== idx));
                      }
                    }}
                  >
                    <Feather name="x-circle" size={16} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
              );
            })}

            {/* Shortcut Unit Converter */}
            <TouchableOpacity
              style={styles.converterShortcutBtn}
              onPress={() => {
                setConvTarget('picker');
                setConvMode(builderTab === 'bahan' ? 'timbangan' : 'kemasan');
                setShowConverterModal(true);
              }}
            >
              <Feather name="zap" size={14} color="#059669" />
              <Text style={styles.converterShortcutText}>
                Buka Kalkulator Konversi Grosir ➔ Takaran (CONV)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.addIngDashedBtn}
              onPress={() => {
                setPickerSelectedMatId('');
                setPickerAmountUsed('');
                setShowPickerModal(true);
              }}
            >
              <Feather name="plus-circle" size={16} color="#059669" />
              <Text style={styles.addIngDashedText}>
                Pilih & Masukkan {builderTab === 'bahan' ? 'Bahan Baku' : 'Kemasan'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 4: PICKER BAHAN KE DALAM RESEP                      */}
      {/* ========================================================= */}
      <Modal visible={showPickerModal} animationType="fade" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.pickerBox}>
            <Text style={styles.pickerHeading}>
              Pilih {builderTab === 'bahan' ? 'Bahan Baku' : 'Kemasan'}
            </Text>

            <ScrollView style={{ maxHeight: 220, marginBottom: 12 }}>
              {materials.filter((m) => m.category === builderTab).length === 0 ? (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Feather name="alert-circle" size={28} color="#94A3B8" />
                  <Text style={{ fontSize: 13, color: '#64748B', textAlign: 'center', marginTop: 8, lineHeight: 18 }}>
                    Belum ada data {builderTab === 'bahan' ? 'bahan baku' : 'kemasan'}.{'\n'}Silakan tambahkan di Tab Bahan Baku terlebih dahulu.
                  </Text>
                </View>
              ) : (
                materials
                  .filter((m) => m.category === builderTab)
                  .map((mat) => (
                    <TouchableOpacity
                      key={mat.id}
                      style={[
                        styles.pickerOption,
                        pickerSelectedMatId === mat.id && styles.pickerOptionActive,
                      ]}
                      onPress={() => setPickerSelectedMatId(mat.id)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.pickerOptionTitle,
                            pickerSelectedMatId === mat.id && styles.pickerOptionTitleActive,
                          ]}
                        >
                          {mat.name}
                        </Text>
                        <Text style={styles.pickerOptionSub}>
                          Beli: Rp {formatRupiah(mat.purchasePrice)} per {mat.purchaseVolume} {mat.unit}
                        </Text>
                      </View>
                      {pickerSelectedMatId === mat.id && (
                        <Feather name="check" size={16} color="#059669" />
                      )}
                    </TouchableOpacity>
                  ))
              )}
            </ScrollView>

            <Text style={styles.inputLabel}>Banyaknya Takaran yang Dipakai</Text>
            <TextInput
              style={styles.nativeInput}
              keyboardType="numeric"
              placeholder="Contoh: 150"
              placeholderTextColor="#94A3B8"
              value={pickerAmountUsed}
              onChangeText={(t) => setPickerAmountUsed(t.replace(/[^0-9]/g, ''))}
            />

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowPickerModal(false)}
              >
                <Text style={styles.cancelBtnText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleConfirmIngredient}
              >
                <Text style={styles.confirmBtnText}>Tambahkan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 5: TAMBAH BAHAN BAKU / KEMASAN BARU                 */}
      {/* ========================================================= */}
      <Modal visible={showAddMaterialModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.sheetContainer}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {editingMaterialId ? 'Edit Bahan / Kemasan' : 'Tambah Bahan / Kemasan'}
              </Text>
              <TouchableOpacity onPress={() => setShowAddMaterialModal(false)}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Shortcut Unit Converter */}
            <TouchableOpacity
              style={styles.converterShortcutBtn}
              onPress={() => {
                setConvTarget('material');
                setConvMode(formMatCat === 'bahan' ? 'timbangan' : 'kemasan');
                setShowConverterModal(true);
              }}
            >
              <Feather name="zap" size={14} color="#059669" />
              <Text style={styles.converterShortcutText}>
                Buka Konverter Satuan Grosir (CONV)
              </Text>
            </TouchableOpacity>

            <Text style={styles.inputLabel}>Nama Bahan / Kemasan</Text>
            <TextInput
              style={styles.nativeInput}
              placeholder="Contoh: Susu Kental Manis"
              placeholderTextColor="#94A3B8"
              value={formMatName}
              onChangeText={setFormMatName}
            />

            <View style={styles.twoColRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.inputLabel}>Harga Beli (Rp)</Text>
                <TextInput
                  style={styles.nativeInput}
                  keyboardType="numeric"
                  placeholder="Contoh: 28000"
                  placeholderTextColor="#94A3B8"
                  value={formMatPrice ? `Rp ${formatRupiah(formMatPrice)}` : ''}
                  onChangeText={(t) => setFormMatPrice(t.replace(/[^0-9]/g, ''))}
                />
              </View>

              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.inputLabel}>Isi / Volume Kemasan</Text>
                <TextInput
                  style={styles.nativeInput}
                  keyboardType="numeric"
                  placeholder="Contoh: 1000"
                  placeholderTextColor="#94A3B8"
                  value={formMatVol}
                  onChangeText={(t) => setFormMatVol(t.replace(/[^0-9]/g, ''))}
                />
              </View>
            </View>

            {/* Category Select */}
            <Text style={styles.inputLabel}>Kategori</Text>
            <View style={styles.unitSelectorRow}>
              <TouchableOpacity
                style={[styles.unitChip, formMatCat === 'bahan' && styles.unitChipActive]}
                onPress={() => setFormMatCat('bahan')}
              >
                <Text style={[styles.unitChipText, formMatCat === 'bahan' && styles.unitChipTextActive]}>
                  Bahan Baku
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.unitChip, formMatCat === 'kemasan' && styles.unitChipActive]}
                onPress={() => setFormMatCat('kemasan')}
              >
                <Text style={[styles.unitChipText, formMatCat === 'kemasan' && styles.unitChipTextActive]}>
                  Kemasan
                </Text>
              </TouchableOpacity>
            </View>

            {/* Unit Select */}
            <Text style={styles.inputLabel}>Satuan Unit</Text>
            <View style={styles.unitSelectorRow}>
              {(['gr', 'ml', 'pcs', 'pax', 'kg', 'liter'] as UnitType[]).map((u) => (
                <TouchableOpacity
                  key={u}
                  style={[styles.unitChipSmall, formMatUnit === u && styles.unitChipActive]}
                  onPress={() => setFormMatUnit(u)}
                >
                  <Text style={[styles.unitChipText, formMatUnit === u && styles.unitChipTextActive]}>
                    {u}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Sisa Stok & Peringatan Belanja */}
            <View style={styles.twoColRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.inputLabel}>Sisa Stok Saat Ini ({formMatUnit})</Text>
                <TextInput
                  style={styles.nativeInput}
                  keyboardType="numeric"
                  placeholder="Contoh: 500"
                  placeholderTextColor="#94A3B8"
                  value={formCurrentStock}
                  onChangeText={(t) => setFormCurrentStock(t.replace(/[^0-9]/g, ''))}
                />
              </View>

              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.inputLabel}>Batas Peringatan Belanja</Text>
                <TextInput
                  style={styles.nativeInput}
                  keyboardType="numeric"
                  placeholder="Contoh: 100"
                  placeholderTextColor="#94A3B8"
                  value={formMinAlert}
                  onChangeText={(t) => setFormMinAlert(t.replace(/[^0-9]/g, ''))}
                />
              </View>
            </View>

            <TouchableOpacity style={styles.primarySubmitBtn} onPress={handleSaveMaterial}>
              <Feather name="check" size={18} color="#FFFFFF" />
              <Text style={styles.primarySubmitText}>
                {editingMaterialId ? 'Simpan Perubahan' : 'Simpan Bahan Baku'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 6: TAMBAH MODAL AWAL (CAPEX)                        */}
      {/* ========================================================= */}
      <Modal visible={showAddCapitalModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.sheetContainer}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Tambah Modal Awal (Capex)</Text>
              <TouchableOpacity onPress={() => setShowAddCapitalModal(false)}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Nama Peralatan / Aset</Text>
            <TextInput
              style={styles.nativeInput}
              placeholder="Contoh: Booth Portable Kayu"
              placeholderTextColor="#94A3B8"
              value={formCapName}
              onChangeText={setFormCapName}
            />

            <View style={styles.twoColRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.inputLabel}>Jumlah (Unit)</Text>
                <TextInput
                  style={styles.nativeInput}
                  keyboardType="numeric"
                  placeholder="1"
                  placeholderTextColor="#94A3B8"
                  value={formCapQty}
                  onChangeText={(t) => setFormCapQty(t.replace(/[^0-9]/g, ''))}
                />
              </View>

              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.inputLabel}>Harga per Unit (Rp)</Text>
                <TextInput
                  style={styles.nativeInput}
                  keyboardType="numeric"
                  placeholder="Contoh: 1500000"
                  placeholderTextColor="#94A3B8"
                  value={formCapPrice ? `Rp ${formatRupiah(formCapPrice)}` : ''}
                  onChangeText={(t) => setFormCapPrice(t.replace(/[^0-9]/g, ''))}
                />
              </View>
            </View>

            {/* Masa Pakai Aset (Depresiasi) */}
            <Text style={styles.inputLabel}>Estimasi Masa Pakai Aset (Depresiasi)</Text>
            <View style={styles.lifespanSelectorRow}>
              {[12, 24, 36, 48, 60].map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[
                    styles.lifespanChip,
                    formCapLifespan === m && styles.lifespanChipActive,
                  ]}
                  onPress={() => setFormCapLifespan(m)}
                >
                  <Text
                    style={[
                      styles.lifespanChipText,
                      formCapLifespan === m && styles.lifespanChipTextActive,
                    ]}
                  >
                    {m} Bln ({m / 12} Thn)
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.lifespanHelpText}>
              💡 Aset disusutkan merata per bulan untuk cadangan penggantian alat baru tanpa menguras kas usaha.
            </Text>

            <TouchableOpacity style={styles.primarySubmitBtn} onPress={handleSaveCapital}>
              <Feather name="check" size={18} color="#FFFFFF" />
              <Text style={styles.primarySubmitText}>Simpan Aset Modal</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 7: TAMBAH BEBAN TETAP (OPEX)                        */}
      {/* ========================================================= */}
      <Modal visible={showAddExpenseModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.sheetContainer}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Tambah Beban Operasional</Text>
              <TouchableOpacity onPress={() => setShowAddExpenseModal(false)}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Nama Pengeluaran Rutin</Text>
            <TextInput
              style={styles.nativeInput}
              placeholder="Contoh: Gaji Karyawan Stand"
              placeholderTextColor="#94A3B8"
              value={formExpName}
              onChangeText={setFormExpName}
            />

            <Text style={styles.inputLabel}>Nominal Biaya Bulanan (Rp)</Text>
            <TextInput
              style={styles.nativeInput}
              keyboardType="numeric"
              placeholder="Contoh: 1800000"
              placeholderTextColor="#94A3B8"
              value={formExpAmount ? `Rp ${formatRupiah(formExpAmount)}` : ''}
              onChangeText={(t) => setFormExpAmount(t.replace(/[^0-9]/g, ''))}
            />

            <TouchableOpacity style={styles.primarySubmitBtn} onPress={handleSaveExpense}>
              <Feather name="check" size={18} color="#FFFFFF" />
              <Text style={styles.primarySubmitText}>Simpan Beban Rutin</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 8: PENGATURAN & TENTANG APLIKASI                     */}
      {/* ========================================================= */}
      <Modal visible={showSettingsModal} animationType="slide">
        <View style={[styles.modalScreen, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowSettingsModal(false)}>
              <Feather name="arrow-left" size={22} color="#0F172A" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Pengaturan Aplikasi</Text>
            <View style={{ width: 22 }} />
          </View>

          <ScrollView style={styles.modalScroll} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            {/* GRUP 1: PROFIL USAHA & BRANDING */}
            <View style={styles.settingsGroupCard}>
              <View style={styles.settingsGroupHeaderRow}>
                <Feather name="home" size={16} color="#0F172A" />
                <Text style={styles.settingsGroupTitle}>PROFIL USAHA & BRANDING</Text>
              </View>

              {/* Logo Toko & Proposal PDF */}
              <Text style={styles.inputLabel}>Logo Usaha / Brand</Text>
              <View style={styles.logoPickerBox}>
                {storeProfile.logoBase64 ? (
                  <View style={styles.logoPreviewRow}>
                    <Image
                      source={{ uri: storeProfile.logoBase64 }}
                      style={styles.logoPreviewImg}
                      resizeMode="contain"
                    />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.logoStatusText}>Logo aktif terpasang</Text>
                      <Text style={styles.logoStatusSub}>Tampil di bar atas & Kop Surat Proposal PDF.</Text>
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                        <TouchableOpacity style={styles.logoChangeBtn} onPress={handlePickLogo}>
                          <Text style={styles.logoChangeBtnText}>Ganti</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.logoDeleteBtn} onPress={handleRemoveLogo}>
                          <Text style={styles.logoDeleteBtnText}>Hapus</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ) : (
                  <View style={styles.logoEmptyRow}>
                    <View style={styles.logoPlaceholderCircle}>
                      <Feather name="image" size={20} color="#94A3B8" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.logoEmptyTitle}>Belum Ada Logo</Text>
                      <Text style={styles.logoEmptySub}>Pilih foto logo persegi dari galeri ponsel.</Text>
                      <TouchableOpacity style={styles.logoPickBtn} onPress={handlePickLogo}>
                        <Feather name="upload" size={14} color="#0F172A" />
                        <Text style={styles.logoPickBtnText}>Pilih dari Galeri</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>

              <Text style={styles.inputLabel}>Nama Usaha / Brand</Text>
              <TextInput
                style={styles.nativeInput}
                placeholder="Contoh: Kopi Meracik Impian"
                placeholderTextColor="#94A3B8"
                value={formProfileName}
                onChangeText={setFormProfileName}
              />

              <Text style={styles.inputLabel}>No. WhatsApp Pemilik / Usaha</Text>
              <TextInput
                style={styles.nativeInput}
                keyboardType="phone-pad"
                placeholder="Contoh: 081234567890"
                placeholderTextColor="#94A3B8"
                value={formProfilePhone}
                onChangeText={setFormProfilePhone}
              />

              <Text style={styles.inputLabel}>Alamat / Lokasi Operasional</Text>
              <TextInput
                style={styles.nativeInput}
                placeholder="Contoh: Jl. Sudirman No. 12, Jakarta"
                placeholderTextColor="#94A3B8"
                value={formProfileAddress}
                onChangeText={setFormProfileAddress}
              />

              <Text style={styles.inputLabel}>Catatan Dokumen / Tujuan Proposal</Text>
              <TextInput
                style={styles.nativeInput}
                placeholder="Contoh: Diajukan untuk Pengajuan Modal Usaha Kuliner"
                placeholderTextColor="#94A3B8"
                value={formProfileFooter}
                onChangeText={setFormProfileFooter}
              />
            </View>

            {/* GRUP 2: PENENTU HARGA PINTAR (SMART PRICING) */}
            <View style={styles.settingsGroupCard}>
              <View style={styles.settingsGroupHeaderRow}>
                <Feather name="sliders" size={16} color="#0284C7" />
                <Text style={[styles.settingsGroupTitle, { color: '#0284C7' }]}>
                  PENENTU HARGA PINTAR (SMART PRICING)
                </Text>
              </View>
              <Text style={styles.settingsCardSubDesc}>
                Konfigurasi persentase margin laba, potongan komisi ojol, dan hari kerja operasional untuk kalkulasi otomatis.
              </Text>

              <View style={styles.twoColRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.inputLabel}>Target Margin Eceran (%)</Text>
                  <TextInput
                    style={styles.nativeInput}
                    keyboardType="numeric"
                    placeholder="35"
                    placeholderTextColor="#94A3B8"
                    value={formRetailMargin}
                    onChangeText={(t) => setFormRetailMargin(t.replace(/[^0-9]/g, ''))}
                  />
                  <Text style={styles.fieldHelpText}>Standar UMKM: 30% - 40%</Text>
                </View>

                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.inputLabel}>Target Margin Reseller (%)</Text>
                  <TextInput
                    style={styles.nativeInput}
                    keyboardType="numeric"
                    placeholder="20"
                    placeholderTextColor="#94A3B8"
                    value={formResellerMargin}
                    onChangeText={(t) => setFormResellerMargin(t.replace(/[^0-9]/g, ''))}
                  />
                  <Text style={styles.fieldHelpText}>Harga Agen: 15% - 25%</Text>
                </View>
              </View>

              <View style={{ marginTop: 8 }}>
                <Text style={styles.inputLabel}>Potongan Komisi Ojol (%)</Text>
                <TextInput
                  style={styles.nativeInput}
                  keyboardType="numeric"
                  placeholder="20"
                  placeholderTextColor="#94A3B8"
                  value={formOjolCommission}
                  onChangeText={(t) => setFormOjolCommission(t.replace(/[^0-9]/g, ''))}
                />
                <Text style={styles.fieldHelpText}>Rata-rata GoFood / GrabFood / ShopeeFood: 20%</Text>
              </View>

              <View style={{ marginTop: 12 }}>
                <Text style={styles.inputLabel}>Hari Operasional Buka Toko per Bulan</Text>
                <TextInput
                  style={styles.nativeInput}
                  keyboardType="numeric"
                  placeholder="30"
                  placeholderTextColor="#94A3B8"
                  value={formOperatingDays}
                  onChangeText={(t) => setFormOperatingDays(t.replace(/[^0-9]/g, ''))}
                />
                <Text style={styles.fieldHelpText}>
                  Standar: 30 hari. Jika toko libur 1 hari per minggu, isi 26 hari agar omset & beban harian akurat.
                </Text>
              </View>

              <View style={{ marginTop: 12 }}>
                <Text style={styles.inputLabel}>Default Buffer Inflasi Resep Pokok</Text>
                <View style={styles.roundingSwitchRow}>
                  {[0, 5, 10, 15].map((pct) => (
                    <TouchableOpacity
                      key={pct}
                      style={[
                        styles.roundingSwitchBtn,
                        formDefaultInflation === pct && styles.roundingSwitchBtnActive,
                      ]}
                      onPress={() => setFormDefaultInflation(pct)}
                    >
                      <Feather
                        name="check-circle"
                        size={14}
                        color={formDefaultInflation === pct ? '#0284C7' : '#94A3B8'}
                      />
                      <Text
                        style={[
                          styles.roundingSwitchText,
                          formDefaultInflation === pct && styles.roundingSwitchTextActive,
                        ]}
                      >
                        {pct === 0 ? '0%' : `+${pct}%`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.fieldHelpText}>
                  Buffer pengaman kenaikan harga pasar saat membuat resep baru.
                </Text>
              </View>

              <View style={{ marginTop: 12 }}>
                <Text style={styles.inputLabel}>Pembulatan Otomatis Harga Jual</Text>
                <View style={styles.roundingSwitchRow}>
                  <TouchableOpacity
                    style={[styles.roundingSwitchBtn, formPriceRounding === 500 && styles.roundingSwitchBtnActive]}
                    onPress={() => setFormPriceRounding(500)}
                  >
                    <Feather
                      name="check-circle"
                      size={14}
                      color={formPriceRounding === 500 ? '#0284C7' : '#94A3B8'}
                    />
                    <Text
                      style={[
                        styles.roundingSwitchText,
                        formPriceRounding === 500 && styles.roundingSwitchTextActive,
                      ]}
                    >
                      Kelipatan Rp 500
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.roundingSwitchBtn, formPriceRounding === 1000 && styles.roundingSwitchBtnActive]}
                    onPress={() => setFormPriceRounding(1000)}
                  >
                    <Feather
                      name="check-circle"
                      size={14}
                      color={formPriceRounding === 1000 ? '#0284C7' : '#94A3B8'}
                    />
                    <Text
                      style={[
                        styles.roundingSwitchText,
                        formPriceRounding === 1000 && styles.roundingSwitchTextActive,
                      ]}
                    >
                      Kelipatan Rp 1.000
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.fieldHelpText}>
                  Menghilangkan angka receh (contoh Rp 15.385 dibulatkan ke Rp {formPriceRounding === 500 ? '15.500' : '16.000'}).
                </Text>
              </View>

              {/* Feature 3: Opex Depreciation Toggle */}
              <View style={{ marginTop: 14, marginBottom: 8 }}>
                <Text style={styles.inputLabel}>Beban Penyusutan Aset (Depresiasi)</Text>
                <TouchableOpacity
                  style={[
                    styles.deprecToggleCard,
                    formIncludeDepreciation && styles.deprecToggleCardActive,
                  ]}
                  onPress={() => setFormIncludeDepreciation(!formIncludeDepreciation)}
                  activeOpacity={0.8}
                >
                  <Feather
                    name={formIncludeDepreciation ? 'check-square' : 'square'}
                    size={20}
                    color={formIncludeDepreciation ? '#059669' : '#94A3B8'}
                  />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.deprecToggleTitle}>
                      Masukkan Beban Susut ke Opex Bulanan
                    </Text>
                    <Text style={styles.deprecToggleSub}>
                      Otomatis menyisihkan Rp {formatRupiah(totalMonthlyDepreciation)}/bln untuk cadangan ganti alat baru di perhitungan laba & BEP.
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.profileSaveBtn} onPress={handleSaveStoreProfile}>
                <Feather name="check" size={16} color="#FFFFFF" />
                <Text style={styles.profileSaveBtnText}>Simpan Semua Pengaturan</Text>
              </TouchableOpacity>
            </View>

            {/* GRUP 3: MANAJEMEN DATABASE & CADANGAN */}
            <View style={styles.settingsGroupCard}>
              <View style={styles.settingsGroupHeaderRow}>
                <Feather name="database" size={16} color="#7C3AED" />
                <Text style={[styles.settingsGroupTitle, { color: '#7C3AED' }]}>
                  MANAJEMEN DATABASE & CADANGAN
                </Text>
              </View>
              <Text style={styles.settingsCardSubDesc}>
                Simpan dan pindahkan data usaha Anda secara aman dengan ekspor berkas JSON atau cadangan teks WhatsApp.
              </Text>

              <TouchableOpacity style={styles.settingsActionBtn} onPress={handleExportJsonBackup}>
                <Feather name="download" size={18} color="#7C3AED" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.settingsActionTitle, { color: '#7C3AED' }]}>
                    Ekspor Database JSON Lengkap
                  </Text>
                  <Text style={styles.settingsActionSub}>
                    Unduh file .json berisi seluruh data resep, bahan baku, modal awal (capex), beban rutin (opex), dan profil toko
                  </Text>
                </View>
              </TouchableOpacity>

              <View style={styles.settingsDivider} />

              <TouchableOpacity
                style={styles.settingsActionBtn}
                onPress={() => {
                  setRestoreJsonInput('');
                  setShowRestoreModal(true);
                }}
              >
                <Feather name="upload" size={18} color="#0284C7" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.settingsActionTitle, { color: '#0284C7' }]}>
                    Pulihkan Data dari Berkas JSON
                  </Text>
                  <Text style={styles.settingsActionSub}>
                    Impor file / tempel kode teks JSON cadangan untuk memulihkan seluruh data aplikasi
                  </Text>
                </View>
              </TouchableOpacity>

              <View style={styles.settingsDivider} />

              <TouchableOpacity style={styles.settingsActionBtn} onPress={handleExportWhatsAppBackup}>
                <Feather name="share-2" size={18} color="#059669" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.settingsActionTitle, { color: '#059669' }]}>
                    Cadangkan Ringkasan ke WhatsApp
                  </Text>
                  <Text style={styles.settingsActionSub}>
                    Kirim laporan keuangan rapi resep, HPP, modal awal, dan omset ke chat WhatsApp
                  </Text>
                </View>
              </TouchableOpacity>

              <View style={styles.settingsDivider} />

              <TouchableOpacity style={styles.settingsActionBtn} onPress={handleResetData}>
                <Feather name="trash-2" size={18} color="#EF4444" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.settingsActionTitle}>Reset Data Bersih (Kondisi 0)</Text>
                  <Text style={styles.settingsActionSub}>
                    Menghapus seluruh resep, bahan baku, modal awal (capex), dan beban operasional kembali bersih (0)
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* GRUP 4: PANDUAN RUMUS KEUANGAN UMKM (EDUKASI) */}
            <View style={styles.settingsGroupCard}>
              <View style={styles.settingsGroupHeaderRow}>
                <Feather name="book-open" size={16} color="#D97706" />
                <Text style={[styles.settingsGroupTitle, { color: '#D97706' }]}>
                  PANDUAN RUMUS KEUANGAN UMKM
                </Text>
              </View>
              <Text style={styles.settingsCardSubDesc}>
                Rumus standar akuntansi bisnis kuliner & UMKM yang digunakan di balik perhitungan Meracik Ide.
              </Text>

              {/* Formula Card 1 */}
              <View style={styles.formulaCard}>
                <View style={styles.formulaCardHeader}>
                  <Text style={styles.formulaCardTitle}>1. HPP Riil per Porsi</Text>
                  <View style={styles.formulaBadge}>
                    <Text style={styles.formulaBadgeText}>AKURAT</Text>
                  </View>
                </View>
                <View style={styles.formulaMathBox}>
                  <Text style={styles.formulaMathText}>
                    HPP = (BOM + Susut + Inflasi + Upah + Utilitas) ÷ Yield
                  </Text>
                </View>
                <Text style={styles.formulaExplainText}>
                  Menghitung seluruh komponen riil: bahan baku (BOM), toleransi susut saat memasak, buffer kenaikan harga, upah pengerjaan, dan energi gas/listrik per porsi.
                </Text>
              </View>

              {/* Formula Card 2 */}
              <View style={styles.formulaCard}>
                <View style={styles.formulaCardHeader}>
                  <Text style={styles.formulaCardTitle}>2. Margin Laba vs Markup</Text>
                  <View style={[styles.formulaBadge, { backgroundColor: '#FEF3C7' }]}>
                    <Text style={[styles.formulaBadgeText, { color: '#B45309' }]}>PENTING</Text>
                  </View>
                </View>
                <View style={styles.formulaMathBox}>
                  <Text style={styles.formulaMathText}>
                    Harga Jual = HPP ÷ (1 - %Margin Target)
                  </Text>
                </View>
                <Text style={styles.formulaExplainText}>
                  Jangan gunakan markup sederhana (HPP × 1.35) karena margin laba Anda akan berkurang jadi ~26%. Gunakan rumus bagi di atas agar margin 35% Anda utuh!
                </Text>
              </View>

              {/* Formula Card 3 */}
              <View style={styles.formulaCard}>
                <View style={styles.formulaCardHeader}>
                  <Text style={styles.formulaCardTitle}>3. Harga Aplikasi Ojol (GoFood/Grab/Shopee)</Text>
                  <View style={[styles.formulaBadge, { backgroundColor: '#DCFCE7' }]}>
                    <Text style={[styles.formulaBadgeText, { color: '#15803D' }]}>KOMISI</Text>
                  </View>
                </View>
                <View style={styles.formulaMathBox}>
                  <Text style={styles.formulaMathText}>
                    Harga Ojol = Harga Eceran ÷ (1 - %Komisi Ojol)
                  </Text>
                </View>
                <Text style={styles.formulaExplainText}>
                  Dengan komisi 20%, harga dinaikkan secara presisi sehingga saat dipotong 20% oleh penyedia aplikasi, uang bersih yang Anda terima tetap sama dengan harga eceran toko.
                </Text>
              </View>

              {/* Formula Card 4 */}
              <View style={styles.formulaCard}>
                <View style={styles.formulaCardHeader}>
                  <Text style={styles.formulaCardTitle}>4. Titik Impas (BEP) Modal Usaha</Text>
                  <View style={[styles.formulaBadge, { backgroundColor: '#E0F2FE' }]}>
                    <Text style={[styles.formulaBadgeText, { color: '#0369A1' }]}>INVESTASI</Text>
                  </View>
                </View>
                <View style={styles.formulaMathBox}>
                  <Text style={styles.formulaMathText}>
                    BEP (Bulan) = (Capex + Kas Cadangan) ÷ Laba Bersih/Bln
                  </Text>
                </View>
                <Text style={styles.formulaExplainText}>
                  Mengestimasi berapa bulan seluruh modal investasi awal (aset perlengkapan + modal kerja kas cadangan) akan kembali utuh berdasarkan laba bersih operasional bulanan.
                </Text>
              </View>
            </View>

            {/* GRUP 5: TENTANG APLIKASI MERACIK IDE */}
            <View style={[styles.settingsGroupCard, { alignItems: 'center' }]}>
              <View style={styles.aboutLogoBox}>
                <Image
                  source={require('./assets/icon.png')}
                  style={{ width: 56, height: 56, borderRadius: 14 }}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.aboutAppName}>Meracik Ide UMKM</Text>
              <Text style={styles.aboutAppVersion}>Versi 1.0.0 Pro • Offline-First Native</Text>
              <View style={styles.aboutBadgeRow}>
                <View style={styles.aboutSecureBadge}>
                  <Feather name="shield" size={12} color="#059669" />
                  <Text style={styles.aboutSecureBadgeText}>100% Data Lokal & Mandiri</Text>
                </View>
                <View style={styles.aboutSecureBadge}>
                  <Feather name="wifi-off" size={12} color="#0284C7" />
                  <Text style={[styles.aboutSecureBadgeText, { color: '#0284C7' }]}>Bekerja Tanpa Internet</Text>
                </View>
              </View>
              <Text style={styles.aboutAppDesc}>
                Aplikasi kalkulator HPP riil, penentu struktur harga jual 3-tier, serta analisis modal awal & simulasi balik modal (BEP) yang dirancang khusus untuk kemandirian pengusaha UMKM Indonesia.
              </Text>

              {/* Legal Copyright Notice */}
              <View style={styles.aboutCopyrightBox}>
                <Feather name="shield" size={14} color="#059669" />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.aboutCopyrightText}>
                    Hak Cipta © 2026 Meracik Ide. All Rights Reserved.
                  </Text>
                  <Text style={styles.aboutCopyrightSub}>
                    Dilindungi UU No. 28 Tahun 2014 tentang Hak Cipta. Seluruh formula perhitungan, kode program, rancangan data, dan desain antarmuka adalah milik eksklusif pemilik sah.
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 9: DETAIL RESEP, RINCIAN KOMPOSISI & TES INFLASI    */}
      {/* ========================================================= */}
      <Modal visible={showRecipeDetailModal} animationType="slide">
        {selectedDetailRecipe && (
          <View style={[styles.modalScreen, { paddingTop: insets.top }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowRecipeDetailModal(false)}>
                <Feather name="arrow-left" size={22} color="#0F172A" />
              </TouchableOpacity>
              <Text style={styles.modalHeaderTitle} numberOfLines={1}>
                {selectedDetailRecipe.name}
              </Text>
              <TouchableOpacity onPress={() => handleShareRecipeAnalysis(selectedDetailRecipe)}>
                <Feather name="share-2" size={20} color="#059669" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
              {/* Product Header Card */}
              <View style={styles.detailHeroCard}>
                <View style={styles.detailHeroBadgeRow}>
                  <View style={styles.categoryPill}>
                    <Text style={styles.categoryPillText}>{selectedDetailRecipe.category}</Text>
                  </View>
                  <View
                    style={[
                      styles.marginBadge,
                      selectedDetailRecipe.marginPercent >= 35
                        ? styles.marginBadgeSuper
                        : selectedDetailRecipe.marginPercent >= 20
                        ? styles.marginBadgeHealthy
                        : styles.marginBadgeWarn,
                    ]}
                  >
                    <Feather
                      name={selectedDetailRecipe.marginPercent >= 35 ? 'trending-up' : 'alert-circle'}
                      size={12}
                      color={selectedDetailRecipe.marginPercent >= 35 ? '#065F46' : '#92400E'}
                    />
                    <Text
                      style={[
                        styles.marginBadgeText,
                        selectedDetailRecipe.marginPercent >= 35
                          ? { color: '#065F46' }
                          : { color: '#92400E' },
                      ]}
                    >
                      Margin {selectedDetailRecipe.marginPercent}%
                    </Text>
                  </View>
                </View>

                <Text style={styles.detailHeroTitle}>{selectedDetailRecipe.name}</Text>
                <Text style={styles.detailHeroSub}>
                  Hasil: {selectedDetailRecipe.yieldQty} Porsi/Batch • Susut Bahan: {selectedDetailRecipe.wastePercent}%
                </Text>

                {/* 3 Metric Grid */}
                <View style={styles.metricRow}>
                  <View style={styles.metricBox}>
                    <Text style={styles.metricLabel}>HPP Dasar</Text>
                    <Text style={styles.metricHppVal}>Rp {formatRupiah(selectedDetailRecipe.unitCost)}</Text>
                  </View>
                  <View style={styles.metricBox}>
                    <Text style={styles.metricLabel}>Target Jual</Text>
                    <Text style={styles.metricPriceVal}>Rp {formatRupiah(selectedDetailRecipe.targetSellingPrice)}</Text>
                  </View>
                  <View style={styles.metricBox}>
                    <Text style={styles.metricLabel}>Untung Bersih</Text>
                    <Text style={styles.metricProfitVal}>+Rp {formatRupiah(selectedDetailRecipe.netProfit)}</Text>
                  </View>
                </View>
              </View>

              {/* Stress-Test Inflasi Section */}
              <View style={styles.inflationTestSection}>
                <View style={styles.inflationTestHeader}>
                  <Feather name="trending-up" size={16} color="#059669" />
                  <Text style={styles.inflationTestTitle}>Stress-Test Lonjakan Harga Bahan (+% Inflasi)</Text>
                </View>
                <Text style={styles.inflationTestDesc}>
                  Pilih persentase kenaikan harga pasar untuk menguji ketahanan margin laba tanpa mengubah data master.
                </Text>
                <View style={styles.inflationChipsRow}>
                  {[0, 5, 10, 15, 20, 30].map((pct) => (
                    <TouchableOpacity
                      key={pct}
                      style={[
                        styles.inflationChip,
                        testInflationBuffer === pct && styles.inflationChipActive,
                      ]}
                      onPress={() => setTestInflationBuffer(pct)}
                    >
                      <Text
                        style={[
                          styles.inflationChipText,
                          testInflationBuffer === pct && styles.inflationChipTextActive,
                        ]}
                      >
                        {pct === 0 ? 'Normal' : `+${pct}%`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {(() => {
                  const testCost = computeBatchCost(
                    selectedDetailRecipe.ingredients,
                    selectedDetailRecipe.packaging,
                    selectedDetailRecipe.wastePercent,
                    testInflationBuffer,
                    selectedDetailRecipe.laborCost || 0,
                    selectedDetailRecipe.utilityCost || 0
                  );
                  const testHpp = Math.round(testCost / selectedDetailRecipe.yieldQty);
                  const testProfit = selectedDetailRecipe.targetSellingPrice - testHpp;
                  const testMargin = selectedDetailRecipe.targetSellingPrice > 0
                    ? Number(((testProfit / selectedDetailRecipe.targetSellingPrice) * 100).toFixed(1))
                    : 0;

                  return (
                    <View style={styles.inflationResultBox}>
                      <View style={styles.inflationResultCol}>
                        <Text style={styles.inflationResultLabel}>HPP Baru</Text>
                        <Text style={styles.inflationResultVal}>Rp {formatRupiah(testHpp)}</Text>
                        {testInflationBuffer > 0 && (
                          <Text style={styles.inflationDiff}>+Rp {formatRupiah(testHpp - selectedDetailRecipe.unitCost)}</Text>
                        )}
                      </View>
                      <View style={styles.inflationResultCol}>
                        <Text style={styles.inflationResultLabel}>Laba Bersih</Text>
                        <Text style={[styles.inflationResultVal, testProfit >= 0 ? { color: '#10B981' } : { color: '#EF4444' }]}>
                          Rp {formatRupiah(testProfit)}
                        </Text>
                      </View>
                      <View style={styles.inflationResultCol}>
                        <Text style={styles.inflationResultLabel}>Margin Laba</Text>
                        <Text style={[styles.inflationResultVal, testMargin >= 20 ? { color: '#10B981' } : { color: '#F59E0B' }]}>
                          {testMargin}%
                        </Text>
                        <Text style={styles.inflationStatus}>
                          {testMargin >= 20 ? '✅ Aman' : testMargin >= 0 ? '⚠️ Tipis' : '⛔ Nombok'}
                        </Text>
                      </View>
                    </View>
                  );
                })()}
              </View>

              {/* Rekomendasi Struktur Harga Jual 3-Tier */}
              {(() => {
                const uCost = selectedDetailRecipe.unitCost;
                const recEceran = uCost > 0 ? Math.ceil((uCost / 0.65) / 1000) * 1000 : 0;
                const recReseller = uCost > 0 ? Math.ceil((uCost / 0.80) / 1000) * 1000 : 0;
                const recGrosir = uCost > 0 ? Math.ceil((uCost / 0.85) / 1000) * 1000 : 0;
                const recOjol = uCost > 0 ? Math.ceil(((uCost / 0.65) / 0.8) / 1000) * 1000 : 0;

                return (
                  <View style={styles.recommendationCard}>
                    <Text style={styles.recommendationTitle}>Struktur Harga Jual Bertingkat (3-Tier):</Text>
                    <View style={styles.tierGrid}>
                      <View style={styles.tierItem}>
                        <Text style={styles.tierBadge}>ECERAN (35%)</Text>
                        <Text style={styles.tierPrice}>Rp {formatRupiah(recEceran)}</Text>
                        <Text style={styles.tierProfit}>Untung +Rp {formatRupiah(recEceran - uCost)}</Text>
                      </View>
                      <View style={styles.tierItem}>
                        <Text style={styles.tierBadge}>RESELLER (20%)</Text>
                        <Text style={styles.tierPrice}>Rp {formatRupiah(recReseller)}</Text>
                        <Text style={styles.tierProfit}>Untung +Rp {formatRupiah(recReseller - uCost)}</Text>
                      </View>
                      <View style={styles.tierItem}>
                        <Text style={styles.tierBadge}>GROSIR (15%)</Text>
                        <Text style={styles.tierPrice}>Rp {formatRupiah(recGrosir)}</Text>
                        <Text style={styles.tierProfit}>Untung +Rp {formatRupiah(recGrosir - uCost)}</Text>
                      </View>
                    </View>
                    <Text style={styles.recommendationLine}>
                      • 🛵 Aplikasi Ojek Online (Komisi 20%): <Text style={styles.boldDark}>Rp {formatRupiah(recOjol)}</Text>
                    </Text>
                  </View>
                );
              })()}

              {/* Rincian Tenaga Kerja & Utilitas */}
              <View style={styles.bomSection}>
                <Text style={styles.bomSectionTitle}>
                  Biaya Tenaga Kerja & Utilitas / Batch
                </Text>
                <View style={styles.bomItemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bomItemName}>Upah Tenaga Kerja Langsung</Text>
                    <Text style={styles.bomItemUsage}>Per batch produksi ({selectedDetailRecipe.yieldQty} porsi)</Text>
                  </View>
                  <Text style={styles.bomItemCost}>
                    Rp {formatRupiah(selectedDetailRecipe.laborCost || 0)}
                  </Text>
                </View>
                <View style={styles.bomItemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bomItemName}>Biaya Gas / Listrik / Air</Text>
                    <Text style={styles.bomItemUsage}>Utilitas energi operasional per batch</Text>
                  </View>
                  <Text style={styles.bomItemCost}>
                    Rp {formatRupiah(selectedDetailRecipe.utilityCost || 0)}
                  </Text>
                </View>
              </View>

              {/* Rincian Komposisi Bahan Baku (BOM) */}
              <View style={styles.bomSection}>
                <Text style={styles.bomSectionTitle}>
                  Komposisi Bahan Baku ({selectedDetailRecipe.ingredients.length})
                </Text>
                {selectedDetailRecipe.ingredients.length === 0 ? (
                  <Text style={styles.bomEmptyText}>Tidak ada bahan baku tercatat.</Text>
                ) : (
                  selectedDetailRecipe.ingredients.map((ing, i) => {
                    const mat = materials.find((m) => m.id === ing.materialId);
                    const c = mat && mat.purchaseVolume > 0
                      ? Math.round((ing.amountUsed / mat.purchaseVolume) * mat.purchasePrice)
                      : 0;
                    return (
                      <View key={i} style={styles.bomItemRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.bomItemName}>{mat?.name || 'Bahan Dihapus'}</Text>
                          <Text style={styles.bomItemUsage}>
                            Takaran: {ing.amountUsed} {mat?.unit || 'unit'}
                          </Text>
                        </View>
                        <Text style={styles.bomItemCost}>Rp {formatRupiah(c)}</Text>
                      </View>
                    );
                  })
                )}
              </View>

              {/* Rincian Kemasan & Operasional */}
              <View style={styles.bomSection}>
                <Text style={styles.bomSectionTitle}>
                  Kemasan & Operasional ({selectedDetailRecipe.packaging.length})
                </Text>
                {selectedDetailRecipe.packaging.length === 0 ? (
                  <Text style={styles.bomEmptyText}>Tidak ada kemasan tercatat.</Text>
                ) : (
                  selectedDetailRecipe.packaging.map((pk, i) => {
                    const mat = materials.find((m) => m.id === pk.materialId);
                    const c = mat && mat.purchaseVolume > 0
                      ? Math.round((pk.amountUsed / mat.purchaseVolume) * mat.purchasePrice)
                      : 0;
                    return (
                      <View key={i} style={styles.bomItemRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.bomItemName}>{mat?.name || 'Kemasan Dihapus'}</Text>
                          <Text style={styles.bomItemUsage}>
                            Pemakaian: {pk.amountUsed} {mat?.unit || 'pcs'}
                          </Text>
                        </View>
                        <Text style={styles.bomItemCost}>Rp {formatRupiah(c)}</Text>
                      </View>
                    );
                  })
                )}
              </View>

              {/* Batch Shopping Planner (Feature 3: Kalkulator Belanja Pasar) */}
              <View style={styles.shoppingPlannerCard}>
                <View style={styles.shoppingPlannerHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.shoppingPlannerTitle}>Kalkulator Belanja Pasar</Text>
                    <Text style={styles.shoppingPlannerSub}>
                      Hitung kebutuhan total bahan & estimasi uang belanja untuk target produksi
                    </Text>
                  </View>
                  <View style={styles.shoppingPlannerIconBadge}>
                    <Feather name="shopping-bag" size={18} color="#D97706" />
                  </View>
                </View>

                {/* Portion Stepper & Presets */}
                <View style={styles.portionStepperRow}>
                  <Text style={styles.portionStepperLabel}>Rencana Produksi:</Text>
                  <View style={styles.portionStepperControls}>
                    <TouchableOpacity
                      style={styles.portionStepBtn}
                      onPress={() => {
                        setShoppingPortions(Math.max(5, shoppingPortions - 10));
                        Haptics.selectionAsync().catch(() => {});
                      }}
                    >
                      <Text style={styles.portionStepBtnText}>-10</Text>
                    </TouchableOpacity>
                    <View style={styles.portionDisplayBox}>
                      <Text style={styles.portionDisplayText}>{shoppingPortions}</Text>
                      <Text style={styles.portionDisplayUnit}>Porsi</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.portionStepBtn}
                      onPress={() => {
                        setShoppingPortions(shoppingPortions + 10);
                        Haptics.selectionAsync().catch(() => {});
                      }}
                    >
                      <Text style={styles.portionStepBtnText}>+10</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Quick Presets */}
                <View style={styles.portionPresetRow}>
                  {[25, 50, 100, 200].map((preset) => (
                    <TouchableOpacity
                      key={preset}
                      style={[
                        styles.portionPresetBtn,
                        shoppingPortions === preset && styles.portionPresetBtnActive,
                      ]}
                      onPress={() => {
                        setShoppingPortions(preset);
                        Haptics.selectionAsync().catch(() => {});
                      }}
                    >
                      <Text
                        style={[
                          styles.portionPresetText,
                          shoppingPortions === preset && styles.portionPresetTextActive,
                        ]}
                      >
                        {preset} Porsi
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Shopping Cash Estimate & Items Table */}
                {(() => {
                  const targetPortions = Math.max(1, shoppingPortions);
                  const batchMultiplier = targetPortions / Math.max(1, selectedDetailRecipe.yieldQty || 1);
                  let plannerTotalCash = 0;

                  const calculatedIngs = selectedDetailRecipe.ingredients.map((ing) => {
                    const mat = materials.find((m) => m.id === ing.materialId);
                    const neededQty = Number((ing.amountUsed * batchMultiplier).toFixed(1));
                    const cost =
                      mat && mat.purchaseVolume > 0
                        ? Math.round((neededQty / mat.purchaseVolume) * mat.purchasePrice)
                        : 0;
                    plannerTotalCash += cost;
                    return {
                      name: mat?.name || 'Bahan Dihapus',
                      neededQty,
                      unit: mat?.unit || 'unit',
                      cost,
                    };
                  });

                  const calculatedPacks = selectedDetailRecipe.packaging.map((pk) => {
                    const mat = materials.find((m) => m.id === pk.materialId);
                    const neededQty = Math.ceil(pk.amountUsed * batchMultiplier);
                    const cost =
                      mat && mat.purchaseVolume > 0
                        ? Math.round((neededQty / mat.purchaseVolume) * mat.purchasePrice)
                        : 0;
                    plannerTotalCash += cost;
                    return {
                      name: mat?.name || 'Kemasan Dihapus',
                      neededQty,
                      unit: mat?.unit || 'pcs',
                      cost,
                    };
                  });

                  return (
                    <View style={styles.plannerResultsWrap}>
                      <View style={styles.plannerTotalBanner}>
                        <View>
                          <Text style={styles.plannerTotalLabel}>ESTIMASI KAS BELANJA</Text>
                          <Text style={styles.plannerTotalVal}>Rp {formatRupiah(plannerTotalCash)}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.plannerShareBtn}
                          onPress={() => handleShareShoppingList(selectedDetailRecipe, shoppingPortions)}
                        >
                          <Feather name="share-2" size={13} color="#FFFFFF" />
                          <Text style={styles.plannerShareBtnText}>Kirim WA</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Detailed Shopping Table */}
                      <View style={styles.plannerItemsList}>
                        {calculatedIngs.map((item, idx) => (
                          <View key={`ing-${idx}`} style={styles.plannerItemRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.plannerItemName}>{item.name}</Text>
                              <Text style={styles.plannerItemQty}>
                                Butuh: {item.neededQty} {item.unit}
                              </Text>
                            </View>
                            <Text style={styles.plannerItemCost}>Rp {formatRupiah(item.cost)}</Text>
                          </View>
                        ))}
                        {calculatedPacks.map((item, idx) => (
                          <View key={`pk-${idx}`} style={styles.plannerItemRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.plannerItemName}>{item.name}</Text>
                              <Text style={styles.plannerItemQty}>
                                Butuh: {item.neededQty} {item.unit}
                              </Text>
                            </View>
                            <Text style={styles.plannerItemCost}>Rp {formatRupiah(item.cost)}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  );
                })()}
              </View>

              {/* Action Buttons */}
              <View style={styles.detailActionCol}>
                <TouchableOpacity
                  style={styles.detailShareBtn}
                  onPress={() => handleShareRecipeAnalysis(selectedDetailRecipe)}
                >
                  <Feather name="share-2" size={16} color="#FFFFFF" />
                  <Text style={styles.detailShareBtnText}>Bagikan Analisis ke WhatsApp</Text>
                </TouchableOpacity>

                <View style={styles.detailActionRow}>
                  <TouchableOpacity
                    style={styles.detailEditBtn}
                    onPress={() => handleEditRecipe(selectedDetailRecipe)}
                  >
                    <Feather name="edit-2" size={16} color="#0284C7" />
                    <Text style={styles.detailEditBtnText}>Edit Resep Ini</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.detailDeleteBtn}
                    onPress={() => handleDeleteRecipe(selectedDetailRecipe.id)}
                  >
                    <Feather name="trash-2" size={16} color="#EF4444" />
                    <Text style={styles.detailDeleteBtnText}>Hapus Resep</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 10: POP-UP KONVERTER SATUAN OTOMATIS (CONV)         */}
      {/* ========================================================= */}
      <Modal visible={showConverterModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.sheetContainer}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Kalkulator Satuan (CONV)</Text>
                <Text style={styles.sheetSub}>Konversi harga grosir ke modal per porsi</Text>
              </View>
              <TouchableOpacity onPress={() => setShowConverterModal(false)}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Mode Segments: Timbangan vs Kemasan */}
            <View style={styles.segmentContainer}>
              <TouchableOpacity
                style={[styles.segmentBtn, convMode === 'timbangan' && styles.segmentBtnActive]}
                onPress={() => setConvMode('timbangan')}
              >
                <Feather name="disc" size={14} color={convMode === 'timbangan' ? '#0F172A' : '#64748B'} />
                <Text style={[styles.segmentBtnText, convMode === 'timbangan' && styles.segmentBtnTextActive]}>
                  Timbangan (Kg ➔ Gram)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segmentBtn, convMode === 'kemasan' && styles.segmentBtnActive]}
                onPress={() => setConvMode('kemasan')}
              >
                <Feather name="box" size={14} color={convMode === 'kemasan' ? '#0F172A' : '#64748B'} />
                <Text style={[styles.segmentBtnText, convMode === 'kemasan' && styles.segmentBtnTextActive]}>
                  Kemasan (Pack ➔ Pcs)
                </Text>
              </TouchableOpacity>
            </View>

            {/* Input Form */}
            <Text style={styles.inputLabel}>Harga Beli Grosir (Rp)</Text>
            <TextInput
              style={styles.nativeInput}
              keyboardType="numeric"
              placeholder="Contoh: 28000"
              placeholderTextColor="#94A3B8"
              value={convBulkPrice ? `Rp ${formatRupiah(convBulkPrice)}` : ''}
              onChangeText={(t) => setConvBulkPrice(t.replace(/[^0-9]/g, ''))}
            />

            <View style={styles.twoColRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.inputLabel}>
                  {convMode === 'timbangan' ? 'Kapasitas Beli (Kg)' : 'Total Isi per Pack (Pcs)'}
                </Text>
                <TextInput
                  style={styles.nativeInput}
                  keyboardType="numeric"
                  placeholder={convMode === 'timbangan' ? '1' : '50'}
                  placeholderTextColor="#94A3B8"
                  value={convBulkCapacity}
                  onChangeText={(t) => setConvBulkCapacity(t.replace(/[^0-9]/g, ''))}
                />
              </View>

              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.inputLabel}>
                  {convMode === 'timbangan' ? 'Dipakai / Porsi (Gram)' : 'Dipakai / Porsi (Pcs)'}
                </Text>
                <TextInput
                  style={styles.nativeInput}
                  keyboardType="numeric"
                  placeholder={convMode === 'timbangan' ? '25' : '1'}
                  placeholderTextColor="#94A3B8"
                  value={convPortionUsage}
                  onChangeText={(t) => setConvPortionUsage(t.replace(/[^0-9]/g, ''))}
                />
              </View>
            </View>

            {/* Live Conversion Result Card */}
            {(() => {
              const price = cleanNum(convBulkPrice);
              const cap = Math.max(cleanNum(convBulkCapacity), 1);
              const use = Math.max(cleanNum(convPortionUsage), 1);
              const unitCost = convMode === 'timbangan' ? price / (cap * 1000) : price / cap;
              const totalUsed = Math.round(unitCost * use);

              return (
                <View style={styles.convResultBox}>
                  <View style={styles.convResultCol}>
                    <Text style={styles.convResultLabel}>
                      Harga per {convMode === 'timbangan' ? 'Gram' : 'Pcs'}
                    </Text>
                    <Text style={styles.convResultVal}>
                      Rp {unitCost > 0 ? unitCost.toFixed(1) : '0'}
                    </Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.convResultCol}>
                    <Text style={styles.convResultLabel}>Biaya per Porsi</Text>
                    <Text style={styles.convResultHighlight}>
                      Rp {formatRupiah(totalUsed)}
                    </Text>
                  </View>
                </View>
              );
            })()}

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowConverterModal(false)}
              >
                <Text style={styles.cancelBtnText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={applyConverterResult}
              >
                <Feather name="check" size={16} color="#FFFFFF" />
                <Text style={styles.confirmBtnText}>Terapkan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 11: PULIHKAN DATABASE JSON                          */}
      {/* ========================================================= */}
      <Modal visible={showRestoreModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.sheetContainer}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Pulihkan Data Cadangan</Text>
              <TouchableOpacity onPress={() => setShowRestoreModal(false)}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.restoreSheetDesc}>
              Tempelkan (paste) seluruh teks kode JSON cadangan Anda ke dalam kotak di bawah ini:
            </Text>

            <TextInput
              style={styles.restoreTextInput}
              multiline
              numberOfLines={7}
              textAlignVertical="top"
              placeholder='Tempel teks JSON di sini... Contoh: {"app":"Meracik Ide", "recipes": [...], ...}'
              placeholderTextColor="#94A3B8"
              value={restoreJsonInput}
              onChangeText={setRestoreJsonInput}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.restoreActionRow}>
              <TouchableOpacity
                style={styles.restoreCancelBtn}
                onPress={() => setShowRestoreModal(false)}
              >
                <Text style={styles.restoreCancelBtnText}>Batal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.restoreSubmitBtn}
                onPress={handleExecuteRestore}
              >
                <Feather name="check" size={16} color="#FFFFFF" />
                <Text style={styles.restoreSubmitBtnText}>Verifikasi & Pulihkan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 12: GUDANG IDE BISNIS (MULTI-PROJEK)                */}
      {/* ========================================================= */}
      <Modal visible={showProjectsModal} animationType="slide">
        <View style={[styles.modalScreen, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowProjectsModal(false)}>
              <Feather name="arrow-left" size={22} color="#0F172A" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Gudang Ide Bisnis</Text>
            <TouchableOpacity onPress={() => setShowStarterPackModal(true)}>
              <Feather name="box" size={20} color="#0284C7" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            {/* Header Explainer Card */}
            <View style={styles.projectsHeroCard}>
              <View style={styles.projectsHeroTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.projectsHeroTitle}>Multi-Proyek Ide Usaha</Text>
                  <Text style={styles.projectsHeroSub}>
                    Simpan banyak konsep bisnis terpisah (misal: Kopi, Ayam Geprek, Angkringan) tanpa mencampur data modal dan resep.
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.starterPackBannerBtn}
                  onPress={() => setShowStarterPackModal(true)}
                >
                  <Feather name="zap" size={14} color="#D97706" />
                  <Text style={styles.starterPackBannerBtnText}>Template</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* List of Projects */}
            <Text style={styles.projectsSectionTitle}>Daftar Ide Usaha Anda ({projects.length})</Text>
            {projects.map((proj) => {
              const isActive = proj.id === activeProjectId;
              const recCount = proj.recipes?.length || 0;
              const capTotal = proj.capitalItems?.reduce((a, c) => a + c.total, 0) || 0;

              return (
                <View
                  key={proj.id}
                  style={[styles.projectCardItem, isActive && styles.projectCardItemActive]}
                >
                  <View style={styles.projectCardTopRow}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={styles.projectCardName}>{proj.name}</Text>
                        {isActive && (
                          <View style={styles.projectActiveBadge}>
                            <Text style={styles.projectActiveBadgeText}>SEDANG DIBUKA</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.projectCardMeta}>
                        Kategori: {proj.category} • {recCount} Resep • Capex: Rp {formatRupiah(capTotal)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.projectActionRow}>
                    {!isActive ? (
                      <TouchableOpacity
                        style={styles.projectSwitchBtn}
                        onPress={() => handleSwitchProject(proj.id)}
                      >
                        <Feather name="check" size={14} color="#FFFFFF" />
                        <Text style={styles.projectSwitchBtnText}>Buka Ide Ini</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.projectCurrentPill}>
                        <Feather name="check-circle" size={14} color="#059669" />
                        <Text style={styles.projectCurrentPillText}>Ide Aktif</Text>
                      </View>
                    )}

                    <TouchableOpacity
                      style={styles.projectDuplicateBtn}
                      onPress={() => handleDuplicateProject(proj.id)}
                    >
                      <Feather name="copy" size={14} color="#0284C7" />
                      <Text style={styles.projectDuplicateBtnText}>Salin</Text>
                    </TouchableOpacity>

                    {projects.length > 1 && (
                      <TouchableOpacity
                        style={styles.projectDeleteBtn}
                        onPress={() => handleDeleteProject(proj.id)}
                      >
                        <Feather name="trash-2" size={14} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}

            {/* Create New Project Card */}
            <View style={styles.newProjectCard}>
              <View style={styles.newProjectHeader}>
                <Feather name="plus-circle" size={18} color="#059669" />
                <Text style={styles.newProjectTitle}>Buat Ide Bisnis Baru</Text>
              </View>

              <Text style={styles.inputLabel}>Nama Konsep Usaha</Text>
              <TextInput
                style={styles.nativeInput}
                placeholder="Contoh: Roti Bakar Bandung Pro"
                placeholderTextColor="#94A3B8"
                value={formNewProjectName}
                onChangeText={setFormNewProjectName}
              />

              <Text style={styles.inputLabel}>Kategori Usaha</Text>
              <TextInput
                style={styles.nativeInput}
                placeholder="Contoh: Kuliner Malam, Minuman Kekinian"
                placeholderTextColor="#94A3B8"
                value={formNewProjectCategory}
                onChangeText={setFormNewProjectCategory}
              />

              <TouchableOpacity
                style={styles.createProjectBtn}
                onPress={() => handleCreateNewProject(formNewProjectName, formNewProjectCategory)}
              >
                <Feather name="plus" size={16} color="#FFFFFF" />
                <Text style={styles.createProjectBtnText}>Mulai Ide Baru (Kondisi 0)</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 13: STARTER PACK TEMPLATES USAHA                     */}
      {/* ========================================================= */}
      <Modal visible={showStarterPackModal} animationType="slide">
        <View style={[styles.modalScreen, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowStarterPackModal(false)}>
              <Feather name="arrow-left" size={22} color="#0F172A" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Starter Pack UMKM</Text>
            <View style={{ width: 22 }} />
          </View>

          <ScrollView style={styles.modalScroll} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            <View style={styles.starterHeroCard}>
              <Text style={styles.starterHeroTitle}>Template Usaha Siap Pakai 🚀</Text>
              <Text style={styles.starterHeroSub}>
                Mulai instan dengan formula resep, daftar bahan baku pasar, modal alat (capex), dan beban rutin riil yang sudah teruji.
              </Text>
            </View>

            {STARTER_PACKS.map((pack) => {
              const packCapex = pack.capitalItems.reduce((a, c) => a + c.total, 0);
              const packOpex = pack.expenses.reduce((a, e) => a + e.amount, 0);

              return (
                <View key={pack.id} style={styles.packCard}>
                  <View style={styles.packCardTop}>
                    <View style={styles.packEmojiCircle}>
                      <Text style={styles.packEmojiText}>{pack.name.includes('Kopi') ? '☕' : pack.name.includes('Ayam') ? '🍗' : '🧋'}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.packCardTitle}>{pack.name}</Text>
                      <Text style={styles.packCategoryTag}>{pack.category}</Text>
                    </View>
                  </View>

                  <Text style={styles.packDescription}>{pack.desc}</Text>

                  {/* Highlights Grid */}
                  <View style={styles.packMetricsGrid}>
                    <View style={styles.packMetricBox}>
                      <Text style={styles.packMetricLabel}>RESEP LENGKAP</Text>
                      <Text style={styles.packMetricVal}>{pack.recipes.length} Menu</Text>
                    </View>
                    <View style={styles.packMetricBox}>
                      <Text style={styles.packMetricLabel}>BAHAN BAKU</Text>
                      <Text style={styles.packMetricVal}>{pack.materials.length} Bahan</Text>
                    </View>
                    <View style={styles.packMetricBox}>
                      <Text style={styles.packMetricLabel}>MODAL ALAT</Text>
                      <Text style={styles.packMetricVal}>Rp {formatRupiah(packCapex)}</Text>
                    </View>
                    <View style={styles.packMetricBox}>
                      <Text style={styles.packMetricLabel}>BEBAN BULANAN</Text>
                      <Text style={styles.packMetricVal}>Rp {formatRupiah(packOpex)}</Text>
                    </View>
                  </View>

                  {/* Sample Menu */}
                  <View style={styles.packSampleMenuBox}>
                    <Text style={styles.packSampleMenuLabel}>Menu Bawaan:</Text>
                    <Text style={styles.packSampleMenuText}>
                      {pack.recipes.map((r) => `• ${r.name} (HPP Rp ${formatRupiah(r.unitCost)} • Jual Rp ${formatRupiah(r.targetSellingPrice)})`).join('\n')}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.packApplyBtn}
                    onPress={() => {
                      Alert.alert(
                        'Terapkan Starter Pack?',
                        `Ide bisnis baru "${pack.name}" akan dibuat beserta seluruh database bahan baku, resep, dan simulasi keuangannya.`,
                        [
                          { text: 'Batal', style: 'cancel' },
                          {
                            text: 'Gunakan Template',
                            onPress: () => handleCreateNewProject(pack.name, pack.category, pack),
                          },
                        ]
                      );
                    }}
                  >
                    <Feather name="check" size={16} color="#FFFFFF" />
                    <Text style={styles.packApplyBtnText}>Gunakan Template Ini</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ==========================================
// 9. NATIVE MOBILE DESIGN SYSTEM STYLES
// ==========================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topAppBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  appBarBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandLogoCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FEF3DF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  brandLogoImg: {
    width: 38,
    height: 38,
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  brandBadge: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  brandBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  brandSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingToast: {
    position: 'absolute',
    top: 70,
    alignSelf: 'center',
    zIndex: 9999,
    backgroundColor: '#0F172A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  floatingToastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  screenBody: {
    flex: 1,
  },
  tabContentFull: {
    flex: 1,
  },

  // Search & Filters
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  searchBarInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },
  filterChipsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 10,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Segment Controller
  segmentContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
    backgroundColor: '#E2E8F0',
    padding: 3,
    borderRadius: 10,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  segmentBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  segmentBtnTextActive: {
    color: '#0F172A',
  },

  // Lists & Scrolling
  scrollList: {
    flex: 1,
  },
  scrollInner: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 24,
  },

  // POS Product Cards
  posCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  posCardInfo: {
    flex: 1,
  },
  categoryPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    marginBottom: 4,
  },
  categoryPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  posCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  posPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  posCardPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#059669',
  },
  posCardProfit: {
    fontSize: 11,
    color: '#64748B',
  },
  posCardAction: {
    marginLeft: 12,
  },
  posAddBtn: {
    backgroundColor: '#0F172A',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
  },
  posAddBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  posStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 2,
  },
  stepperBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
  },
  stepperQty: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    paddingHorizontal: 10,
  },

  // Floating Cart Bar
  floatingCartContainer: {
    position: 'absolute',
    bottom: 12,
    left: 16,
    right: 16,
    zIndex: 999,
  },
  floatingCartBar: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  floatingCartLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cartBadgeCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeNum: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  cartBarLabel: {
    fontSize: 11,
    color: '#94A3B8',
  },
  cartBarTotal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  floatingCartRight: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  cartPayText: {
    color: '#FFFFFF',
    fontSize: 13,
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
  recipeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  recipeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  recipeBatchInfo: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  marginBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  marginBadgeSuper: {
    backgroundColor: '#ECFDF5',
  },
  marginBadgeHealthy: {
    backgroundColor: '#EFF6FF',
  },
  marginBadgeWarn: {
    backgroundColor: '#FEF3C7',
  },
  marginBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  metricRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
  },
  metricBox: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  metricHppVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#EF4444',
    marginTop: 2,
  },
  metricPriceVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  metricProfitVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#10B981',
    marginTop: 2,
  },
  smartPricingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 10,
    gap: 6,
  },
  smartPricingNote: {
    fontSize: 11,
    color: '#065F46',
    flex: 1,
  },
  boldText: {
    fontWeight: '700',
  },

  // Floating Action Button (FAB)
  floatingFab: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: '#0F172A',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  floatingFabText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // BEP Hero Card
  bepHeroCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
  },
  bepHeroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bepHeroTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
  },
  bepBadge: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  bepBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10B981',
  },
  bepMainNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 16,
  },
  bepBigNumber: {
    fontSize: 36,
    fontWeight: '800',
    color: '#10B981',
  },
  bepBigUnit: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: -2,
  },
  bepSubMetrics: {
    alignItems: 'flex-end',
    gap: 6,
  },
  bepSubMetricItem: {
    alignItems: 'flex-end',
  },
  bepSubLabel: {
    fontSize: 10,
    color: '#94A3B8',
  },
  bepSubVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  bepFlowRow: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 10,
  },
  flowItem: {
    flex: 1,
    alignItems: 'center',
  },
  flowDivider: {
    width: 1,
    backgroundColor: '#334155',
  },
  flowLabel: {
    fontSize: 10,
    color: '#94A3B8',
  },
  flowVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
  },
  sectionHelper: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 8,
  },
  bepItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bepItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  bepItemSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  bepItemMonthly: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
    marginTop: 2,
  },
  bepItemTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  targetStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  targetStepBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  targetStepSign: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  targetCountCol: {
    alignItems: 'center',
    minWidth: 40,
  },
  targetCountNum: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  targetCountSub: {
    fontSize: 9,
    color: '#64748B',
  },
  subSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  subSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  subSectionAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  subSectionAddText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },

  // Material Cards
  materialCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  matCategoryTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  matCategoryTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
  },
  matName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  matPurchaseInfo: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  matUnitCostCol: {
    alignItems: 'flex-end',
  },
  matUnitCostLabel: {
    fontSize: 10,
    color: '#94A3B8',
  },
  matUnitCostVal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#059669',
  },
  matUnitCostUnit: {
    fontSize: 10,
    color: '#64748B',
  },

  // Bottom Navigation Bar
  bottomNavBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 8,
  },
  navBarItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconWrapper: {
    position: 'relative',
  },
  navBadgeCircle: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#EF4444',
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  navBarLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 3,
  },
  navBarLabelActive: {
    color: '#059669',
    fontWeight: '700',
  },

  // Modals & Bottom Sheets
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#CBD5E1',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  sheetSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  sheetItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  sheetItemName: {
    fontSize: 14,
    color: '#334155',
  },
  sheetItemSubtotal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  sheetTotalBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    marginVertical: 12,
  },
  sheetTotalLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  sheetTotalVal: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
    marginTop: 8,
  },
  nativeInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 8,
  },
  quickCashRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  quickCashBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  quickCashText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  changeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ECFDF5',
    borderRadius: 10,
    padding: 12,
    marginVertical: 8,
  },
  changeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#065F46',
  },
  changeVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#059669',
  },
  primarySubmitBtn: {
    backgroundColor: '#0F172A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 12,
    gap: 8,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  primarySubmitText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  // Receipt Styles (Professional POS)
  receiptScrollContainer: {
    width: '100%',
    maxHeight: '92%',
  },
  receiptScrollContent: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  receiptPaper: {
    width: Math.min(SCREEN_WIDTH - 36, 350),
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 8,
  },
  receiptHeader: {
    alignItems: 'center',
  },
  receiptBrandBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FEF3DF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  receiptLogoImg: {
    width: 44,
    height: 44,
  },
  receiptStoreName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 1,
    textAlign: 'center',
  },
  receiptStoreSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 3,
    textAlign: 'center',
    lineHeight: 16,
  },
  receiptStoreContact: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    marginTop: 2,
    textAlign: 'center',
  },
  receiptDashedLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
    borderStyle: 'dashed',
    marginVertical: 12,
  },
  receiptDashedLineThin: {
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    borderStyle: 'dashed',
    marginVertical: 8,
  },
  receiptMetaGrid: {
    gap: 4,
  },
  receiptMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptMetaLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  receiptMetaVal: {
    fontSize: 11,
    color: '#1E293B',
    fontWeight: '600',
  },
  receiptTableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  receiptTableColLeft: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  receiptTableColRight: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  receiptItemsList: {
    gap: 8,
  },
  receiptItemBox: {
    gap: 2,
  },
  receiptItemName: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: 0.3,
  },
  receiptItemCalcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptItemCalcText: {
    fontSize: 11.5,
    color: '#475569',
  },
  receiptItemSubtotalText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  receiptItemCountRow: {
    paddingTop: 4,
  },
  receiptItemCountText: {
    fontSize: 10,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  receiptSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2.5,
  },
  receiptSummaryLabel: {
    fontSize: 11.5,
    color: '#64748B',
  },
  receiptSummaryVal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
  },
  receiptGrandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    marginVertical: 4,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#0F172A',
  },
  receiptGrandTotalLabel: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  receiptGrandTotalVal: {
    fontSize: 15.5,
    fontWeight: '900',
    color: '#0F172A',
  },
  receiptPaymentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  paymentBadgeQris: {
    backgroundColor: '#E0F2FE',
  },
  paymentBadgeCash: {
    backgroundColor: '#DCFCE7',
  },
  receiptPaymentBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  receiptChangeLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#059669',
  },
  receiptChangeVal: {
    fontSize: 13,
    fontWeight: '900',
    color: '#059669',
  },
  receiptFooterMessage: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    marginTop: 4,
  },
  receiptFooterSub: {
    fontSize: 9.5,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 2,
  },
  receiptBarcodeWrapper: {
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  receiptBarcodeLines: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
  },
  receiptBarcodeText: {
    fontSize: 9.5,
    color: '#64748B',
    letterSpacing: 2,
    marginTop: 4,
    fontWeight: '600',
  },
  receiptTimestamp: {
    fontSize: 9,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 6,
  },
  receiptActions: {
    width: Math.min(SCREEN_WIDTH - 36, 350),
    marginTop: 16,
    gap: 10,
  },
  shareWhatsappBtn: {
    backgroundColor: '#25D366',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    gap: 8,
  },
  shareWhatsappText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  shareWhatsappTextBtn: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  shareWhatsappTextBtnText: {
    color: '#059669',
    fontSize: 13,
    fontWeight: '700',
  },
  closeReceiptBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeReceiptText: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '600',
  },

  // Recipe Builder Fullscreen Modal
  modalScreen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalHeaderAction: {
    fontSize: 14,
    fontWeight: '700',
    color: '#059669',
  },
  modalScroll: {
    flex: 1,
  },
  twoColRow: {
    flexDirection: 'row',
  },
  builderLiveCard: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 14,
    marginVertical: 12,
  },
  liveCardCol: {
    flex: 1,
    alignItems: 'center',
  },
  liveLabel: {
    fontSize: 10,
    color: '#94A3B8',
  },
  liveVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
  },
  recommendationCard: {
    backgroundColor: '#ECFDF5',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    gap: 4,
  },
  recommendationTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
  },
  recommendationLine: {
    fontSize: 11,
    color: '#065F46',
  },
  boldDark: {
    fontWeight: '700',
    color: '#0F172A',
  },
  recipeIngItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  recipeIngName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  recipeIngUsage: {
    fontSize: 11,
    color: '#64748B',
  },
  recipeIngCost: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  addIngDashedBtn: {
    borderWidth: 1,
    borderColor: '#059669',
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 6,
  },
  addIngDashedText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
  },

  // Picker Modal
  pickerBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 40,
  },
  pickerHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  pickerOptionActive: {
    backgroundColor: '#ECFDF5',
  },
  pickerOptionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  pickerOptionTitleActive: {
    color: '#059669',
  },
  pickerOptionSub: {
    fontSize: 11,
    color: '#64748B',
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  confirmBtn: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Unit Selector
  unitSelectorRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  unitChip: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  unitChipSmall: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
  },
  unitChipActive: {
    backgroundColor: '#0F172A',
  },
  unitChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  unitChipTextActive: {
    color: '#FFFFFF',
  },

  // Riwayat & Stats
  statsSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E2E8F0',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  statValHighlight: {
    fontSize: 16,
    fontWeight: '800',
    color: '#059669',
    marginTop: 2,
  },
  statValNormal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  emptyStateBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569',
    marginTop: 12,
  },
  emptyStateSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 14,
    gap: 6,
  },
  emptyActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  historyCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  historyIdGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historyIdText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  historyTime: {
    fontSize: 11,
    color: '#94A3B8',
  },
  historyItemsSummary: {
    marginBottom: 8,
  },
  historyItemNames: {
    fontSize: 12,
    color: '#64748B',
  },
  historyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  historyTotal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  viewReceiptLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewReceiptText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },

  // Settings & System Cards
  settingsGroupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  settingsGroupHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  settingsGroupTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  settingsCardSubDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 14,
  },
  fieldHelpText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
  },
  roundingSwitchRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  roundingSwitchBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  roundingSwitchBtnActive: {
    backgroundColor: '#F0F9FF',
    borderColor: '#0284C7',
    borderWidth: 1.5,
  },
  roundingSwitchText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  roundingSwitchTextActive: {
    color: '#0369A1',
    fontWeight: '700',
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  settingsLabel: {
    fontSize: 13,
    color: '#334155',
  },
  settingsVal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  settingsActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  settingsActionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  settingsActionSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
    lineHeight: 16,
  },
  settingsDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },

  // Formula Education Cards
  formulaCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  formulaCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  formulaCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  formulaBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  formulaBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#15803D',
  },
  formulaMathBox: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginVertical: 6,
  },
  formulaMathText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '700',
    color: '#0284C7',
  },
  formulaExplainText: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
  },

  // About Section Styles
  aboutLogoBox: {
    width: 68,
    height: 68,
    borderRadius: 18,
    backgroundColor: '#FEF3DF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    marginBottom: 10,
  },
  aboutAppName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  aboutAppVersion: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 10,
  },
  aboutBadgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  aboutSecureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  aboutSecureBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#166534',
  },
  aboutAppDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 8,
  },

  // Restore Modal Styles
  restoreSheetDesc: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 12,
  },
  restoreTextInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 12,
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#0F172A',
    minHeight: 140,
    marginBottom: 14,
  },
  restoreActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  restoreCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  restoreCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  restoreSubmitBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#0284C7',
    gap: 6,
  },
  restoreSubmitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  recipeCardFooterAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
    marginTop: 10,
  },
  recipeCardHintText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  recipeCardFooterButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  cardMiniBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  matActionMiniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  matActionMiniBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  trashMiniBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
  },
  ingRemoveBtn: {
    padding: 4,
    marginLeft: 8,
  },
  converterShortcutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginVertical: 10,
  },
  converterShortcutText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
  },
  converterMaterialLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  converterMaterialLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  detailHeroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  detailHeroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  detailHeroTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  detailHeroSub: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 14,
  },
  inflationTestSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  inflationTestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  inflationTestTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  inflationTestDesc: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
    marginBottom: 12,
  },
  inflationChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  inflationChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  inflationChipActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  inflationChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  inflationChipTextActive: {
    color: '#FFFFFF',
  },
  inflationNote: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '600',
    marginBottom: 10,
  },
  inflationResultBox: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  inflationResultCol: {
    flex: 1,
    alignItems: 'center',
  },
  inflationResultLabel: {
    fontSize: 10,
    color: '#64748B',
    textTransform: 'uppercase',
    fontWeight: '700',
    marginBottom: 4,
  },
  inflationResultVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  inflationDiff: {
    fontSize: 10,
    color: '#EF4444',
    fontWeight: '700',
    marginTop: 2,
  },
  inflationStatus: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  bomSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  bomSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  bomEmptyText: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  bomItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  bomItemName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  bomItemUsage: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  bomItemCost: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  detailActionCol: {
    gap: 12,
    marginTop: 8,
  },
  detailShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#059669',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  detailShareBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },
  detailActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  detailEditBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingVertical: 12,
    borderRadius: 10,
  },
  detailEditBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0284C7',
  },
  detailDeleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 12,
    borderRadius: 10,
  },
  detailDeleteBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#EF4444',
  },
  convResultBox: {
    flexDirection: 'row',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    padding: 14,
    marginVertical: 14,
    alignItems: 'center',
  },
  convResultCol: {
    flex: 1,
    alignItems: 'center',
  },
  convResultLabel: {
    fontSize: 11,
    color: '#065F46',
    marginBottom: 4,
    fontWeight: '600',
  },
  convResultVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  convResultHighlight: {
    fontSize: 15,
    fontWeight: '800',
    color: '#059669',
  },
  dailyBepBanner: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dailyBepHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dailyBepTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  dailyBepRatio: {
    fontSize: 13,
    color: '#64748B',
  },
  dailyBepProgressTrack: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  dailyBepProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  dailyBepStatusText: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 16,
  },
  dailyBepPromptBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    padding: 10,
    borderRadius: 12,
    gap: 8,
  },
  dailyBepPromptText: {
    fontSize: 11,
    color: '#0369A1',
    flex: 1,
    lineHeight: 16,
  },
  methodMiniTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  methodMiniTagQris: {
    backgroundColor: '#E0F2FE',
  },
  methodMiniTagCash: {
    backgroundColor: '#DCFCE7',
  },
  methodMiniTagText: {
    fontSize: 9,
    fontWeight: '800',
  },
  paymentMethodSwitchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  paymentMethodSwitchBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  paymentMethodSwitchBtnActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#0F172A',
    borderWidth: 1.5,
  },
  paymentMethodSwitchText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  paymentMethodSwitchTextActive: {
    color: '#0F172A',
    fontWeight: '700',
  },
  qrisInfoBox: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    padding: 14,
    marginVertical: 10,
  },
  qrisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  qrisTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0369A1',
  },
  qrisDesc: {
    fontSize: 12,
    color: '#0284C7',
    lineHeight: 18,
    marginBottom: 10,
  },
  qrisAmountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 8,
  },
  qrisAmountLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  qrisAmountVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0284C7',
  },
  profileSaveBtn: {
    backgroundColor: '#0F172A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 12,
    gap: 6,
  },
  profileSaveBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  tierGrid: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 10,
  },
  tierItem: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#D1FAE5',
    alignItems: 'center',
  },
  tierBadge: {
    fontSize: 9,
    fontWeight: '800',
    color: '#059669',
    marginBottom: 4,
  },
  tierPrice: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  tierProfit: {
    fontSize: 9,
    color: '#10B981',
    fontWeight: '600',
    marginTop: 2,
  },
  lowStockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  lowStockBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
  },
  matStockText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },
  matStockTextWarn: {
    color: '#DC2626',
    fontWeight: '600',
  },
  filterChipWarnActive: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  bepSubNote: {
    fontSize: 9,
    color: '#94A3B8',
    marginTop: 2,
  },
  scenarioBar: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  scenarioLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  scenarioToggleGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  scenarioBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  scenarioBtnPesimisActive: {
    backgroundColor: '#7F1D1D',
    borderColor: '#EF4444',
  },
  scenarioBtnNormalActive: {
    backgroundColor: '#065F46',
    borderColor: '#10B981',
  },
  scenarioBtnOptimisActive: {
    backgroundColor: '#1E3A8A',
    borderColor: '#3B82F6',
  },
  scenarioBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    textAlign: 'center',
  },
  scenarioBtnTextActive: {
    color: '#FFFFFF',
  },
  proposalActionGroup: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  proposalPdfBtn: {
    flex: 1.6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
    borderRadius: 8,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: '#475569',
  },
  proposalPdfBtnText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
  },
  proposalTextBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  proposalTextBtnText: {
    color: '#059669',
    fontSize: 11.5,
    fontWeight: '700',
  },
  workingCapCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  workingCapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  workingCapTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  workingCapSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  workingCapIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  workingCapInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  workingCapInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 42,
  },
  workingCapPrefix: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    marginRight: 6,
  },
  workingCapInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    paddingVertical: 0,
  },
  workingCapSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0284C7',
    paddingHorizontal: 14,
    height: 42,
    borderRadius: 8,
  },
  workingCapSaveText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  workingCapSavedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  workingCapSavedText: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '600',
  },
  shoppingPlannerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FED7AA',
    marginBottom: 14,
  },
  shoppingPlannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  shoppingPlannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#9A3412',
  },
  shoppingPlannerSub: {
    fontSize: 11,
    color: '#78350F',
    marginTop: 2,
    lineHeight: 16,
  },
  shoppingPlannerIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  portionStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  portionStepperLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  portionStepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  portionStepBtn: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  portionStepBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  portionDisplayBox: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    alignItems: 'center',
    minWidth: 70,
  },
  portionDisplayText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#C2410C',
  },
  portionDisplayUnit: {
    fontSize: 9,
    color: '#EA580C',
    fontWeight: '600',
  },
  portionPresetRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  portionPresetBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  portionPresetBtnActive: {
    backgroundColor: '#C2410C',
    borderColor: '#C2410C',
  },
  portionPresetText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  portionPresetTextActive: {
    color: '#FFFFFF',
  },
  plannerResultsWrap: {
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  plannerTotalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#FCD34D',
    marginBottom: 8,
  },
  plannerTotalLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#92400E',
  },
  plannerTotalVal: {
    fontSize: 16,
    fontWeight: '900',
    color: '#B45309',
  },
  plannerShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#059669',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  plannerShareBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  plannerItemsList: {
    gap: 6,
  },
  plannerItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  plannerItemName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
  },
  plannerItemQty: {
    fontSize: 10,
    color: '#64748B',
  },
  plannerItemCost: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },

  // Daily Survival Meter
  dailySurvivalCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  dailySurvivalTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dailySurvivalIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dailySurvivalTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 0.5,
  },
  dailySurvivalSub: {
    fontSize: 11,
    color: '#475569',
    marginTop: 2,
  },
  dailySurvivalBadge: {
    backgroundColor: '#15803D',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  dailySurvivalBadgeNum: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  dailySurvivalBadgeUnit: {
    fontSize: 9,
    color: '#DCFCE7',
    fontWeight: '600',
  },
  dailySurvivalBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#DCFCE7',
  },
  dailySurvivalBottomText: {
    fontSize: 11,
    color: '#334155',
    flex: 1,
    lineHeight: 16,
  },

  // Investor Profit Sharing Simulation
  investorSimCard: {
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    borderRadius: 12,
    padding: 14,
    marginTop: 14,
  },
  investorSimHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  investorSimTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6B21A8',
  },
  investorSimSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 15,
  },
  investorSimIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  investorSimPorsiLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginTop: 12,
    marginBottom: 6,
  },
  investorPorsiRow: {
    flexDirection: 'row',
    gap: 8,
  },
  investorPorsiChip: {
    flex: 1,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    alignItems: 'center',
  },
  investorPorsiChipActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  investorPorsiChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  investorPorsiChipTextActive: {
    color: '#FFFFFF',
  },
  investorMetricsBox: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F3E8FF',
    padding: 12,
    marginTop: 12,
    alignItems: 'center',
  },
  investorMetricCol: {
    flex: 1,
  },
  investorMetricLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  investorMetricVal: {
    fontSize: 13,
    fontWeight: '800',
    marginVertical: 2,
  },
  investorMetricSub: {
    fontSize: 10,
    color: '#94A3B8',
  },
  investorMetricDivider: {
    width: 1,
    height: '80%',
    backgroundColor: '#E2E8F0',
    marginHorizontal: 10,
  },

  // Segment Scroll
  segmentScroll: {
    marginBottom: 16,
  },
  segmentScrollInner: {
    gap: 8,
    paddingHorizontal: 2,
  },
  segmentScrollBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  // Feature 1: Multi-Proyek / Gudang Ide Styles
  gudangIdeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  gudangIdeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
  },
  projectsHeroCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  projectsHeroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  projectsHeroTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  projectsHeroSub: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
  },
  starterPackBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  starterPackBannerBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  projectsSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  projectCardItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  projectCardItemActive: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
  },
  projectCardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  projectCardName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  projectActiveBadge: {
    backgroundColor: '#059669',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  projectActiveBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  projectCardMeta: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  projectActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  projectSwitchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  projectSwitchBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  projectCurrentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  projectCurrentPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  projectDuplicateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  projectDuplicateBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
  },
  projectDeleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },
  newProjectCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 10,
  },
  newProjectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  newProjectTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  createProjectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 14,
  },
  createProjectBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Feature 2: Starter Pack Presets Styles
  starterHeroCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 16,
  },
  starterHeroTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#92400E',
    marginBottom: 4,
  },
  starterHeroSub: {
    fontSize: 12,
    color: '#78350F',
    lineHeight: 18,
  },
  packCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  packCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  packEmojiCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  packEmojiText: {
    fontSize: 22,
  },
  packCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  packCategoryTag: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  packDescription: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
    marginBottom: 12,
  },
  packMetricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  packMetricBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  packMetricLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  packMetricVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  packSampleMenuBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  packSampleMenuLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  packSampleMenuText: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 18,
  },
  packApplyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0284C7',
    paddingVertical: 12,
    borderRadius: 10,
  },
  packApplyBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Feature 3: Asset Depreciation Styles
  deprecSummaryCard: {
    backgroundColor: '#FEFCE8',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FEF08A',
    marginBottom: 12,
  },
  deprecSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  deprecSummaryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#854D0E',
  },
  deprecSummaryAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: '#854D0E',
  },
  deprecSummaryDesc: {
    fontSize: 11,
    color: '#A16207',
    lineHeight: 16,
  },
  deprecBadgeSub: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  lifespanSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 8,
  },
  lifespanChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  lifespanChipActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  lifespanChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  lifespanChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  lifespanHelpText: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
    marginBottom: 14,
  },
  deprecToggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  deprecToggleCardActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  deprecToggleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  deprecToggleSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 15,
  },

  // Feature 4: Pre-Launch Checklist Styles
  checkHeaderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  checkHeaderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  checkHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  checkHeaderSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  checkProgressBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  checkProgressBadgeText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#059669',
  },
  checkProgressBarTrack: {
    height: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  checkProgressBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  checkAdviceText: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 17,
  },
  checkFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  checkFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  checkFilterChipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  checkFilterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  checkFilterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  checkAddRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  checkAddInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  checkAddBtn: {
    backgroundColor: '#059669',
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  checkItemCardDone: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    opacity: 0.8,
  },
  checkItemTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  checkItemTitleDone: {
    textDecorationLine: 'line-through',
    color: '#94A3B8',
  },
  checkItemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  checkItemCatBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  checkItemCatText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  checkCompletedLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10B981',
  },

  // Feature 5: SVG BEP Curve Chart & Proportions Styles
  bepLiveTag: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  bepLiveTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 0.5,
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  chartCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  chartCardSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 10,
    lineHeight: 16,
  },
  chartSvgWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  chartLegendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendIndicator: {
    width: 12,
    height: 3,
    borderRadius: 2,
  },
  legendDotIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '600',
  },
  proportionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  proportionCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  proportionCardSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 12,
    lineHeight: 16,
  },
  stackedBarWrap: {
    flexDirection: 'row',
    height: 16,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
    marginBottom: 12,
  },
  barSegment: {
    height: '100%',
  },
  stackedLegendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  stackedLegendCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: '45%',
  },
  legendBox: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  stackedLegendName: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  stackedLegendVal: {
    fontSize: 11,
    color: '#0F172A',
    fontWeight: '800',
  },

  // Feature 6: Logo Picker Styles
  logoPickerBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  logoPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoPreviewImg: {
    width: 64,
    height: 64,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  logoStatusText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  logoStatusSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  logoChangeBtn: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
  },
  logoChangeBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  logoDeleteBtn: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
  },
  logoDeleteBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
  },
  logoEmptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoPlaceholderCircle: {
    width: 54,
    height: 54,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoEmptyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  logoEmptySub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 6,
  },
  logoPickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  logoPickBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },

  // App Bar Right Group
  appBarRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  // Depreciation Capex Card Styles
  deprecSummarySub: {
    fontSize: 11,
    color: '#92400E',
    marginTop: 2,
  },
  deprecIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deprecToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FEF08A',
    marginTop: 8,
  },
  deprecToggleRowActive: {
    backgroundColor: '#FEF9C3',
    borderColor: '#F59E0B',
  },
  deprecToggleText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: '#78350F',
    lineHeight: 15,
  },

  // BEP KPI Grid Styles
  bepKpiGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  bepKpiBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bepKpiLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  bepKpiValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginVertical: 4,
  },
  bepKpiSub: {
    fontSize: 10,
    color: '#94A3B8',
  },

  // About Copyright Box Styles
  aboutCopyrightBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 14,
    width: '100%',
  },
  aboutCopyrightText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  aboutCopyrightSub: {
    fontSize: 10,
    color: '#64748B',
    lineHeight: 14,
    marginTop: 2,
  },
});
