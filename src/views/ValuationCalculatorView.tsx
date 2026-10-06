import React, { useState, useEffect } from 'react';
import { Calculator, Coins, ArrowRight, CheckCircle2, AlertTriangle } from 'lucide-react';
import { MaterialType, MetalRate } from '../types';
import { formatINR, formatWeight } from '../utils/currency';
import { Button } from '../components/common/Button';
import { api } from '../api';

interface ValuationCalculatorViewProps {
  onStartLoanWithEstimate?: (estimate: any) => void;
}

export const ValuationCalculatorView: React.FC<ValuationCalculatorViewProps> = ({
  onStartLoanWithEstimate,
}) => {
  const [rates, setRates] = useState<MetalRate[]>([]);
  const [material, setMaterial] = useState<MaterialType>('GOLD');
  const [purity, setPurity] = useState<string>('22K');
  const [grossWeight, setGrossWeight] = useState<number>(35.0);
  const [stoneWeight, setStoneWeight] = useState<number>(1.2);
  const [ratePerGramRupees, setRatePerGramRupees] = useState<number>(7000);
  const [ltvPercent, setLtvPercent] = useState<number>(75);
  const [requestedLoanRupees, setRequestedLoanRupees] = useState<number>(150000);

  useEffect(() => {
    const fetchRates = async () => {
      try {
        if (window.api) {
          const list = await window.api.rates.getLatestRates();
          setRates(list || []);
          const match = list.find((r: any) => r.material === material && r.purity === purity);
          if (match) {
            setRatePerGramRupees(match.rate_per_gram_paise / 100);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchRates();
  }, []);

  const handlePurityChange = (newPurity: string) => {
    setPurity(newPurity);
    const match = rates.find((r) => r.material === material && r.purity === newPurity);
    if (match) {
      setRatePerGramRupees(match.rate_per_gram_paise / 100);
    }
  };

  const handleMaterialChange = (newMaterial: MaterialType) => {
    setMaterial(newMaterial);
    const defaultPurity = newMaterial === 'GOLD' ? '22K' : '999';
    setPurity(defaultPurity);
    const match = rates.find((r) => r.material === newMaterial && r.purity === defaultPurity);
    if (match) {
      setRatePerGramRupees(match.rate_per_gram_paise / 100);
    }
  };

  // Calculations
  const netWeight = Math.max(0, +(grossWeight - stoneWeight).toFixed(3));
  const ratePaise = ratePerGramRupees * 100;
  const valuationPaise = Math.round(netWeight * ratePaise);
  const maxEligibleLoanPaise = Math.round(valuationPaise * (ltvPercent / 100));
  const requestedLoanPaise = requestedLoanRupees * 100;
  const marginPaise = Math.max(0, valuationPaise - requestedLoanPaise);
  const isEligible = requestedLoanPaise <= maxEligibleLoanPaise;

  return (
    <div className="p-8 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Calculator className="w-5 h-5 text-amber-500" /> Walk-In Jewellery Valuation & LTV Calculator
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Quick appraisal for walk-in customer inquiries to estimate eligible loan and collateral margin
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Input Parameters Box */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-xs">
          <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] pb-2 border-b border-slate-100">
            Collateral Parameters
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Precious Metal</label>
              <select
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-semibold"
                value={material}
                onChange={(e) => handleMaterialChange(e.target.value as MaterialType)}
              >
                <option value="GOLD">Gold</option>
                <option value="SILVER">Silver</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Purity / Karat</label>
              <select
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-semibold text-amber-900"
                value={purity}
                onChange={(e) => handlePurityChange(e.target.value)}
              >
                {material === 'GOLD' ? (
                  <>
                    <option value="24K">24 Karat (99.9%)</option>
                    <option value="22K">22 Karat (91.6%)</option>
                    <option value="20K">20 Karat (83.3%)</option>
                    <option value="18K">18 Karat (75.0%)</option>
                  </>
                ) : (
                  <>
                    <option value="999">999 Fine Silver</option>
                    <option value="925">925 Sterling Silver</option>
                    <option value="800">800 Standard Silver</option>
                  </>
                )}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Gross Weight (grams)</label>
              <input
                type="number"
                step="0.001"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono font-bold"
                value={grossWeight}
                onChange={(e) => setGrossWeight(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Stone / Enamel Weight (g)</label>
              <input
                type="number"
                step="0.001"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono"
                value={stoneWeight}
                onChange={(e) => setStoneWeight(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Rate (₹ / gram)</label>
              <input
                type="number"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono font-bold"
                value={ratePerGramRupees}
                onChange={(e) => setRatePerGramRupees(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Loan-to-Value (LTV %)</label>
              <input
                type="number"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono"
                value={ltvPercent}
                onChange={(e) => setLtvPercent(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Customer Desired Loan Amount (₹)
            </label>
            <input
              type="number"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono font-bold text-sm"
              value={requestedLoanRupees}
              onChange={(e) => setRequestedLoanRupees(parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>

        {/* Live Appraisal Output Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-6 text-xs">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">
                Instant Valuation Appraisal
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                Live Result
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center py-2.5 border-b border-slate-100">
                <span className="text-slate-900 font-semibold text-xs">Net Bullion Weight:</span>
                <span className="font-mono font-bold text-base text-amber-600">
                  {formatWeight(netWeight)}
                </span>
              </div>

              <div className="flex justify-between items-center py-2.5 border-b border-slate-100">
                <span className="text-slate-900 font-semibold text-xs">Total Jewellery Valuation:</span>
                <span className="font-mono font-bold text-base text-slate-900">
                  {formatINR(valuationPaise)}
                </span>
              </div>

              <div className="flex justify-between items-center px-3.5 py-3 rounded-xl bg-emerald-50/80 border border-emerald-200 shadow-xs">
                <span className="text-emerald-950 font-bold text-xs">
                  Max Eligible Loan ({ltvPercent}% LTV):
                </span>
                <span className="font-mono font-black text-lg text-emerald-700">
                  {formatINR(maxEligibleLoanPaise)}
                </span>
              </div>

              <div className="flex justify-between items-center py-2.5 border-t border-slate-100">
                <span className="text-slate-900 font-semibold text-xs">Available Safety Margin:</span>
                <span className="font-mono font-bold text-base text-slate-700">
                  {formatINR(marginPaise)}
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs shadow-sm">
            {isEligible ? (
              <div className="text-emerald-400 font-semibold flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Requested loan amount is fully eligible within the {ltvPercent}% LTV margin!</span>
              </div>
            ) : (
              <div className="text-rose-400 font-semibold flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>
                  Requested loan exceeds max ceiling by{' '}
                  {formatINR(requestedLoanPaise - maxEligibleLoanPaise)}.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
