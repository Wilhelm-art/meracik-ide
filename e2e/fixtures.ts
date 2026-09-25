import { test as base, Page } from '@playwright/test';

export interface TestRecipe {
  id: string;
  name: string;
  materials: { id: string; type: 'material'; name: string; amount: number }[];
  overheads: { id: string; type: 'overhead'; name: string; amount: number }[];
  wastePercentage: number;
  inflationBuffer: number;
  targetSellingPrice: number;
  createdAt: number;
}

const STORAGE_KEY = '@umkm_calculator_recipes_v1';

export const sampleRecipe: TestRecipe = {
  id: 'test-recipe-1',
  name: 'Lele Marinasi Siap Goreng 500g',
  materials: [
    { id: 'm1', type: 'material', name: 'Ikan Lele Segar', amount: 12000 },
    { id: 'm2', type: 'material', name: 'Bumbu Kunyit Bawang', amount: 3000 },
  ],
  overheads: [
    { id: 'o1', type: 'overhead', name: 'Plastik Klip Vacuum', amount: 1500 },
    { id: 'o2', type: 'overhead', name: 'Alokasi Listrik Freezer', amount: 1000 },
  ],
  wastePercentage: 15,
  inflationBuffer: 0,
  targetSellingPrice: 25000,
  createdAt: Date.now(),
};

/**
 * Fixture kustom Playwright dengan dukungan Seeding & Cleanup AsyncStorage lokal
 */
export const test = base.extend<{
  appPage: Page;
  cleanApp: Page;
}>({
  // Fixture dengan storage bersih (Empty State)
  cleanApp: async ({ page }, use) => {
    await page.addInitScript((key) => {
      window.localStorage.removeItem(key);
    }, STORAGE_KEY);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await use(page);
    // Cleanup setelah selesai
    await page.evaluate((key) => {
      window.localStorage.removeItem(key);
    }, STORAGE_KEY);
  },

  // Fixture dengan data awal ter-seed (Katalog Berisi)
  appPage: async ({ page }, use) => {
    await page.addInitScript(
      ({ key, data }) => {
        window.localStorage.setItem(key, JSON.stringify([data]));
      },
      { key: STORAGE_KEY, data: sampleRecipe }
    );
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await use(page);
    // Cleanup setelah selesai
    await page.evaluate((key) => {
      window.localStorage.removeItem(key);
    }, STORAGE_KEY);
  },
});

export { expect } from '@playwright/test';
