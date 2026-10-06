import React from 'react';
import { LoanStatus, CollateralStatus } from '../../types';

interface BadgeProps {
  status: LoanStatus | CollateralStatus | string;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ status, className = '' }) => {
  const getBadgeStyle = (st: string) => {
    switch (st) {
      case 'ACTIVE':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'PARTIALLY_PAID':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'OVERDUE':
        return 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse';
      case 'CLOSED':
        return 'bg-slate-100 text-slate-700 border-slate-300';
      case 'DRAFT':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'CANCELLED':
        return 'bg-slate-200 text-slate-500 border-slate-400';
      case 'PLEDGED':
        return 'bg-amber-50 text-amber-900 border-amber-300 font-semibold';
      case 'RELEASED':
        return 'bg-emerald-50 text-emerald-900 border-emerald-300 font-semibold';
      case 'UNDER_DISPUTE':
        return 'bg-purple-100 text-purple-900 border-purple-300';
      case 'SEIZED':
        return 'bg-red-100 text-red-900 border-red-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const formatText = (st: string) => {
    return st.replace(/_/g, ' ');
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getBadgeStyle(
        status
      )} ${className}`}
    >
      {formatText(status)}
    </span>
  );
};
