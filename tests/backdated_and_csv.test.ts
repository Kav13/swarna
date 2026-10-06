import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { CustomerService } from '../electron/services/customerService';
import { LoanService } from '../electron/services/loanService';
import { AuthService } from '../electron/services/authService';
import { InterestService } from '../electron/services/interestService';
import { CSVImportService } from '../electron/services/csvImportService';
import { CryptoService } from '../electron/services/cryptoService';
import { initDatabase, closeDatabase, getDb } from '../electron/database/connection';

describe('Backdated Loans & Offline CSV Import Engine', () => {
  const testDbPath = path.join(process.cwd(), 'data', 'test_backdated_csv.sqlite');
  let db: any;

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch {}
    }
    initDatabase(testDbPath);
    db = getDb();

    // Create an initial Owner and an Executive
    AuthService.createFirstOwner({
      username: 'owner',
      password: 'password123',
      full_name: 'Shop Owner',
    });

    AuthService.createUser(
      {
        username: 'executive',
        password: 'password123',
        full_name: 'Shop Executive',
        role: 'EXECUTIVE',
      },
      'admin',
      'owner'
    );
  });

  afterEach(() => {
    closeDatabase();
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch {}
    }
  });

  describe('CHANGE 2: Backdated Loans Engine', () => {
    it('creates backdated loan storing both distinct business date and creation timestamp', () => {
      // 1. Create Customer
      const customer = CustomerService.createCustomer(
        {
          full_name: 'Ramesh Patel',
          phone: '9876543210',
          address: '45 Jewellers Lane',
          city: 'Ahmedabad',
          state: 'Gujarat',
          pincode: '380001',
        },
        'usr-owner',
        'owner'
      );

      const pastDate = '2026-01-15';
      const backdateReason = 'Migration of physical loan book from January 2026';

      // 2. Create Loan with backdated date
      const loan = LoanService.createLoan(
        {
          customer_id: customer.id,
          loan_date: pastDate,
          start_date: pastDate,
          due_date: '2026-07-15',
          principal_paise: 5000000, // ₹50,000
          interest_rate_percent: 2.0,
          interest_period: 'MONTHLY',
          interest_method: 'MONTHLY_SIMPLE',
          min_interest_days: 15,
          grace_period_days: 7,
          ltv_percent: 75.0,
          payment_mode: 'CASH',
          backdate_reason: backdateReason,
          items: [
            {
              category: 'Ring',
              description: '22K Gold Ring',
              material: 'GOLD',
              purity: '22K',
              gross_weight_grams: 12.0,
              stone_weight_grams: 0.5,
              rate_per_gram_paise: 650000,
              allocated_loan_paise: 5000000,
            },
          ],
        },
        'usr-owner',
        'owner',
        'OWNER'
      );

      // Verify business date vs created timestamp
      expect(loan.loan_date).toBe(pastDate);
      expect(loan.start_date).toBe(pastDate);
      expect(loan.backdate_reason).toBe(backdateReason);
      expect(loan.created_at).toBeDefined();

      // Ensure created_at contains today's year
      expect(loan.created_at).toContain(new Date().getFullYear().toString());

      // Verify Ledger disbursement transaction recorded on past business date
      const ledgerTx = db
        .prepare("SELECT * FROM loan_transactions WHERE loan_id = ? AND type = 'DISBURSEMENT'")
        .get(loan.id) as any;
      expect(ledgerTx).toBeDefined();
      expect(ledgerTx.transaction_date).toBe(pastDate);
      expect(ledgerTx.debit_paise).toBe(5000000);

      // Verify interest accrued accurately from past date
      const asOfDate = '2026-03-15'; // 59 days elapsed
      const interestCalc = InterestService.calculateAccruedInterest(loan, asOfDate);
      expect(interestCalc.elapsed_days).toBe(59);
      expect(interestCalc.interest_accrued_paise).toBeGreaterThan(0);
    });

    it('rejects future loan dates', () => {
      const customer = CustomerService.createCustomer(
        {
          full_name: 'Test Customer',
          phone: '9876543211',
          address: 'Test Addr',
          city: 'Surat',
          state: 'Gujarat',
          pincode: '395001',
        },
        'usr-owner',
        'owner'
      );

      const futureDate = '2099-01-01';

      expect(() => {
        LoanService.createLoan(
          {
            customer_id: customer.id,
            loan_date: futureDate,
            start_date: futureDate,
            due_date: '2099-07-01',
            principal_paise: 1000000,
            interest_rate_percent: 2.0,
            interest_period: 'MONTHLY',
            interest_method: 'MONTHLY_SIMPLE',
            ltv_percent: 75.0,
            payment_mode: 'CASH',
            items: [
              {
                category: 'Gold',
                description: 'Gold',
                material: 'GOLD',
                purity: '22K',
                gross_weight_grams: 5.0,
                stone_weight_grams: 0,
                rate_per_gram_paise: 650000,
                allocated_loan_paise: 1000000,
              },
            ],
          },
          'usr-owner',
          'owner',
          'OWNER'
        );
      }).toThrow(/future/i);
    });

    it('enforces RBAC: Executive cannot backdate unless CREATE_BACKDATED_LOAN is granted', () => {
      const customer = CustomerService.createCustomer(
        {
          full_name: 'Test Customer 2',
          phone: '9876543212',
          address: 'Test Addr',
          city: 'Surat',
          state: 'Gujarat',
          pincode: '395001',
        },
        'usr-owner',
        'owner'
      );

      const execUser = db.prepare("SELECT id FROM users WHERE username = 'executive'").get() as any;

      // 1. Without permission -> Throws
      expect(() => {
        LoanService.createLoan(
          {
            customer_id: customer.id,
            loan_date: '2026-01-10',
            start_date: '2026-01-10',
            due_date: '2026-07-10',
            principal_paise: 1000000,
            interest_rate_percent: 2.0,
            interest_period: 'MONTHLY',
            interest_method: 'MONTHLY_SIMPLE',
            ltv_percent: 75.0,
            payment_mode: 'CASH',
            backdate_reason: 'Executive attempt without permission',
            items: [
              {
                category: 'Gold',
                description: 'Gold',
                material: 'GOLD',
                purity: '22K',
                gross_weight_grams: 5.0,
                stone_weight_grams: 0,
                rate_per_gram_paise: 650000,
                allocated_loan_paise: 1000000,
              },
            ],
          },
          execUser.id,
          'executive',
          'EXECUTIVE'
        );
      }).toThrow(/permission/i);

      // 2. Grant CREATE_BACKDATED_LOAN to executive
      AuthService.setUserPermission(execUser.id, 'CREATE_BACKDATED_LOAN', true);

      // 3. Now executive can backdate successfully
      const loan = LoanService.createLoan(
        {
          customer_id: customer.id,
          loan_date: '2026-01-10',
          start_date: '2026-01-10',
          due_date: '2026-07-10',
          principal_paise: 1000000,
          interest_rate_percent: 2.0,
          interest_period: 'MONTHLY',
          interest_method: 'MONTHLY_SIMPLE',
          ltv_percent: 75.0,
          payment_mode: 'CASH',
          backdate_reason: 'Authorized executive backdating',
          items: [
            {
              category: 'Gold',
              description: 'Gold',
              material: 'GOLD',
              purity: '22K',
              gross_weight_grams: 5.0,
              stone_weight_grams: 0,
              rate_per_gram_paise: 650000,
              allocated_loan_paise: 1000000,
            },
          ],
        },
        execUser.id,
        'executive',
        'EXECUTIVE'
      );

      expect(loan.id).toBeDefined();
      expect(loan.loan_date).toBe('2026-01-10');
    });
  });

  describe('CHANGE 3: Offline Historical Loans CSV Import Engine', () => {
    it('generates compliant template matching aggregated material schema', () => {
      const template = CSVImportService.generateTemplateCSV();
      expect(template).toContain('loan_id,loan_date,customer_name,customer_phone');
      expect(template).toContain('GOLD');
      expect(template).toContain('SILVER');
    });

    it('parses CSV respecting quotes, commas, and line endings', () => {
      const csv = `loan_id,customer_name,remarks\r\nL-101,"Patel, Ramesh","2 Bangles, 1 Chain"\r\nL-102,"Sunita Devi","Gold Ring"`;
      const parsed = CSVImportService.parseCSVText(csv);

      expect(parsed.headers).toEqual(['loan_id', 'customer_name', 'remarks']);
      expect(parsed.rows.length).toBe(2);
      expect(parsed.rows[0].customer_name).toBe('Patel, Ramesh');
      expect(parsed.rows[0].remarks).toBe('2 Bangles, 1 Chain');
      expect(parsed.rows[1].customer_name).toBe('Sunita Devi');
    });

    it('normalizes dates in DD-MM-YYYY and YYYY-MM-DD formats', () => {
      expect(CSVImportService.normalizeDate('15-04-2023')).toBe('2023-04-15');
      expect(CSVImportService.normalizeDate('15/04/2023')).toBe('2023-04-15');
      expect(CSVImportService.normalizeDate('2023-04-15')).toBe('2023-04-15');
      expect(CSVImportService.normalizeDate('invalid')).toBeNull();
    });

    it('masks Aadhaar for privacy in preview', () => {
      expect(CSVImportService.maskAadhaar('123456789012')).toBe('XXXX XXXX 9012');
      expect(CSVImportService.maskAadhaar('')).toBe('');
    });

    it('validates CSV rows and catches weight and formatting errors', () => {
      const rows = [
        {
          loan_id: 'L-1',
          loan_date: '15-04-2023',
          customer_name: 'Rajesh',
          customer_phone: '9876543210',
          material: 'GOLD',
          purity: '22K',
          gross_weight_grams: '10',
          stone_weight_grams: '12', // Error: Stone >= gross
          rate_per_gram: '6000',
          loan_amount: '40000',
        },
        {
          loan_id: 'L-2',
          loan_date: '31-02-2023', // Error: Invalid date
          customer_name: 'Kavya',
          customer_phone: '99999', // Error: Not 10 digits
          material: 'PLATINUM', // Error: Must be GOLD or SILVER
          purity: '950',
          gross_weight_grams: '-5', // Error: Negative weight
          stone_weight_grams: '0',
          rate_per_gram: '5000',
          loan_amount: '20000',
        },
      ];

      const mapping = {
        loan_id: 'loan_id',
        loan_date: 'loan_date',
        customer_name: 'customer_name',
        customer_phone: 'customer_phone',
        material: 'material',
        purity: 'purity',
        gross_weight_grams: 'gross_weight_grams',
        stone_weight_grams: 'stone_weight_grams',
        rate_per_gram: 'rate_per_gram',
        loan_amount: 'loan_amount',
      };

      const result = CSVImportService.validateCSV(rows, mapping);
      expect(result.errorRows).toBe(2);
      expect(result.errors.length).toBeGreaterThanOrEqual(4);

      // Downloadable error CSV
      const errCsv = CSVImportService.generateErrorCSV(result.errors);
      expect(errCsv).toContain('Row Number,Field,Error Description,Original Value');
      expect(errCsv).toContain('Stone deductions cannot equal or exceed gross weight');
    });

    it('groups multi-material rows sharing same loan_id into a single loan record', async () => {
      const rows = [
        {
          loan_id: 'HIST-2023-001',
          loan_date: '15-05-2023',
          customer_name: 'Vikram Singh',
          customer_phone: '9822334455',
          customer_address: 'Main Bazaar',
          customer_city: 'Jaipur',
          aadhaar: '123456789012',
          material: 'GOLD',
          purity: '22K',
          gross_weight_grams: '30.0',
          stone_weight_grams: '1.0',
          rate_per_gram: '5800',
          loan_amount: '120000',
          remarks: '2 Gold Chains',
        },
        {
          loan_id: 'HIST-2023-001', // Same loan ID -> Consolidates
          loan_date: '15-05-2023',
          customer_name: 'Vikram Singh',
          customer_phone: '9822334455',
          customer_address: 'Main Bazaar',
          customer_city: 'Jaipur',
          aadhaar: '123456789012',
          material: 'SILVER',
          purity: '925',
          gross_weight_grams: '200.0',
          stone_weight_grams: '0.0',
          rate_per_gram: '70',
          loan_amount: '10000',
          remarks: '1 Silver Plate',
        },
      ];

      const mapping = {
        loan_id: 'loan_id',
        loan_date: 'loan_date',
        customer_name: 'customer_name',
        customer_phone: 'customer_phone',
        customer_address: 'customer_address',
        customer_city: 'customer_city',
        aadhaar: 'aadhaar',
        material: 'material',
        purity: 'purity',
        gross_weight_grams: 'gross_weight_grams',
        stone_weight_grams: 'stone_weight_grams',
        rate_per_gram: 'rate_per_gram',
        loan_amount: 'loan_amount',
        remarks: 'remarks',
      };

      const importResult = await CSVImportService.executeImport(
        rows,
        mapping,
        { fileName: 'historical_sample.csv', duplicateAction: 'SKIP' },
        'admin',
        'owner'
      );

      expect(importResult.success).toBe(true);
      expect(importResult.importedLoansCount).toBe(1); // 1 Consolidated loan!
      expect(importResult.importedCustomersCount).toBe(1);

      // Verify the consolidated loan in database
      const loanRow = db.prepare("SELECT * FROM loans WHERE id = 'HIST-2023-001'").get() as any;
      expect(loanRow).toBeDefined();
      expect(loanRow.loan_date).toBe('2023-05-15');
      expect(loanRow.principal_paise).toBe(13000000); // ₹120,000 + ₹10,000 = ₹1,30,000 (13,000,000 paise)

      // Verify multiple loan items attached to the consolidated loan
      const items = db.prepare("SELECT * FROM loan_items WHERE loan_id = 'HIST-2023-001'").all() as any[];
      expect(items.length).toBe(2);
      expect(items[0].material).toBe('GOLD');
      expect(items[1].material).toBe('SILVER');

      // Verify Customer creation with encrypted Aadhaar
      const cust = db.prepare("SELECT * FROM customers WHERE phone = '9822334455'").get() as any;
      expect(cust).toBeDefined();
      expect(cust.full_name).toBe('Vikram Singh');
      expect(cust.aadhaar_last4).toBe('9012');
      expect(cust.aadhaar_encrypted).toBeDefined();
      expect(cust.aadhaar_iv).toBeDefined();

      // Verify batch record in import_batches table
      const batchRow = db.prepare('SELECT * FROM import_batches WHERE id = ?').get(importResult.batchId) as any;
      expect(batchRow).toBeDefined();
      expect(batchRow.file_name).toBe('historical_sample.csv');
      expect(batchRow.successful_loans).toBe(1);

      // Verify history list
      const history = CSVImportService.getImportHistory();
      expect(history.length).toBe(1);
      expect(history[0].id).toBe(importResult.batchId);
    });
  });
});
