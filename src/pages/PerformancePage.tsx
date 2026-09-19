import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { PerformanceMeter } from '../components/workflow/PerformanceMeter';
import { TrendingUp, Filter, Lock } from 'lucide-react';
import { api } from '../api/client';
import { getUserRole, isDepartmentHead } from '../utils/hierarchy';

export const PerformancePage: React.FC = () => {
  const { user } = useAuth();
  const [deptFilter, setDeptFilter] = useState('');
  const [departments, setDepartments] = React.useState<any[]>([]);

  const role = getUserRole(user);
  const isTrustee = role === 'TRUSTEE';
  const isCEO = role === 'CEO';
  const isDeptHead = isDepartmentHead(user);

  // Only Trustee, CEO, and Dept Head can see performance
  const canView = isTrustee || isCEO || isDeptHead;

  React.useEffect(() => {
    if (canView && (isTrustee || isCEO)) {
      api.departments.list().then(setDepartments).catch(console.error);
    }
  }, []);

  // Access denied screen for staff
  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-center max-w-md mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
          <Lock className="w-8 h-8 text-slate-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Access Restricted</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Performance data is only visible to Department Heads (for their own department),
          the CEO (all departments), and the Trustee Board (all employees).
        </p>
        <p className="text-xs text-slate-400">
          Contact your Department Head if you need performance-related feedback.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-red-700" />
            <span>Performance Scores</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {isTrustee
              ? 'Full museum-wide performance data across all employees.'
              : isCEO
              ? 'All department and employee performance — excluding Trustee Board.'
              : `Performance data for your department (${user?.departmentId || 'N/A'}).`}
          </p>
        </div>

        {/* Dept filter for Trustee / CEO only */}
        {(isTrustee || isCEO) && departments.length > 0 && (
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
              className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="">All Departments</option>
              {departments.map(d => (
                <option key={d._id} value={d._id}>{d.name.en} ({d.code})</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Info banner about visibility rules */}
      <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400">
        <strong className="text-slate-700 dark:text-slate-300">Visibility Rules:</strong>
        {' '}Trustee Board can see all employees.
        CEO can see all department heads and staff (not Trustees).
        Department Heads can only see their own department's staff.
        Individual employees cannot view performance scores.
      </div>

      {/* For dept head, force filter to their own dept */}
      <PerformanceMeter
        departmentId={isDeptHead ? (user?.departmentId || '') : (deptFilter || undefined)}
      />
    </div>
  );
};
