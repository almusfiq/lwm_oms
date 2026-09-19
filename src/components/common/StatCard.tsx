import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  sublabel?: string;
  trend?: string;
  color?: 'red' | 'blue' | 'amber' | 'emerald' | 'purple' | 'slate';
  onClick?: () => void;
  id?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon: Icon,
  sublabel,
  trend,
  color = 'slate',
  onClick,
  id
}) => {
  const colorMap = {
    red: 'bg-red-50 text-red-700 border-red-100 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30',
    blue: 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30',
    amber: 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30',
    purple: 'bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-900/30',
    slate: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
  };

  const isClickable = Boolean(onClick);

  return (
    <div
      id={id}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={e => {
        if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={`p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 transition-all text-left ${
        isClickable 
          ? 'cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500/20' 
          : ''
      }`}
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="text-sm font-medium text-slate-600 dark:text-slate-400 line-clamp-1">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${colorMap[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {value}
        </div>
        {trend && (
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {trend}
          </span>
        )}
      </div>
      {sublabel && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{sublabel}</p>
      )}
    </div>
  );
};
