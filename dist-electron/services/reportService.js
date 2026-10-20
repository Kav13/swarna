"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportService = void 0;
const connection_1 = require("../database/connection");
const interestService_1 = require("./interestService");
class ReportService {
    /**
     * Fetches real-time dashboard metrics and summary statistics
     */
    static getDashboardStats() {
        const db = (0, connection_1.getDb)();
        const today = new Date().toISOString().split('T')[0];
        // Loan counts & financial totals
        const loansRow = db.prepare(`
      SELECT
        COUNT(CASE WHEN status IN ('ACTIVE', 'PARTIALLY_PAID') THEN 1 END) as active_loans_count,
        COUNT(CASE WHEN status = 'OVERDUE' THEN 1 END) as overdue_loans_count,
        COUNT(CASE WHEN status = 'CLOSED' THEN 1 END) as closed_loans_count,
        COALESCE(SUM(CASE WHEN status IN ('ACTIVE', 'PARTIALLY_PAID', 'OVERDUE') THEN principal_outstanding_paise ELSE 0 END), 0) as principal_outstanding,
        COALESCE(SUM(CASE WHEN status IN ('ACTIVE', 'PARTIALLY_PAID', 'OVERDUE') THEN other_charges_paise ELSE 0 END), 0) as other_charges_outstanding,
        COALESCE(SUM(principal_paise), 0) as total_disbursed,
        COUNT(CASE WHEN status IN ('ACTIVE', 'PARTIALLY_PAID') AND due_date = ? THEN 1 END) as due_today,
        COUNT(CASE WHEN status IN ('ACTIVE', 'PARTIALLY_PAID') AND due_date > ? AND due_date <= date(?, '+7 days') THEN 1 END) as due_7d,
        COUNT(CASE WHEN status IN ('ACTIVE', 'PARTIALLY_PAID') AND due_date > ? AND due_date <= date(?, '+30 days') THEN 1 END) as due_30d
      FROM loans
    `).get(today, today, today, today, today);
        // Calculate accrued unpaid interest & charges across all active loans
        const activeLoans = db.prepare(`
      SELECT * FROM loans WHERE status IN ('ACTIVE', 'PARTIALLY_PAID', 'OVERDUE')
    `).all();
        let dynamicAccruedInterestPaise = 0;
        for (const l of activeLoans) {
            const calc = interestService_1.InterestService.calculateAccruedInterest(l, today);
            dynamicAccruedInterestPaise += calc.interest_accrued_paise;
        }
        const principalOutstanding = loansRow?.principal_outstanding || 0;
        const otherChargesOutstanding = loansRow?.other_charges_outstanding || 0;
        const totalDues = principalOutstanding + dynamicAccruedInterestPaise + otherChargesOutstanding;
        // Total repayments collected
        const repaymentsRow = db.prepare(`
      SELECT COALESCE(SUM(total_amount_paise), 0) as total_collected FROM payments
    `).get();
        // Collateral weights currently pledged
        const collateralRow = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN material = 'GOLD' THEN net_weight_grams ELSE 0 END), 0) as gold_weight,
        COALESCE(SUM(CASE WHEN material = 'SILVER' THEN net_weight_grams ELSE 0 END), 0) as silver_weight
      FROM loan_items
      WHERE status = 'PLEDGED'
    `).get();
        // Active customers
        const customersRow = db.prepare(`
      SELECT COUNT(DISTINCT customer_id) as active_customers
      FROM loans
      WHERE status IN ('ACTIVE', 'PARTIALLY_PAID', 'OVERDUE')
    `).get();
        // Recent activity audit logs
        const recentActivity = db.prepare(`
      SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 10
    `).all();
        return {
            active_loans_count: (loansRow?.active_loans_count || 0) + (loansRow?.overdue_loans_count || 0),
            principal_outstanding_paise: principalOutstanding,
            interest_outstanding_paise: dynamicAccruedInterestPaise,
            other_charges_outstanding_paise: otherChargesOutstanding,
            total_dues_paise: totalDues,
            total_disbursed_paise: loansRow?.total_disbursed || 0,
            total_collected_paise: repaymentsRow?.total_collected || 0,
            closed_loans_count: loansRow?.closed_loans_count || 0,
            overdue_loans_count: loansRow?.overdue_loans_count || 0,
            loans_due_today: loansRow?.due_today || 0,
            loans_due_7days: loansRow?.due_7d || 0,
            loans_due_30days: loansRow?.due_30d || 0,
            total_gold_weight_grams: +(collateralRow?.gold_weight || 0).toFixed(3),
            total_silver_weight_grams: +(collateralRow?.silver_weight || 0).toFixed(3),
            active_customers_count: customersRow?.active_customers || 0,
            recent_activity: recentActivity,
        };
    }
    /**
     * Generates formatted CSV string for reports
     */
    static exportReportToCSV(reportType) {
        const db = (0, connection_1.getDb)();
        const today = new Date().toISOString().split('T')[0];
        if (reportType === 'LOANS') {
            const rows = db.prepare(`
        SELECT l.*, c.full_name as customer
        FROM loans l
        JOIN customers c ON l.customer_id = c.id
        ORDER BY l.loan_date DESC
      `).all();
            const headers = ['Loan ID', 'Customer', 'Loan Date', 'Due Date', 'Principal (INR)', 'Rate %', 'Status', 'Principal Outstanding (INR)', 'Accrued Interest (INR)', 'Total Outstanding (INR)'];
            const csvLines = [headers.join(',')];
            for (const r of rows) {
                let accruedInterestPaise = 0;
                if (['ACTIVE', 'PARTIALLY_PAID', 'OVERDUE'].includes(r.status)) {
                    const calc = interestService_1.InterestService.calculateAccruedInterest(r, today);
                    accruedInterestPaise = calc.interest_accrued_paise;
                }
                const principalOutInr = (r.principal_outstanding_paise / 100.0).toFixed(2);
                const interestOutInr = (accruedInterestPaise / 100.0).toFixed(2);
                const totalOutInr = ((r.principal_outstanding_paise + accruedInterestPaise + (r.other_charges_paise || 0)) / 100.0).toFixed(2);
                csvLines.push([`"${r.id}"`, `"${r.customer}"`, `"${r.loan_date}"`, `"${r.due_date}"`, (r.principal_paise / 100.0).toFixed(2), r.interest_rate_percent, `"${r.status}"`, principalOutInr, interestOutInr, totalOutInr].join(','));
            }
            return csvLines.join('\n');
        }
        if (reportType === 'PAYMENTS') {
            const rows = db.prepare(`
        SELECT p.receipt_no, p.loan_id, c.full_name as customer, p.payment_date,
               p.total_amount_paise / 100.0 as total_paid_inr,
               p.interest_paid_paise / 100.0 as interest_paid_inr,
               p.principal_paid_paise / 100.0 as principal_paid_inr,
               p.payment_mode
        FROM payments p
        JOIN loans l ON p.loan_id = l.id
        JOIN customers c ON l.customer_id = c.id
        ORDER BY p.payment_date DESC
      `).all();
            const headers = ['Receipt No', 'Loan ID', 'Customer', 'Payment Date', 'Total Paid (INR)', 'Interest Paid (INR)', 'Principal Paid (INR)', 'Payment Mode'];
            const csvLines = [headers.join(',')];
            for (const r of rows) {
                csvLines.push([`"${r.receipt_no}"`, `"${r.loan_id}"`, `"${r.customer}"`, `"${r.payment_date}"`, r.total_paid_inr, r.interest_paid_inr, r.principal_paid_inr, `"${r.payment_mode}"`].join(','));
            }
            return csvLines.join('\n');
        }
        if (reportType === 'COLLATERAL') {
            const rows = db.prepare(`
        SELECT i.id, i.loan_id, i.category, i.custom_category, i.material, i.material_type, i.purity, i.purity_percent,
               i.gross_weight_grams, i.net_weight_grams,
               i.valuation_paise / 100.0 as valuation_inr,
               i.status
        FROM loan_items i
        ORDER BY i.created_at DESC
      `).all();
            const headers = ['Item ID', 'Loan ID', 'Category', 'Custom Category', 'Material', 'Material Type', 'Purity', 'Purity %', 'Gross Wt (g)', 'Net Wt (g)', 'Valuation (INR)', 'Status'];
            const csvLines = [headers.join(',')];
            for (const r of rows) {
                const catDisplay = (r.category === 'Other Article' || r.category === 'Other') && r.custom_category
                    ? `Other Article — ${r.custom_category}`
                    : r.category;
                csvLines.push([
                    `"${r.id}"`,
                    `"${r.loan_id}"`,
                    `"${catDisplay}"`,
                    `"${r.custom_category || ''}"`,
                    `"${r.material}"`,
                    `"${r.material_type || ''}"`,
                    `"${r.purity}"`,
                    r.purity_percent != null ? r.purity_percent : '',
                    r.gross_weight_grams,
                    r.net_weight_grams,
                    r.valuation_inr,
                    `"${r.status}"`
                ].join(','));
            }
            return csvLines.join('\n');
        }
        // Customers report
        const custRows = db.prepare(`
      SELECT id, full_name, phone, aadhaar_last4, city, state, created_at
      FROM customers WHERE is_deleted = 0 ORDER BY created_at DESC
    `).all();
        const headers = ['Customer ID', 'Full Name', 'Phone', 'Aadhaar Last 4', 'City', 'State', 'Registered Date'];
        const csvLines = [headers.join(',')];
        for (const r of custRows) {
            csvLines.push([`"${r.id}"`, `"${r.full_name}"`, `"${r.phone}"`, `"XXXX-XXXX-${r.aadhaar_last4}"`, `"${r.city}"`, `"${r.state}"`, `"${r.created_at}"`].join(','));
        }
        return csvLines.join('\n');
    }
}
exports.ReportService = ReportService;
