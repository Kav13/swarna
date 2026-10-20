"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InterestService = void 0;
class InterestService {
    /**
     * Calculates interest accrued on a loan from its start date to a specified as-of date.
     * Takes minimum interest days and rounding rules into account.
     */
    static calculateAccruedInterest(loan, asOfDateStr) {
        const principal = loan.principal_outstanding_paise;
        const rate = loan.interest_rate_percent;
        const minDays = loan.min_interest_days || 15;
        const startDate = new Date(loan.start_date);
        const asOfDate = asOfDateStr ? new Date(asOfDateStr) : new Date();
        const diffMs = asOfDate.getTime() - startDate.getTime();
        const actualElapsedDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
        // Enforce minimum interest period only if time has elapsed
        const billableDays = actualElapsedDays === 0 ? 0 : Math.max(actualElapsedDays, minDays);
        const carriedInterestPaise = loan.interest_outstanding_paise || 0;
        let newInterestPaise = 0;
        let billableMonths = +(billableDays / 30).toFixed(2);
        if (loan.interest_method === 'MONTHLY_SIMPLE') {
            if (loan.interest_period === 'MONTHLY') {
                // Rate is per month (e.g. 2% per month)
                // Daily rate = rate / 30
                const dailyRate = rate / 30 / 100;
                newInterestPaise = Math.round(principal * dailyRate * billableDays);
            }
            else if (loan.interest_period === 'YEARLY') {
                // Rate is per year (e.g. 24% per year)
                const dailyRate = rate / 365 / 100;
                newInterestPaise = Math.round(principal * dailyRate * billableDays);
            }
            else {
                // Daily rate
                const dailyRate = rate / 100;
                newInterestPaise = Math.round(principal * dailyRate * billableDays);
            }
        }
        else if (loan.interest_method === 'DAILY_SIMPLE') {
            const dailyRate = (loan.interest_period === 'YEARLY' ? rate / 365 : rate / 30) / 100;
            newInterestPaise = Math.round(principal * dailyRate * billableDays);
        }
        else if (loan.interest_method === 'FLAT') {
            // Flat agreed interest for the loan tenure
            newInterestPaise = Math.round(principal * (rate / 100));
        }
        const interestAccruedPaise = carriedInterestPaise + newInterestPaise;
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
exports.InterestService = InterestService;
