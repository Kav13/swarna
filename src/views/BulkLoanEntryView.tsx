import React, { useState, useEffect } from 'react';
import {
  TableProperties,
  Plus,
  Trash2,
  Users,
  Coins,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  Percent,
  Calendar,
  Sparkles,
  Clock,
} from 'lucide-react';
import { Customer, MetalRate, PaymentMode, MaterialTypeConfig } from '../types';
import { formatINR, formatWeight } from '../utils/currency';
import { getTodayISO, addMonths } from '../utils/dates';
import { formatItemMaterial } from '../utils/purity';
import { Button } from '../components/common/Button';
import { api } from '../api';

export interface MaterialBlock {
  id: string;
  material: 'GOLD' | 'SILVER';
  material_type?: string;
  purity: string;
  purity_percent?: number;
  gross_weight_grams: number | '';
  stone_weight_grams: number | '';
  rate_per_gram_rupees: number | '';
  loan_amount_rupees: number | '';
  remarks: string;
}

interface BulkLoanEntryViewProps {
  onLoanCreated: (loanId: string) => void;
  onCancel: () => void;
}

export const BulkLoanEntryView: React.FC<BulkLoanEntryViewProps> = ({ onLoanCreated, onCancel }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [rates, setRates] = useState<MetalRate[]>([]);
  const [materialTypeConfigs, setMaterialTypeConfigs] = useState<MaterialTypeConfig[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Business Date and Backdating
  const [loanDate, setLoanDate] = useState<string>(getTodayISO());
  const [tenureMonths, setTenureMonths] = useState<number>(6);
  const [dueDate, setDueDate] = useState<string>(addMonths(getTodayISO(), 6));
  const [backdateReason, setBackdateReason] = useState<string>('');

  // Default Loan Settings
  const [ltvPercent, setLtvPercent] = useState<number>(75.0);
  const [interestRatePercent, setInterestRatePercent] = useState<number>(2.0);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('CASH');

  // Override controls
  const [isOverride, setIsOverride] = useState<boolean>(false);
  const [overrideReason, setOverrideReason] = useState<string>('');

  // Aggregated Material Blocks
  const [blocks, setBlocks] = useState<MaterialBlock[]>([
    {
      id: 'block-1',
      material: 'GOLD',
      material_type: '22K Gold',
      purity: '22K',
      purity_percent: 91.67,
      gross_weight_grams: 60.0,
      stone_weight_grams: 2.0,
      rate_per_gram_rupees: 7000,
      loan_amount_rupees: 300000,
      remarks: 'Combined gold ornaments (rings, chains, bangles)',
    },
  ]);

  const getRateForMaterialAndType = (
    material: 'GOLD' | 'SILVER',
    matTypeName?: string,
    purity?: string,
    purityPct?: number,
    currentRates: MetalRate[] = rates,
    configs: MaterialTypeConfig[] = materialTypeConfigs
  ): number => {
    if (matTypeName) {
      const cfg = configs.find((c) => c.name.toLowerCase() === matTypeName.toLowerCase());
      if (cfg?.rate_per_gram_paise && cfg.rate_per_gram_paise > 0) {
        return cfg.rate_per_gram_paise / 100;
      }
    }
    const match = currentRates.find(
      (r) =>
        r.material === material &&
        (r.material_type === matTypeName || (purity && r.purity === purity))
    );
    if (match && match.rate_per_gram_paise > 0) {
      return match.rate_per_gram_paise / 100;
    }
    if (material === 'GOLD') {
      const g24 = currentRates.find((r) => r.material === 'GOLD' && (r.purity === '24K' || r.material_type === '24K Gold'));
      const g22 = currentRates.find((r) => r.material === 'GOLD' && (r.purity === '22K' || r.material_type === '22K Gold'));
      const pct = purityPct ?? 91.67;
      if (g24) return Math.round((g24.rate_per_gram_paise / 100) * (pct / 100));
      if (g22) return Math.round(((g22.rate_per_gram_paise / 100) / 0.9167) * (pct / 100));
      return 7000;
    } else if (material === 'SILVER') {
      const s999 = currentRates.find((r) => r.material === 'SILVER' && (r.purity === '999' || r.material_type === 'Silver 999'));
      const s925 = currentRates.find((r) => r.material === 'SILVER' && (r.purity === '925' || r.material_type === 'Silver 925'));
      const pct = purityPct ?? 92.5;
      if (s999) return Math.round((s999.rate_per_gram_paise / 100) * (pct / 99.9));
      if (s925) return Math.round(((s925.rate_per_gram_paise / 100) / 0.925) * (pct / 100));
      return 85;
    }
    return 0;
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        if (window.api) {
          const [custRes, metalRates, settings, user, matTypes] = await Promise.all([
            window.api.customers.searchCustomers('', 100, 0),
            window.api.rates.getLatestRates(),
            window.api.settings.getSettings(),
            window.api.auth.getCurrentUser(),
            window.api.materialTypes.getMaterialTypes(true),
          ]);

          setCustomers(custRes?.customers || []);
          setRates(metalRates || []);
          setCurrentUser(user);
          setMaterialTypeConfigs(matTypes || []);

          if (settings) {
            setLtvPercent(settings.default_ltv_percent || 75.0);
            setInterestRatePercent(settings.default_interest_rate_percent || 2.0);
          }

          // Populate rate for initial block from rates
          const initialRate = getRateForMaterialAndType('GOLD', '22K Gold', '22K', 91.67, metalRates || [], matTypes || []);
          setBlocks((prev) =>
            prev.map((b, idx) =>
              idx === 0
                ? {
                    ...b,
                    rate_per_gram_rupees: initialRate,
                  }
                : b
            )
          );
        }
      } catch (err) {
        console.error('Failed to load initial data for bulk entry:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const today = getTodayISO();
  const isBackdated = loanDate < today;
  const isOwner = currentUser?.role === 'OWNER';
  const hasBackdatePermission = isOwner || !!currentUser?.permissions?.CREATE_BACKDATED_LOAN;

  const handleLoanDateChange = (newDate: string) => {
    setLoanDate(newDate);
    setDueDate(addMonths(newDate, tenureMonths || 6));
  };

  const handleTenureChange = (months: number) => {
    setTenureMonths(months);
    setDueDate(addMonths(loanDate, months));
  };

  const handleAddMaterialBlock = (material: 'GOLD' | 'SILVER' = 'GOLD') => {
    const defaultCfg = materialTypeConfigs.find((m) => m.base_material === material && m.is_active);
    const defaultTypeName = defaultCfg ? defaultCfg.name : (material === 'GOLD' ? '22K Gold' : 'Silver 925');
    const defaultPurity = defaultCfg ? (defaultCfg.karat_or_fineness || `${defaultCfg.purity_percent}%`) : (material === 'GOLD' ? '22K' : '925');
    const defaultPct = defaultCfg ? defaultCfg.purity_percent : (material === 'GOLD' ? 91.67 : 92.5);
    const rate = getRateForMaterialAndType(material, defaultTypeName, defaultPurity, defaultPct);

    const newBlock: MaterialBlock = {
      id: `block-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      material,
      material_type: defaultTypeName,
      purity: defaultPurity,
      purity_percent: defaultPct,
      gross_weight_grams: '',
      stone_weight_grams: 0,
      rate_per_gram_rupees: rate,
      loan_amount_rupees: '',
      remarks: '',
    };
    setBlocks([...blocks, newBlock]);
  };

  const handleRemoveBlock = (id: string) => {
    if (blocks.length <= 1) {
      setError('At least one material block is required.');
      return;
    }
    setBlocks(blocks.filter((b) => b.id !== id));
  };

  const handleUpdateBlock = (id: string, field: keyof MaterialBlock, value: any) => {
    setBlocks(
      blocks.map((b) => {
        if (b.id !== id) return b;

        const updated = { ...b, [field]: value };

        // If material changed, adjust material type, purity and rate
        if (field === 'material') {
          const newMaterial = value as 'GOLD' | 'SILVER';
          const defaultCfg = materialTypeConfigs.find((m) => m.base_material === newMaterial && m.is_active);
          const defaultTypeName = defaultCfg ? defaultCfg.name : (newMaterial === 'GOLD' ? '22K Gold' : 'Silver 925');
          const defaultPurity = defaultCfg ? (defaultCfg.karat_or_fineness || `${defaultCfg.purity_percent}%`) : (newMaterial === 'GOLD' ? '22K' : '925');
          const defaultPct = defaultCfg ? defaultCfg.purity_percent : (newMaterial === 'GOLD' ? 91.67 : 92.5);
          updated.material_type = defaultTypeName;
          updated.purity = defaultPurity;
          updated.purity_percent = defaultPct;
          updated.rate_per_gram_rupees = getRateForMaterialAndType(newMaterial, defaultTypeName, defaultPurity, defaultPct);
        } else if (field === 'material_type') {
          const cfg = materialTypeConfigs.find((m) => m.name === value);
          if (cfg) {
            updated.material_type = cfg.name;
            updated.purity = cfg.karat_or_fineness || `${cfg.purity_percent}%`;
            updated.purity_percent = cfg.purity_percent;
            updated.rate_per_gram_rupees = getRateForMaterialAndType(b.material, cfg.name, updated.purity, cfg.purity_percent);
          } else {
            updated.material_type = value;
          }
        } else if (field === 'purity') {
          updated.rate_per_gram_rupees = getRateForMaterialAndType(b.material, b.material_type, value as string, b.purity_percent);
        }

        // Recalculate suggested loan amount if gross weight or rate changed and loan was empty or unadjusted
        const gross = Number(updated.gross_weight_grams) || 0;
        const stone = Number(updated.stone_weight_grams) || 0;
        const rate = Number(updated.rate_per_gram_rupees) || 0;
        const net = Math.max(0, gross - stone);
        const val = net * rate;
        const maxEligible = Math.round(val * (ltvPercent / 100));

        if (field === 'gross_weight_grams' || field === 'stone_weight_grams' || field === 'rate_per_gram_rupees' || field === 'material' || field === 'material_type') {
          if (updated.loan_amount_rupees === '' || updated.loan_amount_rupees === 0) {
            updated.loan_amount_rupees = maxEligible > 0 ? maxEligible : '';
          }
        }

        return updated;
      })
    );
  };

  // Aggregated totals across all material blocks
  let totalGrossWeight = 0;
  let totalStoneWeight = 0;
  let totalNetWeight = 0;
  let totalValuationRupees = 0;
  let totalMaxEligibleLoanRupees = 0;
  let totalActualLoanGivenRupees = 0;

  for (const b of blocks) {
    const gross = Number(b.gross_weight_grams) || 0;
    const stone = Number(b.stone_weight_grams) || 0;
    const net = Math.max(0, gross - stone);
    const rate = Number(b.rate_per_gram_rupees) || 0;
    const val = net * rate;
    const maxLoan = Math.round(val * (ltvPercent / 100));
    const loanAmt = Number(b.loan_amount_rupees) || 0;

    totalGrossWeight += gross;
    totalStoneWeight += stone;
    totalNetWeight += net;
    totalValuationRupees += val;
    totalMaxEligibleLoanRupees += maxLoan;
    totalActualLoanGivenRupees += loanAmt;
  }

  const isOverLtv = totalActualLoanGivenRupees > totalMaxEligibleLoanRupees;

  const handleSubmitBulkLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedCustomerId) {
      setError('Please select a customer for this loan.');
      return;
    }

    if (blocks.length === 0) {
      setError('Please add at least one material block.');
      return;
    }

    // Validate each material block
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      const gross = Number(b.gross_weight_grams) || 0;
      const stone = Number(b.stone_weight_grams) || 0;
      const rate = Number(b.rate_per_gram_rupees) || 0;
      const loan = Number(b.loan_amount_rupees) || 0;

      if (gross <= 0) {
        setError(`Block #${i + 1} (${b.material}): Gross weight must be greater than 0.`);
        return;
      }
      if (stone < 0) {
        setError(`Block #${i + 1} (${b.material}): Stone weight cannot be negative.`);
        return;
      }
      if (stone >= gross) {
        setError(`Block #${i + 1} (${b.material}): Stone weight cannot exceed or equal gross weight.`);
        return;
      }
      if (rate <= 0) {
        setError(`Block #${i + 1} (${b.material}): Rate per gram must be greater than 0.`);
        return;
      }
      if (loan <= 0) {
        setError(`Block #${i + 1} (${b.material}): Loan amount allocated must be greater than 0.`);
        return;
      }
    }

    if (totalActualLoanGivenRupees <= 0) {
      setError('Total loan amount must be greater than zero.');
      return;
    }

    if (isOverLtv && !isOverride) {
      setError(
        `Total loan amount (₹${totalActualLoanGivenRupees.toLocaleString('en-IN')}) exceeds maximum eligible LTV loan (₹${totalMaxEligibleLoanRupees.toLocaleString('en-IN')}). Authorized override is required to proceed.`
      );
      return;
    }

    if (isOverLtv && !overrideReason.trim()) {
      setError('Please provide an explicit justification reason for overriding the maximum eligible loan.');
      return;
    }

    // Backdated Loan Validation
    if (loanDate > today) {
      setError('Loan date cannot be in the future. Please select today or an earlier date.');
      return;
    }

    if (isBackdated) {
      if (!hasBackdatePermission) {
        setError('You do not have permission to record backdated loans. Contact the business owner.');
        return;
      }
      if (!backdateReason.trim()) {
        setError('Please provide a mandatory reason for backdating this loan record.');
        return;
      }
    }

    setSubmitting(true);
    try {
      if (!window.api) throw new Error('Desktop IPC bridge not available');

      // Create loan atomically with items corresponding to the aggregated material blocks
      const created = await window.api.loans.createLoan({
        customer_id: selectedCustomerId,
        loan_date: loanDate,
        start_date: loanDate,
        due_date: dueDate,
        principal_paise: Math.round(totalActualLoanGivenRupees * 100),
        interest_rate_percent: interestRatePercent,
        interest_period: 'MONTHLY',
        interest_method: 'MONTHLY_SIMPLE',
        ltv_percent: ltvPercent,
        is_override: isOverLtv,
        override_reason: isOverLtv ? overrideReason.trim() : undefined,
        payment_mode: paymentMode,
        backdate_reason: isBackdated ? backdateReason.trim() : undefined,
        items: blocks.map((b) => {
          const gross = Number(b.gross_weight_grams) || 0;
          const stone = Number(b.stone_weight_grams) || 0;
          const net = Math.max(0, gross - stone);
          const ratePaise = Math.round((Number(b.rate_per_gram_rupees) || 0) * 100);
          const loanPaise = Math.round((Number(b.loan_amount_rupees) || 0) * 100);

          return {
            category: b.material === 'GOLD' ? 'Gold Ornaments (Bulk)' : 'Silver Articles (Bulk)',
            description: `Bulk ${b.material_type || b.purity} ${b.material} (Combined Net Weight ${formatWeight(net)})${b.remarks ? ` - ${b.remarks}` : ''}`,
            material: b.material,
            material_type: b.material_type || `${b.purity} ${b.material}`,
            purity: b.purity,
            purity_percent: b.purity_percent,
            gross_weight_grams: gross,
            stone_weight_grams: stone,
            rate_per_gram_paise: ratePaise,
            allocated_loan_paise: loanPaise,
            remarks: b.remarks || undefined,
          };
        }),
      });

      onLoanCreated(created.id);
    } catch (err: any) {
      setError(err?.message || 'Failed to submit bulk loan');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <span className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Aggregated Material Entry
          </span>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Bulk Jewellery Loan Entry</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Enter combined total weight of ornaments by material (Gold / Silver) without item-by-item breakdown
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => handleAddMaterialBlock('GOLD')}
          >
            + Add Gold Block
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => handleAddMaterialBlock('SILVER')}
          >
            + Add Silver Block
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-3 shadow-sm">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Customer & Terms Bar */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Select Customer *
          </label>
          <select
            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-medium focus:ring-2 focus:ring-amber-500"
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
          >
            <option value="">-- Choose Borrower --</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name} ({c.phone}) - {c.id} [Aadhaar: •••• {c.aadhaar_last4}]
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span>Loan Date (Business Date) *</span>
            {isBackdated && (
              <span className="text-[10px] text-amber-700 font-bold bg-amber-100 px-1.5 py-0.5 rounded">
                Backdated
              </span>
            )}
          </label>
          <input
            type="date"
            max={today}
            className={`w-full border rounded-lg px-3 py-2 text-xs font-mono font-medium focus:ring-2 focus:ring-amber-500 ${
              isBackdated
                ? 'bg-amber-50 border-amber-300 text-amber-950 font-bold'
                : 'bg-slate-50 border-slate-300 text-slate-900'
            }`}
            value={loanDate}
            onChange={(e) => handleLoanDateChange(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Tenure & Due Date
          </label>
          <div className="grid grid-cols-2 gap-2">
            <select
              className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-2 text-xs text-slate-900 font-medium"
              value={tenureMonths}
              onChange={(e) => handleTenureChange(parseInt(e.target.value, 10))}
            >
              <option value={3}>3 Mo</option>
              <option value={6}>6 Mo</option>
              <option value={9}>9 Mo</option>
              <option value={12}>12 Mo</option>
              <option value={24}>24 Mo</option>
            </select>
            <input
              type="date"
              className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-2 text-[11px] font-mono text-slate-700"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Monthly Interest Rate %
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.05"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono font-bold"
              value={interestRatePercent}
              onChange={(e) => setInterestRatePercent(Number(e.target.value) || 0)}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">%</span>
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Disbursement Mode
          </label>
          <select
            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-medium"
            value={paymentMode}
            onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
          >
            <option value="CASH">Cash in Hand</option>
            <option value="UPI">UPI Digital Transfer</option>
            <option value="BANK_TRANSFER">Direct Bank NEFT/RTGS</option>
            <option value="CHEQUE">Bank Cheque</option>
          </select>
        </div>

        {/* Backdated Loan Audit Reason Card */}
        {isBackdated && (
          <div className="md:col-span-4 p-4 bg-amber-50/90 border border-amber-300/80 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Backdated Loan Record — Official Business Date: {loanDate}</span>
            </div>
            <p className="text-[11px] text-amber-800">
              The loan disbursement ledger entry and interest accrual will begin from {loanDate}. The exact entry timestamp will also be preserved in system audit logs.
            </p>
            <div>
              <label className="block text-[11px] font-bold text-amber-900 uppercase tracking-wide mb-1">
                Reason for Backdating * (Required for Audit)
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Migration from physical ledger book, offline weekend transaction"
                className="w-full bg-white border border-amber-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-medium placeholder-amber-400/80 focus:ring-2 focus:ring-amber-500"
                value={backdateReason}
                onChange={(e) => setBackdateReason(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Material Blocks */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-500" /> Material Pledges ({blocks.length} {blocks.length === 1 ? 'block' : 'blocks'})
          </h2>
          <span className="text-xs text-slate-500">
            Combine ornaments of matching material into a single bulk block
          </span>
        </div>

        {blocks.map((block, index) => {
          const gross = Number(block.gross_weight_grams) || 0;
          const stone = Number(block.stone_weight_grams) || 0;
          const net = Math.max(0, gross - stone);
          const rate = Number(block.rate_per_gram_rupees) || 0;
          const val = net * rate;
          const maxEligible = Math.round(val * (ltvPercent / 100));
          const loanAmt = Number(block.loan_amount_rupees) || 0;
          const isBlockOverLtv = loanAmt > maxEligible && maxEligible > 0;

          return (
            <div
              key={block.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 relative overflow-hidden transition-all hover:border-amber-300"
            >
              {/* Block Header Badge */}
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      block.material === 'GOLD'
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : 'bg-slate-200 text-slate-800 border border-slate-300'
                    }`}
                  >
                    Block #{index + 1}: {block.material} ({block.material_type || block.purity}{block.purity_percent ? ` • ${block.purity_percent}%` : ''})
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    Net: {formatWeight(net)} | Valuation: {formatINR(Math.round(val * 100))}
                  </span>
                </div>

                {blocks.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveBlock(block.id)}
                    className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                    title="Remove this material block"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-8 gap-4 text-xs">
                {/* 1. Material */}
                <div className="lg:col-span-1">
                  <label className="block text-slate-600 font-semibold mb-1">Material</label>
                  <select
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 font-bold text-slate-900"
                    value={block.material}
                    onChange={(e) => handleUpdateBlock(block.id, 'material', e.target.value)}
                  >
                    <option value="GOLD">Gold</option>
                    <option value="SILVER">Silver</option>
                  </select>
                </div>

                {/* 2. Material Type & Purity */}
                <div className="lg:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-600 font-semibold">Material Type</label>
                    {block.purity_percent !== undefined && (
                      <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 rounded">
                        {block.purity_percent}%
                      </span>
                    )}
                  </div>
                  <select
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 font-bold text-amber-900"
                    value={block.material_type || ''}
                    onChange={(e) => handleUpdateBlock(block.id, 'material_type', e.target.value)}
                  >
                    {materialTypeConfigs
                      .filter((m) => m.base_material === block.material && m.is_active)
                      .map((m) => (
                        <option key={m.id} value={m.name}>
                          {m.name} ({m.purity_percent}%)
                        </option>
                      ))}
                  </select>
                </div>

                {/* 3. Combined Gross Weight */}
                <div className="lg:col-span-1">
                  <label className="block text-slate-600 font-semibold mb-1">Combined Gross Wt</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.001"
                      placeholder="0.00"
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-2.5 pr-6 py-2 font-mono font-bold text-slate-900"
                      value={block.gross_weight_grams}
                      onChange={(e) =>
                        handleUpdateBlock(
                          block.id,
                          'gross_weight_grams',
                          e.target.value === '' ? '' : Number(e.target.value)
                        )
                      }
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-[10px]">
                      g
                    </span>
                  </div>
                </div>

                {/* 4. Combined Stone Weight */}
                <div className="lg:col-span-1">
                  <label className="block text-slate-600 font-semibold mb-1">Stone / Tare Wt</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.001"
                      placeholder="0.00"
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-2.5 pr-6 py-2 font-mono text-slate-700"
                      value={block.stone_weight_grams}
                      onChange={(e) =>
                        handleUpdateBlock(
                          block.id,
                          'stone_weight_grams',
                          e.target.value === '' ? '' : Number(e.target.value)
                        )
                      }
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-[10px]">
                      g
                    </span>
                  </div>
                </div>

                {/* 5. Combined Net Weight (Auto) */}
                <div className="lg:col-span-1">
                  <label className="block text-slate-500 font-semibold mb-1">Calculated Net Wt</label>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 font-mono font-bold text-amber-900">
                    {formatWeight(net)}
                  </div>
                </div>

                {/* 6. Rate / Gram */}
                <div className="lg:col-span-1">
                  <label className="block text-slate-600 font-semibold mb-1">Rate / Gram (₹)</label>
                  <input
                    type="number"
                    step="1"
                    placeholder="Rate"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 font-mono font-bold text-slate-900"
                    value={block.rate_per_gram_rupees}
                    onChange={(e) =>
                      handleUpdateBlock(
                        block.id,
                        'rate_per_gram_rupees',
                        e.target.value === '' ? '' : Number(e.target.value)
                      )
                    }
                  />
                </div>

                {/* 7. Valuation (Auto) */}
                <div className="lg:col-span-1">
                  <label className="block text-slate-500 font-semibold mb-1">Jewellery Valuation</label>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 font-mono font-bold text-slate-900 truncate">
                    ₹{val.toLocaleString('en-IN')}
                  </div>
                </div>

                {/* 8. Loan Amount Given */}
                <div className="lg:col-span-1">
                  <label className="block text-slate-700 font-bold mb-1">Loan Amount Given (₹)</label>
                  <input
                    type="number"
                    step="100"
                    placeholder="Amount"
                    className={`w-full border rounded-lg px-2.5 py-2 font-mono font-bold text-slate-900 ${
                      isBlockOverLtv
                        ? 'bg-rose-50 border-rose-300 focus:border-rose-500 text-rose-900'
                        : 'bg-emerald-50/50 border-emerald-300 focus:border-emerald-500'
                    }`}
                    value={block.loan_amount_rupees}
                    onChange={(e) =>
                      handleUpdateBlock(
                        block.id,
                        'loan_amount_rupees',
                        e.target.value === '' ? '' : Number(e.target.value)
                      )
                    }
                  />
                </div>
              </div>

              {/* Block Footer: Remarks & Max Eligible Indicator */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="flex-1 w-full sm:w-auto">
                  <input
                    type="text"
                    placeholder="Remarks / Description of ornaments in this block (e.g. 2 bangles, 1 chain)"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 placeholder-slate-400"
                    value={block.remarks}
                    onChange={(e) => handleUpdateBlock(block.id, 'remarks', e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-4 text-xs font-mono shrink-0">
                  <span className="text-slate-500">
                    Max Eligible ({ltvPercent}% LTV):{' '}
                    <strong className="text-slate-800">₹{maxEligible.toLocaleString('en-IN')}</strong>
                  </span>
                  {isBlockOverLtv && (
                    <span className="text-rose-600 font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Exceeds {ltvPercent}% LTV
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Box & Submission */}
      <div className="bg-slate-900 text-slate-100 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">Consolidated Loan Summary</h3>
          </div>
          <span className="text-xs text-amber-400 font-semibold bg-amber-950/80 px-3 py-1 rounded-full border border-amber-500/30">
            {blocks.length} Material {blocks.length === 1 ? 'Entry' : 'Entries'}
          </span>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700">
            <span className="text-[11px] text-slate-400 uppercase font-semibold">Total Gross Weight</span>
            <div className="text-lg font-bold font-mono text-white mt-1">
              {formatWeight(totalGrossWeight)}
            </div>
          </div>

          <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700">
            <span className="text-[11px] text-slate-400 uppercase font-semibold">Total Net Weight</span>
            <div className="text-lg font-bold font-mono text-amber-400 mt-1">
              {formatWeight(totalNetWeight)}
            </div>
          </div>

          <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700">
            <span className="text-[11px] text-slate-400 uppercase font-semibold">Total Appraised Valuation</span>
            <div className="text-lg font-bold font-mono text-white mt-1">
              ₹{totalValuationRupees.toLocaleString('en-IN')}
            </div>
          </div>

          <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700">
            <span className="text-[11px] text-slate-400 uppercase font-semibold">Max Eligible ({ltvPercent}% LTV)</span>
            <div className="text-lg font-bold font-mono text-emerald-400 mt-1">
              ₹{totalMaxEligibleLoanRupees.toLocaleString('en-IN')}
            </div>
          </div>

          <div className="bg-gradient-to-br from-amber-500/20 to-amber-600/10 p-3.5 rounded-xl border border-amber-500/40">
            <span className="text-[11px] text-amber-300 uppercase font-bold">Total Loan Given</span>
            <div className="text-xl font-black font-mono text-amber-400 mt-1">
              ₹{totalActualLoanGivenRupees.toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        {/* LTV Warning & Override Controls if requested loan > max eligible */}
        {isOverLtv && (
          <div className="p-4 bg-rose-950/80 border border-rose-500/50 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-rose-300 text-xs font-bold">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>LOAN AMOUNT EXCEEDS MAXIMUM ELIGIBLE LTV CEILING</span>
            </div>
            <p className="text-xs text-rose-200/90 leading-relaxed">
              The requested total loan amount of <strong>₹{totalActualLoanGivenRupees.toLocaleString('en-IN')}</strong> exceeds the standard {ltvPercent}% LTV ceiling of <strong>₹{totalMaxEligibleLoanRupees.toLocaleString('en-IN')}</strong>. An authorized executive/owner override is required.
            </p>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-1">
              <label className="flex items-center gap-2 text-xs font-semibold text-rose-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isOverride}
                  onChange={(e) => setIsOverride(e.target.checked)}
                  className="rounded border-rose-400 text-rose-600 focus:ring-rose-500 w-4 h-4"
                />
                Authorise LTV Override
              </label>
              {isOverride && (
                <input
                  type="text"
                  placeholder="Mandatory justification reason for override"
                  className="flex-1 bg-slate-900 border border-rose-400/60 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                />
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="outline" className="text-slate-300 border-slate-700 hover:bg-slate-800" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="gold"
            size="lg"
            isLoading={submitting}
            icon={<CheckCircle2 className="w-5 h-5" />}
            onClick={handleSubmitBulkLoan}
          >
            Disburse & Book Bulk Loan
          </Button>
        </div>
      </div>
    </div>
  );
};
