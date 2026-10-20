import React, { useState, useEffect } from 'react';
import { UserPlus, AlertTriangle, CheckCircle2, Phone, ShieldCheck } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Customer } from '../../types';
import {
  validateIndianPhone,
  validateAadhaar,
  formatAadhaarDisplay,
} from '../../utils/formatters';
import { handleEnterKeyNavigation } from '../../utils/keyboardNavigation';

interface QuickCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCustomerCreated: (customer: Customer) => void;
  onSelectExistingCustomer?: (customer: Customer) => void;
  existingCustomers?: Customer[];
  defaultCity?: string;
  defaultState?: string;
}

export const QuickCustomerModal: React.FC<QuickCustomerModalProps> = ({
  isOpen,
  onClose,
  onCustomerCreated,
  onSelectExistingCustomer,
  existingCustomers = [],
  defaultCity = '',
  defaultState = '',
}) => {
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    alternate_phone: '',
    aadhaar_number: '',
    address: '',
    city: defaultCity || 'Mumbai',
    state: defaultState || 'Maharashtra',
    pincode: '400001',
    remarks: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [duplicateMatch, setDuplicateMatch] = useState<Customer | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        full_name: '',
        phone: '',
        alternate_phone: '',
        aadhaar_number: '',
        address: '',
        city: defaultCity || 'Mumbai',
        state: defaultState || 'Maharashtra',
        pincode: '400001',
        remarks: '',
      });
      setError('');
      setDuplicateMatch(null);
    }
  }, [isOpen, defaultCity, defaultState]);

  // Check for duplicate phone number
  const handlePhoneChange = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 10);
    setFormData((prev) => ({ ...prev, phone: clean }));

    if (clean.length >= 10) {
      const match = existingCustomers.find(
        (c) => c.phone.replace(/\D/g, '') === clean
      );
      setDuplicateMatch(match || null);
    } else {
      setDuplicateMatch(null);
    }
  };

  const handleAadhaarChange = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 12);
    setFormData((prev) => ({ ...prev, aadhaar_number: clean }));
  };

  const handleUseExisting = () => {
    if (duplicateMatch) {
      if (onSelectExistingCustomer) {
        onSelectExistingCustomer(duplicateMatch);
      } else {
        onCustomerCreated(duplicateMatch);
      }
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.full_name.trim()) {
      setError('Please enter the customer full name.');
      document.getElementById('quick-customer-fullname')?.focus();
      return;
    }
    if (!validateIndianPhone(formData.phone)) {
      setError('Please provide a valid 10-digit mobile number (starting with 6, 7, 8, or 9).');
      document.getElementById('quick-customer-phone')?.focus();
      return;
    }
    if (!validateAadhaar(formData.aadhaar_number)) {
      setError('Please provide a valid 12-digit Aadhaar number.');
      document.getElementById('quick-customer-aadhaar')?.focus();
      return;
    }
    if (!formData.address.trim()) {
      setError('Address is required for KYC compliance.');
      document.getElementById('quick-customer-address')?.focus();
      return;
    }

    setSubmitting(true);
    try {
      if (window.api && window.api.customers) {
        const created = await window.api.customers.createCustomer(formData);
        if (created) {
          onCustomerCreated(created);
          onClose();
        }
      } else {
        throw new Error('Customer API service is not available');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to register customer');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="+ Quick Customer Registration" maxWidth="2xl">
      <form onSubmit={handleSubmit} onKeyDown={handleEnterKeyNavigation} className="p-6 space-y-4 text-xs">
        {error && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-300 text-rose-800 font-medium">
            {error}
          </div>
        )}

        {/* Duplicate Customer Warning Banner */}
        {duplicateMatch && (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-950">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>A customer with this phone number may already exist:</span>
            </div>
            <div className="pl-6 text-slate-800">
              <span className="font-bold">{duplicateMatch.full_name}</span> (ID:{' '}
              <span className="font-mono">{duplicateMatch.id}</span>) &bull; Phone:{' '}
              {duplicateMatch.phone} &bull; Aadhaar Last 4: {duplicateMatch.aadhaar_last4}
            </div>
            <div className="pl-6 pt-1 flex items-center gap-2">
              <Button
                type="button"
                variant="gold"
                size="sm"
                icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                onClick={handleUseExisting}
              >
                Select Existing Customer ({duplicateMatch.full_name})
              </Button>
              <span className="text-[11px] text-slate-500">
                Or continue editing to register a new borrower.
              </span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Customer Full Name *
            </label>
            <input
              id="quick-customer-fullname"
              type="text"
              required
              autoFocus
              placeholder="e.g. Ramesh Kumar Sharma"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-amber-500 focus:bg-white"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Mobile Number (10 digits) *
            </label>
            <div className="relative">
              <input
                id="quick-customer-phone"
                type="tel"
                required
                placeholder="9876543210"
                maxLength={10}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-3 pr-8 py-2 font-mono text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white"
                value={formData.phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
              />
              <Phone className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Aadhaar Number (12 digits) *
            </label>
            <div className="relative">
              <input
                id="quick-customer-aadhaar"
                type="text"
                required
                placeholder="1234 5678 9012"
                maxLength={14}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-3 pr-8 py-2 font-mono text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white"
                value={formatAadhaarDisplay(formData.aadhaar_number)}
                onChange={(e) => handleAadhaarChange(e.target.value)}
              />
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 absolute right-3 top-1/2 -translate-y-1/2" />
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Stored with 256-bit encryption; masked in reports.
            </span>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Alternate Contact Number
            </label>
            <input
              id="quick-customer-altphone"
              type="tel"
              placeholder="Optional secondary phone / relative"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white"
              value={formData.alternate_phone}
              onChange={(e) => setFormData({ ...formData, alternate_phone: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">
            Residential Address (KYC) *
          </label>
          <input
            id="quick-customer-address"
            type="text"
            required
            placeholder="House/Shop no, street, building, landmark..."
            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">City</label>
            <input
              id="quick-customer-city"
              type="text"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">State</label>
            <input
              id="quick-customer-state"
              type="text"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white"
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Pincode</label>
            <input
              id="quick-customer-pincode"
              type="text"
              maxLength={6}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white"
              value={formData.pincode}
              onChange={(e) => setFormData({ ...formData, pincode: e.target.value.replace(/\D/g, '') })}
            />
          </div>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">Remarks / Reference</label>
          <input
            id="quick-customer-remarks"
            type="text"
            placeholder="Optional reference person, identification mark..."
            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white"
            value={formData.remarks}
            onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            id="quick-customer-submit-btn"
            type="submit"
            variant="gold"
            size="sm"
            isLoading={submitting}
            icon={<UserPlus className="w-4 h-4" />}
          >
            Save & Select Customer
          </Button>
        </div>
      </form>
    </Modal>
  );
};
