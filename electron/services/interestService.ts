import { Loan, InterestMethod } from '../types';

export interface InterestAccrualResult {
  principal_paise: number;
  interest_rate_percent: number;
  interest_method: InterestMethod;
  interest_period: 'MONTHLY' | 'YEARLY' | 'DAILY';
  start_date: string;
  as_of_date: string;
  elapsed_days: number;
  billable_days: number;
  billable_months: number;
  min_interest_days: number;
  interest_accrued_paise: number;
  total_due_paise: number;
}

export class InterestService {
  /**
   * Calculates interest accrued on a loan from its start date to a specified as-of date.
   * Takes minimum interest days and rounding rules into account.
   */
  static calculateAccruedInterest(
    loan: Pick<
      Loan,
      | 'principal_outstanding_paise'
      | 'interest_rate_percent'
      | 'interest_method'
      | 'interest_period'
      | 'min_interest_days'
      | 'start_date'
      | 'interest_outstanding_paise'
    >,
    asOfDateStr?: string
  ): InterestAccrualResult {
    const principal = loan.principal_outstanding_paise;
    const rate = loan.interest_rate_percent;
    const minDays = loan.min_interest_days || 15;
    const startDate = new Date(loan.start_date);
    const asOfDate = asOfDateStr ? new Date(asOfDateStr) : new Date();

    const diffMs = asOfDate.getTime() - startDate.getTime();
    const actualElapsedDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    // Enforce minimum interest period only if time has elapsed
    const billableDays = actualElapsedDays === 0 ? 0 : Math.max(actualElapsedDays, minDays);

    let interestAccruedPaise = loan.interest_outstanding_paise || 0;
    let billableMonths = +(billableDays / 30).toFixed(2);

    if (loan.interest_method === 'MONTHLY_SIMPLE') {
      if (loan.interest_period === 'MONTHLY') {
        // Rate is per month (e.g. 2% per month)
        // Daily rate = rate / 30
        const dailyRate = rate / 30 / 100;
        interestAccruedPaise = Math.round(principal * dailyRate * billableDays);
      } else if (loan.interest_period === 'YEARLY') {
        // Rate is per year (e.g. 24% per year)
        const dailyRate = rate / 365 / 100;
        interestAccruedPaise = Math.round(principal * dailyRate * billableDays);
      } else {
        // Daily rate
        const dailyRate = rate / 100;
        interestAccruedPaise = Math.round(principal * dailyRate * billableDays);
      }
    } else if (loan.interest_method === 'DAILY_SIMPLE') {
      const dailyRate = (loan.interest_period === 'YEARLY' ? rate / 365 : rate / 30) / 100;
      interestAccruedPaise = Math.round(principal * dailyRate * billableDays);
    } else if (loan.interest_method === 'FLAT') {
      // Flat agreed interest for the loan tenure
      interestAccruedPaise = Math.round(principal * (rate / 100));
    }

    return {
      principal_paise: principal,
      interest_rate_percent: rate,
      interest_method: loan.interest_method,
      interest_period: loan.interest_period,
      start_date: loan.start_date,
      as_of_date: asOfDate.toISOString().split('T')[0],
      elapsed_days: actualElapsedDays,
      billable_days: billableDays,
      billable_months: billableMonths,
      min_interest_days: minDays,
      interest_accrued_paise: interestAccruedPaise,
      total_due_paise: principal + interestAccruedPaise,
    };
  }
}
