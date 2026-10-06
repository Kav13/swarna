import React, { useState, useEffect } from 'react';
import { Search, WifiOff, Bell, Plus, Coins, Users, Receipt, AlertTriangle } from 'lucide-react';
import { Button } from '../common/Button';
import { formatDate } from '../../utils/dates';
import { api } from '../../api';

interface TopbarProps {
  onQuickAction: (action: 'NEW_LOAN' | 'NEW_CUSTOMER' | 'RECORD_PAYMENT') => void;
  onSearchSelectLoan?: (loanId: string) => void;
  onSearchSelectCustomer?: (customerId: string) => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  onQuickAction,
  onSearchSelectLoan,
  onSearchSelectCustomer,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<{ customers: any[]; loans: any[] }>({
    customers: [],
    loans: [],
  });
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    const loadAlerts = async () => {
      try {
        if (window.api) {
          const stats = await window.api.reports.getDashboardStats();
          const list: any[] = [];
          if (stats.loans_due_today > 0) {
            list.push({ type: 'warning', text: `${stats.loans_due_today} loans are due today!` });
          }
          if (stats.overdue_loans_count > 0) {
            list.push({ type: 'danger', text: `${stats.overdue_loans_count} overdue loans require follow-up.` });
          }
          setAlerts(list);
        }
      } catch (err) {
        console.error('Error fetching alerts:', err);
      }
    };
    loadAlerts();
  }, []);

  const handleSearchChange = async (val: string) => {
    setSearchQuery(val);
    if (!val.trim() || val.length < 2) {
      setSearchResults({ customers: [], loans: [] });
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      if (window.api) {
        const custRes = await window.api.customers.searchCustomers(val, 5, 0);
        const loanRes = await window.api.loans.getLoans({ search: val, limit: 5 });
        setSearchResults({
          customers: custRes.customers || [],
          loans: loanRes.loans || [],
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const todayStr = formatDate(new Date());

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 z-20">
      {/* Global Search Bar */}
      <div className="relative w-96">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
            placeholder="Search loans, customer name, phone, Aadhaar..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onBlur={() => setTimeout(() => setIsSearching(false), 250)}
            onFocus={() => {
              if (searchQuery.length >= 2) setIsSearching(true);
            }}
          />
        </div>

        {/* Search Results Dropdown */}
        {isSearching && (searchResults.customers.length > 0 || searchResults.loans.length > 0) && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl py-2 z-50 text-xs">
            {searchResults.loans.length > 0 && (
              <div>
                <span className="px-3 py-1 font-semibold text-[10px] text-slate-400 uppercase tracking-wider block">
                  Loans
                </span>
                {searchResults.loans.map((l) => (
                  <button
                    key={l.id}
                    onMouseDown={() => {
                      if (onSearchSelectLoan) onSearchSelectLoan(l.id);
                      setSearchQuery('');
                      setIsSearching(false);
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span className="font-semibold text-slate-900">{l.id}</span>
                    <span className="text-slate-500">{l.customer_name}</span>
                  </button>
                ))}
              </div>
            )}

            {searchResults.customers.length > 0 && (
              <div className={searchResults.loans.length > 0 ? 'mt-2 pt-2 border-t border-slate-100' : ''}>
                <span className="px-3 py-1 font-semibold text-[10px] text-slate-400 uppercase tracking-wider block">
                  Customers
                </span>
                {searchResults.customers.map((c) => (
                  <button
                    key={c.id}
                    onMouseDown={() => {
                      if (onSearchSelectCustomer) onSearchSelectCustomer(c.id);
                      setSearchQuery('');
                      setIsSearching(false);
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span className="font-medium text-slate-900">{c.full_name}</span>
                    <span className="text-slate-500">{c.phone}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Actions & Status */}
      <div className="flex items-center gap-3">
        {/* Offline Badge */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-medium">
          <WifiOff className="w-3.5 h-3.5 text-emerald-600" />
          <span>100% Offline Vault</span>
        </div>

        {/* Date Display */}
        <span className="text-xs text-slate-500 font-mono hidden lg:inline">{todayStr}</span>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg relative transition-colors"
          >
            <Bell className="w-4 h-4" />
            {alerts.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500 absolute top-1.5 right-1.5 animate-pulse" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-xl p-3 z-50 text-xs">
              <h4 className="font-semibold text-slate-900 mb-2">Vault Notifications</h4>
              {alerts.length === 0 ? (
                <p className="text-slate-500 text-xs py-2">No urgent alerts. All loans on schedule.</p>
              ) : (
                <div className="space-y-2">
                  {alerts.map((a, idx) => (
                    <div
                      key={idx}
                      className={`p-2 rounded-lg border text-xs flex items-center gap-2 ${
                        a.type === 'danger'
                          ? 'bg-rose-50 border-rose-200 text-rose-800'
                          : 'bg-amber-50 border-amber-200 text-amber-800'
                      }`}
                    >
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{a.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="h-6 w-px bg-slate-200 mx-1" />

        {/* Quick Action Buttons */}
        <Button
          size="sm"
          variant="secondary"
          icon={<Users className="w-3.5 h-3.5" />}
          onClick={() => onQuickAction('NEW_CUSTOMER')}
        >
          Customer
        </Button>

        <Button
          size="sm"
          variant="outline"
          icon={<Receipt className="w-3.5 h-3.5" />}
          onClick={() => onQuickAction('RECORD_PAYMENT')}
        >
          Repayment
        </Button>

        <Button
          size="sm"
          variant="gold"
          icon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => onQuickAction('NEW_LOAN')}
        >
          New Loan
        </Button>
      </div>
    </header>
  );
};
