import crypto from 'crypto';
import { getDb } from '../database/connection';
import { AuditLog } from '../types';

export class AuditService {
  /**
   * Records an immutable audit log entry
   */
  static log(
    userId: string,
    username: string,
    action: string,
    module: string,
    recordId?: string,
    prevValue?: any,
    newValue?: any,
    reason?: string
  ): void {
    const db = getDb();
    const id = `AUD-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
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
  static getLogs(filters?: {
    module?: string;
    userId?: string;
    recordId?: string;
    limit?: number;
    offset?: number;
  }): { logs: AuditLog[]; total: number } {
    const db = getDb();
    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as count FROM audit_logs WHERE 1=1';
    const params: any[] = [];
    const countParams: any[] = [];

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

    const totalRow = db.prepare(countQuery).get(...countParams) as { count: number };
    const logs = db.prepare(query).all(...params) as AuditLog[];

    return {
      logs,
      total: totalRow ? totalRow.count : 0,
    };
  }
}
