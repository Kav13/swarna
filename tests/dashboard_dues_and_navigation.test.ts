import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { initDatabase, closeDatabase } from '../electron/database/connection';
import { InterestService } from '../electron/services/interestService';
import { CustomerService } from '../electron/services/customerService';
import { LoanService } from '../electron/services/loanService';
import { PaymentService } from '../electron/services/paymentService';
import { ReportService } from '../electron/services/reportService';
import { handleEnterKeyNavigation } from '../src/utils/keyboardNavigation';

describe('CHANGE 2: Dynamic Accrued Interest & Dashboard Total Dues', () => {
  const testDbPath = path.join(process.cwd(), 'data', 'test_dashboard_dues.sqlite');

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    initDatabase(testDbPath);
  });

  afterEach(() => {
    closeDatabase();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  });

  it('InterestService preserves carried-over unpaid interest from partial repayment and adds new accrual', () => {
    // Principal: ₹100,000 (10,000,000 paise)
    // Rate: 2.0% per month
    // Carried unpaid interest: ₹500 (50,000 paise)
    // New period: 30 days -> ₹2,000 (200,000 paise)
    // Total interest due must be ₹2,500 (250,000 paise)
    const loan: any = {
      principal_outstanding_paise: 10000000,
      interest_rate_percent: 2.0,
      interest_period: 'MONTHLY',
      interest_method: 'MONTHLY_SIMPLE',
      min_interest_days: 15,
      start_date: '2026-02-01',
      interest_outstanding_paise: 50000, // ₹500 carried over
    };

    const result = InterestService.calculateAccruedInterest(loan, '2026-03-03'); // 30 days

    expect(result.elapsed_days).toBe(30);
    expect(result.interest_accrued_paise).toBe(250000); // ₹2,000 + ₹500 = ₹2,500
    expect(result.total_due_paise).toBe(10250000); // ₹102,500
  });

  it('Dashboard Total Dues calculates: Principal + Accrued Unpaid Interest + Other Charges', () => {
    // 1. Create Customer
    const customer = CustomerService.createCustomer(
      {
        full_name: 'Kavya Shukla',
        phone: '9876543210',
        aadhaar_number: '123456789012',
        address: 'MG Road',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
      },
      'admin',
      'Admin'
    );

    // 2. Disburse Loan 1: ₹3,00,000 at 2% monthly simple, 30 days ago (Backdated to 2026-01-01)
    // Accrued interest on 2026-01-31 (30 days) = 300,000 * 0.02 = ₹6,000 (600,000 paise)
    // Other charges = ₹500 (50,000 paise)
    const loan1 = LoanService.createLoan(
      {
        customer_id: customer.id,
        loan_date: '2026-01-01',
        start_date: '2026-01-01',
        due_date: '2026-07-01',
        principal_paise: 30000000, // ₹3,00,000
        interest_rate_percent: 2.0,
        interest_period: 'MONTHLY',
        interest_method: 'MONTHLY_SIMPLE',
        min_interest_days: 15,
        grace_period_days: 7,
        ltv_percent: 75,
        other_charges_paise: 50000, // ₹500 other charges
        payment_mode: 'CASH',
        backdate_reason: 'Historical register entry',
        items: [
          {
            category: 'Necklace',
            description: 'Gold Necklace',
            material: 'GOLD',
            purity: '22K',
            gross_weight_grams: 80,
            stone_weight_grams: 0,
            rate_per_gram_paise: 700000,
            allocated_loan_paise: 30000000,
          },
        ],
      },
      'admin',
      'Admin',
      'OWNER'
    );

    // Check stats on 2026-01-31:
    // Dynamic accrued interest on loan 1:
    const intCalc1 = InterestService.calculateAccruedInterest(loan1, '2026-01-31');
    expect(intCalc1.interest_accrued_paise).toBe(600000); // ₹6,000

    // Fetch dashboard stats
    const stats = ReportService.getDashboardStats();

    expect(stats.active_loans_count).toBe(1);
    expect(stats.principal_outstanding_paise).toBe(30000000); // ₹3,00,000
    // Dynamic accrued interest must be > 0 and include the accrued interest:
    expect(stats.interest_outstanding_paise).toBeGreaterThanOrEqual(600000);
    expect(stats.other_charges_outstanding_paise).toBe(50000); // ₹500
    // Total dues = Principal + Interest + Other Charges
    expect(stats.total_dues_paise).toBe(
      stats.principal_outstanding_paise +
        stats.interest_outstanding_paise +
        stats.other_charges_outstanding_paise
    );
  });

  it('Dashboard Total Dues excludes CLOSED loans and updates upon partial repayment', () => {
    const customer = CustomerService.createCustomer(
      {
        full_name: 'Rahul Sharma',
        phone: '9812345678',
        aadhaar_number: '987654321098',
        address: 'Bandra',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400050',
      },
      'admin',
      'Admin'
    );

    // Create loan: ₹100,000 at 2% monthly on 2026-01-01
    const loan = LoanService.createLoan(
      {
        customer_id: customer.id,
        loan_date: '2026-01-01',
        start_date: '2026-01-01',
        due_date: '2026-07-01',
        principal_paise: 10000000,
        interest_rate_percent: 2.0,
        interest_period: 'MONTHLY',
        interest_method: 'MONTHLY_SIMPLE',
        min_interest_days: 15,
        grace_period_days: 7,
        ltv_percent: 75,
        payment_mode: 'CASH',
        backdate_reason: 'Import',
        items: [
          {
            category: 'Bangle',
            description: 'Gold Bangle',
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

    // On 2026-01-31: Interest due is ₹2,000 (200,000 paise).
    // Customer repays ₹1,500 (150,000 paise).
    // Interest paid = ₹1,500, Remaining unpaid interest = ₹500 (50,000 paise).
    const payRes = PaymentService.recordPayment(
      {
        loan_id: loan.id,
        payment_amount_paise: 150000,
        payment_mode: 'CASH',
        payment_date: '2026-01-31',
      },
      'admin',
      'Admin'
    );

    expect(payRes.loan.interest_outstanding_paise).toBe(50000); // ₹500 residual interest
    expect(payRes.loan.principal_outstanding_paise).toBe(10000000); // ₹100,000 principal
    expect(payRes.loan.status).toBe('ACTIVE');

    // Customer profile reflects true total dues including residual interest
    const profile = CustomerService.getCustomerProfile(customer.id)!;
    expect(profile.total_principal_outstanding_paise).toBe(10000000);
    expect(profile.total_interest_outstanding_paise).toBeGreaterThanOrEqual(50000);
    expect(profile.total_dues_paise).toBe(
      profile.total_principal_outstanding_paise +
        profile.total_interest_outstanding_paise +
        (profile.total_other_charges_paise || 0)
    );

    // Customer search results also reflect true dynamic dues
    const searchRes = CustomerService.searchCustomers('Rahul');
    expect(searchRes.customers[0].total_outstanding_paise).toBe(profile.total_dues_paise);

    // Settle remaining loan: interest ₹500 + principal ₹100,000 = ₹100,500
    PaymentService.recordPayment(
      {
        loan_id: loan.id,
        payment_amount_paise: 10050000,
        payment_mode: 'CASH',
        payment_date: '2026-01-31',
      },
      'admin',
      'Admin'
    );

    // After full settlement, closed loan must NOT contribute to dashboard dues
    const closedStats = ReportService.getDashboardStats();
    expect(closedStats.active_loans_count).toBe(0);
    expect(closedStats.principal_outstanding_paise).toBe(0);
    expect(closedStats.interest_outstanding_paise).toBe(0);
    expect(closedStats.total_dues_paise).toBe(0);
  });
});

describe('CHANGE 1: Enter Key Navigation in Loan Wizard Forms', () => {
  function createMockForm(fields: Array<{ id: string; tagName: string; type?: string; value?: string }>) {
    let activeElement: any = null;
    const elements: any[] = [];
    const form: any = {
      querySelectorAll: (_selector: string) => elements,
      querySelector: (_selector: string) =>
        elements.find((el) => el.type === 'submit' || el.tagName === 'BUTTON') || null,
    };

    for (const f of fields) {
      const el: any = {
        id: f.id,
        tagName: f.tagName.toUpperCase(),
        type: f.type || (f.tagName.toUpperCase() === 'BUTTON' ? 'submit' : 'text'),
        value: f.value || '',
        offsetParent: {},
        offsetWidth: 100,
        offsetHeight: 30,
        getAttribute: (_attr: string) => null,
        closest: (_sel: string) => form,
        focus: () => {
          activeElement = el;
        },
        select: () => {},
      };
      elements.push(el);
    }

    return {
      form,
      elements,
      getActiveElement: () => activeElement,
      setActiveElement: (el: any) => {
        activeElement = el;
      },
    };
  }

  it('advances focus to next input field instead of submitting form', () => {
    const { elements, getActiveElement, setActiveElement } = createMockForm([
      { id: 'input-name', tagName: 'input', type: 'text', value: 'Ramesh' },
      { id: 'input-phone', tagName: 'input', type: 'tel', value: '9876543210' },
      { id: 'select-category', tagName: 'select' },
      { id: 'input-weight', tagName: 'input', type: 'text', value: '10.5' },
      { id: 'input-remarks', tagName: 'textarea', value: 'Notes' },
      { id: 'btn-submit', tagName: 'button', type: 'submit' },
    ]);

    const [inputName, inputPhone, selectCat, inputWeight, inputRemarks, btnSubmit] = elements;

    let defaultPrevented = false;
    const mockEvent = (target: any, key = 'Enter', shiftKey = false, ctrlKey = false) =>
      ({
        key,
        target,
        shiftKey,
        ctrlKey,
        preventDefault: () => {
          defaultPrevented = true;
        },
      } as unknown as React.KeyboardEvent<HTMLElement>);

    // Focus first input and press Enter
    setActiveElement(inputName);
    defaultPrevented = false;
    handleEnterKeyNavigation(mockEvent(inputName));

    expect(defaultPrevented).toBe(true);
    expect(getActiveElement()).toBe(inputPhone);

    // Press Enter on phone input -> moves to category select
    defaultPrevented = false;
    handleEnterKeyNavigation(mockEvent(inputPhone));
    expect(defaultPrevented).toBe(true);
    expect(getActiveElement()).toBe(selectCat);

    // Press Enter on category select -> moves to weight input
    defaultPrevented = false;
    handleEnterKeyNavigation(mockEvent(selectCat));
    expect(defaultPrevented).toBe(true);
    expect(getActiveElement()).toBe(inputWeight);

    // Standard Enter in textarea: must NOT prevent default and NOT move focus
    setActiveElement(inputRemarks);
    defaultPrevented = false;
    handleEnterKeyNavigation(mockEvent(inputRemarks));
    expect(defaultPrevented).toBe(false);
    expect(getActiveElement()).toBe(inputRemarks);

    // Ctrl+Enter in textarea: moves to next field (submit button)
    defaultPrevented = false;
    handleEnterKeyNavigation(mockEvent(inputRemarks, 'Enter', false, true));
    expect(defaultPrevented).toBe(true);
    expect(getActiveElement()).toBe(btnSubmit);

    // Pressing Enter on the submit button itself: does NOT prevent default (allows submit)
    defaultPrevented = false;
    handleEnterKeyNavigation(mockEvent(btnSubmit));
    expect(defaultPrevented).toBe(false);
  });

  it('Shift+Enter moves focus backwards', () => {
    const { elements, getActiveElement, setActiveElement } = createMockForm([
      { id: 'field-1', tagName: 'input', type: 'text' },
      { id: 'field-2', tagName: 'input', type: 'text' },
    ]);

    const [f1, f2] = elements;

    setActiveElement(f2);
    let defaultPrevented = false;
    handleEnterKeyNavigation({
      key: 'Enter',
      target: f2,
      shiftKey: true,
      preventDefault: () => {
        defaultPrevented = true;
      },
    } as unknown as React.KeyboardEvent<HTMLElement>);

    expect(defaultPrevented).toBe(true);
    expect(getActiveElement()).toBe(f1);
  });
});
