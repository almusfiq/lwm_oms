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
      bg: 'bg-red-50 text-red-800 border-red-200/90 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900/60 font-bold shadow-2xs',
      text: 'text-red-800 dark:text-red-300',
      icon: <AlertCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0" />
    },
    HIGH: {
      label: 'High',
      bg: 'bg-amber-50 text-amber-800 border-amber-200/90 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900/60 font-bold shadow-2xs',
      text: 'text-amber-800 dark:text-amber-300',
      icon: <ArrowUp className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
    },
    MEDIUM: {
      label: 'Medium',
      bg: 'bg-blue-50 text-blue-800 border-blue-200/90 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900/60 font-bold shadow-2xs',
      text: 'text-blue-800 dark:text-blue-300',
      icon: <ArrowRight className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
    },
    LOW: {
      label: 'Low',
      bg: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700 font-semibold shadow-2xs',
      text: 'text-slate-700 dark:text-slate-300',
      icon: <ArrowDown className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
    }
  };

  const current = config[norm] || config.MEDIUM;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border ${current.bg} whitespace-nowrap`}>
      {showIcon && current.icon}
      <span>{current.label}</span>
    </span>
  );
};
