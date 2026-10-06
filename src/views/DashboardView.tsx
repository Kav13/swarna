import React, { useState, useEffect } from 'react';
import {
  Coins,
  TrendingUp,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Users,
  Gem,
  PlusCircle,
  Receipt,
  TableProperties,
  ArrowUpRight,
  ShieldAlert,
} from 'lucide-react';
import { DashboardStats } from '../types';
import { formatINR, formatWeight } from '../utils/currency';
import { formatDateTime } from '../utils/dates';
import { Button } from '../components/common/Button';
import { api } from '../api';

interface DashboardViewProps {
  onNavigate: (tab: any, params?: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchStats = async () => {
    try {
      if (window.api) {
        // Refresh overdue checks first
        await window.api.loans.refreshOverdueStatuses();
        const data = await window.api.reports.getDashboardStats();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to load dashboard statistics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading || !stats) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[500px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-500 font-medium">Loading Vault Portfolio...</span>
        </div>
      </div>
    );
  }

  const totalOutstanding = stats.principal_outstanding_paise + stats.interest_outstanding_paise;
  const totalCollateralWeight = stats.total_gold_weight_grams + stats.total_silver_weight_grams;

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Banner & Quick Shortcuts */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 to-slate-800 p-6 rounded-2xl text-white shadow-xl border border-slate-800">
        <div>
          <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
            Live Vault Portfolio
          </span>
          <h1 className="text-2xl font-bold mt-1">Jewellery Loan Command Center</h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time balance, pledged bullion tracking, and loan maturity monitoring.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="gold"
            size="sm"
            icon={<PlusCircle className="w-4 h-4" />}
            onClick={() => onNavigate('new-loan')}
          >
            New Loan Wizard
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<TableProperties className="w-4 h-4" />}
            onClick={() => onNavigate('bulk-loan')}
          >
            Bulk Loan Entry
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-white border-slate-700 hover:bg-slate-800"
            icon={<Receipt className="w-4 h-4" />}
            onClick={() => onNavigate('payments')}
          >
            Record Repayment
          </Button>
        </div>
      </div>

      {/* Due / Overdue Urgent Alert Ribbon if applicable */}
      {(stats.loans_due_today > 0 || stats.overdue_loans_count > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stats.loans_due_today > 0 && (
            <div
              onClick={() => onNavigate('loans', { status: 'ACTIVE' })}
              className="cursor-pointer bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-center justify-between hover:bg-amber-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-200 text-amber-900 flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-amber-950">
                    {stats.loans_due_today} Loans Due Today
                  </h4>
                  <p className="text-xs text-amber-800">Customer payment or interest settlement required</p>
                </div>
              </div>
              <ArrowUpRight className="w-5 h-5 text-amber-700" />
            </div>
          )}

          {stats.overdue_loans_count > 0 && (
            <div
              onClick={() => onNavigate('loans', { status: 'OVERDUE' })}
              className="cursor-pointer bg-rose-50 border border-rose-300 rounded-xl p-4 flex items-center justify-between hover:bg-rose-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-rose-200 text-rose-900 flex items-center justify-center">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-rose-950">
                    {stats.overdue_loans_count} Overdue Loans
                  </h4>
                  <p className="text-xs text-rose-800">Past maturity grace period — review for notice/auction</p>
                </div>
              </div>
              <ArrowUpRight className="w-5 h-5 text-rose-700" />
            </div>
          )}
        </div>
      )}

      {/* Primary Financial Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Outstanding */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Outstanding Due</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {formatINR(totalOutstanding)}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-xs flex justify-between text-slate-500">
            <span>Principal: {formatINR(stats.principal_outstanding_paise, false)}</span>
            <span>Interest: {formatINR(stats.interest_outstanding_paise, false)}</span>
          </div>
        </div>

        {/* Total Disbursed */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Capital Disbursed</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {formatINR(stats.total_disbursed_paise)}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
            Across {stats.active_loans_count + stats.closed_loans_count} total loans recorded
          </div>
        </div>

        {/* Repayments Collected */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Repayments Collected</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {formatINR(stats.total_collected_paise)}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
            {stats.closed_loans_count} loans fully closed & settled
          </div>
        </div>

        {/* Active Customers & Loans */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Active Borrowers & Loans</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {stats.active_loans_count}{' '}
            <span className="text-sm font-normal text-slate-500">active loans</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
            {stats.active_customers_count} registered active customers
          </div>
        </div>
      </div>

      {/* Collateral & Bullion Vault Breakdown */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gem className="w-5 h-5 text-amber-500" />
            <h3 className="text-sm font-bold text-slate-900">Vault Pledged Collateral Inventory</h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            Total Weight: {formatWeight(totalCollateralWeight)}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Gold Bullion Card */}
          <div className="bg-gradient-to-br from-amber-50 to-amber-100/60 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
                Gold Collateral
              </span>
              <div className="text-2xl font-bold text-amber-950 font-mono mt-1">
                {formatWeight(stats.total_gold_weight_grams)}
              </div>
              <p className="text-xs text-amber-700 mt-0.5">Securely pledged in high-security vault</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-200/80 text-amber-900 flex items-center justify-center text-xl font-bold">
              Au
            </div>
          </div>

          {/* Silver Bullion Card */}
          <div className="bg-gradient-to-br from-slate-100 to-slate-200/80 border border-slate-300 rounded-xl p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Silver Collateral
              </span>
              <div className="text-2xl font-bold text-slate-900 font-mono mt-1">
                {formatWeight(stats.total_silver_weight_grams)}
              </div>
              <p className="text-xs text-slate-600 mt-0.5">Articles, vessels, and ornaments</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-slate-300 text-slate-800 flex items-center justify-center text-xl font-bold">
              Ag
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming Due Schedule & Recent Activity Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Loan Maturity Horizon */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Loan Maturity Horizon
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-xs text-slate-600">Maturing Today</span>
              <span className="text-sm font-bold text-amber-600 font-mono">
                {stats.loans_due_today} loans
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-xs text-slate-600">Maturing in 7 Days</span>
              <span className="text-sm font-bold text-slate-800 font-mono">
                {stats.loans_due_7days} loans
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-xs text-slate-600">Maturing in 30 Days</span>
              <span className="text-sm font-bold text-slate-800 font-mono">
                {stats.loans_due_30days} loans
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-rose-50 border border-rose-100">
              <span className="text-xs text-rose-800 font-medium">Overdue Default Loans</span>
              <span className="text-sm font-bold text-rose-600 font-mono">
                {stats.overdue_loans_count} loans
              </span>
            </div>
          </div>
        </div>

        {/* Recent Audit & Transaction Activity */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Recent Activity & Audit Log
            </h3>
            <button
              onClick={() => onNavigate('audit')}
              className="text-xs text-amber-600 hover:text-amber-700 font-semibold"
            >
              View Full Audit Trail &rarr;
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {stats.recent_activity.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No recent activity recorded.</p>
            ) : (
              stats.recent_activity.slice(0, 5).map((log) => (
                <div key={log.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-800 mr-2">
                      {log.action.replace(/_/g, ' ')}
                    </span>
                    <span className="text-slate-500">{log.reason || log.module}</span>
                    {log.record_id && (
                      <span className="ml-2 font-mono text-[11px] text-amber-600">
                        #{log.record_id}
                      </span>
                    )}
                  </div>
                  <div className="text-right text-[11px] text-slate-400 shrink-0">
                    <div>{log.username}</div>
                    <div className="font-mono">{formatDateTime(log.timestamp)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
