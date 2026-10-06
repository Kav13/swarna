import React, { useState, useEffect } from 'react';
import {
  Settings,
  Building2,
  Percent,
  Receipt,
  Shield,
  CheckCircle2,
  Tag,
  Gem,
  Plus,
  Edit2,
  Power,
  Search,
  Filter,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { BusinessSettings, CustomCategory, MaterialTypeConfig, MaterialType } from '../types';
import { calculateGoldPurityPercent, calculateSilverPurityPercent } from '../utils/purity';
import { formatINR } from '../utils/currency';
import { formatDate } from '../utils/dates';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { api } from '../api';

export const SettingsView: React.FC = () => {
  const { isOwner } = useAuth();
  const [activeTab, setActiveTab] = useState<'general' | 'categories' | 'materials'>('general');

  // Business settings state
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [success, setSuccess] = useState<string | null>(null);

  // Custom categories state
  const [categories, setCategories] = useState<CustomCategory[]>([]);
  const [categorySearch, setCategorySearch] = useState<string>('');
  const [categoryModalOpen, setCategoryModalOpen] = useState<boolean>(false);
  const [editingCategory, setEditingCategory] = useState<CustomCategory | null>(null);
  const [categoryNameInput, setCategoryNameInput] = useState<string>('');
  const [categoryModalError, setCategoryModalError] = useState<string>('');
  const [categorySubmitting, setCategorySubmitting] = useState<boolean>(false);

  // Material types state
  const [materialTypes, setMaterialTypes] = useState<MaterialTypeConfig[]>([]);
  const [materialFilter, setMaterialFilter] = useState<'ALL' | MaterialType>('ALL');
  const [materialModalOpen, setMaterialModalOpen] = useState<boolean>(false);
  const [editingMaterial, setEditingMaterial] = useState<MaterialTypeConfig | null>(null);
  const [materialNameInput, setMaterialNameInput] = useState<string>('');
  const [materialBaseInput, setMaterialBaseInput] = useState<MaterialType>('GOLD');
  const [materialPurityInput, setMaterialPurityInput] = useState<string>('91.67');
  const [materialKaratInput, setMaterialKaratInput] = useState<string>('22K');
  const [materialRateInput, setMaterialRateInput] = useState<string>('');
  const [materialModalError, setMaterialModalError] = useState<string>('');
  const [materialSubmitting, setMaterialSubmitting] = useState<boolean>(false);

  const loadData = async () => {
    setLoading(true);
    try {
      if (window.api) {
        const [s, cats, mats] = await Promise.all([
          window.api.settings.getSettings(),
          window.api.categories.getCustomCategories(false),
          window.api.materialTypes.getMaterialTypes(false),
        ]);
        setSettings(s);
        setCategories(cats || []);
        setMaterialTypes(mats || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Save General Settings
  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    setSaving(true);
    setSuccess(null);
    try {
      if (window.api) {
        const updated = await window.api.settings.updateSettings(settings);
        setSettings(updated);
        setSuccess('Business configuration successfully saved.');
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  // Custom Categories Handlers
  const handleOpenAddCategory = () => {
    setEditingCategory(null);
    setCategoryNameInput('');
    setCategoryModalError('');
    setCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (cat: CustomCategory) => {
    setEditingCategory(cat);
    setCategoryNameInput(cat.name);
    setCategoryModalError('');
    setCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = categoryNameInput.trim();
    if (!trimmed) {
      setCategoryModalError('Please enter a valid category name.');
      return;
    }

    setCategorySubmitting(true);
    setCategoryModalError('');
    try {
      if (!window.api) throw new Error('API not available');

      if (editingCategory) {
        await window.api.categories.updateCustomCategory(editingCategory.id, trimmed, editingCategory.is_active);
      } else {
        await window.api.categories.createCustomCategory(trimmed);
      }

      setCategoryModalOpen(false);
      const updatedCats = await window.api.categories.getCustomCategories(false);
      setCategories(updatedCats || []);
      setSuccess(
        editingCategory
          ? `Category "${trimmed}" successfully updated.`
          : `Custom category "${trimmed}" added.`
      );
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setCategoryModalError(err?.message || 'Failed to save category');
    } finally {
      setCategorySubmitting(false);
    }
  };

  const handleToggleCategoryActive = async (cat: CustomCategory) => {
    if (!isOwner) {
      alert('Only the business Owner can modify categories.');
      return;
    }
    try {
      if (window.api) {
        await window.api.categories.toggleCustomCategory(cat.id, !cat.is_active);
        const updatedCats = await window.api.categories.getCustomCategories(false);
        setCategories(updatedCats || []);
        setSuccess(
          `Category "${cat.name}" is now ${!cat.is_active ? 'active' : 'disabled'}.`
        );
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to update category status');
    }
  };

  // Material Types Handlers
  const handleOpenAddMaterial = () => {
    setEditingMaterial(null);
    setMaterialNameInput('');
    setMaterialBaseInput('GOLD');
    setMaterialPurityInput('91.67');
    setMaterialKaratInput('22K');
    setMaterialRateInput('');
    setMaterialModalError('');
    setMaterialModalOpen(true);
  };

  const handleOpenEditMaterial = (m: MaterialTypeConfig) => {
    setEditingMaterial(m);
    setMaterialNameInput(m.name);
    setMaterialBaseInput(m.base_material);
    setMaterialPurityInput(m.purity_percent.toString());
    setMaterialKaratInput(m.karat_or_fineness || '');
    setMaterialRateInput(
      m.rate_per_gram_paise ? (m.rate_per_gram_paise / 100).toString() : ''
    );
    setMaterialModalError('');
    setMaterialModalOpen(true);
  };

  const handleKaratHelperChange = (karatOrFineness: string) => {
    setMaterialKaratInput(karatOrFineness);
    if (materialBaseInput === 'GOLD') {
      const num = parseFloat(karatOrFineness.replace(/[^0-9.]/g, ''));
      if (!isNaN(num) && num > 0) {
        const pct = calculateGoldPurityPercent(num);
        setMaterialPurityInput(pct.toFixed(2));
        if (!editingMaterial && !materialNameInput) {
          setMaterialNameInput(`${num}K Gold`);
        }
      }
    } else if (materialBaseInput === 'SILVER') {
      const num = parseFloat(karatOrFineness.replace(/[^0-9.]/g, ''));
      if (!isNaN(num) && num > 0) {
        const pct = calculateSilverPurityPercent(num);
        setMaterialPurityInput(pct.toFixed(2));
        if (!editingMaterial && !materialNameInput) {
          setMaterialNameInput(`Silver ${num}`);
        }
      }
    }
  };

  const handleSaveMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = materialNameInput.trim();
    const purity = parseFloat(materialPurityInput);

    if (!name) {
      setMaterialModalError('Please enter a display name for the material type.');
      return;
    }
    if (isNaN(purity) || purity <= 0 || purity > 100) {
      setMaterialModalError('Purity percentage must be between 0.01% and 100.00%.');
      return;
    }

    const ratePaise = materialRateInput ? Math.round(parseFloat(materialRateInput) * 100) : undefined;

    setMaterialSubmitting(true);
    setMaterialModalError('');
    try {
      if (!window.api) throw new Error('API not available');

      if (editingMaterial) {
        await window.api.materialTypes.updateMaterialType(editingMaterial.id, {
          name,
          base_material: materialBaseInput,
          purity_percent: purity,
          karat_or_fineness: materialKaratInput.trim() || undefined,
          rate_per_gram_paise: ratePaise,
        });
      } else {
        await window.api.materialTypes.createMaterialType({
          name,
          base_material: materialBaseInput,
          purity_percent: purity,
          karat_or_fineness: materialKaratInput.trim() || undefined,
          rate_per_gram_paise: ratePaise,
        });
      }

      setMaterialModalOpen(false);
      const updatedMats = await window.api.materialTypes.getMaterialTypes(false);
      setMaterialTypes(updatedMats || []);
      setSuccess(
        editingMaterial
          ? `Material type "${name}" updated successfully.`
          : `Material type "${name}" created successfully.`
      );
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setMaterialModalError(err?.message || 'Failed to save material type');
    } finally {
      setMaterialSubmitting(false);
    }
  };

  const handleToggleMaterialActive = async (m: MaterialTypeConfig) => {
    if (!isOwner) {
      alert('Only the business Owner can modify material types.');
      return;
    }
    try {
      if (window.api) {
        await window.api.materialTypes.toggleMaterialType(m.id, !m.is_active);
        const updatedMats = await window.api.materialTypes.getMaterialTypes(false);
        setMaterialTypes(updatedMats || []);
        setSuccess(
          `Material type "${m.name}" is now ${!m.is_active ? 'active' : 'disabled'}.`
        );
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to update material type status');
    }
  };

  if (loading || !settings) {
    return (
      <div className="p-8 text-center text-xs text-slate-500">
        Loading business settings and configuration...
      </div>
    );
  }

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(categorySearch.toLowerCase().trim())
  );

  const filteredMaterials = materialTypes.filter((m) =>
    materialFilter === 'ALL' ? true : m.base_material === materialFilter
  );

  return (
    <div className="p-8 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Settings className="w-5 h-5 text-amber-500" /> Settings & Master Configuration
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Configure shop identity, loan rules, custom article categories, and material purity parameters
        </p>
      </div>

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6 text-xs">
        <button
          onClick={() => setActiveTab('general')}
          className={`pb-3 px-1 border-b-2 font-bold transition-colors flex items-center gap-2 ${
            activeTab === 'general'
              ? 'border-amber-500 text-amber-700'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4" /> General & Business
        </button>

        <button
          onClick={() => setActiveTab('categories')}
          className={`pb-3 px-1 border-b-2 font-bold transition-colors flex items-center gap-2 ${
            activeTab === 'categories'
              ? 'border-amber-500 text-amber-700'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Tag className="w-4 h-4" /> Custom Article Categories ({categories.length})
        </button>

        <button
          onClick={() => setActiveTab('materials')}
          className={`pb-3 px-1 border-b-2 font-bold transition-colors flex items-center gap-2 ${
            activeTab === 'materials'
              ? 'border-amber-500 text-amber-700'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Gem className="w-4 h-4" /> Material Types & Purity ({materialTypes.length})
        </button>
      </div>

      {/* TAB 1: General Business Configuration */}
      {activeTab === 'general' && (
        <form onSubmit={handleSaveGeneral} className="space-y-6 text-xs">
          {/* Shop Profile */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
              <Building2 className="w-4 h-4 text-amber-500" /> Shop Identification & Header Details
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Business / Shop Name *</label>
                <input
                  type="text"
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-semibold"
                  value={settings.business_name}
                  onChange={(e) => setSettings({ ...settings, business_name: e.target.value })}
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Tagline / Subtitle</label>
                <input
                  type="text"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
                  value={settings.tagline || ''}
                  onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Contact Phone</label>
                <input
                  type="text"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
                  value={settings.phone || ''}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Shop Address</label>
                <input
                  type="text"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
                  value={settings.address || ''}
                  onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-slate-700 mb-1">GSTIN Number</label>
                <input
                  type="text"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono"
                  value={settings.gst_number || ''}
                  onChange={(e) => setSettings({ ...settings, gst_number: e.target.value })}
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Pawn Broking License No</label>
                <input
                  type="text"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono"
                  value={settings.registration_number || ''}
                  onChange={(e) => setSettings({ ...settings, registration_number: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Default Loan Parameters */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
              <Percent className="w-4 h-4 text-amber-500" /> Default Loan Terms & Interest Rates
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Default Interest Rate (%)</label>
                <input
                  type="number"
                  step="0.05"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono"
                  value={settings.default_interest_rate_percent}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      default_interest_rate_percent: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Default LTV Ceiling (%)</label>
                <input
                  type="number"
                  step="0.5"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono"
                  value={settings.default_ltv_percent}
                  onChange={(e) =>
                    setSettings({ ...settings, default_ltv_percent: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Min Interest Period (Days)</label>
                <input
                  type="number"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono"
                  value={settings.default_min_interest_days}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      default_min_interest_days: parseInt(e.target.value, 10) || 0,
                    })
                  }
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Grace Period (Days)</label>
                <input
                  type="number"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono"
                  value={settings.default_grace_period_days}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      default_grace_period_days: parseInt(e.target.value, 10) || 0,
                    })
                  }
                />
              </div>
            </div>
          </div>

          {/* Receipt Terms */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
              <Receipt className="w-4 h-4 text-amber-500" /> Pledge Receipt Memorandum & Legal Terms
            </h3>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Receipt Footer Note</label>
              <input
                type="text"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
                value={settings.receipt_footer || ''}
                onChange={(e) => setSettings({ ...settings, receipt_footer: e.target.value })}
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Terms & Conditions</label>
              <textarea
                rows={4}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-slate-900"
                value={settings.terms_conditions || ''}
                onChange={(e) => setSettings({ ...settings, terms_conditions: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" variant="gold" size="lg" isLoading={saving}>
              Save All Configuration Settings
            </Button>
          </div>
        </form>
      )}

      {/* TAB 2: Custom Article Categories */}
      {activeTab === 'categories' && (
        <div className="space-y-4 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search custom categories..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
              />
            </div>

            <Button
              type="button"
              variant="gold"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={handleOpenAddCategory}
            >
              Add Custom Category
            </Button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
                  <th className="py-3 px-4">Custom Category Name</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCategories.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">
                      No custom article categories found. Click &quot;Add Custom Category&quot; to create one.
                    </td>
                  </tr>
                ) : (
                  filteredCategories.map((cat) => (
                    <tr key={cat.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-semibold text-slate-900">{cat.name}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            cat.is_active
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-slate-100 text-slate-600 border border-slate-300'
                          }`}
                        >
                          {cat.is_active ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {formatDate(cat.created_at)}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        {isOwner && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenEditCategory(cat)}
                              className="text-slate-600 hover:text-amber-700 font-semibold text-xs inline-flex items-center gap-1 p-1"
                              title="Edit Category Name"
                            >
                              <Edit2 className="w-3.5 h-3.5" /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleCategoryActive(cat)}
                              className={`font-semibold text-xs inline-flex items-center gap-1 p-1 ${
                                cat.is_active
                                  ? 'text-rose-600 hover:text-rose-800'
                                  : 'text-emerald-600 hover:text-emerald-800'
                              }`}
                              title={cat.is_active ? 'Disable Category' : 'Activate Category'}
                            >
                              <Power className="w-3.5 h-3.5" />
                              {cat.is_active ? 'Disable' : 'Enable'}
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Material Types & Purity */}
      {activeTab === 'materials' && (
        <div className="space-y-4 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">Filter by Material:</span>
              {(['ALL', 'GOLD', 'SILVER', 'OTHER'] as const).map((mat) => (
                <button
                  key={mat}
                  type="button"
                  onClick={() => setMaterialFilter(mat)}
                  className={`px-3 py-1 rounded-lg font-bold text-xs transition-colors ${
                    materialFilter === mat
                      ? 'bg-amber-500 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {mat === 'ALL' ? 'All Materials' : mat}
                </button>
              ))}
            </div>

            <Button
              type="button"
              variant="gold"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={handleOpenAddMaterial}
            >
              Add Material Type
            </Button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
                  <th className="py-3 px-4">Display Name</th>
                  <th className="py-3 px-4">Base Material</th>
                  <th className="py-3 px-4">Purity (%)</th>
                  <th className="py-3 px-4">Karat / Fineness</th>
                  <th className="py-3 px-4">Benchmark Rate</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMaterials.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No material types found for selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredMaterials.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-900">{m.name}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            m.base_material === 'GOLD'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : m.base_material === 'SILVER'
                              ? 'bg-slate-200 text-slate-800 border border-slate-300'
                              : 'bg-cyan-100 text-cyan-800 border border-cyan-300'
                          }`}
                        >
                          {m.base_material}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-amber-900">
                        {m.purity_percent.toFixed(2)}%
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {m.karat_or_fineness || '—'}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-slate-800">
                        {m.rate_per_gram_paise ? `${formatINR(m.rate_per_gram_paise)} / g` : 'Pro-rata'}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            m.is_active
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-slate-100 text-slate-600 border border-slate-300'
                          }`}
                        >
                          {m.is_active ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        {isOwner && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenEditMaterial(m)}
                              className="text-slate-600 hover:text-amber-700 font-semibold text-xs inline-flex items-center gap-1 p-1"
                              title="Edit Material Type"
                            >
                              <Edit2 className="w-3.5 h-3.5" /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleMaterialActive(m)}
                              className={`font-semibold text-xs inline-flex items-center gap-1 p-1 ${
                                m.is_active
                                  ? 'text-rose-600 hover:text-rose-800'
                                  : 'text-emerald-600 hover:text-emerald-800'
                              }`}
                              title={m.is_active ? 'Disable Material Type' : 'Activate Material Type'}
                            >
                              <Power className="w-3.5 h-3.5" />
                              {m.is_active ? 'Disable' : 'Enable'}
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Category Modal */}
      <Modal
        isOpen={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        title={editingCategory ? 'Edit Custom Category' : 'Add Custom Article Category'}
      >
        <form onSubmit={handleSaveCategory} className="space-y-4 text-xs">
          {categoryModalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{categoryModalError}</span>
            </div>
          )}

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Custom Category Name *
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. Nose Pin, Waist Chain, Hair Ornament..."
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-medium"
              value={categoryNameInput}
              onChange={(e) => setCategoryNameInput(e.target.value)}
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Case-insensitive deduplication is applied automatically (e.g. &quot;Nose Pin&quot; equals &quot;nose pin&quot;).
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCategoryModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="gold" isLoading={categorySubmitting}>
              {editingCategory ? 'Update Category' : 'Save Category'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Material Type Modal */}
      <Modal
        isOpen={materialModalOpen}
        onClose={() => setMaterialModalOpen(false)}
        title={editingMaterial ? 'Edit Material Type' : 'Create Custom Material Type'}
      >
        <form onSubmit={handleSaveMaterial} className="space-y-4 text-xs">
          {materialModalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{materialModalError}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Base Material *</label>
              <select
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-semibold"
                value={materialBaseInput}
                onChange={(e) => setMaterialBaseInput(e.target.value as MaterialType)}
              >
                <option value="GOLD">Gold</option>
                <option value="SILVER">Silver</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Karat / Fineness Helper (Optional)
              </label>
              <input
                type="text"
                placeholder={materialBaseInput === 'GOLD' ? 'e.g. 16K, 14K' : 'e.g. 700, 600'}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono"
                value={materialKaratInput}
                onChange={(e) => handleKaratHelperChange(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Display Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. 16K Gold, Silver 700, Rose Gold 18K..."
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-medium"
              value={materialNameInput}
              onChange={(e) => setMaterialNameInput(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Purity Percentage (%) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="100.00"
                  required
                  placeholder="e.g. 66.67, 70.00"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono font-bold"
                  value={materialPurityInput}
                  onChange={(e) => setMaterialPurityInput(e.target.value)}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono">%</span>
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Benchmark Rate (₹ / g, Optional)
              </label>
              <input
                type="number"
                step="1"
                placeholder="Leave blank for pro-rata"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono"
                value={materialRateInput}
                onChange={(e) => setMaterialRateInput(e.target.value)}
              />
            </div>
          </div>

          <p className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded border border-slate-200">
            Gold Karat formula: <code>Purity % = (Karat / 24) * 100</code>.<br />
            Silver Fineness formula: <code>Purity % = Fineness / 10</code>.
          </p>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              onClick={() => setMaterialModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="gold" isLoading={materialSubmitting}>
              {editingMaterial ? 'Update Material Type' : 'Save Material Type'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
