import React, { useState, useEffect } from 'react';
import {
  PlusCircle,
  Users,
  Gem,
  Calculator,
  ShieldCheck,
  AlertTriangle,
  Trash2,
  Receipt,
  Printer,
  CheckCircle2,
  Lock,
  Clock,
  UserPlus,
} from 'lucide-react';
import { Customer, MaterialType, PaymentMode, MetalRate, CustomCategory, MaterialTypeConfig } from '../types';
import { formatINR, formatWeight, rupeesToPaise } from '../utils/currency';
import { getTodayISO, addMonths } from '../utils/dates';
import { formatItemCategory, formatItemMaterial } from '../utils/purity';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { CurrencyInput } from '../components/common/CurrencyInput';
import { WeightInput } from '../components/common/WeightInput';
import { QuickCustomerModal } from '../components/customers/QuickCustomerModal';
import { handleEnterKeyNavigation } from '../utils/keyboardNavigation';
import { api } from '../api';

export const PREDEFINED_CATEGORIES = [
  'Ring',
  'Chain',
  'Necklace',
  'Bracelet',
  'Bangle',
  'Earrings',
  'Anklet',
  'Pendant',
  'Coin',
  'Other Article',
];

interface JewelleryRow {
  category: string;
  custom_category?: string;
  description: string;
  material: MaterialType;
  material_type?: string;
  purity: string;
  purity_percent?: number;
  gross_weight_grams: number;
  stone_weight_grams: number;
  rate_per_gram_paise: number;
  allocated_loan_paise: number;
}

interface NewLoanWizardViewProps {
  initialCustomerId?: string;
  onLoanCreated: (loanId: string) => void;
  onCancel: () => void;
}

export const NewLoanWizardView: React.FC<NewLoanWizardViewProps> = ({
  initialCustomerId,
  onLoanCreated,
  onCancel,
}) => {
  const { currentUser, isOwner, hasPermission } = useAuth();

  // Wizard state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(initialCustomerId || '');
  const [customersList, setCustomersList] = useState<Customer[]>([]);
  const [ratesList, setRatesList] = useState<MetalRate[]>([]);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [materialTypeConfigs, setMaterialTypeConfigs] = useState<MaterialTypeConfig[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [showQuickCustomerModal, setShowQuickCustomerModal] = useState<boolean>(false);

  // Loan Terms
  const [loanDate, setLoanDate] = useState<string>(getTodayISO());
  const [tenureMonths, setTenureMonths] = useState<number>(6);
  const [dueDate, setDueDate] = useState<string>(addMonths(getTodayISO(), 6));
  const [interestRate, setInterestRate] = useState<number>(2.0);
  const [interestPeriod, setInterestPeriod] = useState<'MONTHLY' | 'YEARLY' | 'DAILY'>('MONTHLY');
  const [interestMethod, setInterestMethod] = useState<'MONTHLY_SIMPLE' | 'DAILY_SIMPLE' | 'FLAT'>('MONTHLY_SIMPLE');
  const [minInterestDays, setMinInterestDays] = useState<number>(15);
  const [gracePeriodDays, setGracePeriodDays] = useState<number>(7);
  const [ltvPercent, setLtvPercent] = useState<number>(75);
  const [processingFeeRupees, setProcessingFeeRupees] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('CASH');
  const [disbursementRef, setDisbursementRef] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [backdateReason, setBackdateReason] = useState<string>('');

  const isBackdated = loanDate < getTodayISO();
  const canBackdate = isOwner || Boolean(hasPermission && hasPermission('CREATE_BACKDATED_LOAN'));

  const handleLoanDateChange = (newDate: string) => {
    setLoanDate(newDate);
    if (newDate) {
      setDueDate(addMonths(newDate, tenureMonths));
    }
  };

  const handleTenureChange = (newTenure: number) => {
    setTenureMonths(newTenure);
    if (loanDate) {
      setDueDate(addMonths(loanDate, newTenure));
    }
  };

  // Override Modal
  const [showOverrideModal, setShowOverrideModal] = useState<boolean>(false);
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [overrideAuthorized, setOverrideAuthorized] = useState<boolean>(false);

  // Rate resolution helper
  const resolveRate = (
    mat: MaterialType,
    matTypeName?: string,
    purity?: string,
    purityPct?: number,
    currentRates: MetalRate[] = ratesList,
    configs: MaterialTypeConfig[] = materialTypeConfigs
  ): number => {
    if (matTypeName) {
      const cfg = configs.find((c) => c.name.toLowerCase() === matTypeName.toLowerCase());
      if (cfg?.rate_per_gram_paise && cfg.rate_per_gram_paise > 0) {
        return cfg.rate_per_gram_paise;
      }
    }
    const match = currentRates.find(
      (r) =>
        r.material === mat &&
        (r.material_type === matTypeName || (purity && r.purity === purity))
    );
    if (match && match.rate_per_gram_paise > 0) {
      return match.rate_per_gram_paise;
    }
    if (mat === 'GOLD') {
      const g24 = currentRates.find((r) => r.material === 'GOLD' && (r.purity === '24K' || r.material_type === '24K Gold'));
      const g22 = currentRates.find((r) => r.material === 'GOLD' && (r.purity === '22K' || r.material_type === '22K Gold'));
      const pct = purityPct ?? 91.67;
      if (g24) return Math.round(g24.rate_per_gram_paise * (pct / 100));
      if (g22) return Math.round((g22.rate_per_gram_paise / 0.9167) * (pct / 100));
      return 700000;
    } else if (mat === 'SILVER') {
      const s999 = currentRates.find((r) => r.material === 'SILVER' && (r.purity === '999' || r.material_type === 'Silver 999'));
      const s925 = currentRates.find((r) => r.material === 'SILVER' && (r.purity === '925' || r.material_type === 'Silver 925'));
      const pct = purityPct ?? 92.5;
      if (s999) return Math.round(s999.rate_per_gram_paise * (pct / 99.9));
      if (s925) return Math.round((s925.rate_per_gram_paise / 0.925) * (pct / 100));
      return 8500;
    }
    return 0;
  };

  // Jewellery Items
  const [items, setItems] = useState<JewelleryRow[]>([
    {
      category: 'Chain',
      description: '22K Gold Chain',
      material: 'GOLD',
      material_type: '22K Gold',
      purity: '22K',
      purity_percent: 91.67,
      gross_weight_grams: 20.0,
      stone_weight_grams: 0.0,
      rate_per_gram_paise: 700000,
      allocated_loan_paise: 0,
    },
  ]);

  const [requestedPrincipalRupees, setRequestedPrincipalRupees] = useState<number>(100000);

  // Load Customers, Rates, Categories & Material Types
  useEffect(() => {
    const initData = async () => {
      try {
        if (window.api) {
          const custRes = await window.api.customers.searchCustomers('', 100, 0);
          const rates = await window.api.rates.getLatestRates();
          const settings = await window.api.settings.getSettings();
          const cats = await window.api.categories.getCustomCategories(true);
          const matTypes = await window.api.materialTypes.getMaterialTypes(true);

          setCustomersList(custRes.customers || []);
          setRatesList(rates || []);
          setCustomCategories(cats || []);
          setMaterialTypeConfigs(matTypes || []);

          if (settings) {
            setInterestRate(settings.default_interest_rate_percent || 2.0);
            setLtvPercent(settings.default_ltv_percent || 75.0);
            setMinInterestDays(settings.default_min_interest_days || 15);
            setGracePeriodDays(settings.default_grace_period_days || 7);
          }

          const initialRate = resolveRate('GOLD', '22K Gold', '22K', 91.67, rates || [], matTypes || []);
          setItems([
            {
              category: 'Chain',
              description: '22K Gold Chain',
              material: 'GOLD',
              material_type: '22K Gold',
              purity: '22K',
              purity_percent: 91.67,
              gross_weight_grams: 20.0,
              stone_weight_grams: 0.0,
              rate_per_gram_paise: initialRate,
              allocated_loan_paise: 0,
            },
          ]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, []);

  // Update due date when tenure or loanDate changes
  useEffect(() => {
    setDueDate(addMonths(loanDate, tenureMonths));
  }, [loanDate, tenureMonths]);

  // Handle adding jewellery item
  const handleAddItem = () => {
    const rate = resolveRate('GOLD', '22K Gold', '22K', 91.67);
    setItems([
      ...items,
      {
        category: 'Ring',
        description: '22K Gold Ring',
        material: 'GOLD',
        material_type: '22K Gold',
        purity: '22K',
        purity_percent: 91.67,
        gross_weight_grams: 10.0,
        stone_weight_grams: 0.0,
        rate_per_gram_paise: rate,
        allocated_loan_paise: 0,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleCategoryChange = (index: number, newCat: string) => {
    const updated = [...items];
    updated[index].category = newCat;
    if (newCat !== 'Other Article') {
      updated[index].custom_category = undefined;
    } else if (updated[index].custom_category === undefined) {
      updated[index].custom_category = '';
    }
    setItems(updated);
  };

  const handleMaterialChange = (index: number, newMat: MaterialType) => {
    const updated = [...items];
    updated[index].material = newMat;
    const defaultCfg = materialTypeConfigs.find((m) => m.base_material === newMat && m.is_active);
    if (defaultCfg) {
      updated[index].material_type = defaultCfg.name;
      updated[index].purity = defaultCfg.karat_or_fineness || `${defaultCfg.purity_percent}%`;
      updated[index].purity_percent = defaultCfg.purity_percent;
      updated[index].rate_per_gram_paise = resolveRate(newMat, defaultCfg.name, updated[index].purity, defaultCfg.purity_percent);
    } else {
      updated[index].material_type = newMat === 'GOLD' ? '22K Gold' : newMat === 'SILVER' ? 'Silver 925' : 'Other';
      updated[index].purity = newMat === 'GOLD' ? '22K' : newMat === 'SILVER' ? '925' : '100%';
      updated[index].purity_percent = newMat === 'GOLD' ? 91.67 : newMat === 'SILVER' ? 92.5 : 100;
      updated[index].rate_per_gram_paise = resolveRate(newMat, updated[index].material_type, updated[index].purity, updated[index].purity_percent);
    }
    setItems(updated);
  };

  const handleMaterialTypeChange = (index: number, typeName: string) => {
    const updated = [...items];
    if (typeName === 'CUSTOM') {
      updated[index].material_type = 'CUSTOM';
      updated[index].purity = '';
      updated[index].purity_percent = 100;
      setItems(updated);
      return;
    }
    const cfg = materialTypeConfigs.find((m) => m.name === typeName);
    if (cfg) {
      updated[index].material_type = cfg.name;
      updated[index].purity = cfg.karat_or_fineness || `${cfg.purity_percent}%`;
      updated[index].purity_percent = cfg.purity_percent;
      updated[index].rate_per_gram_paise = resolveRate(updated[index].material, cfg.name, updated[index].purity, cfg.purity_percent);
    } else {
      updated[index].material_type = typeName;
    }
    setItems(updated);
  };

  const handlePurityPercentChange = (index: number, pct: number) => {
    const updated = [...items];
    updated[index].purity_percent = pct;
    updated[index].rate_per_gram_paise = resolveRate(
      updated[index].material,
      updated[index].material_type,
      updated[index].purity,
      pct
    );
    setItems(updated);
  };

  const handleItemChange = (index: number, field: keyof JewelleryRow, val: any) => {
    const updated = [...items];
    (updated[index] as any)[field] = val;
    setItems(updated);
  };

  // Live Calculations
  let totalGross = 0;
  let totalStone = 0;
  let totalNet = 0;
  let totalValuationPaise = 0;
  let totalMaxEligibleLoanPaise = 0;

  for (const item of items) {
    const gross = Number(item.gross_weight_grams) || 0;
    const stone = Number(item.stone_weight_grams) || 0;
    const net = Math.max(0, gross - stone);
    const valPaise = Math.round(net * (item.rate_per_gram_paise || 0));
    const maxLoan = Math.round(valPaise * (ltvPercent / 100));

    totalGross += gross;
    totalStone += stone;
    totalNet += net;
    totalValuationPaise += valPaise;
    totalMaxEligibleLoanPaise += maxLoan;
  }

  const requestedPrincipalPaise = requestedPrincipalRupees * 100;
  const isExceedingLtv = requestedPrincipalPaise > totalMaxEligibleLoanPaise;
  const excessAmountPaise = Math.max(0, requestedPrincipalPaise - totalMaxEligibleLoanPaise);
  const availableMarginPaise = Math.max(0, totalValuationPaise - requestedPrincipalPaise);

  const handleSubmitLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedCustomerId) {
      setError('Please select a borrower customer.');
      const custSelect = document.getElementById('borrower-customer-select') || document.querySelector('select');
      custSelect?.focus();
      return;
    }
    if (items.length === 0) {
      setError('At least one jewellery item must be pledged.');
      return;
    }
    if (requestedPrincipalPaise <= 0) {
      setError('Loan amount must be greater than zero.');
      const princInput = document.getElementById('loan-requested-principal') || document.querySelector('input[name="requested_principal"]');
      princInput?.focus();
      return;
    }
    if (loanDate > getTodayISO()) {
      setError('Future loan dates are not permitted.');
      const dateInput = document.getElementById('loan-date-input');
      dateInput?.focus();
      return;
    }
    if (isBackdated && !canBackdate) {
      setError('Access Denied: Owner authorization or CREATE_BACKDATED_LOAN permission required.');
      return;
    }
    if (isBackdated && !backdateReason.trim()) {
      setError('Please provide an explicit justification reason for backdating this loan.');
      const reasonInput = document.getElementById('backdate-reason-input');
      reasonInput?.focus();
      return;
    }
    for (let i = 0; i < items.length; i++) {
      const itm = items[i];
      if (itm.category === 'Other Article' && (!itm.custom_category || !itm.custom_category.trim())) {
        setError('Please enter the custom article category.');
        const customCatInput = document.getElementById(`item-custom-category-${i}`);
        customCatInput?.focus();
        return;
      }
      if (!itm.gross_weight_grams || itm.gross_weight_grams <= 0) {
        setError(`Please enter a valid gross weight for Item #${i + 1}.`);
        const grossInput = document.getElementById(`item-gross-weight-${i}`);
        grossInput?.focus();
        return;
      }
      if (!itm.rate_per_gram_paise || itm.rate_per_gram_paise <= 0) {
        setError(`Please enter a valid rate per gram for Item #${i + 1}.`);
        const rateInput = document.getElementById(`item-rate-${i}`);
        rateInput?.focus();
        return;
      }
    }

    if (isExceedingLtv && !overrideAuthorized) {
      setError(
        `Requested loan exceeds maximum eligible loan by ₹${(excessAmountPaise / 100).toFixed(
          2
        )}. Owner authorization required.`
      );
      const authBtn = document.getElementById('authorize-override-btn') || document.getElementById('loan-requested-principal');
      authBtn?.focus();
      return;
    }

    setSubmitting(true);
    try {
      if (!window.api) throw new Error('Desktop IPC bridge not available');

      // Create loan
      const createdLoan = await window.api.loans.createLoan({
        customer_id: selectedCustomerId,
        loan_date: loanDate,
        start_date: loanDate,
        due_date: dueDate,
        principal_paise: requestedPrincipalPaise,
        interest_rate_percent: Number(interestRate),
        interest_period: interestPeriod,
        interest_method: interestMethod,
        min_interest_days: Number(minInterestDays),
        grace_period_days: Number(gracePeriodDays),
        processing_fee_paise: processingFeeRupees * 100,
        ltv_percent: Number(ltvPercent),
        is_override: overrideAuthorized,
        override_reason: overrideReason,
        backdate_reason: isBackdated ? backdateReason.trim() : undefined,
        remarks,
        payment_mode: paymentMode,
        disbursement_reference: disbursementRef,
        items: items.map((itm) => {
          const net = Math.max(0, itm.gross_weight_grams - itm.stone_weight_grams);
          const customCat = itm.category === 'Other Article' ? itm.custom_category?.trim() : undefined;
          const matType =
            itm.material_type === 'CUSTOM'
              ? (itm.purity ? `${itm.purity} (${itm.material})` : `Custom ${itm.material}`)
              : (itm.material_type || `${itm.purity} ${itm.material}`);
          const desc = itm.description?.trim() || (
            customCat ? `Other Article — ${customCat}` : `${itm.category}`
          );

          return {
            category: itm.category,
            custom_category: customCat,
            description: desc,
            material: itm.material,
            material_type: matType,
            purity: itm.purity || `${itm.purity_percent}%`,
            purity_percent: itm.purity_percent,
            gross_weight_grams: Number(itm.gross_weight_grams),
            stone_weight_grams: Number(itm.stone_weight_grams),
            rate_per_gram_paise: itm.rate_per_gram_paise,
            allocated_loan_paise: Math.round(
              (net / (totalNet || 1)) * requestedPrincipalPaise
            ),
          };
        }),
      });

      onLoanCreated(createdLoan.id);
    } catch (err: any) {
      setError(err?.message || 'Failed to create loan.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAuthorizeOverride = () => {
    if (!overrideReason.trim()) {
      alert('Please specify an explicit justification reason for overriding the LTV ceiling.');
      return;
    }
    setOverrideAuthorized(true);
    setShowOverrideModal(false);
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-slate-500">
        Loading loan appraisal workflow...
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">
            Guided Loan Creation
          </span>
          <h1 className="text-xl font-bold text-slate-900 mt-0.5">New Jewellery Pledge Loan</h1>
        </div>
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmitLoan} onKeyDown={handleEnterKeyNavigation} className="space-y-6 text-xs">
        {/* Step 1: Customer Selection */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-500" /> 1. Select Borrower (Customer)
            </h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={<UserPlus className="w-3.5 h-3.5" />}
              onClick={() => setShowQuickCustomerModal(true)}
            >
              + New Customer
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-medium text-slate-700">Select Registered Customer *</label>
                <button
                  type="button"
                  onClick={() => setShowQuickCustomerModal(true)}
                  className="text-amber-700 hover:text-amber-800 text-[11px] font-semibold flex items-center gap-1 hover:underline"
                >
                  <PlusCircle className="w-3 h-3" /> Quick Add Customer
                </button>
              </div>
              <select
                id="borrower-customer-select"
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-amber-500"
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
              >
                <option value="">-- Choose Borrower --</option>
                {customersList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name} ({c.id}) - {c.phone}
                  </option>
                ))}
              </select>
            </div>

            {selectedCustomerId && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 text-xs">
                {(() => {
                  const sel = customersList.find((c) => c.id === selectedCustomerId);
                  if (!sel) return null;
                  return (
                    <div className="space-y-0.5">
                      <div className="font-semibold text-slate-900">{sel.full_name}</div>
                      <div>Phone: {sel.phone} | Aadhaar: XXXX XXXX {sel.aadhaar_last4}</div>
                      <div>{sel.address}, {sel.city}</div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>

        {/* Step 2: Jewellery Collateral Pledged */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Gem className="w-4 h-4 text-amber-500" /> 2. Jewellery Collateral Items Pledged
            </h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={<PlusCircle className="w-3.5 h-3.5" />}
              onClick={handleAddItem}
            >
              + Add Another Jewellery Item
            </Button>
          </div>

          <div className="space-y-3">
            {items.map((item, idx) => {
              const net = Math.max(0, item.gross_weight_grams - item.stone_weight_grams);
              const valPaise = Math.round(net * item.rate_per_gram_paise);
              const maxLoan = Math.round(valPaise * (ltvPercent / 100));

              return (
                <div
                  key={idx}
                  className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 relative"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="font-semibold text-slate-800">
                      Item #{idx + 1}: {formatItemCategory(item.category, item.custom_category)} ({formatItemMaterial(item.material, item.material_type, item.purity, item.purity_percent)})
                    </span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-rose-500 hover:text-rose-700 p-1"
                        title="Remove Item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Category *
                      </label>
                      <select
                        id={`item-category-${idx}`}
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-medium text-slate-800"
                        value={item.category}
                        onChange={(e) => handleCategoryChange(idx, e.target.value)}
                      >
                        {PREDEFINED_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    {item.category === 'Other Article' && (
                      <div>
                        <label className="block text-[11px] font-semibold text-amber-800 mb-1">
                          Custom Category *
                        </label>
                        <input
                          id={`item-custom-category-${idx}`}
                          type="text"
                          required
                          list={`custom-cat-list-${idx}`}
                          placeholder="e.g. Nose Pin, Waist Chain..."
                          className="w-full bg-amber-50/50 border border-amber-400 rounded px-2.5 py-1.5 font-semibold text-slate-900 placeholder:text-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
                          value={item.custom_category || ''}
                          onChange={(e) => handleItemChange(idx, 'custom_category', e.target.value)}
                        />
                        <datalist id={`custom-cat-list-${idx}`}>
                          {customCategories.map((c) => (
                            <option key={c.id} value={c.name} />
                          ))}
                        </datalist>
                      </div>
                    )}

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Material
                      </label>
                      <select
                        id={`item-material-${idx}`}
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-semibold text-slate-800"
                        value={item.material}
                        onChange={(e) => handleMaterialChange(idx, e.target.value as MaterialType)}
                      >
                        <option value="GOLD">Gold</option>
                        <option value="SILVER">Silver</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Material Type
                      </label>
                      <select
                        id={`item-material-type-${idx}`}
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-semibold text-amber-900"
                        value={item.material_type || ''}
                        onChange={(e) => handleMaterialTypeChange(idx, e.target.value)}
                      >
                        {materialTypeConfigs
                          .filter((m) => m.base_material === item.material && m.is_active)
                          .map((m) => (
                            <option key={m.id} value={m.name}>
                              {m.name}
                            </option>
                          ))}
                        <option value="CUSTOM">Custom / Manual Type</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Purity (%)
                      </label>
                      <div className="relative">
                        <input
                          id={`item-purity-${idx}`}
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          className={`w-full border rounded px-2.5 py-1.5 font-mono font-semibold text-amber-900 ${
                            item.material_type === 'CUSTOM'
                              ? 'bg-amber-50/50 border-amber-300'
                              : 'bg-slate-100 border-slate-300 cursor-not-allowed text-slate-700'
                          }`}
                          value={item.purity_percent !== undefined ? item.purity_percent : ''}
                          readOnly={item.material_type !== 'CUSTOM'}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            handlePurityPercentChange(idx, val);
                          }}
                        />
                        <span className="absolute right-2.5 top-1.5 text-slate-400 font-mono text-xs">%</span>
                      </div>
                    </div>
                  </div>

                  {item.material_type === 'CUSTOM' && (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                      <label className="block text-[11px] font-medium text-amber-800 mb-1">
                        Custom Material Type Label / Purity Name
                      </label>
                      <input
                        id={`item-custom-purity-${idx}`}
                        type="text"
                        placeholder="e.g. 14K Gold, Silver 650, Rose Gold 18K..."
                        className="w-full bg-white border border-amber-300 rounded px-2.5 py-1.5 text-xs text-slate-800 font-medium"
                        value={item.purity || ''}
                        onChange={(e) => handleItemChange(idx, 'purity', e.target.value)}
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Gross Weight (g) *
                      </label>
                      <WeightInput
                        id={`item-gross-weight-${idx}`}
                        required
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                        value={item.gross_weight_grams}
                        onChange={(val) =>
                          handleItemChange(idx, 'gross_weight_grams', val)
                        }
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Stone Wt (g)
                      </label>
                      <WeightInput
                        id={`item-stone-weight-${idx}`}
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                        value={item.stone_weight_grams}
                        onChange={(val) =>
                          handleItemChange(idx, 'stone_weight_grams', val)
                        }
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Net Weight (g)
                      </label>
                      <div className="font-mono font-bold text-slate-800 py-1.5 px-2 bg-slate-100 rounded border border-slate-200">
                        {formatWeight(net)}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Rate (₹ / g)
                      </label>
                      <CurrencyInput
                        id={`item-rate-${idx}`}
                        required
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                        value={item.rate_per_gram_paise / 100}
                        onChange={(val) =>
                          handleItemChange(idx, 'rate_per_gram_paise', Math.round(val * 100))
                        }
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Item Valuation
                      </label>
                      <div className="font-mono font-bold text-amber-700 py-1.5 px-2 bg-amber-50 rounded border border-amber-200">
                        {formatINR(valPaise)}
                      </div>
                    </div>
                  </div>

                  <div>
                    <input
                      id={`item-description-${idx}`}
                      type="text"
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-700"
                      placeholder="Identification remarks / hallmarks / stones..."
                      value={item.description}
                      onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step 3: Live Valuation & Appraisal Summary Panel (High Contrast Redesign) */}
        <div className="bg-slate-900 border border-slate-700/80 p-6 rounded-xl text-white shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
              <Calculator className="w-4 h-4 text-amber-400" /> 3. Live Collateral Appraisal & LTV Calculation
            </h3>
            <span className="text-xs text-slate-100 font-mono font-semibold bg-slate-800 border border-slate-600 px-3 py-1 rounded-md shadow-sm">
              Configured LTV: {ltvPercent}%
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
            <div className="p-3.5 rounded-lg bg-slate-800 border border-slate-700 shadow-sm">
              <span className="text-slate-300 text-xs font-medium block">Total Gross Wt</span>
              <div className="text-base font-bold font-mono text-white mt-1.5">
                {formatWeight(totalGross)}
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-800 border border-slate-700 shadow-sm">
              <span className="text-slate-300 text-xs font-medium block">Deductions (Stones)</span>
              <div className="text-base font-bold font-mono text-slate-100 mt-1.5">
                {formatWeight(totalStone)}
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-800 border border-slate-700 shadow-sm">
              <span className="text-amber-400 text-xs font-medium block">Net Bullion Wt</span>
              <div className="text-base font-bold font-mono text-amber-300 mt-1.5">
                {formatWeight(totalNet)}
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-800 border border-slate-700 shadow-sm">
              <span className="text-slate-300 text-xs font-medium block">Total Collateral Value</span>
              <div className="text-lg font-bold font-mono text-white mt-1.5">
                {formatINR(totalValuationPaise)}
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-amber-500/15 border-2 border-amber-500/70 shadow-sm">
              <span className="text-amber-300 text-xs font-bold uppercase tracking-wide block">Max Eligible Loan</span>
              <div className="text-lg font-black font-mono text-amber-400 mt-1.5">
                {formatINR(totalMaxEligibleLoanPaise)}
              </div>
            </div>
          </div>

          {/* LTV Ceiling Warning Banner */}
          {isExceedingLtv && (
            <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-500/50 flex flex-col md:flex-row md:items-center justify-between gap-3 text-rose-200">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                <div>
                  <div className="font-bold text-rose-100">
                    Requested loan exceeds allowed LTV by {formatINR(excessAmountPaise)}
                  </div>
                  <div className="text-[11px] text-rose-300">
                    Maximum eligible is {formatINR(totalMaxEligibleLoanPaise)} at {ltvPercent}% LTV.
                  </div>
                </div>
              </div>

              {overrideAuthorized ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-900/60 border border-emerald-500/60 text-emerald-300 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4" /> Owner Override Approved
                </div>
              ) : isOwner ? (
                <Button
                  type="button"
                  variant="gold"
                  size="sm"
                  onClick={() => setShowOverrideModal(true)}
                >
                  Authorize Owner Override
                </Button>
              ) : (
                <div className="text-xs text-rose-400 font-semibold">
                  Owner authorization required to proceed
                </div>
              )}
            </div>
          )}
        </div>

        {/* Step 4: Loan Terms & Disbursement */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Receipt className="w-4 h-4 text-amber-500" /> 4. Loan Financial Terms & Disbursement
            </h3>
            {isBackdated && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-300 text-amber-800 text-xs font-semibold">
                <Clock className="w-3.5 h-3.5 text-amber-600" /> Backdated Loan Record
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Loan Date (Business Date) *
              </label>
              <input
                id="loan-date-input"
                type="date"
                required
                max={getTodayISO()}
                className={`w-full border rounded-lg px-3 py-2 text-slate-900 font-mono text-xs focus:outline-none focus:border-amber-500 ${
                  isBackdated ? 'bg-amber-50/70 border-amber-300 font-semibold text-amber-950' : 'bg-slate-50 border-slate-300'
                }`}
                value={loanDate}
                onChange={(e) => handleLoanDateChange(e.target.value)}
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                {isBackdated ? 'Historical register date' : 'Current date'}
              </span>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Actual Loan Requested (₹) *
              </label>
              <CurrencyInput
                id="loan-requested-principal"
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono font-bold text-xs focus:outline-none focus:border-amber-500"
                value={requestedPrincipalRupees}
                onChange={(val) => setRequestedPrincipalRupees(val)}
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Interest Rate (% / Month) *</label>
              <input
                id="loan-interest-rate"
                type="number"
                step="0.1"
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono text-xs"
                value={interestRate}
                onChange={(e) => setInterestRate(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Loan Tenure</label>
              <select
                id="loan-tenure-select"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 text-xs"
                value={tenureMonths}
                onChange={(e) => handleTenureChange(parseInt(e.target.value, 10))}
              >
                <option value={3}>3 Months</option>
                <option value={6}>6 Months</option>
                <option value={9}>9 Months</option>
                <option value={12}>12 Months (1 Year)</option>
                <option value={24}>24 Months (2 Years)</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Maturity / Due Date</label>
              <input
                id="loan-due-date"
                type="date"
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono text-xs"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          {/* Backdate Reason Banner & Field */}
          {isBackdated && (
            <div className="p-3.5 rounded-lg bg-amber-50/70 border border-amber-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-600" /> Historical Register Entry ({loanDate})
                </span>
                {!canBackdate && (
                  <span className="text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                    Owner Authorization Required
                  </span>
                )}
              </div>
              <div>
                <label className="block font-medium text-amber-950 text-xs mb-1">
                  Reason for Backdating *
                </label>
                <input
                  id="backdate-reason-input"
                  type="text"
                  required
                  placeholder="e.g. Entering historical manual register records, migration from physical ledger..."
                  className="w-full bg-white border border-amber-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
                  value={backdateReason}
                  onChange={(e) => setBackdateReason(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Disbursement Payment Mode *</label>
              <select
                id="loan-payment-mode"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-semibold"
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
              >
                <option value="CASH">Cash in Hand</option>
                <option value="BANK_TRANSFER">Bank NEFT / RTGS</option>
                <option value="UPI">UPI Direct</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Bank Reference / UPI UTR</label>
              <input
                id="loan-disbursement-ref"
                type="text"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono"
                placeholder="Optional transaction reference"
                value={disbursementRef}
                onChange={(e) => setDisbursementRef(e.target.value)}
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Processing Fee (₹)</label>
              <CurrencyInput
                id="loan-processing-fee"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono"
                value={processingFeeRupees}
                onChange={(val) => setProcessingFeeRupees(val)}
              />
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>

          <Button
            id="submit-loan-btn"
            type="submit"
            variant="gold"
            size="lg"
            isLoading={submitting}
            icon={<CheckCircle2 className="w-5 h-5" />}
          >
            Confirm & Disburse Loan ({formatINR(requestedPrincipalPaise)})
          </Button>
        </div>
      </form>

      {/* LTV Override Modal */}
      <Modal
        isOpen={showOverrideModal}
        onClose={() => setShowOverrideModal(false)}
        title="Authorize Loan LTV Ceiling Override"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600">
            The requested loan of <strong>{formatINR(requestedPrincipalPaise)}</strong> exceeds the maximum allowed
            LTV ceiling of <strong>{formatINR(totalMaxEligibleLoanPaise)}</strong> by{' '}
            <strong className="text-rose-600">{formatINR(excessAmountPaise)}</strong>.
          </p>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Required Override Justification Reason *
            </label>
            <textarea
              rows={3}
              required
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-900"
              placeholder="e.g. Valued repeat customer, additional security provided, owner approved special margin"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
            <Button variant="outline" onClick={() => setShowOverrideModal(false)}>
              Cancel
            </Button>
            <Button variant="gold" onClick={handleAuthorizeOverride}>
              Confirm Authorization
            </Button>
          </div>
        </div>
      </Modal>

      {/* Quick Customer Creation Modal */}
      {showQuickCustomerModal && (
        <QuickCustomerModal
          isOpen={showQuickCustomerModal}
          onClose={() => setShowQuickCustomerModal(false)}
          existingCustomers={customersList}
          onCustomerCreated={(newCust) => {
            setCustomersList((prev) => [newCust, ...prev.filter((c) => c.id !== newCust.id)]);
            setSelectedCustomerId(newCust.id);
            setShowQuickCustomerModal(false);
          }}
          onSelectExistingCustomer={(cust) => {
            setSelectedCustomerId(cust.id);
            setShowQuickCustomerModal(false);
          }}
        />
      )}
    </div>
  );
};
