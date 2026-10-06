"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const connection_1 = require("../database/connection");
class AuditService {
    /**
     * Records an immutable audit log entry
     */
    static log(userId, username, action, module, recordId, prevValue, newValue, reason) {
        const db = (0, connection_1.getDb)();
        const id = `AUD-${Date.now()}-${crypto_1.default.randomBytes(4).toString('hex')}`;
        const timestamp = new Date().toISOString();
        const prevStr = prevValue !== undefined ? JSON.stringify(prevValue) : null;
        const newStr = newValue !== undefined ? JSON.stringify(newValue) : null;
        const stmt = db.prepare(`
      INSERT INTO audit_logs (id, timestamp, user_id, username, action, module, record_id, previous_value, new_value, reason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, timestamp, userId, username, action, module, recordId || null, prevStr, newStr, reason || null);
    }
    /**
     * Retrieves audit logs with optional filters and pagination
     */
    static getLogs(filters) {
        const db = (0, connection_1.getDb)();
        let query = 'SELECT * FROM audit_logs WHERE 1=1';
        let countQuery = 'SELECT COUNT(*) as count FROM audit_logs WHERE 1=1';
        const params = [];
        const countParams = [];
        if (filters?.module) {
            query += ' AND module = ?';
            countQuery += ' AND module = ?';
            params.push(filters.module);
            countParams.push(filters.module);
        }
        if (filters?.userId) {
            query += ' AND user_id = ?';
            countQuery += ' AND user_id = ?';
            params.push(filters.userId);
            countParams.push(filters.userId);
        }
        if (filters?.recordId) {
            query += ' AND record_id = ?';
            countQuery += ' AND record_id = ?';
            params.push(filters.recordId);
            countParams.push(filters.recordId);
        }
        query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
        params.push(filters?.limit || 100, filters?.offset || 0);
        const totalRow = db.prepare(countQuery).get(...countParams);
        const logs = db.prepare(query).all(...params);
        return {
            logs,
            total: totalRow ? totalRow.count : 0,
        };
    }
}
exports.AuditService = AuditService;
