import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Coins,
  Receipt,
  Printer,
  Gem,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  User,
} from 'lucide-react';
import { Loan, JewelleryItem, LoanTransaction, Payment, AuditLog } from '../types';
import { formatINR, formatWeight } from '../utils/currency';
import { formatDate, formatDateTime } from '../utils/dates';
import { formatItemCategory, formatItemMaterial } from '../utils/purity';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { api } from '../api';

interface LoanDetailsViewProps {
  loanId: string;
  onBack: () => void;
  onRecordPayment: (loanId: string) => void;
  onPrintPledgeReceipt: (loanId: string) => void;
  onPrintPaymentReceipt: (paymentId: string) => void;
  onPrintClosureReceipt: (loanId: string) => void;
  onSelectCustomer: (customerId: string) => void;
  refreshTrigger?: number;
}

export const LoanDetailsView: React.FC<LoanDetailsViewProps> = ({
  loanId,
  onBack,
  onRecordPayment,
  onPrintPledgeReceipt,
  onPrintPaymentReceipt,
  onPrintClosureReceipt,
  onSelectCustomer,
  refreshTrigger,
}) => {
  const { isOwner } = useAuth();
  const [loan, setLoan] = useState<Loan | null>(null);
  const [ledger, setLedger] = useState<LoanTransaction[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [accruedInterestPaise, setAccruedInterestPaise] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'jewellery' | 'ledger' | 'payments' | 'documents' | 'activity'>('overview');

  // Reversal Modal
  const [showReversalModal, setShowReversalModal] = useState<boolean>(false);
  const [selectedTxId, setSelectedTxId] = useState<string>('');
  const [reversalReason, setReversalReason] = useState<string>('');
  const [reversalSubmitting, setReversalSubmitting] = useState<boolean>(false);

  const fetchLoanData = async () => {
    setLoading(true);
    try {
      if (window.api) {
        const l = await window.api.loans.getLoanById(loanId);
        if (l) {
          setLoan(l);
          const intCalc = await window.api.interest.calculateAccruedInterest(l);
          setAccruedInterestPaise(intCalc.interest_accrued_paise);

          const led = await window.api.ledger.getLedgerByLoanId(loanId);
          setLedger(led || []);

          const pays = await window.api.payments.getPaymentsByLoanId(loanId);
          setPayments(pays || []);

          const logs = await window.api.audit.getLogs({ recordId: loanId, limit: 50 });
          setAuditLogs(logs.logs || []);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoanData();
  }, [loanId, refreshTrigger]);

  const handleReverseTx = async () => {
    if (!reversalReason.trim()) {
      alert('An explicit justification reason is required for financial transaction reversal.');
      return;
    }

    setReversalSubmitting(true);
    try {
      if (window.api) {
        await window.api.ledger.reverseTransaction(selectedTxId, reversalReason.trim());
        setShowReversalModal(false);
        setReversalReason('');
        setSelectedTxId('');
        fetchLoanData();
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to reverse transaction');
    } finally {
      setReversalSubmitting(false);
    }
  };

  if (loading || !loan) {
    return (
      <div className="p-8 text-center text-xs text-slate-500">
        Loading Loan #{loanId} Command Center...
      </div>
    );
  }

  const totalOutstandingDue = loan.principal_outstanding_paise + accruedInterestPaise;

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Navigation & Action Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Loans Directory
        </button>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            icon={<Printer className="w-3.5 h-3.5" />}
            onClick={() => onPrintPledgeReceipt(loan.id)}
          >
            Print Pledge Receipt
          </Button>

          {loan.status === 'CLOSED' ? (
            <Button
              size="sm"
              variant="secondary"
              icon={<Printer className="w-3.5 h-3.5" />}
              onClick={() => onPrintClosureReceipt(loan.id)}
            >
              Print Closure Settlement
            </Button>
          ) : (
            <Button
              size="sm"
              variant="gold"
              icon={<Receipt className="w-3.5 h-3.5" />}
              onClick={() => onRecordPayment(loan.id)}
            >
              Record Repayment
            </Button>
          )}
        </div>
      </div>

      {/* Main Loan Details Hub Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold font-mono text-slate-900">{loan.id}</h1>
              <Badge status={loan.status} />
              {loan.is_override && (
                <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-300">
                  LTV Override
                </span>
              )}
            </div>

            <div className="text-xs text-slate-600 flex items-center gap-2">
              <span>Borrower:</span>
              <button
                onClick={() => onSelectCustomer(loan.customer_id)}
                className="font-bold text-amber-700 hover:underline"
              >
                {loan.customer_name}
              </button>
              <span className="text-slate-400 font-mono">({loan.customer_phone})</span>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs text-right">
            <div>
              <span className="text-slate-400 block">Loan Disbursed</span>
              <span className="font-mono font-medium text-slate-800">{formatDate(loan.loan_date)}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Maturity Date</span>
              <span className="font-mono font-bold text-slate-900">{formatDate(loan.due_date)}</span>
            </div>
          </div>
        </div>

        {/* 4 Central Summary Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 text-xs">
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-slate-500 font-medium">Principal Outstanding</span>
            <div className="text-xl font-bold text-slate-900 font-mono mt-1">
              {formatINR(loan.principal_outstanding_paise)}
            </div>
            <span className="text-[11px] text-slate-400">
              Original: {formatINR(loan.principal_paise, false)}
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-slate-500 font-medium">Interest Accrued to Date</span>
            <div className="text-xl font-bold text-amber-600 font-mono mt-1">
              {formatINR(accruedInterestPaise)}
            </div>
            <span className="text-[11px] text-slate-400">
              Rate: {loan.interest_rate_percent}% / {loan.interest_period.toLowerCase()}
            </span>
          </div>

          <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <span className="text-amber-800 font-semibold">Total Outstanding Due</span>
            <div className="text-xl font-bold text-slate-950 font-mono mt-1">
              {formatINR(totalOutstandingDue)}
            </div>
            <span className="text-[11px] text-amber-700">
              Principal + Accrued Interest
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-slate-500 font-medium">Collateral Market Value</span>
            <div className="text-xl font-bold text-slate-900 font-mono mt-1">
              {formatINR(loan.total_valuation_paise)}
            </div>
            <span className="text-[11px] text-slate-400">
              LTV: {loan.ltv_percent}% ({loan.items?.length || 0} items)
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-4 text-xs font-medium">
        {[
          { id: 'overview', label: 'Overview & Terms' },
          { id: 'jewellery', label: `Jewellery Collateral (${loan.items?.length || 0})` },
          { id: 'ledger', label: `Transaction Ledger (${ledger.length})` },
          { id: 'payments', label: `Repayments (${payments.length})` },
          { id: 'documents', label: 'Receipts & Documents' },
          { id: 'activity', label: `Activity Trail (${auditLogs.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-3 px-1 border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-amber-500 text-amber-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6 text-xs">
          <div>
            <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-3">
              Contract Terms & Interest Calculation Rules
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-400 block">Calculation Method</span>
                <span className="font-semibold text-slate-800">{loan.interest_method.replace(/_/g, ' ')}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Minimum Interest Period</span>
                <span className="font-semibold text-slate-800">{loan.min_interest_days} Days</span>
              </div>
              <div>
                <span className="text-slate-400 block">Grace Period</span>
                <span className="font-semibold text-slate-800">{loan.grace_period_days} Days</span>
              </div>
              <div>
                <span className="text-slate-400 block">Created By</span>
                <span className="font-semibold text-slate-800">{loan.created_by}</span>
              </div>
            </div>
          </div>

          {loan.is_override && (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-amber-900">
              <span className="font-bold block">Owner LTV Ceiling Override Justification:</span>
              <p className="mt-1">{loan.override_reason || 'Special terms approved by shop owner.'}</p>
            </div>
          )}

          {loan.status === 'CLOSED' && (
            <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 flex items-center justify-between">
              <div>
                <span className="font-bold block flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Loan Settle & Closed
                </span>
                <p className="mt-0.5 text-xs text-emerald-800">
                  Closed on {formatDateTime(loan.closed_at)} by {loan.closed_by}. All collateral items marked as RELEASED.
                </p>
              </div>
              <Button
                size="sm"
                variant="gold"
                icon={<Printer className="w-3.5 h-3.5" />}
                onClick={() => onPrintClosureReceipt(loan.id)}
              >
                Print Closure Settlement
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Jewellery Collateral */}
      {activeTab === 'jewellery' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
                <th className="py-3 px-4">Item ID</th>
                <th className="py-3 px-4">Category & Description</th>
                <th className="py-3 px-4">Material / Karat</th>
                <th className="py-3 px-4 text-right">Gross Wt</th>
                <th className="py-3 px-4 text-right">Stone Wt</th>
                <th className="py-3 px-4 text-right">Net Wt</th>
                <th className="py-3 px-4 text-right">Appraisal Rate</th>
                <th className="py-3 px-4 text-right">Valuation</th>
                <th className="py-3 px-4 text-center">Collateral Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(loan.items || []).map((itm) => (
                <tr key={itm.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">{itm.id}</td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-800">
                      {formatItemCategory(itm.category, itm.custom_category)}
                    </div>
                    <div className="text-[11px] text-slate-400">{itm.description}</div>
                  </td>
                  <td className="py-3 px-4 font-semibold text-amber-800">
                    {formatItemMaterial(itm.material, itm.material_type, itm.purity, itm.purity_percent)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono">{formatWeight(itm.gross_weight_grams)}</td>
                  <td className="py-3 px-4 text-right font-mono text-slate-500">
                    {formatWeight(itm.stone_weight_grams)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                    {formatWeight(itm.net_weight_grams)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono">
                    {formatINR(itm.rate_per_gram_paise)}/g
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-amber-700">
                    {formatINR(itm.valuation_paise)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Badge status={itm.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Transaction Ledger (Strictly Chronological & Immutable) */}
      {activeTab === 'ledger' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
                <th className="py-3 px-4">Tx ID</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4 text-right">Debit (Dr)</th>
                <th className="py-3 px-4 text-right">Credit (Cr)</th>
                <th className="py-3 px-4 text-right">Principal Bal</th>
                <th className="py-3 px-4 text-center">User</th>
                {isOwner && <th className="py-3 px-4 text-center">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ledger.map((tx) => (
                <tr
                  key={tx.id}
                  className={`hover:bg-slate-50 ${tx.is_reversal ? 'bg-rose-50/40 text-slate-500' : ''}`}
                >
                  <td className="py-3 px-4 font-mono font-semibold text-slate-700">
                    {tx.id}
                    {tx.is_reversal && (
                      <span className="ml-1.5 px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 text-[10px] font-bold">
                        Reversed
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono">{formatDate(tx.transaction_date)}</td>
                  <td className="py-3 px-4 font-bold text-slate-900">{tx.type}</td>
                  <td className="py-3 px-4 text-slate-600">{tx.description}</td>
                  <td className="py-3 px-4 text-right font-mono font-semibold text-slate-800">
                    {tx.debit_paise > 0 ? formatINR(tx.debit_paise) : '-'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                    {tx.credit_paise > 0 ? formatINR(tx.credit_paise) : '-'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-950">
                    {formatINR(tx.principal_balance_paise)}
                  </td>
                  <td className="py-3 px-4 text-center font-mono text-[11px] text-slate-500">
                    {tx.created_by}
                  </td>
                  {isOwner && (
                    <td className="py-3 px-4 text-center">
                      {!tx.is_reversal && tx.type !== 'DISBURSEMENT' && (
                        <button
                          onClick={() => {
                            setSelectedTxId(tx.id);
                            setShowReversalModal(true);
                          }}
                          className="text-rose-600 hover:text-rose-800 font-semibold text-[11px] inline-flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" /> Reverse
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 4: Repayments History */}
      {activeTab === 'payments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Repayment Records</h3>
              <p className="text-[11px] text-slate-500">History of all repayments and receipts issued for this loan.</p>
            </div>
            {loan.status !== 'CLOSED' && (
              <Button
                size="sm"
                variant="gold"
                icon={<Receipt className="w-3.5 h-3.5" />}
                onClick={() => onRecordPayment(loan.id)}
              >
                Record Repayment
              </Button>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
                  <th className="py-3 px-4">Receipt No</th>
                  <th className="py-3 px-4">Payment Date</th>
                  <th className="py-3 px-4 text-right">Total Paid</th>
                  <th className="py-3 px-4 text-right">Interest Covered</th>
                  <th className="py-3 px-4 text-right">Principal Cleared</th>
                  <th className="py-3 px-4">Payment Mode</th>
                  <th className="py-3 px-4 text-center">Printed By</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No repayments recorded yet for this loan.
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{p.receipt_no}</td>
                      <td className="py-3 px-4 font-mono">{formatDate(p.payment_date)}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                        {formatINR(p.total_amount_paise)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-amber-800">
                        {formatINR(p.interest_paid_paise)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                        {formatINR(p.principal_paid_paise)}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-700">{p.payment_mode}</td>
                      <td className="py-3 px-4 text-center text-slate-500 font-mono text-[11px]">
                        {p.created_by}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          className="py-1 px-2.5 text-[11px]"
                          icon={<Printer className="w-3 h-3" />}
                          onClick={() => onPrintPaymentReceipt(p.id)}
                        >
                          Reprint Receipt
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Documents & Printing */}
      {activeTab === 'documents' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <h4 className="font-bold text-slate-900 text-sm">Pledge Receipt / Memorandum</h4>
            <p className="text-slate-500">
              Official pawn pledge agreement containing full customer KYC, itemized gold ornaments, valuation rate, interest terms, and sign blocks.
            </p>
            <Button
              variant="gold"
              size="sm"
              icon={<Printer className="w-4 h-4" />}
              onClick={() => onPrintPledgeReceipt(loan.id)}
            >
              Print Pledge Agreement
            </Button>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <h4 className="font-bold text-slate-900 text-sm">Loan Closure & Release Receipt</h4>
            <p className="text-slate-500">
              Final settlement document certifying zero balance and formal release of all pledged jewellery from vault custody back to the borrower.
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={loan.status !== 'CLOSED'}
              icon={<Printer className="w-4 h-4" />}
              onClick={() => onPrintClosureReceipt(loan.id)}
            >
              {loan.status === 'CLOSED' ? 'Print Closure Document' : 'Available upon Full Settlement'}
            </Button>
          </div>
        </div>
      )}

      {/* Tab 6: Activity & Audit Trail */}
      {activeTab === 'activity' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm divide-y divide-slate-100 text-xs">
          {auditLogs.length === 0 ? (
            <p className="text-slate-400 py-4 text-center">No audit trail entries recorded.</p>
          ) : (
            auditLogs.map((log) => (
              <div key={log.id} className="py-3 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 mr-2">{log.action.replace(/_/g, ' ')}</span>
                  <span className="text-slate-600">{log.reason || 'Audit checkpoint'}</span>
                </div>
                <div className="text-right text-[11px] text-slate-400 font-mono">
                  <div>{log.username}</div>
                  <div>{formatDateTime(log.timestamp)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Reversal Transaction Modal */}
      <Modal
        isOpen={showReversalModal}
        onClose={() => setShowReversalModal(false)}
        title="Authorizing Transaction Reversal"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600">
            Reversing transaction <strong>#{selectedTxId}</strong> will create an immutable offsetting reversal entry on the loan ledger. The original entry is never deleted.
          </p>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Required Reversal Justification Reason *
            </label>
            <textarea
              rows={3}
              required
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-900"
              placeholder="e.g. Typographical error during entry, cashier adjustment authorized by owner"
              value={reversalReason}
              onChange={(e) => setReversalReason(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
            <Button variant="outline" onClick={() => setShowReversalModal(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={reversalSubmitting}
              onClick={handleReverseTx}
            >
              Confirm Reversal Entry
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
