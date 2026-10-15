import React, { useState, useEffect } from 'react';
import {
  Receipt,
  AlertCircle,
  Coins,
  CheckCircle2,
  Printer,
  Search,
} from 'lucide-react';
import { Loan, PaymentMode, PaymentAllocation } from '../types';
import { formatINR } from '../utils/currency';
import { getTodayISO } from '../utils/dates';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { CurrencyInput } from '../components/common/CurrencyInput';
import { api } from '../api';

interface RepaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedLoanId?: string;
  onPaymentSuccess: (paymentId: string, isClosed: boolean) => void;
}

export const RepaymentModal: React.FC<RepaymentModalProps> = ({
  isOpen,
  onClose,
  preselectedLoanId,
  onPaymentSuccess,
}) => {
  const [loanId, setLoanId] = useState<string>(preselectedLoanId || '');
  const [loan, setLoan] = useState<Loan | null>(null);
  const [activeLoans, setActiveLoans] = useState<Loan[]>([]);
  const [paymentAmountRupees, setPaymentAmountRupees] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState<string>(getTodayISO());
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('CASH');
  const [referenceNo, setReferenceNo] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');

  const [allocation, setAllocation] = useState<PaymentAllocation | null>(null);
  const [accruedInterestPaise, setAccruedInterestPaise] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Fetch active loans list if not preselected
  useEffect(() => {
    const fetchActiveLoans = async () => {
      try {
        if (window.api) {
          const res = await window.api.loans.getLoans({ limit: 100 });
          setActiveLoans((res.loans || []).filter((l: any) => l.status !== 'CLOSED'));
        }
      } catch (err) {
        console.error(err);
      }
    };
    if (isOpen) {
      fetchActiveLoans();
    }
  }, [isOpen]);

  // Load selected loan details & compute accrued interest
  useEffect(() => {
    const loadSelectedLoan = async () => {
      if (!loanId) {
        setLoan(null);
        setAllocation(null);
        return;
      }

      setLoading(true);
      setError('');
      try {
        if (window.api) {
          const l = await window.api.loans.getLoanById(loanId);
          if (l) {
            setLoan(l);
            const intCalc = await window.api.interest.calculateAccruedInterest(l, paymentDate);
            setAccruedInterestPaise(intCalc.interest_accrued_paise);
          }
        }
      } catch (err: any) {
        setError(err?.message || 'Error fetching loan details');
      } finally {
        setLoading(false);
      }
    };

    if (isOpen && loanId) {
      loadSelectedLoan();
    }
  }, [isOpen, loanId, paymentDate]);

  // Update live allocation preview whenever payment amount changes
  useEffect(() => {
    const updatePreview = async () => {
      if (!loan || paymentAmountRupees <= 0) {
        setAllocation(null);
        return;
      }

      try {
        if (window.api) {
          const amountPaise = paymentAmountRupees * 100;
          const alloc = await window.api.payments.previewAllocation(loan.id, amountPaise, paymentDate);
          setAllocation(alloc);
        }
      } catch (err) {
        console.error(err);
      }
    };

    updatePreview();
  }, [loan, paymentAmountRupees, paymentDate]);

  const handlePayFullInterest = () => {
    setPaymentAmountRupees(accruedInterestPaise / 100);
  };

  const handlePayFullSettlement = () => {
    if (loan) {
      setPaymentAmountRupees((loan.principal_outstanding_paise + accruedInterestPaise) / 100);
    }
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!loan) {
      setError('Please select an active loan.');
      return;
    }

    const amountPaise = paymentAmountRupees * 100;
    if (amountPaise <= 0) {
      setError('Payment amount must be greater than zero.');
      return;
    }

    const totalDue = loan.principal_outstanding_paise + accruedInterestPaise;
    if (amountPaise > totalDue) {
      setError(
        `Payment amount (${formatINR(amountPaise)}) exceeds total due (${formatINR(totalDue)}). Overpayment is not permitted.`
      );
      return;
    }

    setSubmitting(true);
    try {
      if (!window.api) throw new Error('Desktop IPC bridge not available');

      const res = await window.api.payments.recordPayment({
        loan_id: loan.id,
        payment_amount_paise: amountPaise,
        payment_mode: paymentMode,
        reference_no: referenceNo,
        remarks,
        payment_date: paymentDate,
      });

      onPaymentSuccess(res.payment.id, res.is_closed);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record repayment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Record Loan Repayment" maxWidth="2xl">
      {error && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmitPayment} className="space-y-4 text-xs">
        {/* Step 1: Select Loan */}
        <div>
          <label className="block font-medium text-slate-700 mb-1">Select Active Loan *</label>
          <select
            required
            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono text-xs focus:outline-none focus:border-amber-500"
            value={loanId}
            onChange={(e) => setLoanId(e.target.value)}
          >
            <option value="">-- Choose Active Loan --</option>
            {activeLoans.map((l) => (
              <option key={l.id} value={l.id}>
                {l.id} &bull; {l.customer_name} &bull; Bal: {formatINR(l.principal_outstanding_paise)}
              </option>
            ))}
          </select>
        </div>

        {loan && (
          <>
            {/* Live Loan Summary Box */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div>
                  <span className="font-bold text-slate-900">{loan.customer_name}</span>
                  <span className="text-slate-400 font-mono ml-2">({loan.customer_phone})</span>
                </div>
                <span className="font-mono text-slate-600 text-[11px]">Due: {loan.due_date}</span>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                  <span className="text-slate-400 text-[11px]">Principal Due</span>
                  <div className="text-sm font-bold font-mono text-slate-900 mt-0.5">
                    {formatINR(loan.principal_outstanding_paise)}
                  </div>
                </div>

                <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                  <span className="text-slate-400 text-[11px]">Interest Accrued</span>
                  <div className="text-sm font-bold font-mono text-amber-600 mt-0.5">
                    {formatINR(accruedInterestPaise)}
                  </div>
                </div>

                <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-lg">
                  <span className="text-amber-800 text-[11px] font-semibold">Total Settle Due</span>
                  <div className="text-sm font-bold font-mono text-slate-950 mt-0.5">
                    {formatINR(loan.principal_outstanding_paise + accruedInterestPaise)}
                  </div>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-slate-500 text-[11px]">Quick Amount:</span>
                <button
                  type="button"
                  onClick={handlePayFullInterest}
                  className="px-2.5 py-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 font-medium text-[11px] transition-colors"
                >
                  Pay Accrued Interest Only ({formatINR(accruedInterestPaise)})
                </button>
                <button
                  type="button"
                  onClick={handlePayFullSettlement}
                  className="px-2.5 py-1 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-bold text-[11px] transition-colors"
                >
                  Full Settlement & Close Loan
                </button>
              </div>
            </div>

            {/* Step 2: Payment Inputs */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Payment Amount Received (₹) *
                </label>
                <CurrencyInput
                  required
                  autoFocus
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono font-bold text-sm focus:outline-none focus:border-amber-500"
                  value={paymentAmountRupees}
                  onChange={(val) => setPaymentAmountRupees(val)}
                  placeholder="Enter amount"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Payment Mode *</label>
                <select
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-semibold"
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
                >
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI Direct</option>
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Payment Date</label>
                <input
                  type="date"
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">UTR / Cheque Reference</label>
                <input
                  type="text"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono"
                  placeholder="Optional reference / transaction ID"
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Remarks</label>
                <input
                  type="text"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
                  placeholder="Remarks on receipt..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </div>
            </div>

            {/* Step 3: Repayment Waterfall Allocation Breakdown Preview */}
            {allocation && (
              <div className="p-4 bg-amber-50/70 border border-amber-300 rounded-xl space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900 block">
                  Waterfall Allocation Breakdown:
                </span>

                <div className="space-y-1.5 text-xs text-slate-800">
                  <div className="flex justify-between items-center py-1 border-b border-amber-200">
                    <span className="flex items-center gap-1.5">
                      1. Accrued Interest Allocation:
                    </span>
                    <span className="font-mono font-bold text-amber-800">
                      {formatINR(allocation.interest_paid_paise)} &rarr; Paid
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-amber-200">
                    <span className="flex items-center gap-1.5">
                      2. Principal Balance Reduction:
                    </span>
                    <span className="font-mono font-bold text-emerald-700">
                      {formatINR(allocation.principal_paid_paise)} &rarr; Paid
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1 pt-2 font-bold text-slate-900">
                    <span>Remaining Principal Balance:</span>
                    <span className="font-mono text-sm">
                      {formatINR(allocation.remaining_principal_paise)}
                    </span>
                  </div>
                </div>

                {allocation.remaining_principal_paise === 0 &&
                  allocation.remaining_interest_paise === 0 && (
                    <div className="mt-2 p-2 bg-emerald-100 border border-emerald-300 rounded-lg text-emerald-900 font-bold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Full Settlement &bull; All collateral will be released upon confirmation!</span>
                    </div>
                  )}
              </div>
            )}
          </>
        )}

        {/* Buttons */}
        <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>

          <Button
            type="submit"
            variant="gold"
            isLoading={submitting}
            disabled={!loan || paymentAmountRupees <= 0}
            icon={<CheckCircle2 className="w-4 h-4" />}
          >
            Confirm & Record Payment ({formatINR(paymentAmountRupees * 100)})
          </Button>
        </div>
      </form>
    </Modal>
  );
};
