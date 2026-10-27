import React from 'react';
import { TaskStatus } from '../../types';

interface StatusBadgeProps {
  status: TaskStatus | string;
  isOverdue?: boolean;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, isOverdue = false, size = 'sm' }) => {
  const norm = (status || '').toUpperCase();

  const config: Record<string, { label: string; bg: string; text: string; dot: string; border: string }> = {
    TODO: { 
      label: 'To Do', 
      bg: 'bg-slate-100 dark:bg-slate-800', 
      text: 'text-slate-700 dark:text-slate-300', 
      dot: 'bg-slate-400',
      border: 'border-slate-200 dark:border-slate-700' 
    },
    ACCEPTED: { 
      label: 'Accepted', 
      bg: 'bg-sky-50 dark:bg-sky-950/40', 
      text: 'text-sky-700 dark:text-sky-300', 
      dot: 'bg-sky-500',
      border: 'border-sky-200 dark:border-sky-800/60' 
    },
    IN_PROGRESS: { 
      label: 'In Progress', 
      bg: 'bg-blue-50 dark:bg-blue-950/40', 
      text: 'text-blue-700 dark:text-blue-300', 
      dot: 'bg-blue-600 animate-pulse',
      border: 'border-blue-200 dark:border-blue-800/60' 
    },
    ON_HOLD: { 
      label: 'On Hold', 
      bg: 'bg-amber-50 dark:bg-amber-950/40', 
      text: 'text-amber-800 dark:text-amber-300', 
      dot: 'bg-amber-500',
      border: 'border-amber-200 dark:border-amber-800/60' 
    },
    IN_REVIEW: { 
      label: 'In Review', 
      bg: 'bg-purple-50 dark:bg-purple-950/40', 
      text: 'text-purple-700 dark:text-purple-300', 
      dot: 'bg-purple-600',
      border: 'border-purple-200 dark:border-purple-800/60' 
    },
    COMPLETED: { 
      label: 'Completed', 
      bg: 'bg-emerald-50 dark:bg-emerald-950/40', 
      text: 'text-emerald-700 dark:text-emerald-300', 
      dot: 'bg-emerald-500',
      border: 'border-emerald-200 dark:border-emerald-800/60' 
    },
    REJECTED: { 
      label: 'Rejected', 
      bg: 'bg-rose-50 dark:bg-rose-950/40', 
      text: 'text-rose-700 dark:text-rose-300', 
      dot: 'bg-rose-500',
      border: 'border-rose-200 dark:border-rose-800/60' 
    },
    CANCELLED: { 
      label: 'Cancelled', 
      bg: 'bg-zinc-100 dark:bg-zinc-800', 
      text: 'text-zinc-600 dark:text-zinc-400', 
      dot: 'bg-zinc-400',
      border: 'border-zinc-200 dark:border-zinc-700' 
    },
    PENDING: { 
      label: 'Pending', 
      bg: 'bg-amber-50 dark:bg-amber-950/40', 
      text: 'text-amber-800 dark:text-amber-300', 
      dot: 'bg-amber-500',
      border: 'border-amber-200 dark:border-amber-800/60' 
    },
    CONVERTED_TO_TASK: { 
      label: 'Converted to Task', 
      bg: 'bg-teal-50 dark:bg-teal-950/40', 
      text: 'text-teal-700 dark:text-teal-300', 
      dot: 'bg-teal-500',
      border: 'border-teal-200 dark:border-teal-800/60' 
    },
    CLARIFICATION_REQUIRED: { 
      label: 'Clarification Needed', 
      bg: 'bg-orange-50 dark:bg-orange-950/40', 
      text: 'text-orange-700 dark:text-orange-300', 
      dot: 'bg-orange-500',
      border: 'border-orange-200 dark:border-orange-800/60' 
    }
  };

  const current = config[norm] || { 
    label: norm, 
    bg: 'bg-slate-100 dark:bg-slate-800', 
    text: 'text-slate-600 dark:text-slate-400', 
    dot: 'bg-slate-400',
    border: 'border-slate-200 dark:border-slate-700' 
  };
  const sizeClasses = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-xs md:text-sm font-semibold';

  return (
    <div className="inline-flex items-center gap-1.5 flex-wrap">
      <span className={`inline-flex items-center gap-1.5 rounded-lg font-semibold ${sizeClasses} ${current.bg} ${current.text} border ${current.border} shadow-2xs`}>
        <span className={`w-1.5 h-1.5 rounded-full ${current.dot}`}></span>
        <span className="whitespace-nowrap">{current.label}</span>
      </span>
      {isOverdue && norm !== 'COMPLETED' && norm !== 'CANCELLED' && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-800 whitespace-nowrap shadow-2xs">
          Overdue
        </span>
      )}
    </div>
  );
};
