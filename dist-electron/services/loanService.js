"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoanService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const connection_1 = require("../database/connection");
const settingService_1 = require("./settingService");
const valuationService_1 = require("./valuationService");
const auditService_1 = require("./auditService");
const authService_1 = require("./authService");
const categoryService_1 = require("./categoryService");
const materialTypeService_1 = require("./materialTypeService");
const interestService_1 = require("./interestService");
class LoanService {
    /**
     * Creates a new loan with multi-item collateral and disbursement transaction inside an atomic DB transaction
     */
    static createLoan(input, userId, username, userRole) {
        const db = (0, connection_1.getDb)();
        if (!input.customer_id)
            throw new Error('Customer ID is required');
        if (!input.items || input.items.length === 0)
            throw new Error('At least one jewellery item must be pledged');
        if (input.principal_paise <= 0)
            throw new Error('Principal loan amount must be greater than zero');
        const todayStr = new Date().toISOString().split('T')[0];
        const loanDateStr = (input.loan_date || todayStr).split('T')[0];
        // Validate future dates
        if (loanDateStr > todayStr) {
            throw new Error('Future loan dates are not permitted.');
        }
        const isBackdated = loanDateStr < todayStr;
        if (isBackdated) {
            if (userRole !== 'OWNER') {
                const perms = authService_1.AuthService.getUserPermissions(userId, userRole);
                if (!perms['CREATE_BACKDATED_LOAN']) {
                    throw new Error('Access Denied: You do not have permission to create backdated loans. Owner authorization required.');
                }
            }
            if (!input.backdate_reason?.trim()) {
                throw new Error('A mandatory reason for backdating is required for historical loan records.');
            }
        }
        // Validate each jewellery item & normalize category and material type snapshot
        for (let i = 0; i < input.items.length; i++) {
            const item = input.items[i];
            const isOther = item.category === 'Other Article' || item.category === 'Other';
            if (isOther) {
                item.category = 'Other Article';
                const trimmedCustom = item.custom_category?.trim();
                if (!trimmedCustom) {
                    throw new Error('Please enter the custom article category.');
                }
                item.custom_category = trimmedCustom;
                // Register custom category for future reuse
                try {
                    categoryService_1.CategoryService.createCustomCategory(trimmedCustom, userId, username);
                }
                catch { }
            }
            else {
                item.custom_category = undefined;
            }
            // Snapshot Material Type & Purity Percentage
            if (!item.material_type || item.purity_percent == null) {
                const foundMt = materialTypeService_1.MaterialTypeService.findMaterialType(item.material, item.material_type || item.purity);
                if (foundMt) {
                    item.material_type = item.material_type || foundMt.name;
                    item.purity_percent = item.purity_percent ?? foundMt.purity_percent;
                }
                else if (item.material === 'GOLD') {
                    const kNum = parseFloat(item.purity.replace(/[^0-9.]/g, ''));
                    if (!isNaN(kNum) && kNum > 0) {
                        item.purity_percent = item.purity_percent ?? (Math.round((kNum / 24) * 10000) / 100);
                        item.material_type = item.material_type || `${kNum}K Gold`;
                    }
                    else {
                        item.material_type = item.material_type || item.purity;
                    }
                }
                else if (item.material === 'SILVER') {
                    const fNum = parseFloat(item.purity.replace(/[^0-9.]/g, ''));
                    if (!isNaN(fNum) && fNum > 0) {
                        item.purity_percent = item.purity_percent ?? (Math.round((fNum / 10) * 100) / 100);
                        item.material_type = item.material_type || `Silver ${fNum}`;
                    }
                    else {
                        item.material_type = item.material_type || item.purity;
                    }
                }
                else {
                    item.material_type = item.material_type || item.purity;
                }
            }
        }
        // Calculate valuation summary
        const summary = valuationService_1.ValuationService.calculateMultiItemSummary(input.items, input.ltv_percent, input.principal_paise);
        // Enforce LTV ceiling unless Owner override is present
        if (!summary.is_eligible && !input.is_override) {
            throw new Error(`Loan amount (₹${(input.principal_paise / 100).toFixed(2)}) exceeds maximum eligible loan (₹${(summary.total_max_loan_paise / 100).toFixed(2)}) by ₹${(summary.excess_amount_paise / 100).toFixed(2)}. Owner override required.`);
        }
        if (input.is_override && userRole !== 'OWNER') {
            throw new Error('Access Denied: Only Owner can authorize an LTV ceiling override.');
        }
        if (input.is_override && !input.override_reason?.trim()) {
            throw new Error('An explicit reason is required for an LTV override.');
        }
        const loanId = settingService_1.SettingService.generateNextId('LOAN');
        const now = new Date().toISOString();
        const settings = settingService_1.SettingService.getSettings();
        const minDays = input.min_interest_days ?? settings.default_min_interest_days ?? 15;
        const graceDays = input.grace_period_days ?? settings.default_grace_period_days ?? 7;
        const createLoanTx = db.transaction(() => {
            // 1. Insert Loan record
            const insertLoan = db.prepare(`
        INSERT INTO loans (
          id, customer_id, loan_date, start_date, due_date,
          principal_paise, interest_rate_percent, interest_period, interest_method,
          min_interest_days, grace_period_days, processing_fee_paise, other_charges_paise,
          principal_outstanding_paise, interest_outstanding_paise,
          status, ltv_percent, total_valuation_paise, is_override, override_reason,
          backdate_reason, import_batch_id,
          remarks, created_by, created_at
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, 0,
          'ACTIVE', ?, ?, ?, ?,
          ?, ?,
          ?, ?, ?
        )
      `);
            insertLoan.run(loanId, input.customer_id, loanDateStr, loanDateStr, // start_date corresponds to actual business loan_date
            input.due_date, input.principal_paise, input.interest_rate_percent, input.interest_period, input.interest_method, minDays, graceDays, input.processing_fee_paise || 0, input.other_charges_paise || 0, input.principal_paise, input.ltv_percent, summary.total_valuation_paise, input.is_override ? 1 : 0, input.override_reason || null, input.backdate_reason || null, input.import_batch_id || null, input.remarks || null, username, now);
            // 2. Insert Collateral Items
            const insertItem = db.prepare(`
        INSERT INTO loan_items (
          id, loan_id, category, custom_category, description, material, material_type, purity, purity_percent,
          gross_weight_grams, stone_weight_grams, net_weight_grams,
          rate_per_gram_paise, valuation_paise, max_loan_paise, allocated_loan_paise,
          condition, status, remarks, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PLEDGED', ?, ?)
      `);
            for (let i = 0; i < input.items.length; i++) {
                const item = input.items[i];
                const itemId = `${loanId}-ITM-${i + 1}`;
                const itemVal = valuationService_1.ValuationService.calculateItemValuation(item.gross_weight_grams, item.stone_weight_grams, item.rate_per_gram_paise, input.ltv_percent, item.allocated_loan_paise);
                insertItem.run(itemId, loanId, item.category, item.custom_category || null, item.description, item.material, item.material_type || null, item.purity, item.purity_percent ?? null, item.gross_weight_grams, item.stone_weight_grams || 0, itemVal.net_weight_grams, item.rate_per_gram_paise, itemVal.valuation_paise, itemVal.max_loan_paise, item.allocated_loan_paise, item.condition || 'GOOD', item.remarks || null, now);
            }
            // 3. Record Initial Disbursement in Loan Transactions (Ledger)
            const txId = `TX-${Date.now()}-${crypto_1.default.randomBytes(3).toString('hex')}`;
            const insertTx = db.prepare(`
        INSERT INTO loan_transactions (
          id, loan_id, transaction_date, type, debit_paise, credit_paise,
          principal_balance_paise, interest_balance_paise, payment_mode, reference_no,
          description, created_by, is_reversal, created_at
        ) VALUES (?, ?, ?, 'DISBURSEMENT', ?, 0, ?, 0, ?, ?, ?, ?, 0, ?)
      `);
            insertTx.run(txId, loanId, loanDateStr, input.principal_paise, input.principal_paise, input.payment_mode, input.disbursement_reference || null, `Loan disbursed to customer via ${input.payment_mode}`, username, now);
            // If processing fee applies, record fee debit transaction
            if (input.processing_fee_paise && input.processing_fee_paise > 0) {
                const feeTxId = `TX-${Date.now() + 1}-${crypto_1.default.randomBytes(3).toString('hex')}`;
                insertTx.run(feeTxId, loanId, loanDateStr, input.processing_fee_paise, input.principal_paise, input.payment_mode, null, `Processing fee debited: ₹${(input.processing_fee_paise / 100).toFixed(2)}`, username, now);
            }
        });
        createLoanTx();
        let auditDesc = 'New loan created and disbursed';
        if (isBackdated) {
            auditDesc = `Backdated loan created | Loan Date: ${loanDateStr} | Entered into system: ${now} | Reason: ${input.backdate_reason?.trim()}`;
        }
        else if (input.is_override) {
            auditDesc = `Loan created with LTV override: ${input.override_reason}`;
        }
        auditService_1.AuditService.log(userId, username, isBackdated ? 'CREATE_BACKDATED_LOAN' : 'CREATE_LOAN', 'LOANS', loanId, undefined, {
            loan_id: loanId,
            loan_date: loanDateStr,
            created_at: now,
            principal_paise: input.principal_paise,
            customer_id: input.customer_id,
            is_backdated: isBackdated,
            backdate_reason: input.backdate_reason || null,
            entered_by: username,
        }, auditDesc);
        return this.getLoanById(loanId);
    }
    /**
     * Retrieves loan by ID including customer metadata and collateral items
     */
    static getLoanById(id) {
        const db = (0, connection_1.getDb)();
        const loan = db.prepare(`
      SELECT l.*, c.full_name as customer_name, c.phone as customer_phone
      FROM loans l
      INNER JOIN customers c ON l.customer_id = c.id
      WHERE l.id = ?
    `).get(id);
        if (!loan)
            return null;
        const items = db.prepare(`
      SELECT * FROM loan_items WHERE loan_id = ? ORDER BY id ASC
    `).all(id);
        return {
            ...loan,
            is_override: Boolean(loan.is_override),
            items,
        };
    }
    /**
     * Query loans with filtering, sorting, and pagination
     */
    static getLoans(filters) {
        const db = (0, connection_1.getDb)();
        let sql = `
      SELECT l.*, c.full_name as customer_name, c.phone as customer_phone
      FROM loans l
      INNER JOIN customers c ON l.customer_id = c.id
      WHERE 1=1
    `;
        let countSql = `
      SELECT COUNT(*) as count
      FROM loans l
      INNER JOIN customers c ON l.customer_id = c.id
      WHERE 1=1
    `;
        const params = [];
        const countParams = [];
        if (filters?.status) {
            sql += ' AND l.status = ?';
            countSql += ' AND l.status = ?';
            params.push(filters.status);
            countParams.push(filters.status);
        }
        if (filters?.customerId) {
            sql += ' AND l.customer_id = ?';
            countSql += ' AND l.customer_id = ?';
            params.push(filters.customerId);
            countParams.push(filters.customerId);
        }
        if (filters?.search) {
            const condition = ` AND (l.id LIKE ? OR c.full_name LIKE ? OR c.phone LIKE ?)`;
            sql += condition;
            countSql += condition;
            const term = `%${filters.search.trim()}%`;
            params.push(term, term, term);
            countParams.push(term, term, term);
        }
        if (filters?.startDate) {
            sql += ' AND l.loan_date >= ?';
            countSql += ' AND l.loan_date >= ?';
            params.push(filters.startDate);
            countParams.push(filters.startDate);
        }
        if (filters?.endDate) {
            sql += ' AND l.loan_date <= ?';
            countSql += ' AND l.loan_date <= ?';
            params.push(filters.endDate);
            countParams.push(filters.endDate);
        }
        sql += ' ORDER BY l.loan_date DESC, l.created_at DESC LIMIT ? OFFSET ?';
        params.push(filters?.limit || 50, filters?.offset || 0);
        const totalRow = db.prepare(countSql).get(...countParams);
        const rows = db.prepare(sql).all(...params);
        const today = new Date().toISOString().split('T')[0];
        const loans = rows.map((r) => {
            let accruedInterestPaise = r.interest_outstanding_paise || 0;
            if (['ACTIVE', 'PARTIALLY_PAID', 'OVERDUE'].includes(r.status)) {
                const intCalc = interestService_1.InterestService.calculateAccruedInterest(r, today);
                accruedInterestPaise = intCalc.interest_accrued_paise;
            }
            return {
                ...r,
                is_override: Boolean(r.is_override),
                accrued_interest_paise: accruedInterestPaise,
                total_due_paise: (r.principal_outstanding_paise || 0) +
                    accruedInterestPaise +
                    (r.other_charges_paise || 0),
            };
        });
        return {
            loans,
            total: totalRow ? totalRow.count : 0,
        };
    }
    /**
     * Evaluates due dates and marks active loans as OVERDUE if past maturity + grace period
     */
    static refreshOverdueStatuses() {
        const db = (0, connection_1.getDb)();
        const today = new Date().toISOString().split('T')[0];
        // Status goes to OVERDUE if due_date + grace_period_days < today
        db.prepare(`
      UPDATE loans
      SET status = 'OVERDUE'
      WHERE status IN ('ACTIVE', 'PARTIALLY_PAID')
        AND date(due_date, '+' || grace_period_days || ' days') < ?
    `).run(today);
    }
}
exports.LoanService = LoanService;
