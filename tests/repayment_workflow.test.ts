import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { PaymentService } from '../electron/services/paymentService';
import { LoanService } from '../electron/services/loanService';
import { CustomerService } from '../electron/services/customerService';
import { LedgerService } from '../electron/services/ledgerService';
import { AuditService } from '../electron/services/auditService';
import { InterestService } from '../electron/services/interestService';
import { initDatabase, closeDatabase } from '../electron/database/connection';
import fs from 'fs';
import path from 'path';

describe('Repayment Workflow - Direct Loan Context & Settlement Engine', () => {
  const testDbPath = path.join(process.cwd(), 'data', 'test_repayment_workflow.sqlite');

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    initDatabase(testDbPath);
  });

  afterEach(() => {
    closeDatabase();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  });

  function setupBorrowerAndLoan(principalPaise = 30000000) {
    const customer = CustomerService.createCustomer(
      {
        full_name: 'Kavya Shukla',
        phone: '9876543210',
        aadhaar_number: '123456789012',
        address: '22 Swarna Avenue',
        city: 'Jaipur',
        state: 'Rajasthan',
        pincode: '302001',
      },
      'admin',
      'Admin'
    );

    const loan = LoanService.createLoan(
      {
        customer_id: customer.id,
        loan_date: '2026-01-01',
        start_date: '2026-01-01',
        due_date: '2026-07-01',
        principal_paise: principalPaise, // ₹3,00,000
        interest_rate_percent: 1.0, // 1% monthly = ₹3,000/mo
        interest_period: 'MONTHLY',
        interest_method: 'MONTHLY_SIMPLE',
        min_interest_days: 0,
        grace_period_days: 0,
        ltv_percent: 75,
        payment_mode: 'CASH',
        backdate_reason: 'Testing direct repayment workflow',
        items: [
          {
            category: 'Necklace',
            description: '22K Gold Necklace',
            material: 'GOLD',
            purity: '22K',
            gross_weight_grams: 80,
            stone_weight_grams: 0,
            net_weight_grams: 80,
            rate_per_gram_paise: 600000,
            valuation_paise: 48000000,
            allocated_loan_paise: principalPaise,
          },
        ],
      },
      'admin',
      'Admin',
      'OWNER'
    );

    return { customer, loan };
  }

  it('correctly loads specific loan balances and calculates accrued interest', () => {
    const { loan } = setupBorrowerAndLoan(30000000); // ₹3,00,000 principal

    // Accrued interest as of 2026-02-01 (31 days from 2026-01-01 = 3,10,000 paise)
    const intCalc = InterestService.calculateAccruedInterest(loan, '2026-02-01');
    expect(intCalc.interest_accrued_paise).toBe(310000); // ₹3,100 in paise

    const totalDue = loan.principal_outstanding_paise + intCalc.interest_accrued_paise;
    expect(totalDue).toBe(30310000); // ₹3,03,100 in paise
  });

  it('generates waterfall preview allocating interest first, principal second', () => {
    const { loan } = setupBorrowerAndLoan(30000000);

    // Suppose borrower pays ₹50,000 on 2026-02-01 when ₹3,100 interest is accrued
    const alloc = PaymentService.previewAllocation(loan.id, 5000000, '2026-02-01');
    expect(alloc.interest_paid_paise).toBe(310000); // ₹3,100 goes to interest
    expect(alloc.principal_paid_paise).toBe(4690000); // ₹46,900 goes to principal
    expect(alloc.remaining_principal_paise).toBe(30000000 - 4690000); // ₹2,53,100
    expect(alloc.remaining_interest_paise).toBe(0);
  });

  it('records repayment directly against the target loan and updates ledger and audit log', () => {
    const { loan } = setupBorrowerAndLoan(30000000);

    const result = PaymentService.recordPayment(
      {
        loan_id: loan.id,
        payment_amount_paise: 5000000, // ₹50,000
        payment_mode: 'UPI',
        reference_no: 'UPI-TXN-12345',
        remarks: 'Partial repayment via GPay',
        payment_date: '2026-02-01',
      },
      'admin',
      'Admin User'
    );

    expect(result.is_closed).toBe(false);
    expect(result.payment.loan_id).toBe(loan.id);
    expect(result.payment.total_amount_paise).toBe(5000000);
    expect(result.payment.interest_paid_paise).toBe(310000);
    expect(result.payment.principal_paid_paise).toBe(4690000);

    // Verify loan record was updated
    const updatedLoan = LoanService.getLoanById(loan.id);
    expect(updatedLoan?.principal_outstanding_paise).toBe(25310000);
    expect(updatedLoan?.status).toBe('PARTIALLY_PAID');

    // Verify ledger transactions were added
    const ledger = LedgerService.getLedgerByLoanId(loan.id);
    const repaymentTx = ledger.find((tx) => tx.type === 'REPAYMENT');
    expect(repaymentTx).toBeDefined();
    expect(repaymentTx?.credit_paise).toBe(5000000);
    expect(repaymentTx?.principal_balance_paise).toBe(25310000);

    // Verify payments list
    const payments = PaymentService.getPaymentsByLoanId(loan.id);
    expect(payments.length).toBe(1);
    expect(payments[0].receipt_no).toBe(result.payment.receipt_no);
    expect(payments[0].payment_mode).toBe('UPI');

    // Verify audit logs
    const res = AuditService.getLogs({ recordId: result.payment.id });
    expect(res.logs.some((l) => l.action === 'RECORD_REPAYMENT')).toBe(true);
  });

  it('closes loan and sets status to CLOSED when full balance is settled', () => {
    const { loan } = setupBorrowerAndLoan(10000000); // ₹1,00,000

    // Accrued interest on 2026-02-01 = 31 days = 103,333 paise (or exact calc)
    const intCalc = InterestService.calculateAccruedInterest(loan, '2026-02-01');
    const totalDue = loan.principal_outstanding_paise + intCalc.interest_accrued_paise;

    // Pay full settlement amount
    const result = PaymentService.recordPayment(
      {
        loan_id: loan.id,
        payment_amount_paise: totalDue,
        payment_mode: 'CASH',
        payment_date: '2026-02-01',
      },
      'admin',
      'Admin User'
    );

    expect(result.is_closed).toBe(true);

    const closedLoan = LoanService.getLoanById(loan.id);
    expect(closedLoan?.status).toBe('CLOSED');
    expect(closedLoan?.principal_outstanding_paise).toBe(0);
    expect(closedLoan?.closed_at).toBeDefined();

    // Collateral items should now be RELEASED
    expect(closedLoan?.items.every((itm) => itm.status === 'RELEASED')).toBe(true);
  });

  it('rejects repayments on already CLOSED loans', () => {
    const { loan } = setupBorrowerAndLoan(10000000);

    // Close the loan
    const intCalc = InterestService.calculateAccruedInterest(loan, '2026-02-01');
    PaymentService.recordPayment(
      {
        loan_id: loan.id,
        payment_amount_paise: loan.principal_outstanding_paise + intCalc.interest_accrued_paise,
        payment_mode: 'CASH',
        payment_date: '2026-02-01',
      },
      'admin',
      'Admin User'
    );

    // Attempting another repayment on the closed loan must be rejected
    expect(() =>
      PaymentService.recordPayment(
        {
          loan_id: loan.id,
          payment_amount_paise: 50000,
          payment_mode: 'CASH',
        },
        'admin',
        'Admin User'
      )
    ).toThrow(/already closed/i);
  });

  it('rejects overpayments exceeding total due', () => {
    const { loan } = setupBorrowerAndLoan(10000000);
    const intCalc = InterestService.calculateAccruedInterest(loan, '2026-02-01');
    const totalDue = loan.principal_outstanding_paise + intCalc.interest_accrued_paise;

    expect(() =>
      PaymentService.recordPayment(
        {
          loan_id: loan.id,
          payment_amount_paise: totalDue + 10000, // ₹100 overpayment
          payment_mode: 'CASH',
          payment_date: '2026-02-01',
        },
        'admin',
        'Admin User'
      )
    ).toThrow(/exceeds total outstanding due/i);
  });
});
