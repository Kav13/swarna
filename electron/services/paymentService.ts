import crypto from 'crypto';
import { getDb } from '../database/connection';
import { Payment, PaymentMode, Loan, PaymentAllocation } from '../types';
import { SettingService } from './settingService';
import { InterestService } from './interestService';
import { AuditService } from './auditService';

export interface RecordPaymentInput {
  loan_id: string;
  payment_amount_paise: number;
  payment_mode: PaymentMode;
  reference_no?: string;
  remarks?: string;
  payment_date?: string;
}

export class PaymentService {
  /**
   * Previews the repayment waterfall allocation without making database changes
   */
  static previewAllocation(loanId: string, amountPaise: number, asOfDate?: string): PaymentAllocation {
    const db = getDb();
    const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(loanId) as Loan | undefined;
    if (!loan) throw new Error('Loan not found');

    if (amountPaise <= 0) throw new Error('Payment amount must be greater than zero');

    // Calculate accrued interest as of today / payment date
    const interestCalc = InterestService.calculateAccruedInterest(loan, asOfDate);
    const totalInterestDue = interestCalc.interest_accrued_paise;
    const currentPrincipalDue = loan.principal_outstanding_paise;

    let remainingPayment = amountPaise;

    // 1. First allocate toward accrued interest
    const interestPaid = Math.min(remainingPayment, totalInterestDue);
    remainingPayment -= interestPaid;

    // 2. Second allocate toward pending fees/charges (if any)
    const feesPaid = 0; // Configured fees if tracked separately

    // 3. Third allocate remaining payment toward principal
    const principalPaid = Math.min(remainingPayment, currentPrincipalDue);
    remainingPayment -= principalPaid;

    const remainingInterest = totalInterestDue - interestPaid;
    const remainingPrincipal = currentPrincipalDue - principalPaid;

    return {
      interest_paid_paise: interestPaid,
      fees_paid_paise: feesPaid,
      principal_paid_paise: principalPaid,
      total_paid_paise: amountPaise - remainingPayment,
      remaining_interest_paise: remainingInterest,
      remaining_principal_paise: remainingPrincipal,
    };
  }

  /**
   * Records a repayment transaction using strict interest-first waterfall allocation in an atomic DB transaction
   */
  static recordPayment(
    input: RecordPaymentInput,
    userId: string,
    username: string
  ): { payment: Payment; loan: Loan; is_closed: boolean } {
    const db = getDb();

    if (input.payment_amount_paise <= 0) {
      throw new Error('Payment amount must be strictly greater than zero.');
    }

    const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(input.loan_id) as Loan | undefined;
    if (!loan) throw new Error(`Loan #${input.loan_id} not found.`);

    if (loan.status === 'CLOSED') {
      throw new Error(`Loan #${input.loan_id} is already closed.`);
    }

    const paymentDate = input.payment_date || new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    // Calculate accrued interest and waterfall allocation
    const interestCalc = InterestService.calculateAccruedInterest(loan, paymentDate);
    const interestDue = interestCalc.interest_accrued_paise;
    const principalDue = loan.principal_outstanding_paise;
    const totalDue = interestDue + principalDue;

    if (input.payment_amount_paise > totalDue) {
      throw new Error(
        `Payment amount (₹${(input.payment_amount_paise / 100).toFixed(2)}) exceeds total outstanding due (₹${(
          totalDue / 100
        ).toFixed(2)}). Overpayments are not permitted.`
      );
    }

    let remainingPay = input.payment_amount_paise;

    // 1. Allocate toward accrued interest first
    const interestPaid = Math.min(remainingPay, interestDue);
    remainingPay -= interestPaid;

    // 2. Fees
    const feesPaid = 0;

    // 3. Allocate remaining payment toward principal
    const principalPaid = Math.min(remainingPay, principalDue);
    remainingPay -= principalPaid;

    const newPrincipalOutstanding = principalDue - principalPaid;
    const newInterestOutstanding = interestDue - interestPaid;

    const isFullSettlement = newPrincipalOutstanding === 0 && newInterestOutstanding === 0;
    const newStatus = isFullSettlement ? 'CLOSED' : principalPaid > 0 ? 'PARTIALLY_PAID' : loan.status;

    const receiptNo = SettingService.generateNextId('RECEIPT');
    const paymentId = `PAY-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const txId = `TX-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

    const executePaymentTx = db.transaction(() => {
      // 1. Insert into payments table
      db.prepare(`
        INSERT INTO payments (
          id, loan_id, receipt_no, payment_date, total_amount_paise,
          interest_paid_paise, fees_paid_paise, principal_paid_paise,
          payment_mode, reference_no, remarks, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        paymentId,
        input.loan_id,
        receiptNo,
        paymentDate,
        input.payment_amount_paise,
        interestPaid,
        feesPaid,
        principalPaid,
        input.payment_mode,
        input.reference_no || null,
        input.remarks || null,
        username,
        now
      );

      // 2. If interest was accrued and not previously recorded in transactions, record interest debit
      if (interestDue > 0) {
        const intAccrualTxId = `TX-${Date.now() - 1}-${crypto.randomBytes(3).toString('hex')}`;
        db.prepare(`
          INSERT INTO loan_transactions (
            id, loan_id, transaction_date, type, debit_paise, credit_paise,
            principal_balance_paise, interest_balance_paise, payment_mode, reference_no,
            description, created_by, is_reversal, created_at
          ) VALUES (?, ?, ?, 'INTEREST_ACCRUAL', ?, 0, ?, ?, NULL, NULL, ?, ?, 0, ?)
        `).run(
          intAccrualTxId,
          input.loan_id,
          paymentDate,
          interestDue,
          principalDue,
          interestDue,
          `Interest accrued up to ${paymentDate} (${interestCalc.billable_days} days)`,
          username,
          now
        );
      }

      // 3. Record Repayment credit in loan_transactions (immutable ledger)
      db.prepare(`
        INSERT INTO loan_transactions (
          id, loan_id, transaction_date, type, debit_paise, credit_paise,
          principal_balance_paise, interest_balance_paise, payment_mode, reference_no,
          description, created_by, is_reversal, created_at
        ) VALUES (?, ?, ?, 'REPAYMENT', 0, ?, ?, ?, ?, ?, ?, ?, 0, ?)
      `).run(
        txId,
        input.loan_id,
        paymentDate,
        input.payment_amount_paise,
        newPrincipalOutstanding,
        newInterestOutstanding,
        input.payment_mode,
        input.reference_no || null,
        `Repayment received via ${input.payment_mode} (Interest: ₹${(interestPaid / 100).toFixed(
          2
        )}, Principal: ₹${(principalPaid / 100).toFixed(2)})`,
        username,
        now
      );

      // 4. Update Loan record
      db.prepare(`
        UPDATE loans SET
          principal_outstanding_paise = ?,
          interest_outstanding_paise = ?,
          status = ?,
          start_date = ?,
          closed_at = ?,
          closed_by = ?
        WHERE id = ?
      `).run(
        newPrincipalOutstanding,
        newInterestOutstanding,
        newStatus,
        paymentDate,
        isFullSettlement ? now : null,
        isFullSettlement ? username : null,
        input.loan_id
      );

      // 5. If fully settled, release all pledged collateral items
      if (isFullSettlement) {
        db.prepare(`
          UPDATE loan_items
          SET status = 'RELEASED'
          WHERE loan_id = ?
        `).run(input.loan_id);

        // Record Closure ledger transaction
        const closureTxId = `TX-${Date.now() + 1}-${crypto.randomBytes(3).toString('hex')}`;
        db.prepare(`
          INSERT INTO loan_transactions (
            id, loan_id, transaction_date, type, debit_paise, credit_paise,
            principal_balance_paise, interest_balance_paise, payment_mode, reference_no,
            description, created_by, is_reversal, created_at
          ) VALUES (?, ?, ?, 'CLOSURE', 0, 0, 0, 0, ?, ?, 'Loan fully settled and closed. All collateral items released.', ?, 0, ?)
        `).run(closureTxId, input.loan_id, paymentDate, input.payment_mode, receiptNo, username, now);
      }
    });

    executePaymentTx();

    AuditService.log(
      userId,
      username,
      isFullSettlement ? 'SETTLE_AND_CLOSE_LOAN' : 'RECORD_REPAYMENT',
      'PAYMENTS',
      paymentId,
      {
        loan_id: input.loan_id,
        old_principal: principalDue,
        old_interest: interestDue,
      },
      {
        total_paid_paise: input.payment_amount_paise,
        interest_paid_paise: interestPaid,
        principal_paid_paise: principalPaid,
        new_principal: newPrincipalOutstanding,
        new_status: newStatus,
        receipt_no: receiptNo,
      },
      isFullSettlement ? 'Full settlement of loan and collateral released' : 'Partial repayment recorded'
    );

    const updatedLoan = db.prepare('SELECT * FROM loans WHERE id = ?').get(input.loan_id) as Loan;
    const paymentRecord = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId) as Payment;

    return {
      payment: paymentRecord,
      loan: updatedLoan,
      is_closed: isFullSettlement,
    };
  }

  /**
   * Retrieves all payments for a given loan
   */
  static getPaymentsByLoanId(loanId: string): Payment[] {
    const db = getDb();
    return db.prepare('SELECT * FROM payments WHERE loan_id = ? ORDER BY payment_date DESC, created_at DESC').all(loanId) as Payment[];
  }
}
