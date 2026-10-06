import React, { useState, useEffect } from 'react';
import { BarChart3, Download, FileSpreadsheet, Coins, Users, Gem, Receipt } from 'lucide-react';
import { DashboardStats } from '../types';
import { formatINR, formatWeight } from '../utils/currency';
import { Button } from '../components/common/Button';
import { api } from '../api';

export const ReportsView: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      try {
        if (window.api) {
          const res = await window.api.reports.getDashboardStats();
          setStats(res);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  const handleExport = async (type: 'LOANS' | 'PAYMENTS' | 'CUSTOMERS' | 'COLLATERAL') => {
    setExporting(type);
    try {
      if (window.api) {
        const csvContent = await window.api.reports.exportReportToCSV(type);
        const filename = `${type.toLowerCase()}_report_${new Date().toISOString().split('T')[0]}.csv`;

        const savedPath = await window.api.system.saveFile(csvContent, filename, [
          { name: 'CSV File', extensions: ['csv'] },
        ]);

        if (savedPath) {
          alert(`Report exported successfully to: ${savedPath}`);
        }
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to export CSV report');
    } finally {
      setExporting(null);
    }
  };

  if (loading || !stats) {
    return (
      <div className="p-8 text-center text-xs text-slate-500">
        Loading reports dashboard...
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-amber-500" /> Business Reports & Data Export Center
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Generate audit-ready reports and export data to Excel-compatible CSV spreadsheets
        </p>
      </div>

      {/* Export Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Loan Register Export */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-4 text-xs">
          <div>
            <div className="flex items-center gap-2 text-amber-600 font-bold text-sm">
              <Coins className="w-4 h-4" /> Loan Master Register
            </div>
            <p className="text-slate-500 mt-1">
              Full breakdown of all loans, principal amounts, interest rates, status, and outstanding balances.
            </p>
            <div className="mt-3 font-mono font-semibold text-slate-800">
              Total Active: {stats.active_loans_count} | Closed: {stats.closed_loans_count}
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            icon={<Download className="w-3.5 h-3.5" />}
            isLoading={exporting === 'LOANS'}
            onClick={() => handleExport('LOANS')}
          >
            Export Loans CSV
          </Button>
        </div>

        {/* Repayments Export */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-4 text-xs">
          <div>
            <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
              <Receipt className="w-4 h-4" /> Repayment Collections
            </div>
            <p className="text-slate-500 mt-1">
              Every payment receipt, interest allocated, principal cleared, payment mode, and date.
            </p>
            <div className="mt-3 font-mono font-semibold text-emerald-700">
              Total Collected: {formatINR(stats.total_collected_paise)}
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            icon={<Download className="w-3.5 h-3.5" />}
            isLoading={exporting === 'PAYMENTS'}
            onClick={() => handleExport('PAYMENTS')}
          >
            Export Payments CSV
          </Button>
        </div>

        {/* Collateral Bullion Export */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-4 text-xs">
          <div>
            <div className="flex items-center gap-2 text-amber-700 font-bold text-sm">
              <Gem className="w-4 h-4" /> Collateral & Bullion
            </div>
            <p className="text-slate-500 mt-1">
              Itemized inventory of pledged ornaments, purity, gross/net weights, and valuations.
            </p>
            <div className="mt-3 font-mono font-semibold text-slate-800">
              Gold: {formatWeight(stats.total_gold_weight_grams)} | Silver: {formatWeight(stats.total_silver_weight_grams)}
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            icon={<Download className="w-3.5 h-3.5" />}
            isLoading={exporting === 'COLLATERAL'}
            onClick={() => handleExport('COLLATERAL')}
          >
            Export Collateral CSV
          </Button>
        </div>

        {/* Customer Directory Export */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-4 text-xs">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
              <Users className="w-4 h-4" /> Borrower Customer List
            </div>
            <p className="text-slate-500 mt-1">
              Customer KYC directory, masked Aadhaar last 4, mobile phone numbers, and addresses.
            </p>
            <div className="mt-3 font-mono font-semibold text-slate-800">
              Registered Borrowers: {stats.active_customers_count}
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            icon={<Download className="w-3.5 h-3.5" />}
            isLoading={exporting === 'CUSTOMERS'}
            onClick={() => handleExport('CUSTOMERS')}
          >
            Export Customers CSV
          </Button>
        </div>
      </div>
    </div>
  );
};
