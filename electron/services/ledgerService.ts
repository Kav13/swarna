import crypto from 'crypto';
import { getDb } from '../database/connection';
import { LoanTransaction } from '../types';
import { AuditService } from './auditService';

export class LedgerService {
  /**
   * Retrieves full chronological ledger for a specific loan
   */
  static getLedgerByLoanId(loanId: string): LoanTransaction[] {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM loan_transactions
      WHERE loan_id = ?
      ORDER BY transaction_date ASC, created_at ASC
    `).all(loanId) as LoanTransaction[];
  }

  /**
   * Reverses or adjusts a transaction by creating an offsetting reversal transaction.
   * Never modifies or erases historical records.
   */
  static reverseTransaction(
    transactionId: string,
    reason: string,
    userId: string,
    username: string,
    userRole: string
  ): LoanTransaction {
    if (userRole !== 'OWNER') {
      throw new Error('Access Denied: Only Owner can authorize financial transaction reversals.');
    }

    if (!reason || !reason.trim()) {
      throw new Error('An explicit justification reason is required for a financial reversal.');
    }

    const db = getDb();
    const origTx = db.prepare('SELECT * FROM loan_transactions WHERE id = ?').get(transactionId) as LoanTransaction | undefined;
    if (!origTx) throw new Error('Transaction not found');
    if (origTx.is_reversal) throw new Error('Cannot reverse an existing reversal transaction');

    const now = new Date().toISOString();
    const newTxId = `TX-REV-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

    // Create offsetting debit/credit
    const offsettingDebit = origTx.credit_paise;
    const offsettingCredit = origTx.debit_paise;

    const reverseTx = db.transaction(() => {
      // 1. Insert offsetting reversal transaction
      db.prepare(`
        INSERT INTO loan_transactions (
          id, loan_id, transaction_date, type, debit_paise, credit_paise,
          principal_balance_paise, interest_balance_paise, payment_mode, reference_no,
          description, created_by, is_reversal, reversed_transaction_id, created_at
        ) VALUES (?, ?, ?, 'REVERSAL', ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `).run(
        newTxId,
        origTx.loan_id,
        now.split('T')[0],
        offsettingDebit,
        offsettingCredit,
        origTx.principal_balance_paise,
        origTx.interest_balance_paise,
        origTx.payment_mode || null,
        origTx.reference_no || null,
        `Reversal of Tx #${origTx.id}: ${reason}`,
        username,
        origTx.id,
        now
      );

      // 2. Mark original transaction
      db.prepare(`
        UPDATE loan_transactions SET is_reversal = 1 WHERE id = ?
      `).run(origTx.id);
    });

    reverseTx();

    AuditService.log(
      userId,
      username,
      'REVERSE_TRANSACTION',
      'LEDGER',
      transactionId,
      origTx,
      { reversal_tx_id: newTxId, reason },
      `Reversed transaction #${transactionId}: ${reason}`
    );

    return db.prepare('SELECT * FROM loan_transactions WHERE id = ?').get(newTxId) as LoanTransaction;
  }
}
