import React from 'react';
import { TaskStatus } from '../../types';

interface StatusBadgeProps {
  status: TaskStatus | string;
  isOverdue?: boolean;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, isOverdue = false, size = 'sm' }) => {
  const norm = status.toUpperCase();

  const config: Record<string, { label: string; bg: string; text: string; dot: string }> = {
    TODO: { label: 'To Do', bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300', dot: 'bg-slate-400' },
    ACCEPTED: { label: 'Accepted', bg: 'bg-sky-50 dark:bg-sky-950/40', text: 'text-sky-700 dark:text-sky-300', dot: 'bg-sky-500' },
    IN_PROGRESS: { label: 'In Progress', bg: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-600' },
    ON_HOLD: { label: 'On Hold', bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
    IN_REVIEW: { label: 'In Review', bg: 'bg-indigo-50 dark:bg-indigo-950/40', text: 'text-indigo-700 dark:text-indigo-300', dot: 'bg-indigo-500' },
    COMPLETED: { label: 'Completed', bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
    REJECTED: { label: 'Rejected', bg: 'bg-rose-50 dark:bg-rose-950/40', text: 'text-rose-700 dark:text-rose-300', dot: 'bg-rose-500' },
    CANCELLED: { label: 'Cancelled', bg: 'bg-zinc-100 dark:bg-zinc-800', text: 'text-zinc-600 dark:text-zinc-400', dot: 'bg-zinc-400' },
    PENDING: { label: 'Pending', bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
    CONVERTED_TO_TASK: { label: 'Converted to Task', bg: 'bg-teal-50 dark:bg-teal-950/40', text: 'text-teal-700 dark:text-teal-300', dot: 'bg-teal-500' },
    CLARIFICATION_REQUIRED: { label: 'Clarification Needed', bg: 'bg-orange-50 dark:bg-orange-950/40', text: 'text-orange-700 dark:text-orange-300', dot: 'bg-orange-500' }
  };

  const current = config[norm] || { label: norm, bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-400', dot: 'bg-slate-400' };
  const sizeClasses = size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-xs md:text-sm font-medium';

  return (
    <div className="inline-flex items-center gap-1.5 flex-wrap">
      <span className={`inline-flex items-center gap-1.5 rounded-md font-medium ${sizeClasses} ${current.bg} ${current.text} border border-black/5 dark:border-white/5`}>
        <span className={`w-1.5 h-1.5 rounded-full ${current.dot}`}></span>
        <span className="whitespace-nowrap">{current.label}</span>
      </span>
      {isOverdue && norm !== 'COMPLETED' && norm !== 'CANCELLED' && (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-800 whitespace-nowrap">
          Overdue
        </span>
      )}
    </div>
  );
};
