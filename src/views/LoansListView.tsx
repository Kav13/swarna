import React, { useState, useEffect } from 'react';
import {
  Coins,
  Search,
  Filter,
  PlusCircle,
  Eye,
  Calendar,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { Loan, LoanStatus } from '../types';
import { formatINR } from '../utils/currency';
import { formatDate } from '../utils/dates';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { api } from '../api';

interface LoansListViewProps {
  initialStatus?: LoanStatus;
  onSelectLoan: (loanId: string) => void;
  onNewLoan: () => void;
}

export const LoansListView: React.FC<LoansListViewProps> = ({
  initialStatus,
  onSelectLoan,
  onNewLoan,
}) => {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus || 'ALL');
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  const fetchLoans = async () => {
    setLoading(true);
    try {
      if (window.api) {
        await window.api.loans.refreshOverdueStatuses();
        const filters: any = { search, limit: 100, offset: 0 };
        if (statusFilter !== 'ALL') filters.status = statusFilter;

        const res = await window.api.loans.getLoans(filters);
        setLoans(res.loans || []);
        setTotal(res.total || 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoans();
  }, [statusFilter, search]);

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-500" /> Loan Master Directory
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Complete registry of all active, overdue, partially paid, and settled pledge loans
          </p>
        </div>

        <Button variant="gold" size="sm" icon={<PlusCircle className="w-4 h-4" />} onClick={onNewLoan}>
          New Loan
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-4 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-500"
            placeholder="Search by Loan ID (e.g. LN-2026-000001), Customer name, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {['ALL', 'ACTIVE', 'PARTIALLY_PAID', 'OVERDUE', 'CLOSED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === st
                  ? 'bg-slate-900 text-white font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Loans Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
                <th className="py-3 px-4">Loan ID</th>
                <th className="py-3 px-4">Borrower Customer</th>
                <th className="py-3 px-4">Loan Date</th>
                <th className="py-3 px-4">Maturity / Due</th>
                <th className="py-3 px-4 text-right">Principal Disbursed</th>
                <th className="py-3 px-4 text-right">Outstanding Due</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Loading loans...
                  </td>
                </tr>
              ) : loans.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No loans found matching the criteria.
                  </td>
                </tr>
              ) : (
                loans.map((loan) => (
                  <tr
                    key={loan.id}
                    onClick={() => onSelectLoan(loan.id)}
                    className="hover:bg-amber-50/30 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{loan.id}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{loan.customer_name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{loan.customer_phone}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700">{formatDate(loan.loan_date)}</td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-700">
                      {formatDate(loan.due_date)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-slate-800">
                      {formatINR(loan.principal_paise)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {formatINR(loan.total_due_paise ?? (loan.principal_outstanding_paise + (loan.accrued_interest_paise ?? loan.interest_outstanding_paise) + (loan.other_charges_paise || 0)))}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge status={loan.status} />
                    </td>
                    <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs py-1 px-2.5"
                        onClick={() => onSelectLoan(loan.id)}
                      >
                        Open Hub &rarr;
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
