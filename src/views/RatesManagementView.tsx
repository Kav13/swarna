import React, { useState, useEffect } from 'react';
import { TrendingUp, Edit2, ShieldAlert, CheckCircle2, History } from 'lucide-react';
import { MetalRate } from '../types';
import { formatINR } from '../utils/currency';
import { formatDateTime } from '../utils/dates';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { api } from '../api';

export const RatesManagementView: React.FC = () => {
  const { isOwner } = useAuth();
  const [rates, setRates] = useState<MetalRate[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [selectedRate, setSelectedRate] = useState<MetalRate | null>(null);
  const [newRateRupees, setNewRateRupees] = useState<number>(0);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const fetchRates = async () => {
    setLoading(true);
    try {
      if (window.api) {
        const list = await window.api.rates.getLatestRates();
        setRates(list || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRates();
  }, []);

  const handleOpenEdit = (rate: MetalRate) => {
    setSelectedRate(rate);
    setNewRateRupees(rate.rate_per_gram_paise / 100);
    setModalOpen(true);
  };

  const handleSaveRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRate || newRateRupees <= 0) return;

    setSubmitting(true);
    try {
      if (window.api) {
        await window.api.rates.setRate(
          selectedRate.material,
          selectedRate.purity,
          newRateRupees * 100
        );
        setModalOpen(false);
        fetchRates();
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to update rate');
    } finally {
      setSubmitting(false);
    }
  };

  const goldRates = rates.filter((r) => r.material === 'GOLD');
  const silverRates = rates.filter((r) => r.material === 'SILVER');

  return (
    <div className="p-8 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-amber-500" /> Metal Rate Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure bullion market valuation benchmarks by purity with full historical audit preservation
          </p>
        </div>

        {!isOwner && (
          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>View Only: Rate updates require Owner authorization.</span>
          </div>
        )}
      </div>

      {/* Gold Rates Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-500" />
            <h3 className="font-bold text-slate-900 text-sm">Gold Benchmark Rates (₹ / Gram)</h3>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">Preserves Historical Valuation</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          {goldRates.map((r) => (
            <div
              key={r.id}
              className="p-4 bg-amber-50/50 border border-amber-200/80 rounded-xl flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-950 text-sm">
                    {r.material_type || `${r.purity} Gold`}
                  </span>
                  <span className="text-[10px] text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded font-mono font-semibold">
                    {r.purity_percent ? `${r.purity_percent}%` : r.purity === '24K' ? '100.00%' : r.purity === '22K' ? '91.67%' : `${r.purity}`}
                  </span>
                </div>
                <div className="text-xl font-bold font-mono text-slate-900 mt-2">
                  {formatINR(r.rate_per_gram_paise)}
                  <span className="text-xs text-slate-500 font-normal"> / g</span>
                </div>
              </div>

              <div className="pt-2 border-t border-amber-200/60 flex items-center justify-between text-[11px] text-slate-500">
                <span>By {r.updated_by}</span>
                {isOwner && (
                  <button
                    onClick={() => handleOpenEdit(r)}
                    className="text-amber-700 hover:text-amber-900 font-semibold inline-flex items-center gap-1"
                  >
                    <Edit2 className="w-3 h-3" /> Edit
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Silver Rates Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-slate-400" />
            <h3 className="font-bold text-slate-900 text-sm">Silver Benchmark Rates (₹ / Gram)</h3>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">Preserves Historical Valuation</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {silverRates.map((r) => (
            <div
              key={r.id}
              className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-sm">
                    {r.material_type || `${r.purity} Silver`}
                  </span>
                  <span className="text-[10px] text-slate-700 bg-slate-200 px-1.5 py-0.5 rounded font-mono font-semibold">
                    {r.purity_percent ? `${r.purity_percent}%` : r.purity === '999' ? '99.90%' : r.purity === '925' ? '92.50%' : `${r.purity}`}
                  </span>
                </div>
                <div className="text-xl font-bold font-mono text-slate-900 mt-2">
                  {formatINR(r.rate_per_gram_paise)}
                  <span className="text-xs text-slate-500 font-normal"> / g</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
                <span>By {r.updated_by}</span>
                {isOwner && (
                  <button
                    onClick={() => handleOpenEdit(r)}
                    className="text-slate-800 hover:text-slate-950 font-semibold inline-flex items-center gap-1"
                  >
                    <Edit2 className="w-3 h-3" /> Edit
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Rate Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Update Bullion Valuation Rate">
        {selectedRate && (
          <form onSubmit={handleSaveRate} className="space-y-4 text-xs">
            <p className="text-slate-600">
              Updating benchmark rate for{' '}
              <strong>
                {selectedRate.material} ({selectedRate.purity})
              </strong>
              . This will apply to all future loan appraisals. Existing historical loan appraisals remain strictly unchanged.
            </p>

            <div>
              <label className="block font-medium text-slate-700 mb-1">New Rate per Gram (₹) *</label>
              <input
                type="number"
                step="1"
                required
                autoFocus
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono font-bold text-sm focus:outline-none focus:border-amber-500"
                value={newRateRupees}
                onChange={(e) => setNewRateRupees(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="gold" isLoading={submitting}>
                Save Benchmark Rate
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
