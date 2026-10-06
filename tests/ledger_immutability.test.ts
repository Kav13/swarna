import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CustomerService } from '../electron/services/customerService';
import { LoanService } from '../electron/services/loanService';
import { LedgerService } from '../electron/services/ledgerService';
import { initDatabase, closeDatabase, getDb } from '../electron/database/connection';
import fs from 'fs';
import path from 'path';

describe('LedgerService - Transaction Immutability and Reversals', () => {
  const testDbPath = path.join(process.cwd(), 'data', 'test_ledger.sqlite');

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    initDatabase(testDbPath);
  });

  afterEach(() => {
    closeDatabase();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  });

  it('preserves chronological transaction history and reverses transactions without deletion', () => {
    const customer = CustomerService.createCustomer(
      {
        full_name: 'Ledger Audit Borrower',
        phone: '9988776655',
        aadhaar_number: '987654321098',
        address: 'Vault Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
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
        principal_paise: 5000000,
        interest_rate_percent: 2.0,
        interest_period: 'MONTHLY',
        interest_method: 'MONTHLY_SIMPLE',
        ltv_percent: 75,
        payment_mode: 'CASH',
        backdate_reason: 'Test backdated loan',
        items: [
          {
            category: 'Bangle',
            description: 'Gold Bangle',
            material: 'GOLD',
            purity: '22K',
            gross_weight_grams: 15,
            stone_weight_grams: 0,
            rate_per_gram_paise: 700000,
            allocated_loan_paise: 5000000,
          },
        ],
      },
      'admin',
      'Admin',
      'OWNER'
    );

    // Initial ledger should have the disbursement entry
    const initialLedger = LedgerService.getLedgerByLoanId(loan.id);
    expect(initialLedger.length).toBeGreaterThanOrEqual(1);
    const disbTx = initialLedger[0];
    expect(disbTx.type).toBe('DISBURSEMENT');
    expect(disbTx.debit_paise).toBe(5000000);

    // Reverse transaction with authorized owner credentials and required justification
    const reversalTx = LedgerService.reverseTransaction(
      disbTx.id,
      'Administrative adjustment for testing',
      'admin',
      'Admin',
      'OWNER'
    );

    expect(reversalTx.type).toBe('REVERSAL');
    expect(reversalTx.credit_paise).toBe(5000000); // Offsets the 5,000,000 debit

    // Ledger should now have 2 entries (both preserved, zero rows deleted!)
    const updatedLedger = LedgerService.getLedgerByLoanId(loan.id);
    expect(updatedLedger.length).toBe(initialLedger.length + 1);

    // Executives cannot reverse transactions
    expect(() =>
      LedgerService.reverseTransaction(
        reversalTx.id,
        'Unauthorized reversal',
        'worker',
        'Worker',
        'EXECUTIVE'
      )
    ).toThrow('Access Denied: Only Owner can authorize financial transaction reversals.');
  });
});
