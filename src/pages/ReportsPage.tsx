import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { BarChart3, TrendingUp, Users, Building, ArrowRight, Download, CheckCircle2, AlertCircle } from 'lucide-react';

interface ReportsPageProps {
  onNavigateTasks?: (filters: any) => void;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({ onNavigateTasks }) => {
  const [report, setReport] = useState<any>(null);
  const [matrix, setMatrix] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.reports.getSummary(),
      api.reports.getCollaborationMatrix()
    ])
      .then(([repData, matrixData]) => {
        setReport(repData);
        setMatrix(matrixData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleExportCSV = () => {
    if (!report) return;
    const rows = [
      ['Department Code', 'Department Name', 'Total Directives', 'Completed', 'Active', 'Overdue', 'Completion Rate'],
      ...report.departmentStats.map((d: any) => [
        d.code,
        `"${d.name}"`,
        d.total,
        d.completed,
        d.active,
        d.overdue,
        `${d.completionRate}%`
      ])
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Liberation_War_Museum_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400">
        Compiling organizational reports and collaboration matrix...
      </div>
    );
  }

  const deptStats = report?.departmentStats || [];
  const overall = report?.overall || {};

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-red-700" />
            <span>Museum Institutional Analytics & Reports</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Operational efficiency, task completion rates, departmental workloads, and inter-department collaboration synergy.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCSV}
          className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 shadow-xs flex items-center gap-1.5 transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>Export CSV Report</span>
        </button>
      </div>

      {/* Global Executive KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="text-xs font-semibold text-slate-500">Overall Completion Rate</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            {overall.completionRate || 0}%
          </div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">
            {overall.completedTasks || 0} of {overall.totalTasks || 0} tasks resolved
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="text-xs font-semibold text-slate-500">Active Operational Tasks</div>
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-400 mt-1">
            {overall.activeTasks || 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Across 7 departments & projects
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="text-xs font-semibold text-slate-500">Overdue Task Slippage</div>
          <div className="text-2xl font-bold text-red-700 dark:text-red-400 mt-1">
            {overall.overdueTasks || 0}
          </div>
          <div className="text-[11px] text-red-600 font-medium mt-1">
            Requiring supervisory attention
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="text-xs font-semibold text-slate-500">Cross-Dept Collaborations</div>
          <div className="text-2xl font-bold text-purple-700 dark:text-purple-400 mt-1">
            {matrix?.totalSynergies || 14}
          </div>
          <div className="text-[11px] text-purple-600 font-medium mt-1">
            Inter-department directives logged
          </div>
        </div>
      </div>

      {/* SECTION 1: Cross-Department Collaboration Matrix */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
        <div className="mb-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>Inter-Departmental Collaboration Synergy Matrix</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono font-normal bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300">
              Cross-Functional Index
            </span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Rows represent the <strong>Requesting Department (From)</strong>, and columns represent the <strong>Executing Department (To)</strong>. Numbers indicate active joint directives and tasks.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <th className="p-3 text-left font-bold text-slate-500 uppercase tracking-wider">
                  From \ To
                </th>
                {matrix?.departments?.map((dept: any) => (
                  <th key={dept._id} className="p-3 font-bold text-slate-700 dark:text-slate-300 min-w-[75px]" title={dept.name.en}>
                    {dept.code}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {matrix?.departments?.map((fromDept: any) => (
                <tr key={fromDept._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                  <td className="p-3 text-left font-semibold text-slate-800 dark:text-slate-200 bg-slate-50/40 dark:bg-slate-800/20 whitespace-nowrap">
                    <span className="font-mono font-bold text-red-800 dark:text-red-400 mr-1.5">[{fromDept.code}]</span>
                    <span>{fromDept.name.en}</span>
                  </td>

                  {matrix?.departments?.map((toDept: any) => {
                    const isSelf = fromDept._id === toDept._id;
                    const count = matrix?.matrix?.[fromDept._id]?.[toDept._id] || 0;

                    return (
                      <td key={toDept._id} className="p-3">
                        {isSelf ? (
                          <span className="text-slate-300 dark:text-slate-700 font-mono">-</span>
                        ) : count > 0 ? (
                          <span 
                            onClick={() => onNavigateTasks?.({ sourceDepartmentId: fromDept._id, targetDepartmentId: toDept._id })}
                            className="inline-block px-2.5 py-1 rounded-lg font-bold font-mono bg-red-100 text-red-900 dark:bg-red-950/60 dark:text-red-300 cursor-pointer hover:ring-2 hover:ring-red-500 transition-all shadow-xs"
                            title={`Click to view tasks from ${fromDept.code} to ${toDept.code}`}
                          >
                            {count}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-600 font-mono text-[11px]">0</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 2: Department Performance Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4">
          Department Operational Breakdown
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Head / Curator</th>
                <th className="py-3 px-4 text-center">Total Tasks</th>
                <th className="py-3 px-4 text-center">Active</th>
                <th className="py-3 px-4 text-center">Completed</th>
                <th className="py-3 px-4 text-center">Overdue</th>
                <th className="py-3 px-4 min-w-[150px]">Completion Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {deptStats.map((d: any) => (
                <tr key={d.departmentId} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900 dark:text-slate-100">
                      {d.name}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400">
                      [{d.code}]
                    </div>
                  </td>

                  <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                    {d.headName}
                  </td>

                  <td className="py-3 px-4 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
                    {d.total}
                  </td>

                  <td className="py-3 px-4 text-center font-mono text-blue-600 dark:text-blue-400 font-semibold">
                    {d.active}
                  </td>

                  <td className="py-3 px-4 text-center font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                    {d.completed}
                  </td>

                  <td className="py-3 px-4 text-center font-mono text-red-600 dark:text-red-400 font-semibold">
                    {d.overdue}
                  </td>

                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-red-700 h-full rounded-full"
                          style={{ width: `${d.completionRate}%` }}
                        />
                      </div>
                      <span className="font-mono text-slate-600 dark:text-slate-300 font-semibold w-10 text-right">
                        {d.completionRate}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
