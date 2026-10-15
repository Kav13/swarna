import { describe, it, expect, beforeEach } from 'vitest';
import {
  cleanLeadingZeros,
  formatIndianNumber,
  parseIndianNumber,
  formatWeight,
} from '../src/utils/currency';
import {
  DEFAULT_RECEIPT_CUSTOMIZATION,
  loadReceiptCustomization,
  saveReceiptCustomization,
  resetReceiptCustomization,
  ReceiptCustomization,
} from '../src/utils/receiptCustomization';
import { getReceiptPrintStyles } from '../src/utils/printStyles';
import {
  validateIndianPhone,
  validateAadhaar,
  formatAadhaarDisplay,
  maskAadhaar,
} from '../src/utils/formatters';

describe('Receipt Customization, Number Formatting & Quick Customer Tests', () => {
  describe('Indian Numbering System & Leading Zero Cleanup', () => {
    it('cleanLeadingZeros strips redundant leading zeros while preserving decimals and valid zero', () => {
      expect(cleanLeadingZeros('0200')).toBe('200');
      expect(cleanLeadingZeros('00200')).toBe('200');
      expect(cleanLeadingZeros('01000000')).toBe('1000000');
      expect(cleanLeadingZeros('00')).toBe('0');
      expect(cleanLeadingZeros('0')).toBe('0');
      expect(cleanLeadingZeros('0.5')).toBe('0.5');
      expect(cleanLeadingZeros('00.75')).toBe('0.75');
      expect(cleanLeadingZeros('100')).toBe('100');
      expect(cleanLeadingZeros('')).toBe('');
    });

    it('formatIndianNumber formats integers and decimals with Indian lakh/crore commas', () => {
      expect(formatIndianNumber(0)).toBe('0');
      expect(formatIndianNumber(500)).toBe('500');
      expect(formatIndianNumber(1000)).toBe('1,000');
      expect(formatIndianNumber(10000)).toBe('10,000');
      expect(formatIndianNumber(100000)).toBe('1,00,000'); // 1 Lakh
      expect(formatIndianNumber(1000000)).toBe('10,00,000'); // 10 Lakhs
      expect(formatIndianNumber(10000000)).toBe('1,00,00,000'); // 1 Crore
      expect(formatIndianNumber('1234567.50')).toBe('12,34,567.50');
      expect(formatIndianNumber('987654321')).toBe('98,76,54,321');
    });

    it('parseIndianNumber parses Indian comma-separated strings back to numerical floats', () => {
      expect(parseIndianNumber('1,00,000')).toBe(100000);
      expect(parseIndianNumber('1,00,00,000.50')).toBe(10000000.5);
      expect(parseIndianNumber('   2,500   ')).toBe(2500);
      expect(parseIndianNumber('')).toBeNull();
      expect(parseIndianNumber('invalid')).toBeNull();
    });

    it('ensures weights are formatted as decimals with 3 digits and not as currency', () => {
      expect(formatWeight(200)).toBe('200.000 g');
      expect(formatWeight(12.345)).toBe('12.345 g');
      expect(formatWeight(0)).toBe('0.000 g');
      // Weight strings must not contain currency symbols or lakh groupings
      expect(formatWeight(1000)).toBe('1000.000 g');
      expect(formatWeight(1000)).not.toContain('₹');
      expect(formatWeight(1000)).not.toContain('1,000');
    });
  });

  describe('Receipt Customization Checklist Logic', () => {
    let mockStore: Record<string, string> = {};

    beforeEach(() => {
      mockStore = {};
      (globalThis as any).localStorage = {
        getItem: (k: string) => mockStore[k] || null,
        setItem: (k: string, v: string) => {
          mockStore[k] = v;
        },
        removeItem: (k: string) => {
          delete mockStore[k];
        },
        clear: () => {
          mockStore = {};
        },
        key: () => null,
        length: 0,
      };
    });

    it('has receipt checklist items configured with proper defaults', () => {
      const config = DEFAULT_RECEIPT_CUSTOMIZATION;

      // Business Details
      expect(config.show_business_logo).toBe(true);
      expect(config.show_business_address).toBe(true);
      expect(config.show_business_phone).toBe(true);

      // Customer Details
      expect(config.show_customer_name_id).toBe(true);
      expect(config.show_customer_phone).toBe(true);
      expect(config.show_customer_address).toBe(true);
      expect(config.show_customer_aadhaar).toBe(true);

      // Loan Details
      expect(config.show_loan_id).toBe(true);
      expect(config.show_loan_date).toBe(true);
      expect(config.show_due_date).toBe(true);
      expect(config.show_interest_terms).toBe(true);

      // Jewellery Details
      expect(config.show_item_description).toBe(true);
      expect(config.show_custom_category).toBe(true);
      expect(config.show_material_purity).toBe(true);
      expect(config.show_gross_weight).toBe(true);
      expect(config.show_stone_weight).toBe(true);
      expect(config.show_net_weight).toBe(true);
      expect(config.show_valuation).toBe(true);

      // Financial Summary
      expect(config.show_principal_disbursed).toBe(true);
      expect(config.show_amount_in_words).toBe(true);
      expect(config.show_fees_charges).toBe(true);

      // Additional Information
      expect(config.show_terms_conditions).toBe(true);
      expect(config.show_customer_signature).toBe(true);
      expect(config.show_authorized_signature).toBe(true);
    });

    it('persists customized options and merges with defaults', () => {
      const custom: ReceiptCustomization = {
        ...DEFAULT_RECEIPT_CUSTOMIZATION,
        show_customer_aadhaar: false,
        show_fees_charges: false,
        show_business_phone: false,
      };

      saveReceiptCustomization(custom);

      const loaded = loadReceiptCustomization();
      expect(loaded.show_customer_aadhaar).toBe(false);
      expect(loaded.show_fees_charges).toBe(false);
      expect(loaded.show_business_phone).toBe(false);

      // Other fields should remain enabled
      expect(loaded.show_customer_phone).toBe(true);
      expect(loaded.show_net_weight).toBe(true);
    });

    it('resetReceiptCustomization restores all options to defaults', () => {
      const custom: ReceiptCustomization = {
        ...DEFAULT_RECEIPT_CUSTOMIZATION,
        show_terms_conditions: false,
      };
      saveReceiptCustomization(custom);

      const restored = resetReceiptCustomization();
      expect(restored.show_terms_conditions).toBe(true);

      const reloaded = loadReceiptCustomization();
      expect(reloaded.show_terms_conditions).toBe(true);
    });
  });

  describe('Receipt High-Fidelity Print Styling', () => {
    it('generates A4 page sizing, color preservation, and table integrity styles', () => {
      const styles = getReceiptPrintStyles();
      expect(styles).toContain('@page');
      expect(styles).toContain('size: A4 portrait');
      expect(styles).toContain('margin: 10mm 12mm');
      expect(styles).toContain('-webkit-print-color-adjust: exact');
      expect(styles).toContain('print-color-adjust: exact');
      expect(styles).toContain('page-break-inside: avoid');
      expect(styles).toContain('border-collapse: collapse');
    });
  });

  describe('Customer Validation & Formatting for Quick Creation', () => {
    it('validates 10-digit Indian mobile numbers correctly', () => {
      expect(validateIndianPhone('9876543210')).toBe(true);
      expect(validateIndianPhone('8123456789')).toBe(true);
      expect(validateIndianPhone('7000000000')).toBe(true);
      expect(validateIndianPhone('6123456789')).toBe(true);

      // Invalid mobile numbers
      expect(validateIndianPhone('5123456789')).toBe(false); // Starts with 5
      expect(validateIndianPhone('987654321')).toBe(false);  // 9 digits
      expect(validateIndianPhone('98765432100')).toBe(false); // 11 digits
      expect(validateIndianPhone('abcdefghij')).toBe(false);
    });

    it('validates 12-digit Aadhaar numbers and handles formatting', () => {
      expect(validateAadhaar('234567890123')).toBe(true);
      expect(validateAadhaar('987654321098')).toBe(true);
      expect(validateAadhaar('1234 5678 9012')).toBe(true);

      // Invalid Aadhaar numbers
      expect(validateAadhaar('12345678901')).toBe(false); // 11 digits
      expect(validateAadhaar('')).toBe(false);

      // Masking and display formatting
      expect(formatAadhaarDisplay('123456789012')).toBe('1234 5678 9012');
      expect(maskAadhaar('123456789012')).toBe('XXXX XXXX 9012');
      expect(maskAadhaar('9012')).toBe('XXXX XXXX 9012');
      expect(maskAadhaar('')).toBe('XXXX XXXX XXXX');
    });

    it('identifies duplicate phone numbers regardless of country code or whitespace', () => {
      const existingPhones = ['9876543210', '8888899999'];

      const normalizePhone = (phone: string) =>
        phone.replace(/[\s\-\(\)\+]/g, '').replace(/^91/, '').slice(-10);

      expect(existingPhones.includes(normalizePhone('+91 98765 43210'))).toBe(true);
      expect(existingPhones.includes(normalizePhone('98765-43210'))).toBe(true);
      expect(existingPhones.includes(normalizePhone('9999911111'))).toBe(false);
    });
  });
});
