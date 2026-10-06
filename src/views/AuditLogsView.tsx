import React, { useState, useEffect } from 'react';
import { FileText, Search, Filter, ShieldCheck } from 'lucide-react';
import { AuditLog } from '../types';
import { formatDateTime } from '../utils/dates';
import { api } from '../api';

export const AuditLogsView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [moduleFilter, setModuleFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState<boolean>(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      if (window.api) {
        const filters: any = { limit: 100, offset: 0 };
        if (moduleFilter !== 'ALL') filters.module = moduleFilter;

        const res = await window.api.audit.getLogs(filters);
        setLogs(res.logs || []);
        setTotal(res.total || 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [moduleFilter]);

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-500" /> Tamper-Evident Audit Trail
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable log of all user logins, financial transactions, rates, and administrative actions
          </p>
        </div>

        {/* Module Filter Tabs */}
        <div className="flex items-center gap-1.5 flex-wrap bg-slate-100 p-1 rounded-xl text-xs">
          {['ALL', 'LOANS', 'PAYMENTS', 'CUSTOMERS', 'AUTH', 'RATES', 'SETTINGS', 'BACKUP'].map((m) => (
            <button
              key={m}
              onClick={() => setModuleFilter(m)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                moduleFilter === m
                  ? 'bg-white text-slate-900 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-xs">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
              <th className="py-3 px-4">Timestamp</th>
              <th className="py-3 px-4">User</th>
              <th className="py-3 px-4">Action</th>
              <th className="py-3 px-4">Module</th>
              <th className="py-3 px-4 font-mono">Record ID</th>
              <th className="py-3 px-4">Reason / Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  Loading audit logs...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  No audit logs recorded for this category.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                    {formatDateTime(log.timestamp)}
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-800">{log.username}</td>
                  <td className="py-3 px-4 font-bold text-slate-900">{log.action}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px]">
                      {log.module}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-amber-700 font-semibold">
                    {log.record_id || '-'}
                  </td>
                  <td className="py-3 px-4 text-slate-600">{log.reason || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
