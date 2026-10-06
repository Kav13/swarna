import React, { useState, useEffect } from 'react';
import { CalendarCheck, Printer, CheckCircle2, TrendingUp, TrendingDown, Coins, Receipt } from 'lucide-react';
import { DailyClosingSummary } from '../types';
import { formatINR } from '../utils/currency';
import { formatDate, getTodayISO } from '../utils/dates';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/common/Button';
import { api } from '../api';

interface DailyClosingViewProps {
  onPrintDailySummary: (dateStr: string) => void;
}

export const DailyClosingView: React.FC<DailyClosingViewProps> = ({ onPrintDailySummary }) => {
  const { isOwner } = useAuth();
  const [closingDate, setClosingDate] = useState<string>(getTodayISO());
  const [summary, setSummary] = useState<DailyClosingSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [committing, setCommitting] = useState<boolean>(false);

  const fetchDailyData = async (dateStr: string) => {
    setLoading(true);
    try {
      if (window.api) {
        const data = await window.api.dailyClosing.getDailySummary(dateStr);
        setSummary(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDailyData(closingDate);
  }, [closingDate]);

  const handleCommitClosing = async () => {
    if (!summary) return;
    setCommitting(true);
    try {
      if (window.api) {
        const updated = await window.api.dailyClosing.commitDailyClosing(closingDate);
        setSummary(updated);
        alert(`Daily register for ${closingDate} successfully finalized.`);
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to commit daily closing.');
    } finally {
      setCommitting(false);
    }
  };

  if (loading || !summary) {
    return (
      <div className="p-8 text-center text-xs text-slate-500">
        Loading daily register summary...
      </div>
    );
  }

  const isFinalized = summary.closed_at !== '';

  return (
    <div className="p-8 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-amber-500" /> Daily Business Register Closing
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            End-of-day register tally for capital disbursements, collections by mode, and cash balance
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="date"
            className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-mono"
            value={closingDate}
            onChange={(e) => setClosingDate(e.target.value)}
          />

          <Button
            size="sm"
            variant="outline"
            icon={<Printer className="w-3.5 h-3.5" />}
            onClick={() => onPrintDailySummary(closingDate)}
          >
            Print Day Summary
          </Button>
        </div>
      </div>

      {isFinalized && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 flex items-center gap-2 text-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            This business register was officially closed and finalized on {summary.closed_at} by{' '}
            <strong>{summary.closed_by}</strong>.
          </span>
        </div>
      )}

      {/* Primary Tally Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm text-xs">
          <span className="text-slate-500 font-medium">Capital Disbursed Today</span>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1">
            {formatINR(summary.total_disbursed_paise)}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {summary.total_loans_opened} new loans opened
          </span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm text-xs">
          <span className="text-slate-500 font-medium">Repayments Collected Today</span>
          <div className="text-xl font-bold font-mono text-emerald-600 mt-1">
            {formatINR(summary.total_collected_paise)}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {summary.total_loans_closed} loans fully closed & settled
          </span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm text-xs">
          <span className="text-slate-500 font-medium">Net Cash Flow Today</span>
          <div
            className={`text-xl font-bold font-mono mt-1 ${
              summary.net_cash_flow_paise >= 0 ? 'text-emerald-700' : 'text-rose-600'
            }`}
          >
            {formatINR(summary.net_cash_flow_paise)}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Collections minus disbursements
          </span>
        </div>
      </div>

      {/* Payment Modes Breakdown Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4 text-xs">
        <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-3">
          Collections by Payment Mode
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-slate-500">Cash in Hand</span>
            <div className="text-lg font-bold font-mono text-slate-900 mt-1">
              {formatINR(summary.cash_collected_paise)}
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-slate-500">UPI Digital Direct</span>
            <div className="text-lg font-bold font-mono text-slate-900 mt-1">
              {formatINR(summary.upi_collected_paise)}
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-slate-500">Bank Transfer / NEFT</span>
            <div className="text-lg font-bold font-mono text-slate-900 mt-1">
              {formatINR(summary.bank_collected_paise)}
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-slate-500">Cheques / Other</span>
            <div className="text-lg font-bold font-mono text-slate-900 mt-1">
              {formatINR(summary.cheque_collected_paise)}
            </div>
          </div>
        </div>
      </div>

      {/* Commit Day Button */}
      {isOwner && !isFinalized && (
        <div className="flex justify-end pt-4">
          <Button
            variant="gold"
            size="lg"
            isLoading={committing}
            icon={<CheckCircle2 className="w-5 h-5" />}
            onClick={handleCommitClosing}
          >
            Finalize & Commit Daily Closing for {formatDate(closingDate)}
          </Button>
        </div>
      )}
    </div>
  );
};
