import React, { useState, useEffect } from 'react';
import { Users, Plus, Search, Eye, Phone, MapPin, Shield, Edit, AlertCircle } from 'lucide-react';
import { Customer } from '../types';
import { formatINR } from '../utils/currency';
import { formatDate } from '../utils/dates';
import { formatPhone, maskAadhaar, validateIndianPhone, validateAadhaar } from '../utils/formatters';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { api } from '../api';

interface CustomersViewProps {
  onSelectCustomer: (customerId: string) => void;
  onNewLoanForCustomer?: (customerId: string) => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  onSelectCustomer,
  onNewLoanForCustomer,
}) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Form State
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    alternate_phone: '',
    aadhaar_number: '',
    address: '',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001',
    remarks: '',
  });

  const fetchCustomers = async (searchQuery = '') => {
    setLoading(true);
    try {
      if (window.api) {
        const res = await window.api.customers.searchCustomers(searchQuery, 100, 0);
        setCustomers(res.customers || []);
        setTotal(res.total || 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers(search);
  }, [search]);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.full_name.trim()) {
      setError('Customer full name is required.');
      return;
    }
    if (!validateIndianPhone(formData.phone)) {
      setError('Please provide a valid 10-digit mobile number.');
      return;
    }
    if (!formData.aadhaar_number.trim() || !validateAadhaar(formData.aadhaar_number)) {
      setError('Please provide a valid 12-digit Aadhaar number.');
      return;
    }
    if (!formData.address.trim()) {
      setError('Address is required for KYC compliance.');
      return;
    }

    try {
      if (window.api) {
        const created = await window.api.customers.createCustomer(formData);
        setModalOpen(false);
        setFormData({
          full_name: '',
          phone: '',
          alternate_phone: '',
          aadhaar_number: '',
          address: '',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
          remarks: '',
        });
        fetchCustomers(search);
        onSelectCustomer(created.id);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to register customer');
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-500" /> Customer KYC Directory
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Registered jewellery loan borrowers with secure encrypted Aadhaar identification
          </p>
        </div>

        <Button
          variant="gold"
          size="sm"
          icon={<Plus className="w-4 h-4" />}
          onClick={() => setModalOpen(true)}
        >
          Register Customer
        </Button>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white"
            placeholder="Search by customer name, phone number, customer ID, or Aadhaar last 4 digits..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="text-xs text-slate-500 font-mono shrink-0">
          Total: {total} customers
        </span>
      </div>

      {/* Customer Directory Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Customer ID</th>
                <th className="py-3 px-4">Borrower Details</th>
                <th className="py-3 px-4">Phone</th>
                <th className="py-3 px-4">Aadhaar (Masked)</th>
                <th className="py-3 px-4">City / Area</th>
                <th className="py-3 px-4 text-center">Active Loans</th>
                <th className="py-3 px-4 text-right">Total Outstanding</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Loading customers...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No customers found matching search query.
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => onSelectCustomer(c.id)}
                    className="hover:bg-amber-50/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900">{c.id}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{c.full_name}</div>
                      <div className="text-[11px] text-slate-400">Reg: {formatDate(c.created_at)}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700">{formatPhone(c.phone)}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] border border-slate-200">
                        XXXX XXXX {c.aadhaar_last4}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {c.city}, {c.state}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                          (c.active_loans_count || 0) > 0
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {c.active_loans_count || 0}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {formatINR(c.total_outstanding_paise || 0)}
                    </td>
                    <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs py-1 px-2.5"
                        onClick={() => onSelectCustomer(c.id)}
                      >
                        View Profile
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Register Customer Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Register New Customer" maxWidth="2xl">
        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleCreateCustomer} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-slate-700 mb-1">Full Legal Name *</label>
            <input
              type="text"
              required
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-amber-500"
              placeholder="Full name as per Aadhaar / ID"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Mobile Phone Number *</label>
              <input
                type="text"
                required
                maxLength={10}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-amber-500 font-mono"
                placeholder="10 digit mobile (e.g. 9820112233)"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Alternate / WhatsApp Phone</label>
              <input
                type="text"
                maxLength={10}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-amber-500 font-mono"
                value={formData.alternate_phone}
                onChange={(e) => setFormData({ ...formData, alternate_phone: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              12-Digit Aadhaar Number * <span className="text-slate-400 font-normal">(Encrypted with AES-256-GCM)</span>
            </label>
            <input
              type="password"
              required
              maxLength={12}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-amber-500 font-mono tracking-widest"
              placeholder="12 digits"
              value={formData.aadhaar_number}
              onChange={(e) => setFormData({ ...formData, aadhaar_number: e.target.value })}
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Address *</label>
            <input
              type="text"
              required
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-amber-500"
              placeholder="Street address, apartment, locality"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">City</label>
              <input
                type="text"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">State</label>
              <input
                type="text"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Pincode</label>
              <input
                type="text"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono"
                value={formData.pincode}
                onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Remarks / Reference</label>
            <textarea
              rows={2}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
              placeholder="Optional customer reference or remarks"
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="gold">
              Save & Register Borrower
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
