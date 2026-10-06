import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getDb } from '../database/connection';
import { CryptoService } from './cryptoService';
import { BackupService } from './backupService';
import { AuditService } from './auditService';
import { ValuationService } from './valuationService';
import { CategoryService } from './categoryService';
import { MaterialTypeService } from './materialTypeService';
import {
  ImportBatch,
  CSVValidationError,
  CSVValidationResult,
  CSVImportResult,
} from '../types';

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}

export interface CSVParseResult {
  headers: string[];
  rows: Record<string, string>[];
  previewRows: Record<string, string>[];
}

export class CSVImportService {
  /**
   * Generates downloadable CSV template matching aggregated material schema
   */
  static generateTemplateCSV(): string {
    const headers = [
      'loan_id',
      'loan_date',
      'customer_name',
      'customer_phone',
      'customer_address',
      'customer_city',
      'aadhaar',
      'category',
      'custom_category',
      'material',
      'material_type',
      'purity_percentage',
      'karat',
      'fineness',
      'purity',
      'gross_weight_grams',
      'stone_weight_grams',
      'rate_per_gram',
      'loan_amount',
      'interest_rate_percent',
      'tenure_months',
      'disbursement_mode',
      'remarks',
    ];

    const sampleRows = [
      [
        'L-2023-001',
        '15-04-2023',
        'Rajesh Kumar',
        '9876543210',
        '123 Main Bazaar',
        'Mumbai',
        '123456789012',
        'Chain',
        '',
        'GOLD',
        '22K Gold',
        '91.67',
        '22K',
        '',
        '22K',
        '45.5',
        '1.5',
        '5800',
        '200000',
        '2.0',
        '6',
        'CASH',
        '2 Gold Chains, 4 Bangles',
      ],
      [
        'L-2023-001',
        '15-04-2023',
        'Rajesh Kumar',
        '9876543210',
        '123 Main Bazaar',
        'Mumbai',
        '123456789012',
        'Other Article',
        'Nose Pin',
        'GOLD',
        '16K Gold',
        '66.67',
        '16K',
        '',
        '16K',
        '12.5',
        '0.5',
        '4200',
        '30000',
        '2.0',
        '6',
        'CASH',
        '1 Gold Nose Pin',
      ],
      [
        'L-2023-001',
        '15-04-2023',
        'Rajesh Kumar',
        '9876543210',
        '123 Main Bazaar',
        'Mumbai',
        '123456789012',
        'Vessel',
        '',
        'SILVER',
        'Silver 925',
        '92.50',
        '',
        '925',
        '925',
        '250.0',
        '0.0',
        '75',
        '15000',
        '2.0',
        '6',
        'CASH',
        '1 Silver Plate, 2 Bowls (Same loan multi-material)',
      ],
      [
        'L-2023-002',
        '20-05-2023',
        'Sunita Devi',
        '9812345678',
        '45 Gandhi Road',
        'Delhi',
        '987654321098',
        'GOLD',
        '22K',
        '28.0',
        '0.5',
        '5850',
        '130000',
        '2.0',
        '12',
        'BANK_TRANSFER',
        '3 Gold Rings, 1 Pendant',
      ],
    ];

    const lines = [
      headers.join(','),
      ...sampleRows.map((row) =>
        row
          .map((val) => {
            if (val.includes(',') || val.includes('"') || val.includes('\n')) {
              return `"${val.replace(/"/g, '""')}"`;
            }
            return val;
          })
          .join(',')
      ),
    ];

    return lines.join('\r\n');
  }

  /**
   * RFC 4180 compliant CSV parser that handles quotes, line breaks, and trimming
   */
  static parseCSVText(csvContent: string): { headers: string[]; rows: Record<string, string>[] } {
    const rawLines: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let inQuotes = false;
    let i = 0;

    const text = csvContent.replace(/^\uFEFF/, ''); // strip BOM if present

    while (i < text.length) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (inQuotes) {
        if (char === '"') {
          if (nextChar === '"') {
            currentField += '"';
            i += 2;
            continue;
          } else {
            inQuotes = false;
            i++;
            continue;
          }
        } else {
          currentField += char;
          i++;
          continue;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
          i++;
          continue;
        } else if (char === ',') {
          currentRow.push(currentField.trim());
          currentField = '';
          i++;
          continue;
        } else if (char === '\r') {
          if (nextChar === '\n') {
            i++;
          }
          currentRow.push(currentField.trim());
          if (currentRow.some((f) => f.length > 0)) {
            rawLines.push(currentRow);
          }
          currentRow = [];
          currentField = '';
          i++;
          continue;
        } else if (char === '\n') {
          currentRow.push(currentField.trim());
          if (currentRow.some((f) => f.length > 0)) {
            rawLines.push(currentRow);
          }
          currentRow = [];
          currentField = '';
          i++;
          continue;
        } else {
          currentField += char;
          i++;
        }
      }
    }

    if (currentField.length > 0 || currentRow.length > 0) {
      currentRow.push(currentField.trim());
      if (currentRow.some((f) => f.length > 0)) {
        rawLines.push(currentRow);
      }
    }

    if (rawLines.length === 0) {
      return { headers: [], rows: [] };
    }

    const headers = rawLines[0].map((h) => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'));
    const rows: Record<string, string>[] = [];

    for (let r = 1; r < rawLines.length; r++) {
      const line = rawLines[r];
      const rowObj: Record<string, string> = {};
      for (let c = 0; c < headers.length; c++) {
        rowObj[headers[c]] = line[c] !== undefined ? line[c].trim() : '';
      }
      rows.push(rowObj);
    }

    return { headers, rows };
  }

  /**
   * Normalizes dates to YYYY-MM-DD supporting DD-MM-YYYY, DD/MM/YYYY, and YYYY-MM-DD
   */
  static normalizeDate(dateStr: string): string | null {
    if (!dateStr) return null;
    const clean = dateStr.trim();

    // Match DD-MM-YYYY or DD/MM/YYYY
    const dmy = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (dmy) {
      const day = dmy[1].padStart(2, '0');
      const month = dmy[2].padStart(2, '0');
      const year = dmy[3];
      const iso = `${year}-${month}-${day}`;
      const d = new Date(iso);
      if (!isNaN(d.getTime())) return iso;
    }

    // Match YYYY-MM-DD or YYYY/MM/DD
    const ymd = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (ymd) {
      const year = ymd[1];
      const month = ymd[2].padStart(2, '0');
      const day = ymd[3].padStart(2, '0');
      const iso = `${year}-${month}-${day}`;
      const d = new Date(iso);
      if (!isNaN(d.getTime())) return iso;
    }

    return null;
  }

  /**
   * Masks Aadhaar for display: XXXX XXXX 1234
   */
  static maskAadhaar(raw: string): string {
    const digits = (raw || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.length >= 4) {
      return `XXXX XXXX ${digits.slice(-4)}`;
    }
    return `XXXX ${digits}`;
  }

  /**
   * Generates initial column mapping guesses based on standard headers
   */
  static suggestMapping(headers: string[]): Record<string, string> {
    const mapping: Record<string, string> = {
      loan_id: '',
      loan_date: '',
      customer_name: '',
      customer_phone: '',
      customer_address: '',
      customer_city: '',
      aadhaar: '',
      category: '',
      custom_category: '',
      material: '',
      material_type: '',
      purity_percentage: '',
      karat: '',
      fineness: '',
      purity: '',
      gross_weight_grams: '',
      stone_weight_grams: '',
      rate_per_gram: '',
      loan_amount: '',
      interest_rate_percent: '',
      tenure_months: '',
      disbursement_mode: '',
      remarks: '',
    };

    const targetAliases: Record<string, string[]> = {
      loan_id: ['loan_id', 'loan_no', 'loan_number', 'loanno', 'id', 'ticket_no', 'account_no'],
      loan_date: ['loan_date', 'date', 'disbursement_date', 'start_date', 'booking_date'],
      customer_name: ['customer_name', 'name', 'borrower_name', 'client_name', 'party_name', 'full_name'],
      customer_phone: ['customer_phone', 'phone', 'mobile', 'contact', 'mobile_no', 'cell'],
      customer_address: ['customer_address', 'address', 'addr', 'residential_address'],
      customer_city: ['customer_city', 'city', 'town', 'village'],
      aadhaar: ['aadhaar', 'aadhar', 'aadhaar_number', 'id_number', 'uid'],
      category: ['category', 'item_category', 'article_category', 'article'],
      custom_category: ['custom_category', 'custom_article', 'other_category', 'sub_category'],
      material: ['material', 'metal', 'item_type', 'type'],
      material_type: ['material_type', 'metal_type', 'material_name'],
      purity_percentage: ['purity_percentage', 'purity_percent', 'purity_%', 'purity_pct', 'purity_val'],
      karat: ['karat', 'carat', 'kt', 'k'],
      fineness: ['fineness', 'hallmark_fineness'],
      purity: ['purity', 'karat', 'carat', 'kt', 'hallmark'],
      gross_weight_grams: ['gross_weight_grams', 'gross_weight', 'gross_wt', 'gross', 'weight', 'gwt'],
      stone_weight_grams: ['stone_weight_grams', 'stone_weight', 'stone_wt', 'deductions', 'stones', 'swt'],
      rate_per_gram: ['rate_per_gram', 'rate', 'gold_rate', 'metal_rate', 'price_per_gram'],
      loan_amount: ['loan_amount', 'principal', 'amount', 'sanctioned_amount', 'disbursed_amount'],
      interest_rate_percent: ['interest_rate_percent', 'interest_rate', 'roi', 'rate_of_interest', 'interest'],
      tenure_months: ['tenure_months', 'tenure', 'duration', 'months', 'period'],
      disbursement_mode: ['disbursement_mode', 'payment_mode', 'mode', 'payment_type'],
      remarks: ['remarks', 'description', 'ornaments', 'items', 'item_description', 'notes'],
    };

    for (const targetKey of Object.keys(targetAliases)) {
      const aliases = targetAliases[targetKey];
      for (const h of headers) {
        if (aliases.includes(h.toLowerCase())) {
          mapping[targetKey] = h;
          break;
        }
      }
    }

    return mapping;
  }

  /**
   * Validates parsed CSV rows against the column mapping and detects duplicates
   */
  static validateCSV(
    rows: Record<string, string>[],
    mapping: Record<string, string>,
    options: { duplicateAction?: 'SKIP' | 'IMPORT_AS_NEW' } = {}
  ): CSVValidationResult {
    const db = getDb();
    const errors: CSVValidationError[] = [];
    const today = new Date().toISOString().split('T')[0];

    const getVal = (row: Record<string, string>, targetField: string): string => {
      const mappedCol = mapping[targetField];
      return mappedCol && row[mappedCol] !== undefined ? row[mappedCol].trim() : '';
    };

    const uniqueLoans = new Set<string>();
    const uniqueCustomers = new Set<string>();
    let duplicateLoansCount = 0;
    let validRowsCount = 0;
    let warningRowsCount = 0;
    let errorRowsCount = 0;

    // Cache existing loan ids from DB
    const existingLoans = new Set<string>();
    const existingLoanRows = db.prepare('SELECT id FROM loans').all() as any[];
    for (const r of existingLoanRows) {
      existingLoans.add(r.id.toUpperCase());
    }

    // Cache customer lookups
    const findCustomerByPhone = db.prepare('SELECT id, full_name FROM customers WHERE phone = ?');

    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx];
      const rowNum = idx + 2; // +1 for 0-index, +1 for header line
      let rowHasError = false;

      const customerName = getVal(row, 'customer_name');
      const customerPhone = getVal(row, 'customer_phone').replace(/\D/g, '');
      const rawDate = getVal(row, 'loan_date');
      const material = (getVal(row, 'material') || 'GOLD').toUpperCase();
      const purity = getVal(row, 'purity').toUpperCase();
      const grossStr = getVal(row, 'gross_weight_grams');
      const stoneStr = getVal(row, 'stone_weight_grams') || '0';
      const rateStr = getVal(row, 'rate_per_gram');
      const loanStr = getVal(row, 'loan_amount');
      const loanId = getVal(row, 'loan_id').toUpperCase();

      // 1. Customer Name & Phone
      if (!customerName) {
        errors.push({
          row: rowNum,
          field: 'customer_name',
          message: 'Customer name is required',
          value: customerName,
        });
        rowHasError = true;
      }

      if (!customerPhone || customerPhone.length !== 10) {
        errors.push({
          row: rowNum,
          field: 'customer_phone',
          message: 'Valid 10-digit phone number is required',
          value: getVal(row, 'customer_phone'),
        });
        rowHasError = true;
      } else {
        uniqueCustomers.add(customerPhone);
      }

      // 2. Date
      const normalizedDate = this.normalizeDate(rawDate);
      if (!normalizedDate) {
        errors.push({
          row: rowNum,
          field: 'loan_date',
          message: 'Invalid date format. Use DD-MM-YYYY or YYYY-MM-DD',
          value: rawDate,
        });
        rowHasError = true;
      } else if (normalizedDate > today) {
        errors.push({
          row: rowNum,
          field: 'loan_date',
          message: 'Historical loan date cannot be in the future',
          value: rawDate,
        });
        rowHasError = true;
      }

      // 3. Material & Purity
      if (material !== 'GOLD' && material !== 'SILVER') {
        errors.push({
          row: rowNum,
          field: 'material',
          message: 'Material must be GOLD or SILVER',
          value: material,
        });
        rowHasError = true;
      }

      // Category & Custom Category validation
      const rawCategory = getVal(row, 'category');
      const rawCustomCategory = getVal(row, 'custom_category');
      if (
        (rawCategory.toLowerCase() === 'other article' || rawCategory.toLowerCase() === 'other') &&
        !rawCustomCategory
      ) {
        errors.push({
          row: rowNum,
          field: 'custom_category',
          message: 'Please enter the custom article category.',
          value: rawCustomCategory,
        });
        rowHasError = true;
      }

      // Purity Percentage validation (if provided)
      const purityPctVal = getVal(row, 'purity_percentage');
      if (purityPctVal) {
        const pct = parseFloat(purityPctVal);
        if (isNaN(pct) || pct <= 0 || pct > 100) {
          errors.push({
            row: rowNum,
            field: 'purity_percentage',
            message: 'Purity percentage must be between 0 and 100',
            value: purityPctVal,
          });
          rowHasError = true;
        }
      }

      // 4. Weights
      const gross = parseFloat(grossStr);
      const stone = parseFloat(stoneStr) || 0;

      if (isNaN(gross) || gross <= 0) {
        errors.push({
          row: rowNum,
          field: 'gross_weight_grams',
          message: 'Gross weight must be a positive number',
          value: grossStr,
        });
        rowHasError = true;
      }

      if (stone < 0) {
        errors.push({
          row: rowNum,
          field: 'stone_weight_grams',
          message: 'Stone weight cannot be negative',
          value: stoneStr,
        });
        rowHasError = true;
      }

      if (gross > 0 && stone >= gross) {
        errors.push({
          row: rowNum,
          field: 'stone_weight_grams',
          message: 'Stone deductions cannot equal or exceed gross weight',
          value: stoneStr,
        });
        rowHasError = true;
      }

      // 5. Rate & Loan Amount
      const rate = parseFloat(rateStr);
      if (isNaN(rate) || rate <= 0) {
        errors.push({
          row: rowNum,
          field: 'rate_per_gram',
          message: 'Rate per gram must be a positive number',
          value: rateStr,
        });
        rowHasError = true;
      }

      const loanAmt = parseFloat(loanStr);
      if (isNaN(loanAmt) || loanAmt <= 0) {
        errors.push({
          row: rowNum,
          field: 'loan_amount',
          message: 'Loan amount must be a positive number',
          value: loanStr,
        });
        rowHasError = true;
      }

      // 6. Grouping and Duplicate check
      const groupKey = loanId ? loanId : `${customerPhone}_${normalizedDate}`;
      uniqueLoans.add(groupKey);

      if (loanId && existingLoans.has(loanId)) {
        duplicateLoansCount++;
      } else if (normalizedDate && customerPhone && loanAmt > 0) {
        // Check for existing loan by customer phone + date + amount
        const custMatch = findCustomerByPhone.get(customerPhone) as any;
        if (custMatch) {
          const amtPaise = Math.round(loanAmt * 100);
          const existingMatch = db
            .prepare(
              'SELECT id FROM loans WHERE customer_id = ? AND loan_date = ? AND principal_paise = ?'
            )
            .get(custMatch.id, normalizedDate, amtPaise) as any;
          if (existingMatch) {
            duplicateLoansCount++;
          }
        }
      }

      if (rowHasError) {
        errorRowsCount++;
      } else {
        validRowsCount++;
      }
    }

    return {
      totalRows: rows.length,
      validRows: validRowsCount,
      warningRows: warningRowsCount,
      errorRows: errorRowsCount,
      errors,
      uniqueLoansCount: uniqueLoans.size,
      uniqueCustomersCount: uniqueCustomers.size,
      duplicateLoansCount,
    };
  }

  /**
   * Executes historical loans CSV import atomically with pre-import backup and rollback safety
   */
  static async executeImport(
    rows: Record<string, string>[],
    mapping: Record<string, string>,
    options: {
      fileName: string;
      duplicateAction: 'SKIP' | 'IMPORT_AS_NEW';
    },
    userId: string,
    username: string
  ): Promise<CSVImportResult> {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();
    const year = new Date().getFullYear();

    // 1. Mandatory Pre-Import Database Backup
    const backupResult = await BackupService.createBackup(undefined, 'MANUAL', userId, username);
    const preBackupPath = backupResult.backupPath;

    // 2. Validate all rows first; block if any structural/format errors exist
    const validation = this.validateCSV(rows, mapping, options);
    if (validation.errorRows > 0) {
      throw new Error(
        `Import stopped: CSV contains ${validation.errorRows} invalid row(s). Please fix the errors before importing.`
      );
    }

    const batchId = `IMP-${year}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    const getVal = (row: Record<string, string>, targetField: string): string => {
      const mappedCol = mapping[targetField];
      return mappedCol && row[mappedCol] !== undefined ? row[mappedCol].trim() : '';
    };

    // 3. Group rows into consolidated loans (by loan_id or customer_phone + loan_date)
    interface MaterialRowItem {
      category: string;
      custom_category?: string;
      material: 'GOLD' | 'SILVER';
      material_type?: string;
      purity_percent?: number;
      purity: string;
      gross_weight: number;
      stone_weight: number;
      rate_per_gram: number;
      allocated_loan: number;
      remarks?: string;
    }

    interface LoanGroup {
      externalLoanId?: string;
      loanDate: string;
      customerName: string;
      customerPhone: string;
      customerAddress: string;
      customerCity: string;
      aadhaar: string;
      interestRatePercent: number;
      tenureMonths: number;
      disbursementMode: 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE';
      items: MaterialRowItem[];
    }

    const groups = new Map<string, LoanGroup>();

    for (const row of rows) {
      const loanId = getVal(row, 'loan_id').toUpperCase();
      const customerPhone = getVal(row, 'customer_phone').replace(/\D/g, '');
      const rawDate = getVal(row, 'loan_date');
      const loanDate = this.normalizeDate(rawDate) || today;
      const groupKey = loanId ? loanId : `${customerPhone}_${loanDate}`;

      const material = (getVal(row, 'material') || 'GOLD').toUpperCase() === 'SILVER' ? 'SILVER' : 'GOLD';
      const purity = getVal(row, 'purity').toUpperCase() || (material === 'GOLD' ? '22K' : '925');
      const gross = parseFloat(getVal(row, 'gross_weight_grams')) || 0;
      const stone = parseFloat(getVal(row, 'stone_weight_grams')) || 0;
      const rate = parseFloat(getVal(row, 'rate_per_gram')) || 0;
      const loanAmt = parseFloat(getVal(row, 'loan_amount')) || 0;
      const interestRate = parseFloat(getVal(row, 'interest_rate_percent')) || 2.0;
      const tenure = parseInt(getVal(row, 'tenure_months'), 10) || 6;
      const modeRaw = getVal(row, 'disbursement_mode').toUpperCase();
      const mode = ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE'].includes(modeRaw)
        ? (modeRaw as any)
        : 'CASH';

      const rawCategory = getVal(row, 'category');
      const rawCustomCategory = getVal(row, 'custom_category');
      const isOther = rawCategory.toLowerCase() === 'other article' || rawCategory.toLowerCase() === 'other';
      const category = isOther
        ? 'Other Article'
        : (rawCategory || (material === 'GOLD' ? 'Gold Ornaments (Imported)' : 'Silver Articles (Imported)'));
      const customCategory = rawCustomCategory.trim() ? rawCustomCategory.trim() : undefined;

      // Register custom category if provided
      if (customCategory) {
        try {
          CategoryService.getOrCreate(customCategory, username);
        } catch {
          // ignore duplicate or non-fatal registration issues
        }
      }

      let materialType = getVal(row, 'material_type');
      let purityPercent: number | undefined = undefined;
      const purityPctStr = getVal(row, 'purity_percentage');
      if (purityPctStr && !isNaN(parseFloat(purityPctStr))) {
        purityPercent = parseFloat(purityPctStr);
      }

      const karatStr = getVal(row, 'karat');
      const finenessStr = getVal(row, 'fineness');

      if (purityPercent === undefined) {
        if (material === 'GOLD') {
          if (karatStr && !isNaN(parseFloat(karatStr))) {
            purityPercent = Math.round((parseFloat(karatStr) / 24) * 10000) / 100;
          } else if (purity.includes('24')) {
            purityPercent = 100.0;
          } else if (purity.includes('22')) {
            purityPercent = 91.67;
          } else if (purity.includes('20')) {
            purityPercent = 83.33;
          } else if (purity.includes('18')) {
            purityPercent = 75.0;
          } else if (purity.includes('16')) {
            purityPercent = 66.67;
          } else if (purity.includes('14')) {
            purityPercent = 58.33;
          } else {
            purityPercent = 91.67;
          }
        } else {
          // SILVER
          if (finenessStr && !isNaN(parseFloat(finenessStr))) {
            purityPercent = Math.round((parseFloat(finenessStr) / 10) * 100) / 100;
          } else if (purity.includes('999')) {
            purityPercent = 99.9;
          } else if (purity.includes('925')) {
            purityPercent = 92.5;
          } else if (purity.includes('900')) {
            purityPercent = 90.0;
          } else if (purity.includes('800')) {
            purityPercent = 80.0;
          } else if (purity.includes('700')) {
            purityPercent = 70.0;
          } else if (purity.includes('600')) {
            purityPercent = 60.0;
          } else {
            purityPercent = 92.5;
          }
        }
      }

      if (!materialType) {
        if (material === 'GOLD') {
          if (karatStr) {
            materialType = `${karatStr}K Gold`;
          } else if (purity) {
            materialType = purity.includes('K') ? `${purity} Gold` : `${purity}K Gold`;
          } else {
            materialType = '22K Gold';
          }
        } else {
          if (finenessStr) {
            materialType = `Silver ${finenessStr}`;
          } else if (purity) {
            materialType = purity.toLowerCase().includes('silver') ? purity : `Silver ${purity}`;
          } else {
            materialType = 'Silver 925';
          }
        }
      }

      const item: MaterialRowItem = {
        category,
        custom_category: customCategory,
        material,
        material_type: materialType,
        purity_percent: purityPercent,
        purity,
        gross_weight: gross,
        stone_weight: stone,
        rate_per_gram: rate,
        allocated_loan: loanAmt,
        remarks: getVal(row, 'remarks') || undefined,
      };

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          externalLoanId: loanId || undefined,
          loanDate,
          customerName: getVal(row, 'customer_name'),
          customerPhone,
          customerAddress: getVal(row, 'customer_address') || 'Imported Address',
          customerCity: getVal(row, 'customer_city') || 'Local',
          aadhaar: getVal(row, 'aadhaar').replace(/\D/g, ''),
          interestRatePercent: interestRate,
          tenureMonths: tenure,
          disbursementMode: mode,
          items: [item],
        });
      } else {
        groups.get(groupKey)!.items.push(item);
      }
    }

    let importedLoansCount = 0;
    let importedCustomersCount = 0;
    let skippedDuplicatesCount = 0;

    // Prepared statements for high performance execution inside transaction
    const selectCustByPhone = db.prepare('SELECT id FROM customers WHERE phone = ?');
    const insertCustStmt = db.prepare(`
      INSERT INTO customers (
        id, full_name, phone, alternate_phone,
        aadhaar_encrypted, aadhaar_iv, aadhaar_tag, aadhaar_last4,
        address, city, state, pincode, remarks,
        created_by, created_at, updated_at, is_deleted
      ) VALUES (?, ?, ?, null, ?, ?, ?, ?, ?, ?, 'Imported', '000000', 'Imported historical record', ?, ?, ?, 0)
    `);

    const selectLoanById = db.prepare('SELECT id FROM loans WHERE id = ?');
    const selectLoanByCustAndDetails = db.prepare(
      'SELECT id FROM loans WHERE customer_id = ? AND loan_date = ? AND principal_paise = ?'
    );

    const insertLoanStmt = db.prepare(`
      INSERT INTO loans (
        id, customer_id, loan_date, start_date, due_date,
        principal_paise, interest_rate_percent, interest_period, interest_method,
        min_interest_days, grace_period_days, processing_fee_paise, other_charges_paise,
        principal_outstanding_paise, interest_outstanding_paise,
        status, ltv_percent, total_valuation_paise, is_override, override_reason,
        backdate_reason, import_batch_id,
        remarks, created_by, created_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, 'MONTHLY', 'MONTHLY_SIMPLE',
        15, 7, 0, 0,
        ?, 0,
        'ACTIVE', 75.0, ?, 0, null,
        'Imported from historical CSV batch', ?,
        'Historical Loan (Batch Import)', ?, ?
      )
    `);

    const insertItemStmt = db.prepare(`
      INSERT INTO loan_items (
        id, loan_id, category, custom_category, description, material, material_type, purity, purity_percent,
        gross_weight_grams, stone_weight_grams, net_weight_grams,
        rate_per_gram_paise, valuation_paise, max_loan_paise, allocated_loan_paise,
        condition, status, remarks, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'GOOD', 'PLEDGED', ?, ?)
    `);

    const insertTxStmt = db.prepare(`
      INSERT INTO loan_transactions (
        id, loan_id, transaction_date, type, debit_paise, credit_paise,
        principal_balance_paise, interest_balance_paise, payment_mode, reference_no,
        description, created_by, is_reversal, created_at
      ) VALUES (?, ?, ?, 'DISBURSEMENT', ?, 0, ?, 0, ?, 'CSV-IMPORT', 'Historical disbursement (Batch Import)', ?, 0, ?)
    `);

    // 4. Atomic Database Transaction
    const importTx = db.transaction(() => {
      for (const [, group] of groups) {
        // Customer resolution / creation
        let customerId: string;
        const existingCust = selectCustByPhone.get(group.customerPhone) as any;

        if (existingCust) {
          customerId = existingCust.id;
        } else {
          customerId = `CUST-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
          let encAadhaar = null;
          let iv = null;
          let tag = null;
          let last4 = '0000';

          if (group.aadhaar) {
            const enc = CryptoService.encryptAadhaar(group.aadhaar);
            encAadhaar = enc.encrypted;
            iv = enc.iv;
            tag = enc.tag;
            last4 = group.aadhaar.slice(-4);
          }

          insertCustStmt.run(
            customerId,
            group.customerName,
            group.customerPhone,
            encAadhaar,
            iv,
            tag,
            last4,
            group.customerAddress,
            group.customerCity,
            username,
            now,
            now
          );
          importedCustomersCount++;
        }

        // Consolidated financial calculation across all material items
        let consolidatedPrincipalPaise = 0;
        let consolidatedValuationPaise = 0;

        for (const item of group.items) {
          const net = Math.max(0, item.gross_weight - item.stone_weight);
          const ratePaise = Math.round(item.rate_per_gram * 100);
          const valPaise = Math.round(net * ratePaise);
          consolidatedValuationPaise += valPaise;
          consolidatedPrincipalPaise += Math.round(item.allocated_loan * 100);
        }

        // Duplicate checking
        let targetLoanId = group.externalLoanId;
        let isDuplicate = false;

        if (targetLoanId) {
          const match = selectLoanById.get(targetLoanId) as any;
          if (match) isDuplicate = true;
        } else {
          const match = selectLoanByCustAndDetails.get(
            customerId,
            group.loanDate,
            consolidatedPrincipalPaise
          ) as any;
          if (match) isDuplicate = true;
        }

        if (isDuplicate) {
          if (options.duplicateAction === 'SKIP') {
            skippedDuplicatesCount++;
            continue;
          } else {
            // Generate a fresh unique ID
            targetLoanId = `LN-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
          }
        } else if (!targetLoanId) {
          targetLoanId = `LN-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        }

        const dueDate = addMonths(group.loanDate, group.tenureMonths || 6);

        // Insert Loan record
        insertLoanStmt.run(
          targetLoanId,
          customerId,
          group.loanDate,
          group.loanDate, // start_date aligns with loan_date
          dueDate,
          consolidatedPrincipalPaise,
          group.interestRatePercent,
          consolidatedPrincipalPaise,
          consolidatedValuationPaise,
          batchId,
          username,
          now
        );

        // Insert Aggregated Material Items
        for (let itmIdx = 0; itmIdx < group.items.length; itmIdx++) {
          const item = group.items[itmIdx];
          const itemId = `${targetLoanId}-ITM-${itmIdx + 1}`;
          const net = Math.max(0, item.gross_weight - item.stone_weight);
          const ratePaise = Math.round(item.rate_per_gram * 100);
          const valPaise = Math.round(net * ratePaise);
          const maxLoanPaise = Math.round(valPaise * 0.75);
          const allocPaise = Math.round(item.allocated_loan * 100);

          const itemDesc = item.category === 'Other Article' && item.custom_category
            ? `Other Article — ${item.custom_category} (${item.material_type || item.material})`
            : `Historical ${item.purity} ${item.material} - ${item.remarks || 'Pledged collateral'}`;

          insertItemStmt.run(
            itemId,
            targetLoanId,
            item.category,
            item.custom_category || null,
            itemDesc,
            item.material,
            item.material_type || null,
            item.purity,
            item.purity_percent !== undefined ? item.purity_percent : null,
            item.gross_weight,
            item.stone_weight,
            net,
            ratePaise,
            valPaise,
            maxLoanPaise,
            allocPaise,
            item.remarks || null,
            now
          );
        }

        // Insert Historical Disbursement Ledger Transaction
        const txId = `TX-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
        insertTxStmt.run(
          txId,
          targetLoanId,
          group.loanDate,
          consolidatedPrincipalPaise,
          consolidatedPrincipalPaise,
          group.disbursementMode,
          username,
          now
        );

        importedLoansCount++;
      }

      // Record Import Batch
      db.prepare(`
        INSERT INTO import_batches (
          id, file_name, total_rows, successful_loans, skipped_records,
          error_count, pre_backup_path, imported_by, created_at, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED')
      `).run(
        batchId,
        options.fileName,
        rows.length,
        importedLoansCount,
        skippedDuplicatesCount,
        0,
        preBackupPath,
        username,
        now
      );
    });

    importTx();

    AuditService.log(
      userId,
      username,
      'IMPORT_HISTORICAL_LOANS',
      'LOANS',
      batchId,
      undefined,
      {
        batchId,
        file: options.fileName,
        loansImported: importedLoansCount,
        customersImported: importedCustomersCount,
        skipped: skippedDuplicatesCount,
      },
      `Imported historical batch ${batchId}: ${importedLoansCount} loans booked, ${importedCustomersCount} customers created`
    );

    return {
      success: true,
      batchId,
      totalRows: rows.length,
      importedLoansCount,
      importedCustomersCount,
      skippedDuplicatesCount,
      errorCount: 0,
      preBackupPath,
    };
  }

  /**
   * Generates downloadable Error Report CSV for failed validations
   */
  static generateErrorCSV(errors: CSVValidationError[]): string {
    const headers = ['Row Number', 'Field', 'Error Description', 'Original Value'];
    const lines = [
      headers.join(','),
      ...errors.map((e) =>
        [
          e.row,
          `"${e.field.replace(/"/g, '""')}"`,
          `"${e.message.replace(/"/g, '""')}"`,
          `"${(e.value || '').replace(/"/g, '""')}"`,
        ].join(',')
      ),
    ];
    return lines.join('\r\n');
  }

  /**
   * Retrieves previous import batches
   */
  static getImportHistory(): ImportBatch[] {
    const db = getDb();
    const rows = db
      .prepare('SELECT * FROM import_batches ORDER BY created_at DESC')
      .all() as any[];

    return rows.map((r) => ({
      id: r.id,
      file_name: r.file_name,
      total_rows: r.total_rows,
      successful_loans: r.successful_loans,
      skipped_records: r.skipped_records,
      error_count: r.error_count,
      pre_backup_path: r.pre_backup_path || undefined,
      imported_by: r.imported_by,
      created_at: r.created_at,
      status: r.status,
    }));
  }
}
