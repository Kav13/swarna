import { describe, it, expect, beforeEach } from 'vitest';
import { getDb } from '../electron/database/connection';
import { CategoryService } from '../electron/services/categoryService';
import { MaterialTypeService } from '../electron/services/materialTypeService';
import { LoanService } from '../electron/services/loanService';
import { CSVImportService } from '../electron/services/csvImportService';
import {
  calculateGoldPurityPercent,
  calculateSilverPurityPercent,
  formatItemCategory,
  formatItemMaterial,
} from '../src/utils/purity';

describe('Feature 1 & Feature 2: Custom Categories & Material Types with Purity', () => {
  beforeEach(() => {
    // Seed default categories and material types
    CategoryService.seedDefaultCategories('TEST_ADMIN', 'TEST_ADMIN');
    MaterialTypeService.seedDefaultMaterialTypes('TEST_ADMIN', 'TEST_ADMIN');
  });

  describe('Feature 1: Custom Article Categories', () => {
    it('creates and retrieves custom categories with case-insensitive deduplication', () => {
      // 1. Create initial custom category
      const cat1 = CategoryService.getOrCreate('Nose Pin', 'TEST_ADMIN');
      expect(cat1.name).toBe('Nose Pin');
      expect(cat1.is_active).toBe(true);

      // 2. Case-insensitive deduplication check: "nose pin" and "  NOSE PIN  "
      const cat2 = CategoryService.getOrCreate('nose pin', 'TEST_ADMIN');
      expect(cat2.id).toBe(cat1.id);
      expect(cat2.name).toBe('Nose Pin');

      const cat3 = CategoryService.getOrCreate('  NOSE PIN  ', 'TEST_ADMIN');
      expect(cat3.id).toBe(cat1.id);

      // 3. Create another custom category
      const cat4 = CategoryService.getOrCreate('Waist Chain', 'TEST_ADMIN');
      expect(cat4.name).toBe('Waist Chain');
      expect(cat4.id).not.toBe(cat1.id);

      // 4. List all active categories
      const activeList = CategoryService.getCustomCategories(true);
      const names = activeList.map((c) => c.name);
      expect(names).toContain('Nose Pin');
      expect(names).toContain('Waist Chain');
    });

    it('supports soft-delete toggle without physical deletion', () => {
      const cat = CategoryService.getOrCreate('Hair Ornament', 'TEST_ADMIN');
      expect(cat.is_active).toBe(true);

      // Disable category
      const disabled = CategoryService.toggleActive(cat.id, false, 'TEST_ADMIN');
      expect(disabled.is_active).toBe(false);

      // Active list should not include it
      const activeOnly = CategoryService.getCustomCategories(true);
      expect(activeOnly.some((c) => c.id === cat.id)).toBe(false);

      // Full list includes it
      const all = CategoryService.getCustomCategories(false);
      expect(all.some((c) => c.id === cat.id)).toBe(true);

      // Re-enable category
      const reEnabled = CategoryService.toggleActive(cat.id, true, 'TEST_ADMIN');
      expect(reEnabled.is_active).toBe(true);
    });

    it('enforces validation when "Other Article" is selected during loan creation', () => {
      const db = getDb();
      // Ensure customer exists
      const custId = 'CUST-TEST-CAT';
      db.prepare(`
        INSERT OR IGNORE INTO customers (id, full_name, phone, aadhaar_last4, address, city, state, pincode, created_by, created_at, updated_at, is_deleted)
        VALUES (?, 'Test Customer', '9999900001', '1234', '123 Street', 'City', 'State', '110001', 'ADMIN', datetime('now'), datetime('now'), 0)
      `).run(custId);

      const todayStr = new Date().toISOString().split('T')[0];

      // 1. Should throw "Please enter the custom article category." if Other Article has empty custom_category
      expect(() => {
        LoanService.createLoan(
          {
            customer_id: custId,
            loan_date: todayStr,
            start_date: todayStr,
            due_date: '2027-04-01',
            principal_paise: 5000000,
            interest_rate_percent: 2.0,
            interest_period: 'MONTHLY',
            interest_method: 'MONTHLY_SIMPLE',
            ltv_percent: 75,
            payment_mode: 'CASH',
            items: [
              {
                category: 'Other Article',
                custom_category: '', // Empty custom category!
                description: 'Custom pledge',
                material: 'GOLD',
                material_type: '22K Gold',
                purity: '22K',
                gross_weight_grams: 10,
                stone_weight_grams: 0,
                rate_per_gram_paise: 700000,
                allocated_loan_paise: 5000000,
              },
            ],
          },
          'USER-1',
          'ADMIN',
          'OWNER'
        );
      }).toThrow('Please enter the custom article category.');

      // 2. Should succeed when custom_category is provided and record category + custom_category
      const loan = LoanService.createLoan(
        {
          customer_id: custId,
          loan_date: todayStr,
          start_date: todayStr,
          due_date: '2027-04-01',
          principal_paise: 5000000,
          interest_rate_percent: 2.0,
          interest_period: 'MONTHLY',
          interest_method: 'MONTHLY_SIMPLE',
          ltv_percent: 75,
          payment_mode: 'CASH',
          items: [
            {
              category: 'Other Article',
              custom_category: 'Nose Pin',
              description: '22K Gold Nose Pin',
              material: 'GOLD',
              material_type: '22K Gold',
              purity: '22K',
              purity_percent: 91.67,
              gross_weight_grams: 10,
              stone_weight_grams: 0,
              rate_per_gram_paise: 700000,
              allocated_loan_paise: 5000000,
            },
          ],
        },
        'USER-1',
        'ADMIN',
        'OWNER'
      );

      expect(loan.id).toBeDefined();
      const fetched = LoanService.getLoanById(loan.id);
      expect(fetched?.items).toHaveLength(1);
      const item = fetched!.items![0];
      expect(item.category).toBe('Other Article');
      expect(item.custom_category).toBe('Nose Pin');
      expect(item.material_type).toBe('22K Gold');
      expect(item.purity_percent).toBe(91.67);
    });

    it('formats display as "Other Article — [Custom Category]" across all screens', () => {
      expect(formatItemCategory('Other Article', 'Nose Pin')).toBe('Other Article — Nose Pin');
      expect(formatItemCategory('Other', 'Waist Chain')).toBe('Other Article — Waist Chain');
      expect(formatItemCategory('Ring')).toBe('Ring');
      expect(formatItemCategory('Chain', undefined)).toBe('Chain');
    });
  });

  describe('Feature 2: Material Types and Explicit Purity Percentage', () => {
    it('correctly calculates exact gold karat purity percentages', () => {
      // 24K -> 100.00%
      expect(calculateGoldPurityPercent(24)).toBe(100.0);
      // 22K -> 91.67%
      expect(calculateGoldPurityPercent(22)).toBe(91.67);
      // 20K -> 83.33%
      expect(calculateGoldPurityPercent(20)).toBe(83.33);
      // 18K -> 75.00%
      expect(calculateGoldPurityPercent(18)).toBe(75.0);
      // 16K -> 66.67%
      expect(calculateGoldPurityPercent(16)).toBe(66.67);
      // 14K -> 58.33%
      expect(calculateGoldPurityPercent(14)).toBe(58.33);
    });

    it('correctly calculates exact silver fineness purity percentages', () => {
      // 999 -> 99.90%
      expect(calculateSilverPurityPercent(999)).toBe(99.9);
      // 925 -> 92.50%
      expect(calculateSilverPurityPercent(925)).toBe(92.5);
      // 900 -> 90.00%
      expect(calculateSilverPurityPercent(900)).toBe(90.0);
      // 800 -> 80.00%
      expect(calculateSilverPurityPercent(800)).toBe(80.0);
      // 700 -> 70.00%
      expect(calculateSilverPurityPercent(700)).toBe(70.0);
      // 600 -> 60.00%
      expect(calculateSilverPurityPercent(600)).toBe(60.0);
    });

    it('formats material and purity as "16K Gold (66.67%)" and "Silver 700 (70.00%)"', () => {
      expect(formatItemMaterial('GOLD', '16K Gold', '16K', 66.67)).toBe('16K Gold (66.67%)');
      expect(formatItemMaterial('SILVER', 'Silver 700', '700', 70.0)).toBe('Silver 700 (70.00%)');
      expect(formatItemMaterial('GOLD', '22K Gold', '22K', 91.67)).toBe('22K Gold (91.67%)');
      expect(formatItemMaterial('SILVER', 'Silver 925', '925', 92.5)).toBe('Silver 925 (92.50%)');
    });

    it('allows Owner to create, edit, and toggle custom material types', () => {
      const db = getDb();
      db.prepare(`DELETE FROM material_types WHERE name IN ('14 Karat Gold Special', '14K Gold Hallmark', 'Silver 600 Traditional')`).run();

      // 1. Create custom 14K Gold
      const mat1 = MaterialTypeService.createMaterialType(
        {
          name: '14 Karat Gold Special',
          base_material: 'GOLD',
          purity_percent: 58.33,
          karat_or_fineness: '14K',
          rate_per_gram_paise: 420000,
        },
        'OWNER-1',
        'SHOP_OWNER'
      );
      expect(mat1.id).toBeDefined();
      expect(mat1.name).toBe('14 Karat Gold Special');
      expect(mat1.purity_percent).toBe(58.33);

      // 2. Create custom Silver 600
      const mat2 = MaterialTypeService.createMaterialType(
        {
          name: 'Silver 600 Traditional',
          base_material: 'SILVER',
          purity_percent: 60.0,
          karat_or_fineness: '600',
        },
        'OWNER-1',
        'SHOP_OWNER'
      );
      expect(mat2.name).toBe('Silver 600 Traditional');
      expect(mat2.purity_percent).toBe(60.0);

      // 3. Edit material type
      const updatedMat1 = MaterialTypeService.updateMaterialType(
        mat1.id,
        {
          name: '14K Gold Hallmark',
          rate_per_gram_paise: 430000,
        },
        'SHOP_OWNER'
      );
      expect(updatedMat1.name).toBe('14K Gold Hallmark');
      expect(updatedMat1.rate_per_gram_paise).toBe(430000);

      // 4. Soft-delete toggle
      const toggled = MaterialTypeService.toggleActive(mat2.id, false, 'SHOP_OWNER');
      expect(toggled.is_active).toBe(false);

      const activeSilvers = MaterialTypeService.getByBaseMaterial('SILVER', true);
      expect(activeSilvers.some((s) => s.id === mat2.id)).toBe(false);

      const allSilvers = MaterialTypeService.getByBaseMaterial('SILVER', false);
      expect(allSilvers.some((s) => s.id === mat2.id)).toBe(true);
    });

    it('preserves immutable material snapshot in loan_items across settings changes', () => {
      const db = getDb();
      const custId = 'CUST-TEST-SNAPSHOT';
      db.prepare(`
        INSERT OR IGNORE INTO customers (id, full_name, phone, aadhaar_last4, address, city, state, pincode, created_by, created_at, updated_at, is_deleted)
        VALUES (?, 'Snapshot Borrower', '9999900002', '5678', '456 Street', 'City', 'State', '110001', 'ADMIN', datetime('now'), datetime('now'), 0)
      `).run(custId);

      const todayStr = new Date().toISOString().split('T')[0];

      // Create loan with 16K Gold
      const loan = LoanService.createLoan(
        {
          customer_id: custId,
          loan_date: todayStr,
          start_date: todayStr,
          due_date: '2027-04-02',
          principal_paise: 4000000,
          interest_rate_percent: 2.0,
          interest_period: 'MONTHLY',
          interest_method: 'MONTHLY_SIMPLE',
          ltv_percent: 75,
          payment_mode: 'CASH',
          items: [
            {
              category: 'Bangle',
              description: '16K Gold Bangles',
              material: 'GOLD',
              material_type: '16K Gold',
              purity: '16K',
              purity_percent: 66.67,
              gross_weight_grams: 15,
              stone_weight_grams: 1,
              rate_per_gram_paise: 490000,
              allocated_loan_paise: 4000000,
            },
          ],
        },
        'USER-1',
        'ADMIN',
        'OWNER'
      );

      const fetchedLoan = LoanService.getLoanById(loan.id);
      const originalItem = fetchedLoan!.items![0];
      expect(originalItem.material_type).toBe('16K Gold');
      expect(originalItem.purity_percent).toBe(66.67);

      // Modify the 16K Gold material type in master settings
      const mat16k = MaterialTypeService.getMaterialTypes(false).find((m) => m.name === '16K Gold');
      if (mat16k) {
        MaterialTypeService.updateMaterialType(
          mat16k.id,
          {
            name: '16K Gold (Renamed Master)',
            rate_per_gram_paise: 550000,
          },
          'ADMIN'
        );
      }

      // Historical loan record remains completely untouched
      const reFetchedLoan = LoanService.getLoanById(loan.id);
      const itemAfterUpdate = reFetchedLoan!.items![0];
      expect(itemAfterUpdate.material_type).toBe('16K Gold');
      expect(itemAfterUpdate.purity_percent).toBe(66.67);
      expect(itemAfterUpdate.rate_per_gram_paise).toBe(490000);
    });
  });

  describe('CSV Import with Custom Categories and Material Types', () => {
    it('template includes custom_category, material_type, and purity_percentage', () => {
      const template = CSVImportService.generateTemplateCSV();
      expect(template).toContain('category');
      expect(template).toContain('custom_category');
      expect(template).toContain('material_type');
      expect(template).toContain('purity_percentage');
    });

    it('rejects CSV rows with Other Article but missing custom category', () => {
      const rows = [
        {
          customer_name: 'CSV Test Customer',
          customer_phone: '9876543210',
          loan_date: '2026-09-01',
          material: 'GOLD',
          category: 'Other Article',
          custom_category: '', // missing!
          gross_weight_grams: '10',
          rate_per_gram: '7000',
          loan_amount: '50000',
        },
      ];
      const mapping = CSVImportService.suggestMapping(Object.keys(rows[0]));
      const validation = CSVImportService.validateCSV(rows, mapping);

      expect(validation.errorRows).toBeGreaterThan(0);
      const catError = validation.errors.find((e) => e.field === 'custom_category');
      expect(catError).toBeDefined();
      expect(catError?.message).toBe('Please enter the custom article category.');
    });
  });
});
