import React from 'react';
import {
  LayoutDashboard,
  Users,
  PlusCircle,
  TableProperties,
  Coins,
  Receipt,
  Gem,
  Calculator,
  TrendingUp,
  CalendarCheck,
  BarChart3,
  UserCog,
  Settings,
  HardDrive,
  FileText,
  LogOut,
  Shield,
  FileSpreadsheet,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export type ActiveTab =
  | 'dashboard'
  | 'customers'
  | 'customer-profile'
  | 'new-loan'
  | 'bulk-loan'
  | 'loans'
  | 'loan-details'
  | 'payments'
  | 'valuation'
  | 'rates'
  | 'daily-closing'
  | 'reports'
  | 'users'
  | 'settings'
  | 'backup'
  | 'import-loans'
  | 'audit';

interface SidebarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onSelectTab }) => {
  const { currentUser, isOwner, logout, hasPermission } = useAuth();
  const canImportHistoricalLoans = isOwner || hasPermission('IMPORT_HISTORICAL_LOANS');

  const navItems = [
    { id: 'dashboard' as ActiveTab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'customers' as ActiveTab, label: 'Customers', icon: Users },
    { id: 'new-loan' as ActiveTab, label: 'New Loan', icon: PlusCircle, badge: 'Wizard' },
    { id: 'bulk-loan' as ActiveTab, label: 'Bulk Loan Entry', icon: TableProperties },
    { id: 'loans' as ActiveTab, label: 'Loan Directory', icon: Coins },
    { id: 'payments' as ActiveTab, label: 'Repayments', icon: Receipt },
    { id: 'valuation' as ActiveTab, label: 'Valuation Calculator', icon: Calculator },
    { id: 'rates' as ActiveTab, label: 'Rate Management', icon: TrendingUp },
    { id: 'daily-closing' as ActiveTab, label: 'Daily Business Closing', icon: CalendarCheck },
    { id: 'reports' as ActiveTab, label: 'Reports & Analytics', icon: BarChart3 },
    ...(canImportHistoricalLoans
      ? [
          {
            id: 'import-loans' as ActiveTab,
            label: 'Import Historical Loans',
            icon: FileSpreadsheet,
            badge: 'CSV',
          },
        ]
      : []),
    ...(isOwner
      ? [
          { id: 'users' as ActiveTab, label: 'User Management', icon: UserCog },
          { id: 'settings' as ActiveTab, label: 'Business Settings', icon: Settings },
          { id: 'backup' as ActiveTab, label: 'Backup & Restore', icon: HardDrive },
          { id: 'audit' as ActiveTab, label: 'Audit Trail', icon: FileText },
        ]
      : []),
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center font-bold shadow-md shadow-amber-500/10">
          <Coins className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-white tracking-wide">SwarnaRaksha</h2>
          <span className="text-[11px] text-amber-400 font-medium tracking-tight">Jewellery Loan Vault</span>
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            activeTab === item.id ||
            (item.id === 'customers' && activeTab === 'customer-profile') ||
            (item.id === 'loans' && activeTab === 'loan-details');

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && !isActive && (
                <span className="text-[10px] uppercase tracking-wider bg-slate-800 text-amber-400 px-1.5 py-0.5 rounded font-bold">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User Info & Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/40">
        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-850 border border-slate-800">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-amber-400">
              {currentUser?.full_name?.[0] || 'U'}
            </div>
            <div className="truncate">
              <p className="text-xs font-medium text-white truncate">{currentUser?.full_name}</p>
              <p className="text-[10px] text-amber-400/80 font-mono uppercase">{currentUser?.role}</p>
            </div>
          </div>
          <button
            onClick={() => logout()}
            title="Logout"
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
