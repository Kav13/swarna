"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerService = void 0;
const connection_1 = require("../database/connection");
const cryptoService_1 = require("./cryptoService");
const settingService_1 = require("./settingService");
const auditService_1 = require("./auditService");
const interestService_1 = require("./interestService");
class CustomerService {
    /**
     * Creates a new customer with encrypted Aadhaar and masked storage
     */
    static createCustomer(data, userId, username) {
        const db = (0, connection_1.getDb)();
        const id = settingService_1.SettingService.generateNextId('CUSTOMER');
        const now = new Date().toISOString();
        const cleanAadhaar = (data.aadhaar_number || '').replace(/\D/g, '');
        let encAadhaar = null;
        let iv = null;
        let tag = null;
        let last4 = '0000';
        if (cleanAadhaar) {
            const encryptedObj = cryptoService_1.CryptoService.encryptAadhaar(cleanAadhaar);
            encAadhaar = encryptedObj.encrypted;
            iv = encryptedObj.iv;
            tag = encryptedObj.tag;
            last4 = cleanAadhaar.slice(-4);
        }
        const stmt = db.prepare(`
      INSERT INTO customers (
        id, full_name, phone, alternate_phone,
        aadhaar_encrypted, aadhaar_iv, aadhaar_tag, aadhaar_last4,
        address, city, state, pincode, remarks,
        created_by, created_at, updated_at, is_deleted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `);
        stmt.run(id, data.full_name.trim(), data.phone.trim(), data.alternate_phone ? data.alternate_phone.trim() : null, encAadhaar, iv, tag, last4, data.address.trim(), data.city.trim(), data.state.trim(), data.pincode.trim(), data.remarks ? data.remarks.trim() : null, username, now, now);
        auditService_1.AuditService.log(userId, username, 'CREATE_CUSTOMER', 'CUSTOMERS', id, undefined, { id, full_name: data.full_name, phone: data.phone }, 'Customer registered');
        return this.getCustomerById(id);
    }
    /**
     * Retrieves a customer by ID with masked Aadhaar
     */
    static getCustomerById(id) {
        const db = (0, connection_1.getDb)();
        const row = db.prepare(`
      SELECT * FROM customers WHERE id = ? AND is_deleted = 0
    `).get(id);
        if (!row)
            return null;
        return {
            id: row.id,
            full_name: row.full_name,
            phone: row.phone,
            alternate_phone: row.alternate_phone || undefined,
            aadhaar_last4: row.aadhaar_last4,
            address: row.address,
            city: row.city,
            state: row.state,
            pincode: row.pincode,
            remarks: row.remarks || undefined,
            created_at: row.created_at,
            updated_at: row.updated_at,
            created_by: row.created_by,
        };
    }
    /**
     * Retrieves full unmasked Aadhaar only for authorized roles with audit log
     */
    static getUnmaskedAadhaar(customerId, userId, username, userRole) {
        if (userRole !== 'OWNER') {
            throw new Error('Access Denied: Only Owner is permitted to unmask full Aadhaar number.');
        }
        const db = (0, connection_1.getDb)();
        const row = db.prepare(`
      SELECT aadhaar_encrypted, aadhaar_iv, aadhaar_tag FROM customers WHERE id = ? AND is_deleted = 0
    `).get(customerId);
        if (!row || !row.aadhaar_encrypted || !row.aadhaar_iv || !row.aadhaar_tag) {
            return '';
        }
        const fullAadhaar = cryptoService_1.CryptoService.decryptAadhaar(row.aadhaar_encrypted, row.aadhaar_iv, row.aadhaar_tag);
        auditService_1.AuditService.log(userId, username, 'VIEW_SENSITIVE_AADHAAR', 'CUSTOMERS', customerId, undefined, undefined, 'Unmasked full Aadhaar for viewing');
        return fullAadhaar;
    }
    /**
     * Updates an existing customer profile
     */
    static updateCustomer(id, data, userId, username) {
        const db = (0, connection_1.getDb)();
        const current = this.getCustomerById(id);
        if (!current)
            throw new Error('Customer not found');
        const now = new Date().toISOString();
        const stmt = db.prepare(`
      UPDATE customers SET
        full_name = COALESCE(?, full_name),
        phone = COALESCE(?, phone),
        alternate_phone = COALESCE(?, alternate_phone),
        address = COALESCE(?, address),
        city = COALESCE(?, city),
        state = COALESCE(?, state),
        pincode = COALESCE(?, pincode),
        remarks = COALESCE(?, remarks),
        updated_at = ?
      WHERE id = ?
    `);
        stmt.run(data.full_name || null, data.phone || null, data.alternate_phone !== undefined ? data.alternate_phone : null, data.address || null, data.city || null, data.state || null, data.pincode || null, data.remarks !== undefined ? data.remarks : null, now, id);
        auditService_1.AuditService.log(userId, username, 'UPDATE_CUSTOMER', 'CUSTOMERS', id, current, data, 'Updated customer details');
        return this.getCustomerById(id);
    }
    /**
     * Searches customers by Name, Phone, ID, Last 4 digits of Aadhaar, or Loan ID
     */
    static searchCustomers(query, limit = 50, offset = 0) {
        const db = (0, connection_1.getDb)();
        const trimmed = (query || '').trim();
        let sql = `
      SELECT c.*,
        (SELECT COUNT(*) FROM loans l WHERE l.customer_id = c.id AND l.status IN ('ACTIVE', 'PARTIALLY_PAID', 'OVERDUE')) as active_loans_count,
        (SELECT COALESCE(SUM(l.principal_outstanding_paise + l.interest_outstanding_paise), 0) FROM loans l WHERE l.customer_id = c.id AND l.status IN ('ACTIVE', 'PARTIALLY_PAID', 'OVERDUE')) as total_outstanding_paise
      FROM customers c
      WHERE c.is_deleted = 0
    `;
        let countSql = `SELECT COUNT(*) as count FROM customers c WHERE c.is_deleted = 0`;
        const params = [];
        const countParams = [];
        if (trimmed) {
            const condition = `
        AND (
          c.full_name LIKE ?
          OR c.phone LIKE ?
          OR c.id LIKE ?
          OR c.aadhaar_last4 LIKE ?
          OR EXISTS (SELECT 1 FROM loans l WHERE l.customer_id = c.id AND l.id LIKE ?)
        )
      `;
            sql += condition;
            countSql += condition;
            const searchPattern = `%${trimmed}%`;
            params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
            countParams.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
        }
        sql += ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);
        const totalRow = db.prepare(countSql).get(...countParams);
        const rows = db.prepare(sql).all(...params);
        const customerIds = rows.filter((r) => r.active_loans_count > 0).map((r) => r.id);
        const activeLoansMap = new Map();
        const today = new Date().toISOString().split('T')[0];
        if (customerIds.length > 0) {
            const placeholders = customerIds.map(() => '?').join(',');
            const activeLoans = db.prepare(`
        SELECT * FROM loans
        WHERE customer_id IN (${placeholders}) AND status IN ('ACTIVE', 'PARTIALLY_PAID', 'OVERDUE')
      `).all(...customerIds);
            for (const l of activeLoans) {
                if (!activeLoansMap.has(l.customer_id)) {
                    activeLoansMap.set(l.customer_id, []);
                }
                activeLoansMap.get(l.customer_id).push(l);
            }
        }
        const customers = rows.map((row) => {
            let dynamicTotalOutstandingPaise = 0;
            const cLoans = activeLoansMap.get(row.id);
            if (cLoans && cLoans.length > 0) {
                for (const l of cLoans) {
                    const calc = interestService_1.InterestService.calculateAccruedInterest(l, today);
                    dynamicTotalOutstandingPaise +=
                        (l.principal_outstanding_paise || 0) +
                            calc.interest_accrued_paise +
                            (l.other_charges_paise || 0);
                }
            }
            else {
                dynamicTotalOutstandingPaise = row.total_outstanding_paise || 0;
            }
            return {
                id: row.id,
                full_name: row.full_name,
                phone: row.phone,
                alternate_phone: row.alternate_phone || undefined,
                aadhaar_last4: row.aadhaar_last4,
                address: row.address,
                city: row.city,
                state: row.state,
                pincode: row.pincode,
                remarks: row.remarks || undefined,
                created_at: row.created_at,
                updated_at: row.updated_at,
                created_by: row.created_by,
                active_loans_count: row.active_loans_count || 0,
                total_outstanding_paise: dynamicTotalOutstandingPaise,
            };
        });
        return {
            customers,
            total: totalRow ? totalRow.count : 0,
        };
    }
    /**
     * Comprehensive customer profile with active loans, closed loans, repayments, and pledged jewellery
     */
    static getCustomerProfile(customerId) {
        const customer = this.getCustomerById(customerId);
        if (!customer)
            return null;
        const db = (0, connection_1.getDb)();
        const today = new Date().toISOString().split('T')[0];
        const loans = db.prepare(`
      SELECT * FROM loans WHERE customer_id = ? ORDER BY loan_date DESC
    `).all(customerId);
        const activeLoans = loans
            .filter((l) => ['ACTIVE', 'PARTIALLY_PAID', 'OVERDUE'].includes(l.status))
            .map((l) => {
            const intCalc = interestService_1.InterestService.calculateAccruedInterest(l, today);
            return {
                ...l,
                accrued_interest_paise: intCalc.interest_accrued_paise,
                total_due_paise: (l.principal_outstanding_paise || 0) +
                    intCalc.interest_accrued_paise +
                    (l.other_charges_paise || 0),
            };
        });
        const closedLoans = loans.filter((l) => l.status === 'CLOSED');
        const totalPrincipalOutstanding = activeLoans.reduce((sum, l) => sum + (l.principal_outstanding_paise || 0), 0);
        const totalInterestOutstanding = activeLoans.reduce((sum, l) => sum + (l.accrued_interest_paise || 0), 0);
        const totalOtherCharges = activeLoans.reduce((sum, l) => sum + (l.other_charges_paise || 0), 0);
        const totalDues = totalPrincipalOutstanding + totalInterestOutstanding + totalOtherCharges;
        const repaymentsRow = db.prepare(`
      SELECT COALESCE(SUM(p.total_amount_paise), 0) as total_repayments
      FROM payments p
      INNER JOIN loans l ON p.loan_id = l.id
      WHERE l.customer_id = ?
    `).get(customerId);
        // Get pledged jewellery items
        const pledgedItems = db.prepare(`
      SELECT i.* FROM loan_items i
      INNER JOIN loans l ON i.loan_id = l.id
      WHERE l.customer_id = ? AND i.status = 'PLEDGED'
      ORDER BY i.created_at DESC
    `).all(customerId);
        // Get recent transactions
        const recentTx = db.prepare(`
      SELECT t.* FROM loan_transactions t
      INNER JOIN loans l ON t.loan_id = l.id
      WHERE l.customer_id = ?
      ORDER BY t.transaction_date DESC LIMIT 20
    `).all(customerId);
        return {
            customer,
            active_loans: activeLoans,
            closed_loans: closedLoans,
            total_principal_outstanding_paise: totalPrincipalOutstanding,
            total_interest_outstanding_paise: totalInterestOutstanding,
            total_other_charges_paise: totalOtherCharges,
            total_dues_paise: totalDues,
            total_repayments_paise: repaymentsRow ? repaymentsRow.total_repayments : 0,
            pledged_items: pledgedItems,
            recent_transactions: recentTx,
        };
    }
}
exports.CustomerService = CustomerService;
