import { describe, it, expect } from 'vitest';
import { InterestService } from '../electron/services/interestService';

describe('InterestService - Configurable Interest Calculation Engine', () => {
  it('correctly calculates monthly simple interest with standard 30 days period', () => {
    // Principal: ₹100,000 (10,000,000 paise)
    // Rate: 2.0% per month
    // Period: 30 days
    // Expected Interest: ₹2,000 (200,000 paise)
    const loan: any = {
      principal_outstanding_paise: 10000000,
      interest_rate_percent: 2.0,
      interest_period: 'MONTHLY',
      interest_method: 'MONTHLY_SIMPLE',
      min_interest_days: 15,
      start_date: '2026-01-01',
      interest_outstanding_paise: 0,
    };

    const result = InterestService.calculateAccruedInterest(loan, '2026-01-31');

    expect(result.elapsed_days).toBe(30);
    expect(result.billable_days).toBe(30);
    expect(result.interest_accrued_paise).toBe(200000); // exactly ₹2,000
    expect(result.total_due_paise).toBe(10200000); // ₹1,02,000
  });

  it('enforces minimum interest period when loan is closed early (e.g. 5 days elapsed < 15 min days)', () => {
    // Principal: ₹100,000 (10,000,000 paise)
    // Rate: 2.0% per month
    // Elapsed: 5 days, but min_interest_days = 15
    // Billable days should be 15!
    // Expected Interest: (100,000 * (2 / 30 / 100)) * 15 = ₹1,000 (100,000 paise)
    const loan: any = {
      principal_outstanding_paise: 10000000,
      interest_rate_percent: 2.0,
      interest_period: 'MONTHLY',
      interest_method: 'MONTHLY_SIMPLE',
      min_interest_days: 15,
      start_date: '2026-01-01',
      interest_outstanding_paise: 0,
    };

    const result = InterestService.calculateAccruedInterest(loan, '2026-01-06');

    expect(result.elapsed_days).toBe(5);
    expect(result.billable_days).toBe(15);
    expect(result.interest_accrued_paise).toBe(100000); // ₹1,000
  });

  it('correctly calculates daily simple interest for partial periods', () => {
    // Principal: ₹200,000 (20,000,000 paise)
    // Rate: 1.5% per month (Daily rate = 1.5 / 30 = 0.05% per day)
    // Period: 45 days
    // Expected Interest = 200,000 * 0.0005 * 45 = ₹4,500 (450,000 paise)
    const loan: any = {
      principal_outstanding_paise: 20000000,
      interest_rate_percent: 1.5,
      interest_period: 'MONTHLY',
      interest_method: 'DAILY_SIMPLE',
      min_interest_days: 15,
      start_date: '2026-01-01',
      interest_outstanding_paise: 0,
    };

    const result = InterestService.calculateAccruedInterest(loan, '2026-02-15');

    expect(result.elapsed_days).toBe(45);
    expect(result.interest_accrued_paise).toBe(450000); // ₹4,500
  });

  it('correctly calculates flat interest method', () => {
    // Principal: ₹50,000 (5,000,000 paise)
    // Rate: 10% flat
    // Expected Interest: ₹5,000 (500,000 paise)
    const loan: any = {
      principal_outstanding_paise: 5000000,
      interest_rate_percent: 10.0,
      interest_period: 'YEARLY',
      interest_method: 'FLAT',
      min_interest_days: 15,
      start_date: '2026-01-01',
      interest_outstanding_paise: 0,
    };

    const result = InterestService.calculateAccruedInterest(loan, '2026-04-01');
    expect(result.interest_accrued_paise).toBe(500000); // ₹5,000
  });
});
