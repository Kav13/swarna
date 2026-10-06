import React, { useState, useEffect } from 'react';
import {
  Users,
  ArrowLeft,
  Coins,
  ShieldCheck,
  Eye,
  EyeOff,
  PlusCircle,
  Receipt,
  Printer,
  Gem,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { CustomerProfileData, Loan, JewelleryItem, LoanTransaction } from '../types';
import { formatINR, formatWeight } from '../utils/currency';
import { formatDate, formatDateTime } from '../utils/dates';
import { formatPhone, maskAadhaar } from '../utils/formatters';
import { formatItemCategory, formatItemMaterial } from '../utils/purity';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { api } from '../api';

interface CustomerProfileViewProps {
  customerId: string;
  onBack: () => void;
  onSelectLoan: (loanId: string) => void;
  onNewLoan: (customerId: string) => void;
  onRecordPayment: (loanId?: string) => void;
  onPrintStatement: (customerId: string) => void;
}

export const CustomerProfileView: React.FC<CustomerProfileViewProps> = ({
  customerId,
  onBack,
  onSelectLoan,
  onNewLoan,
  onRecordPayment,
  onPrintStatement,
}) => {
  const { isOwner } = useAuth();
  const [profile, setProfile] = useState<CustomerProfileData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [unmaskedAadhaar, setUnmaskedAadhaar] = useState<string | null>(null);
  const [unmaskLoading, setUnmaskLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'loans' | 'jewellery' | 'transactions'>('loans');

  const fetchProfile = async () => {
    setLoading(true);
    try {
      if (window.api) {
        const data = await window.api.customers.getCustomerProfile(customerId);
        setProfile(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [customerId]);

  const handleToggleUnmask = async () => {
    if (unmaskedAadhaar) {
      setUnmaskedAadhaar(null);
      return;
    }

    setUnmaskLoading(true);
    try {
      if (window.api) {
        const full = await window.api.customers.getUnmaskedAadhaar(customerId);
        setUnmaskedAadhaar(full);
      }
    } catch (err: any) {
      alert(err?.message || 'Access Denied: Only Owner can unmask full Aadhaar.');
    } finally {
      setUnmaskLoading(false);
    }
  };

  if (loading || !profile) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-xs text-slate-500">Loading customer profile...</div>
      </div>
    );
  }

  const { customer, active_loans, closed_loans, pledged_items, recent_transactions } = profile;
  const totalOutstanding =
    profile.total_principal_outstanding_paise + profile.total_interest_outstanding_paise;

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Back button & Action Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Customers
        </button>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            icon={<Printer className="w-3.5 h-3.5" />}
            onClick={() => onPrintStatement(customer.id)}
          >
            Print Statement
          </Button>

          <Button
            size="sm"
            variant="gold"
            icon={<PlusCircle className="w-3.5 h-3.5" />}
            onClick={() => onNewLoan(customer.id)}
          >
            New Loan for Customer
          </Button>
        </div>
      </div>

      {/* Customer Header Profile Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xl shrink-0">
              {customer.full_name.charAt(0)}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-slate-900">{customer.full_name}</h1>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                  {customer.id}
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Phone: <span className="font-mono font-medium">{formatPhone(customer.phone)}</span>
                {customer.alternate_phone && (
                  <span className="ml-2 text-slate-400">/ Alt: {formatPhone(customer.alternate_phone)}</span>
                )}
              </p>
              <p className="text-xs text-slate-500">
                {customer.address}, {customer.city}, {customer.state} - {customer.pincode}
              </p>
            </div>
          </div>

          {/* Aadhaar & KYC Verification Badge */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 min-w-[240px]">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-medium">Aadhaar (KYC)</span>
              {isOwner && (
                <button
                  onClick={handleToggleUnmask}
                  disabled={unmaskLoading}
                  className="text-amber-600 hover:text-amber-700 font-medium inline-flex items-center gap-1 text-[11px]"
                >
                  {unmaskedAadhaar ? (
                    <>
                      <EyeOff className="w-3 h-3" /> Hide
                    </>
                  ) : (
                    <>
                      <Eye className="w-3 h-3" /> Unmask
                    </>
                  )}
                </button>
              )}
            </div>
            <div className="font-mono text-sm font-semibold text-slate-900 tracking-wider">
              {unmaskedAadhaar ? unmaskedAadhaar : `XXXX XXXX ${customer.aadhaar_last4}`}
            </div>
            <div className="text-[10px] text-slate-400 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-500" /> AES-256 Encrypted Record
            </div>
          </div>
        </div>

        {/* Metric Cards Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100 text-xs">
          <div>
            <span className="text-slate-500">Total Outstanding</span>
            <div className="text-lg font-bold text-slate-900 font-mono mt-0.5">
              {formatINR(totalOutstanding)}
            </div>
            <span className="text-[11px] text-slate-400">
              Principal: {formatINR(profile.total_principal_outstanding_paise, false)}
            </span>
          </div>

          <div>
            <span className="text-slate-500">Active Pledged Loans</span>
            <div className="text-lg font-bold text-amber-600 font-mono mt-0.5">
              {active_loans.length} Active
            </div>
            <span className="text-[11px] text-slate-400">{closed_loans.length} Closed Loans</span>
          </div>

          <div>
            <span className="text-slate-500">Pledged Jewellery Items</span>
            <div className="text-lg font-bold text-slate-900 font-mono mt-0.5">
              {pledged_items.length} items
            </div>
            <span className="text-[11px] text-slate-400">Held in Vault</span>
          </div>

          <div>
            <span className="text-slate-500">Total Repaid to Date</span>
            <div className="text-lg font-bold text-emerald-600 font-mono mt-0.5">
              {formatINR(profile.total_repayments_paise)}
            </div>
            <span className="text-[11px] text-slate-400">Cleared Capital</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-4 text-xs font-medium">
        <button
          onClick={() => setActiveTab('loans')}
          className={`pb-3 px-1 border-b-2 transition-colors ${
            activeTab === 'loans'
              ? 'border-amber-500 text-amber-700 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Loans ({active_loans.length + closed_loans.length})
        </button>
        <button
          onClick={() => setActiveTab('jewellery')}
          className={`pb-3 px-1 border-b-2 transition-colors ${
            activeTab === 'jewellery'
              ? 'border-amber-500 text-amber-700 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Pledged Jewellery ({pledged_items.length})
        </button>
        <button
          onClick={() => setActiveTab('transactions')}
          className={`pb-3 px-1 border-b-2 transition-colors ${
            activeTab === 'transactions'
              ? 'border-amber-500 text-amber-700 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Recent Transactions ({recent_transactions.length})
        </button>
      </div>

      {/* Tab 1: Loans */}
      {activeTab === 'loans' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
                <th className="py-3 px-4">Loan ID</th>
                <th className="py-3 px-4">Loan Date</th>
                <th className="py-3 px-4">Due Date</th>
                <th className="py-3 px-4 text-right">Principal</th>
                <th className="py-3 px-4 text-right">Outstanding</th>
                <th className="py-3 px-4">Interest Terms</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...active_loans, ...closed_loans].length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-400">
                    No loans on record for this customer.
                  </td>
                </tr>
              ) : (
                [...active_loans, ...closed_loans].map((l) => (
                  <tr
                    key={l.id}
                    onClick={() => onSelectLoan(l.id)}
                    className="hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{l.id}</td>
                    <td className="py-3 px-4">{formatDate(l.loan_date)}</td>
                    <td className="py-3 px-4 font-mono">{formatDate(l.due_date)}</td>
                    <td className="py-3 px-4 text-right font-mono font-medium">
                      {formatINR(l.principal_paise)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {formatINR(l.principal_outstanding_paise + l.interest_outstanding_paise)}
                    </td>
                    <td className="py-3 px-4">
                      {l.interest_rate_percent}% / {l.interest_period.toLowerCase()}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge status={l.status} />
                    </td>
                    <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-2">
                        {l.status !== 'CLOSED' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-[11px] py-1 px-2"
                            onClick={() => onRecordPayment(l.id)}
                          >
                            Pay
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="secondary"
                          className="text-[11px] py-1 px-2"
                          onClick={() => onSelectLoan(l.id)}
                        >
                          Details
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 2: Jewellery Items */}
      {activeTab === 'jewellery' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
                <th className="py-3 px-4">Item ID</th>
                <th className="py-3 px-4">Category & Description</th>
                <th className="py-3 px-4">Material / Karat</th>
                <th className="py-3 px-4 text-right">Gross Wt</th>
                <th className="py-3 px-4 text-right">Net Wt</th>
                <th className="py-3 px-4 text-right">Valuation</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pledged_items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400">
                    No jewellery currently pledged in vault.
                  </td>
                </tr>
              ) : (
                pledged_items.map((itm: JewelleryItem) => (
                  <tr key={itm.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900">{itm.id}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">
                        {formatItemCategory(itm.category, itm.custom_category)}
                      </div>
                      <div className="text-[11px] text-slate-400">{itm.description}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-amber-700">
                        {formatItemMaterial(itm.material, itm.material_type, itm.purity, itm.purity_percent)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono">{formatWeight(itm.gross_weight_grams)}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {formatWeight(itm.net_weight_grams)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-amber-700">
                      {formatINR(itm.valuation_paise)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge status={itm.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Transactions */}
      {activeTab === 'transactions' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
                <th className="py-3 px-4">Tx Date</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4 text-right">Debit (Dr)</th>
                <th className="py-3 px-4 text-right">Credit (Cr)</th>
                <th className="py-3 px-4 text-right">Principal Bal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recent_transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    No transactions on ledger.
                  </td>
                </tr>
              ) : (
                recent_transactions.map((t: LoanTransaction) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono">{formatDate(t.transaction_date)}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{t.type}</td>
                    <td className="py-3 px-4 text-slate-600">{t.description}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-800">
                      {t.debit_paise > 0 ? formatINR(t.debit_paise) : '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-600 font-semibold">
                      {t.credit_paise > 0 ? formatINR(t.credit_paise) : '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {formatINR(t.principal_balance_paise)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
