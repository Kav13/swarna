import { getDb } from '../database/connection';
import { BusinessSettings } from '../types';
import { AuditService } from './auditService';

const DEFAULT_SETTINGS: BusinessSettings = {
  business_name: 'SwarnaRaksha Jewellers',
  tagline: 'Trusted Gold & Silver Loans Since 1995',
  address: '124, Bullion Bazaar, Main Road',
  city: 'Mumbai',
  state: 'Maharashtra',
  pincode: '400002',
  phone: '9876543210',
  email: 'info@swarnaraksha.com',
  gst_number: '27AAAAA0000A1Z5',
  registration_number: 'MH-MUM-JL-2026-987',
  receipt_header: 'PLEDGE LOAN MEMORANDUM & RECEIPT',
  receipt_footer: 'Thank you for your business. Please bring this receipt for settlement.',
  terms_conditions: '1. Pledged jewellery is held in secure insured vaults.\n2. Interest is calculated strictly as per agreed terms.\n3. Repayments will be credited against accrued interest first, then principal.\n4. Notice of 30 days will be served before auction in case of overdue default.',
  default_interest_rate_percent: 2.0, // 2% per month
  default_interest_method: 'MONTHLY_SIMPLE',
  default_interest_period: 'MONTHLY',
  default_ltv_percent: 75.0, // 75% LTV
  default_min_interest_days: 15,
  default_grace_period_days: 7,
  loan_prefix: 'LN',
  customer_prefix: 'CUST',
  receipt_prefix: 'RCP',
  auto_backup_enabled: true,
  backup_folder_path: '',
  inactivity_timeout_minutes: 15,
};

export class SettingService {
  /**
   * Retrieves all business settings with sensible defaults
   */
  static getSettings(): BusinessSettings {
    const db = getDb();
    const rows = db.prepare('SELECT key, value FROM business_settings').all() as { key: string; value: string }[];
    const settings: any = { ...DEFAULT_SETTINGS };

    for (const row of rows) {
      try {
        settings[row.key] = JSON.parse(row.value);
      } catch {
        settings[row.key] = row.value;
      }
    }

    return settings as BusinessSettings;
  }

  /**
   * Updates business settings and logs the audit event
   */
  static updateSettings(newSettings: Partial<BusinessSettings>, userId: string, username: string): BusinessSettings {
    const db = getDb();
    const current = this.getSettings();

    const insertOrUpdate = db.prepare(`
      INSERT INTO business_settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);

    const updateTx = db.transaction(() => {
      for (const [k, v] of Object.entries(newSettings)) {
        insertOrUpdate.run(k, JSON.stringify(v));
      }
    });

    updateTx();

    AuditService.log(
      userId,
      username,
      'UPDATE_SETTINGS',
      'SETTINGS',
      'BUSINESS_SETTINGS',
      current,
      newSettings,
      'Updated shop business settings'
    );

    return this.getSettings();
  }

  /**
   * Generates next sequential human-readable identifier (e.g. LN-2026-000001)
   */
  static generateNextId(type: 'LOAN' | 'CUSTOMER' | 'RECEIPT'): string {
    const db = getDb();
    const settings = this.getSettings();
    const currentYear = new Date().getFullYear();

    if (type === 'LOAN') {
      const prefix = settings.loan_prefix || 'LN';
      const yearPattern = `${prefix}-${currentYear}-%`;
      const row = db.prepare(`
        SELECT id FROM loans WHERE id LIKE ? ORDER BY id DESC LIMIT 1
      `).get(yearPattern) as { id: string } | undefined;

      let nextNum = 1;
      if (row && row.id) {
        const parts = row.id.split('-');
        const lastNum = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastNum)) nextNum = lastNum + 1;
      }
      return `${prefix}-${currentYear}-${String(nextNum).padStart(6, '0')}`;
    }

    if (type === 'CUSTOMER') {
      const prefix = settings.customer_prefix || 'CUST';
      const row = db.prepare(`
        SELECT id FROM customers WHERE id LIKE ? ORDER BY id DESC LIMIT 1
      `).get(`${prefix}-%`) as { id: string } | undefined;

      let nextNum = 1;
      if (row && row.id) {
        const parts = row.id.split('-');
        const lastNum = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastNum)) nextNum = lastNum + 1;
      }
      return `${prefix}-${String(nextNum).padStart(6, '0')}`;
    }

    if (type === 'RECEIPT') {
      const prefix = settings.receipt_prefix || 'RCP';
      const row = db.prepare(`
        SELECT receipt_no FROM payments WHERE receipt_no LIKE ? ORDER BY receipt_no DESC LIMIT 1
      `).get(`${prefix}-${currentYear}-%`) as { receipt_no: string } | undefined;

      let nextNum = 1;
      if (row && row.receipt_no) {
        const parts = row.receipt_no.split('-');
        const lastNum = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastNum)) nextNum = lastNum + 1;
      }
      return `${prefix}-${currentYear}-${String(nextNum).padStart(6, '0')}`;
    }

    return `${Date.now()}`;
  }
}
