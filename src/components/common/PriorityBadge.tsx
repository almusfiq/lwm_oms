import React from 'react';
import { TaskPriority } from '../../types';
import { AlertCircle, ArrowUp, ArrowRight, ArrowDown } from 'lucide-react';

interface PriorityBadgeProps {
  priority: TaskPriority | string;
  showIcon?: boolean;
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority, showIcon = true }) => {
  const norm = (priority || 'MEDIUM').toUpperCase();

  const config: Record<string, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
    URGENT: {
      label: 'Urgent',
      bg: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800/40',
      text: 'text-red-700 dark:text-red-400',
      icon: <AlertCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
    },
    HIGH: {
      label: 'High',
      bg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/40',
      text: 'text-amber-700 dark:text-amber-400',
      icon: <ArrowUp className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
    },
    MEDIUM: {
      label: 'Medium',
      bg: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/40',
      text: 'text-blue-700 dark:text-blue-400',
      icon: <ArrowRight className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
    },
    LOW: {
      label: 'Low',
      bg: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/60 dark:text-slate-400 dark:border-slate-800',
      text: 'text-slate-600 dark:text-slate-400',
      icon: <ArrowDown className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
    }
  };

  const current = config[norm] || config.MEDIUM;

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium border ${current.bg} whitespace-nowrap`}>
      {showIcon && current.icon}
      <span>{current.label}</span>
    </span>
  );
};
