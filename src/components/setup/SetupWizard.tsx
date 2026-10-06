import React, { useState } from 'react';
import { Shield, Sparkles, Building2, User, KeyRound, Percent, Coins, HardDrive, CheckCircle2 } from 'lucide-react';
import { Button } from '../common/Button';
import { api } from '../../api';

interface SetupWizardProps {
  onComplete: () => void;
}

export const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete }) => {
  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Form State
  const [formData, setFormData] = useState({
    // Shop info
    business_name: 'SwarnaRaksha Jewellers',
    address: '101, Bullion Market, Jewellers Street',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400002',
    phone: '9876543210',
    gst_number: '27AAAAA0000A1Z5',
    // Owner credentials
    owner_username: 'admin',
    owner_fullname: 'Shop Owner',
    owner_password: '',
    owner_confirm_password: '',
    // Interest & LTV
    default_interest_rate_percent: 2.0,
    default_ltv_percent: 75.0,
    default_min_interest_days: 15,
    default_grace_period_days: 7,
    // Rates
    gold_24k_rate: 7600,
    gold_22k_rate: 7000,
    gold_18k_rate: 5700,
    silver_999_rate: 95,
    silver_925_rate: 88,
    // Backup folder
    backup_folder: '',
  });

  const handleNext = () => {
    setError('');
    if (step === 1) {
      if (!formData.business_name.trim() || !formData.phone.trim()) {
        setError('Business name and contact phone are required.');
        return;
      }
    }
    if (step === 2) {
      if (!formData.owner_username.trim() || !formData.owner_fullname.trim()) {
        setError('Owner username and full name are required.');
        return;
      }
      if (formData.owner_password.length < 6) {
        setError('Password must be at least 6 characters long.');
        return;
      }
      if (formData.owner_password !== formData.owner_confirm_password) {
        setError('Passwords do not match.');
        return;
      }
    }
    setStep((s) => s + 1);
  };

  const handleSelectBackupDir = async () => {
    if (window.api) {
      const dir = await window.api.backups.selectBackupDirectory();
      if (dir) {
        setFormData({ ...formData, backup_folder: dir });
      }
    }
  };

  const handleFinishSetup = async () => {
    setLoading(true);
    setError('');
    try {
      if (!window.api) throw new Error('Desktop IPC bridge not available');

      // 1. Create First Owner Account
      await window.api.auth.createFirstOwner({
        username: formData.owner_username,
        password: formData.owner_password,
        full_name: formData.owner_fullname,
      });

      // 2. Login automatically
      await window.api.auth.login(formData.owner_username, formData.owner_password);

      // 3. Save Business Settings
      await window.api.settings.updateSettings({
        business_name: formData.business_name,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        pincode: formData.pincode,
        phone: formData.phone,
        gst_number: formData.gst_number,
        default_interest_rate_percent: Number(formData.default_interest_rate_percent),
        default_ltv_percent: Number(formData.default_ltv_percent),
        default_min_interest_days: Number(formData.default_min_interest_days),
        default_grace_period_days: Number(formData.default_grace_period_days),
        backup_folder_path: formData.backup_folder,
      });

      // 4. Save Initial Metal Rates
      await window.api.rates.setRate('GOLD', '24K', formData.gold_24k_rate * 100);
      await window.api.rates.setRate('GOLD', '22K', formData.gold_22k_rate * 100);
      await window.api.rates.setRate('GOLD', '18K', formData.gold_18k_rate * 100);
      await window.api.rates.setRate('SILVER', '999', formData.silver_999_rate * 100);
      await window.api.rates.setRate('SILVER', '925', formData.silver_925_rate * 100);

      // 5. Initial First Backup if directory selected
      if (formData.backup_folder) {
        await window.api.backups.createBackup(formData.backup_folder);
      }

      onComplete();
    } catch (err: any) {
      setError(err?.message || 'Failed to complete setup');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-slate-100">
      <div className="w-full max-w-2xl bg-slate-900 border border-amber-500/30 rounded-2xl shadow-2xl p-8 relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 mb-4 shadow-lg shadow-amber-500/20">
            <Coins className="w-9 h-9" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">SwarnaRaksha Vault Setup</h1>
          <p className="text-slate-400 text-sm mt-1">First-Time Offline Business Initialization</p>

          {/* Stepper Dots */}
          <div className="flex items-center justify-center gap-2 mt-6">
            {[1, 2, 3, 4, 5].map((s) => (
              <div
                key={s}
                className={`h-2 rounded-full transition-all duration-300 ${
                  s === step ? 'w-8 bg-amber-500' : s < step ? 'w-2 bg-emerald-500' : 'w-2 bg-slate-700'
                }`}
              />
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-200 text-sm">
            {error}
          </div>
        )}

        {/* Step 1: Shop Information */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-amber-400 font-semibold mb-2">
              <Building2 className="w-5 h-5" />
              <span>Step 1: Jewellery Shop Profile</span>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Jewellery Shop / Business Name *</label>
              <input
                type="text"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-amber-500"
                value={formData.business_name}
                onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                placeholder="e.g. SwarnaRaksha Jewellers"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Phone Number *</label>
                <input
                  type="text"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-amber-500"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">GST Number (Optional)</label>
                <input
                  type="text"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-amber-500"
                  value={formData.gst_number}
                  onChange={(e) => setFormData({ ...formData, gst_number: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Shop Address</label>
              <input
                type="text"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-amber-500"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">City</label>
                <input
                  type="text"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">State</label>
                <input
                  type="text"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Pincode</label>
                <input
                  type="text"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  value={formData.pincode}
                  onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Owner Credentials */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-amber-400 font-semibold mb-2">
              <User className="w-5 h-5" />
              <span>Step 2: Create Super Admin / Owner Account</span>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Owner Full Name *</label>
              <input
                type="text"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-amber-500"
                value={formData.owner_fullname}
                onChange={(e) => setFormData({ ...formData, owner_fullname: e.target.value })}
                placeholder="e.g. Ramesh Shah"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Admin Username *</label>
              <input
                type="text"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-amber-500"
                value={formData.owner_username}
                onChange={(e) => setFormData({ ...formData, owner_username: e.target.value })}
                placeholder="e.g. admin"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Master Password *</label>
                <input
                  type="password"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-amber-500"
                  value={formData.owner_password}
                  onChange={(e) => setFormData({ ...formData, owner_password: e.target.value })}
                  placeholder="Min 6 characters"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Confirm Password *</label>
                <input
                  type="password"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-amber-500"
                  value={formData.owner_confirm_password}
                  onChange={(e) => setFormData({ ...formData, owner_confirm_password: e.target.value })}
                />
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Note: This account will have complete administrative control over rates, loans, settings, user permissions, and database recovery.
            </p>
          </div>
        )}

        {/* Step 3: Loan & Interest Defaults */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-amber-400 font-semibold mb-2">
              <Percent className="w-5 h-5" />
              <span>Step 3: Loan & Interest Calculation Rules</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Default Interest Rate (% / Month)</label>
                <input
                  type="number"
                  step="0.1"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-amber-500"
                  value={formData.default_interest_rate_percent}
                  onChange={(e) => setFormData({ ...formData, default_interest_rate_percent: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Maximum Allowed LTV (%)</label>
                <input
                  type="number"
                  step="1"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-amber-500"
                  value={formData.default_ltv_percent}
                  onChange={(e) => setFormData({ ...formData, default_ltv_percent: parseFloat(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Minimum Interest Period (Days)</label>
                <input
                  type="number"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-amber-500"
                  value={formData.default_min_interest_days}
                  onChange={(e) => setFormData({ ...formData, default_min_interest_days: parseInt(e.target.value, 10) })}
                />
                <span className="text-[11px] text-slate-400">If loan closed before this, min days are charged</span>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Grace Period (Days)</label>
                <input
                  type="number"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-amber-500"
                  value={formData.default_grace_period_days}
                  onChange={(e) => setFormData({ ...formData, default_grace_period_days: parseInt(e.target.value, 10) })}
                />
                <span className="text-[11px] text-slate-400">Days after due date before overdue status flags</span>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Today's Metal Rates */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-amber-400 font-semibold mb-2">
              <Coins className="w-5 h-5" />
              <span>Step 4: Initial Gold & Silver Valuation Rates</span>
            </div>
            <p className="text-xs text-slate-400">Enter today's base valuation rate per gram. Rates can be updated anytime later in Rate Management.</p>

            <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60 space-y-3">
              <span className="text-xs font-semibold text-amber-400">GOLD RATES (₹ / gram)</span>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">24 Karat (99.9%)</label>
                  <input
                    type="number"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                    value={formData.gold_24k_rate}
                    onChange={(e) => setFormData({ ...formData, gold_24k_rate: parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">22 Karat (91.6%)</label>
                  <input
                    type="number"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                    value={formData.gold_22k_rate}
                    onChange={(e) => setFormData({ ...formData, gold_22k_rate: parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">18 Karat (75.0%)</label>
                  <input
                    type="number"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                    value={formData.gold_18k_rate}
                    onChange={(e) => setFormData({ ...formData, gold_18k_rate: parseFloat(e.target.value) })}
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60 space-y-3">
              <span className="text-xs font-semibold text-slate-300">SILVER RATES (₹ / gram)</span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">999 Fine Silver</label>
                  <input
                    type="number"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                    value={formData.silver_999_rate}
                    onChange={(e) => setFormData({ ...formData, silver_999_rate: parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">925 Sterling Silver</label>
                  <input
                    type="number"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                    value={formData.silver_925_rate}
                    onChange={(e) => setFormData({ ...formData, silver_925_rate: parseFloat(e.target.value) })}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Backup Location */}
        {step === 5 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-amber-400 font-semibold mb-2">
              <HardDrive className="w-5 h-5" />
              <span>Step 5: Offline Backup Destination</span>
            </div>
            <p className="text-xs text-slate-400">
              Select a dedicated local directory or external USB drive where automatic snapshots of your jewellery loan ledger will be archived.
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                placeholder="Choose folder or leave default..."
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white"
                value={formData.backup_folder || 'Default: AppData/JewelleryVault/backups'}
              />
              <Button variant="secondary" onClick={handleSelectBackupDir}>
                Browse Folder
              </Button>
            </div>

            <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Ready to Launch Offline Vault
              </div>
              <p>All database tables, secure master keys, and audit ledgers will be initialized on your local drive.</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-800">
          {step > 1 ? (
            <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          ) : (
            <div />
          )}

          {step < 5 ? (
            <Button variant="gold" onClick={handleNext}>
              Continue to Step {step + 1}
            </Button>
          ) : (
            <Button variant="gold" isLoading={loading} onClick={handleFinishSetup}>
              Complete Setup & Open App
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
