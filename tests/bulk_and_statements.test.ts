import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CustomerService } from '../electron/services/customerService';
import { LoanService } from '../electron/services/loanService';
import { PaymentService } from '../electron/services/paymentService';
import { initDatabase, closeDatabase } from '../electron/database/connection';
import fs from 'fs';
import path from 'path';

describe('Bulk Entry & Statement Generation Engine', () => {
  const testDbPath = path.join(process.cwd(), 'data', 'test_bulk_statement.sqlite');

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    initDatabase(testDbPath);
  });

  afterEach(() => {
    closeDatabase();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  });

  it('correctly creates a multi-material bulk loan with aggregated weight and valuation', () => {
    // 1. Create Customer
    const customer = CustomerService.createCustomer(
      {
        full_name: 'Rajesh Sharma',
        phone: '9876543210',
        aadhaar_number: '123456789012',
        address: '74 Zaveri Bazaar',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400002',
      },
      'admin',
      'Admin'
    );
    expect(customer.id).toBeDefined();

    // 2. Define Multi-Material Aggregated Blocks:
    // Block A: Gold 22K: Gross 50g, Stone 2g -> Net 48g @ ₹7,000/g = Valuation ₹3,36,000. At 75% LTV, Max = ₹2,52,000. Actual Loan = ₹2,50,000.
    // Block B: Silver 925: Gross 500g, Stone 10g -> Net 490g @ ₹90/g = Valuation ₹44,100. At 75% LTV, Max = ₹33,075. Actual Loan = ₹30,000.
    const goldGross = 50;
    const goldStone = 2;
    const goldNet = goldGross - goldStone; // 48
    const goldRatePaise = 700000; // ₹7,000/g
    const goldValuationPaise = goldNet * goldRatePaise; // 336,000,000 paise (₹3,36,000)
    const goldAllocatedPaise = 25000000; // ₹2,50,000

    const silverGross = 500;
    const silverStone = 10;
    const silverNet = silverGross - silverStone; // 490
    const silverRatePaise = 9000; // ₹90/g
    const silverValuationPaise = silverNet * silverRatePaise; // 4,410,000 paise (₹44,100)
    const silverAllocatedPaise = 3000000; // ₹30,000

    const totalPrincipalPaise = goldAllocatedPaise + silverAllocatedPaise; // ₹2,80,000

    const createdLoan = LoanService.createLoan(
      {
        customer_id: customer.id,
        loan_date: '2026-02-01',
        start_date: '2026-02-01',
        due_date: '2026-08-01',
        principal_paise: totalPrincipalPaise,
        interest_rate_percent: 2.0,
        interest_period: 'MONTHLY',
        interest_method: 'MONTHLY_SIMPLE',
        ltv_percent: 75.0,
        payment_mode: 'CASH',
        backdate_reason: 'Test backdated loan',
        items: [
          {
            category: 'Gold Ornaments (Bulk)',
            description: 'Bulk 22K GOLD (Combined Net Weight 48.000g) - Mixed rings and chains',
            material: 'GOLD',
            purity: '22K',
            gross_weight_grams: goldGross,
            stone_weight_grams: goldStone,
            rate_per_gram_paise: goldRatePaise,
            allocated_loan_paise: goldAllocatedPaise,
            remarks: 'Mixed rings and chains',
          },
          {
            category: 'Silver Articles (Bulk)',
            description: 'Bulk 925 SILVER (Combined Net Weight 490.000g) - Silver utensils and coins',
            material: 'SILVER',
            purity: '925',
            gross_weight_grams: silverGross,
            stone_weight_grams: silverStone,
            rate_per_gram_paise: silverRatePaise,
            allocated_loan_paise: silverAllocatedPaise,
            remarks: 'Silver utensils and coins',
          },
        ],
      },
      'admin',
      'Admin',
      'OWNER'
    );

    expect(createdLoan.id).toBeDefined();
    expect(createdLoan.principal_paise).toBe(28000000); // ₹2,80,000
    expect(createdLoan.items).toHaveLength(2);

    // Verify items in loan
    const goldItem = createdLoan.items.find((i) => i.material === 'GOLD')!;
    expect(goldItem.gross_weight_grams).toBe(50);
    expect(goldItem.net_weight_grams).toBe(48);
    expect(goldItem.valuation_paise).toBe(goldValuationPaise);
    expect(goldItem.status).toBe('PLEDGED');

    const silverItem = createdLoan.items.find((i) => i.material === 'SILVER')!;
    expect(silverItem.gross_weight_grams).toBe(500);
    expect(silverItem.net_weight_grams).toBe(490);
    expect(silverItem.valuation_paise).toBe(silverValuationPaise);
    expect(silverItem.status).toBe('PLEDGED');
  });

  it('retrieves complete customer profile and verified statement data', () => {
    // 1. Create Customer
    const customer = CustomerService.createCustomer(
      {
        full_name: 'Anjali Verma',
        phone: '9812345678',
        aadhaar_number: '987654321098',
        address: '12 MG Road',
        city: 'Bangalore',
        state: 'Karnataka',
        pincode: '560001',
      },
      'admin',
      'Admin'
    );

    // 2. Create Active Loan
    const loan = LoanService.createLoan(
      {
        customer_id: customer.id,
        loan_date: '2026-01-01',
        start_date: '2026-01-01',
        due_date: '2026-07-01',
        principal_paise: 5000000, // ₹50,000
        interest_rate_percent: 2.0,
        interest_period: 'MONTHLY',
        interest_method: 'MONTHLY_SIMPLE',
        ltv_percent: 75.0,
        payment_mode: 'CASH',
        backdate_reason: 'Test backdated loan',
        items: [
          {
            category: 'Bangles',
            description: '22K Gold Bangles Pair',
            material: 'GOLD',
            purity: '22K',
            gross_weight_grams: 25.0,
            stone_weight_grams: 1.0,
            rate_per_gram_paise: 700000,
            allocated_loan_paise: 5000000,
          },
        ],
      },
      'admin',
      'Admin',
      'OWNER'
    );

    // 3. Make a partial repayment of ₹10,000
    const partialPay = PaymentService.recordPayment(
      {
        loan_id: loan.id,
        payment_amount_paise: 1000000, // ₹10,000
        payment_mode: 'UPI',
        payment_date: '2026-01-15',
        reference_no: 'UPI-112233',
      },
      'admin',
      'Admin'
    );

    expect(partialPay.loan.status).toBe('PARTIALLY_PAID');

    // 4. Retrieve Customer Profile for Statement Generation
    const profile = CustomerService.getCustomerProfile(customer.id);
    expect(profile).not.toBeNull();
    if (!profile) return;

    // Check Customer Information
    expect(profile.customer.id).toBe(customer.id);
    expect(profile.customer.full_name).toBe('Anjali Verma');
    expect(profile.customer.aadhaar_last4).toBe('1098');

    // Check Active Loans
    expect(profile.active_loans).toHaveLength(1);
    expect(profile.active_loans[0].id).toBe(loan.id);
    expect(profile.active_loans[0].status).toBe('PARTIALLY_PAID');

    // Check Pledged Ornaments
    expect(profile.pledged_items).toHaveLength(1);
    expect(profile.pledged_items[0].material).toBe('GOLD');
    expect(profile.pledged_items[0].net_weight_grams).toBe(24.0);
    expect(profile.pledged_items[0].status).toBe('PLEDGED');

    // Check Repayments
    expect(profile.total_repayments_paise).toBe(1000000); // ₹10,000
    expect(profile.recent_transactions.length).toBeGreaterThan(0);
  });
});
