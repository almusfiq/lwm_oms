import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { TrendingUp, Award, AlertCircle, CheckCircle2, Clock, ChevronDown, ChevronUp } from 'lucide-react';

interface PerformanceRecord {
  userId: string;
  name: { en: string; bn: string };
  role: string;
  employeeId: string;
  uniqueId: string;
  department: { _id: string; code: string; name: { en: string } } | null;
  totalTasks: number;
  completedOnTime: number;
  completedLate: number;
  overduePending: number;
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

interface PerformanceMeterProps {
  departmentId?: string;
  compact?: boolean;
}

function gradeColor(grade: string) {
  switch (grade) {
    case 'A': return { bg: 'bg-emerald-100 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-300', bar: 'bg-emerald-500' };
    case 'B': return { bg: 'bg-blue-100 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-300', bar: 'bg-blue-500' };
    case 'C': return { bg: 'bg-amber-100 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-300', bar: 'bg-amber-500' };
    case 'D': return { bg: 'bg-orange-100 dark:bg-orange-950/40', text: 'text-orange-700 dark:text-orange-300', bar: 'bg-orange-500' };
    default:  return { bg: 'bg-red-100 dark:bg-red-950/40', text: 'text-red-700 dark:text-red-300', bar: 'bg-red-500' };
  }
}

export const PerformanceMeter: React.FC<PerformanceMeterProps> = ({ departmentId, compact = false }) => {
  const { user } = useAuth();
  const [records, setRecords] = useState<PerformanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    api.users.getPerformance({ departmentId })
      .then(setRecords)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [departmentId]);

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin w-8 h-8 border-2 border-red-700 border-t-transparent rounded-full mx-auto" />
        <p className="text-xs text-slate-400 mt-2">Loading performance data...</p>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400 text-sm">
        No performance data available.
      </div>
    );
  }

  const avg = Math.round(records.reduce((sum, r) => sum + r.score, 0) / records.length);

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      {!compact && (
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 text-center">
            <div className="text-lg font-black text-emerald-700 dark:text-emerald-300">
              {records.filter(r => r.grade === 'A' || r.grade === 'B').length}
            </div>
            <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">High Performers</div>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 text-center">
            <div className="text-lg font-black text-slate-700 dark:text-slate-300">{avg}</div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Avg Score</div>
          </div>
          <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-2xl border border-red-100 dark:border-red-900/30 text-center">
            <div className="text-lg font-black text-red-700 dark:text-red-300">
              {records.filter(r => r.grade === 'D' || r.grade === 'F').length}
            </div>
            <div className="text-[10px] font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">Needs Attention</div>
          </div>
        </div>
      )}

      {/* Employee rows */}
      <div className="space-y-2">
        {records.map(r => {
          const colors = gradeColor(r.grade);
          const isExpanded = expanded === r.userId;

          return (
            <div
              key={r.userId}
              className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setExpanded(isExpanded ? null : r.userId)}
                className="w-full p-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left"
              >
                {/* Grade badge */}
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${colors.bg} ${colors.text}`}>
                  {r.grade}
                </div>

                {/* Name + dept */}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                    {r.name.en}
                    <span className="ml-1.5 text-[10px] font-normal text-slate-400">{r.uniqueId}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {r.role.replace('_', ' ')} {r.department ? `• ${r.department.code}` : ''}
                  </div>
                </div>

                {/* Score bar */}
                <div className="w-24 shrink-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-slate-400">Score</span>
                    <span className={`text-xs font-bold ${colors.text}`}>{r.score}</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${colors.bar}`}
                      style={{ width: `${r.score}%` }}
                    />
                  </div>
                </div>

                {/* Expand toggle */}
                <div className="text-slate-400 shrink-0">
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>

              {/* Expanded details */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-1 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-3">
                  <div className="text-center p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto mb-0.5" />
                    <div className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{r.completedOnTime}</div>
                    <div className="text-[10px] text-emerald-600">On Time</div>
                  </div>
                  <div className="text-center p-2 rounded-xl bg-amber-50 dark:bg-amber-950/30">
                    <Clock className="w-4 h-4 text-amber-600 mx-auto mb-0.5" />
                    <div className="text-sm font-bold text-amber-700 dark:text-amber-300">{r.completedLate}</div>
                    <div className="text-[10px] text-amber-600">Late</div>
                  </div>
                  <div className="text-center p-2 rounded-xl bg-red-50 dark:bg-red-950/30">
                    <AlertCircle className="w-4 h-4 text-red-600 mx-auto mb-0.5" />
                    <div className="text-sm font-bold text-red-700 dark:text-red-300">{r.overduePending}</div>
                    <div className="text-[10px] text-red-600">Overdue</div>
                  </div>
                  <div className="col-span-3 text-[10px] text-slate-400 text-center mt-1">
                    Total assigned: {r.totalTasks} tasks
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
