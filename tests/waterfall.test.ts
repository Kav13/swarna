import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { PaymentService } from '../electron/services/paymentService';
import { LoanService } from '../electron/services/loanService';
import { CustomerService } from '../electron/services/customerService';
import { initDatabase, closeDatabase } from '../electron/database/connection';
import fs from 'fs';
import path from 'path';

describe('PaymentService - Repayment Waterfall Engine', () => {
  const testDbPath = path.join(process.cwd(), 'data', 'test_waterfall.sqlite');

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    initDatabase(testDbPath);
  });

  afterEach(() => {
    closeDatabase();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  });

  it('allocates payment to interest first, then principal (Waterfall Priority)', () => {
    // 1. Create Customer
    const customer = CustomerService.createCustomer(
      {
        full_name: 'Test Borrower',
        phone: '9876543210',
        aadhaar_number: '123456789012',
        address: '123 Test Road',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
      },
      'admin',
      'Admin'
    );

    // 2. Create Loan: ₹100,000 principal at 2% monthly simple interest
    const loan = LoanService.createLoan(
      {
        customer_id: customer.id,
        loan_date: '2026-01-01',
        start_date: '2026-01-01',
        due_date: '2026-07-01',
        principal_paise: 10000000, // ₹100,000
        interest_rate_percent: 2.0,
        interest_period: 'MONTHLY',
        interest_method: 'MONTHLY_SIMPLE',
        min_interest_days: 15,
        grace_period_days: 7,
        ltv_percent: 75,
        payment_mode: 'CASH',
        backdate_reason: 'Test backdated loan',
        items: [
          {
            category: 'Chain',
            description: 'Gold Chain',
            material: 'GOLD',
            purity: '22K',
            gross_weight_grams: 30,
            stone_weight_grams: 0,
            rate_per_gram_paise: 700000,
            allocated_loan_paise: 10000000,
          },
        ],
      },
      'admin',
      'Admin',
      'OWNER'
    );

    // After 30 days (on 2026-01-31):
    // Accrued Interest is ₹2,000 (200,000 paise)
    // Principal Outstanding is ₹100,000 (10,000,000 paise)
    // Scenario A: Customer pays ₹1,500 (150,000 paise) - Partial Interest only
    const allocA = PaymentService.previewAllocation(loan.id, 150000, '2026-01-31');
    expect(allocA.interest_paid_paise).toBe(150000); // 1,500 paid towards interest
    expect(allocA.principal_paid_paise).toBe(0); // 0 paid towards principal
    expect(allocA.remaining_interest_paise).toBe(50000); // ₹500 interest remaining
    expect(allocA.remaining_principal_paise).toBe(10000000); // ₹100,000 principal remains intact

    // Scenario B: Customer pays ₹5,000 (500,000 paise) - Covers all ₹2,000 interest, and ₹3,000 principal
    const allocB = PaymentService.previewAllocation(loan.id, 500000, '2026-01-31');
    expect(allocB.interest_paid_paise).toBe(200000); // ₹2,000 covers 100% of accrued interest
    expect(allocB.principal_paid_paise).toBe(300000); // Remaining ₹3,000 reduces principal
    expect(allocB.remaining_interest_paise).toBe(0); // Zero interest remaining
    expect(allocB.remaining_principal_paise).toBe(9700000); // Principal drops to ₹97,000

    // Record the actual payment of ₹5,000
    const payRes = PaymentService.recordPayment(
      {
        loan_id: loan.id,
        payment_amount_paise: 500000,
        payment_mode: 'UPI',
        payment_date: '2026-01-31',
        reference_no: 'UPI-987654',
      },
      'admin',
      'Admin'
    );

    expect(payRes.loan.status).toBe('PARTIALLY_PAID');
    expect(payRes.loan.principal_outstanding_paise).toBe(9700000);
    expect(payRes.loan.interest_outstanding_paise).toBe(0);
    expect(payRes.is_closed).toBe(false);

    // Full settlement: Customer pays remaining ₹97,000
    const settleRes = PaymentService.recordPayment(
      {
        loan_id: loan.id,
        payment_amount_paise: 9700000,
        payment_mode: 'CASH',
        payment_date: '2026-01-31',
      },
      'admin',
      'Admin'
    );

    expect(settleRes.loan.status).toBe('CLOSED');
    expect(settleRes.loan.principal_outstanding_paise).toBe(0);
    expect(settleRes.is_closed).toBe(true);
  });
});
