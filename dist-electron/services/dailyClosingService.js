"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DailyClosingService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const connection_1 = require("../database/connection");
const auditService_1 = require("./auditService");
class DailyClosingService {
    /**
     * Computes the daily closing summary for a given business date
     */
    static getDailySummary(dateStr) {
        const db = (0, connection_1.getDb)();
        const targetDate = dateStr || new Date().toISOString().split('T')[0];
        // Check if closing was already officially executed and saved
        const saved = db.prepare('SELECT * FROM daily_closings WHERE closing_date = ?').get(targetDate);
        if (saved) {
            return saved;
        }
        // Otherwise calculate live figures for today
        // 1. Total disbursed
        const disbRow = db.prepare(`
      SELECT COALESCE(SUM(principal_paise), 0) as total_disbursed, COUNT(*) as loans_opened
      FROM loans
      WHERE loan_date = ?
    `).get(targetDate);
        // 2. Total collected and payment mode breakdown
        const payRows = db.prepare(`
      SELECT payment_mode, COALESCE(SUM(total_amount_paise), 0) as amount
      FROM payments
      WHERE payment_date = ?
      GROUP BY payment_mode
    `).all(targetDate);
        let totalCollected = 0;
        let cash = 0;
        let upi = 0;
        let bank = 0;
        let cheque = 0;
        for (const r of payRows) {
            totalCollected += r.amount;
            if (r.payment_mode === 'CASH')
                cash += r.amount;
            else if (r.payment_mode === 'UPI')
                upi += r.amount;
            else if (r.payment_mode === 'BANK_TRANSFER')
                bank += r.amount;
            else if (r.payment_mode === 'CHEQUE')
                cheque += r.amount;
        }
        // 3. Closed loans today
        const closedRow = db.prepare(`
      SELECT COUNT(*) as loans_closed
      FROM loans
      WHERE status = 'CLOSED' AND date(closed_at) = ?
    `).get(targetDate);
        const netCashFlow = totalCollected - (disbRow?.total_disbursed || 0);
        return {
            id: `DC-${targetDate}`,
            closing_date: targetDate,
            total_disbursed_paise: disbRow?.total_disbursed || 0,
            total_collected_paise: totalCollected,
            cash_collected_paise: cash,
            upi_collected_paise: upi,
            bank_collected_paise: bank,
            cheque_collected_paise: cheque,
            total_loans_opened: disbRow?.loans_opened || 0,
            total_loans_closed: closedRow?.loans_closed || 0,
            net_cash_flow_paise: netCashFlow,
            closed_by: 'Pending Closure',
            closed_at: '',
        };
    }
    /**
     * Finalizes and commits the daily business register closing
     */
    static commitDailyClosing(dateStr, userId, username) {
        const db = (0, connection_1.getDb)();
        const summary = this.getDailySummary(dateStr);
        const now = new Date().toISOString();
        const id = `DC-${dateStr}-${crypto_1.default.randomBytes(3).toString('hex')}`;
        db.prepare(`
      INSERT INTO daily_closings (
        id, closing_date, total_disbursed_paise, total_collected_paise,
        cash_collected_paise, upi_collected_paise, bank_collected_paise, cheque_collected_paise,
        total_loans_opened, total_loans_closed, net_cash_flow_paise,
        closed_by, closed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(closing_date) DO UPDATE SET
        total_disbursed_paise = excluded.total_disbursed_paise,
        total_collected_paise = excluded.total_collected_paise,
        cash_collected_paise = excluded.cash_collected_paise,
        upi_collected_paise = excluded.upi_collected_paise,
        bank_collected_paise = excluded.bank_collected_paise,
        cheque_collected_paise = excluded.cheque_collected_paise,
        total_loans_opened = excluded.total_loans_opened,
        total_loans_closed = excluded.total_loans_closed,
        net_cash_flow_paise = excluded.net_cash_flow_paise,
        closed_by = excluded.closed_by,
        closed_at = excluded.closed_at
    `).run(id, dateStr, summary.total_disbursed_paise, summary.total_collected_paise, summary.cash_collected_paise, summary.upi_collected_paise, summary.bank_collected_paise, summary.cheque_collected_paise, summary.total_loans_opened, summary.total_loans_closed, summary.net_cash_flow_paise, username, now);
        auditService_1.AuditService.log(userId, username, 'DAILY_CLOSING', 'CLOSING', id, undefined, summary, `Committed daily business register closing for ${dateStr}`);
        return {
            ...summary,
            id,
            closed_by: username,
            closed_at: now,
        };
    }
}
exports.DailyClosingService = DailyClosingService;
