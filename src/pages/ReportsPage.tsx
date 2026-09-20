import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { downloadOngoingTasksPdfReport } from '../utils/pdfGenerator';
import { BarChart3, TrendingUp, Users, Building, ArrowRight, Download, CheckCircle2, AlertCircle, FileText, Building2, Loader2 } from 'lucide-react';

interface ReportsPageProps {
  onNavigateTasks?: (filters: any) => void;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({ onNavigateTasks }) => {
  const { user, department: userDepartment } = useAuth();
  const [report, setReport] = useState<any>(null);
  const [matrix, setMatrix] = useState<any>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // PDF Report Section state
  const isTrustee = user?.role === 'TRUSTEE';
  const isCEO = user?.role === 'CEO';
  const isDeptHead = user?.role === 'DEPT_HEAD' || user?.role === 'DEPARTMENT_HEAD';
  const canSelectAllOrAnyDept = isTrustee || isCEO;

  const userDeptId = user?.departmentId || userDepartment?._id || '';

  const [reportScope, setReportScope] = useState<'ALL' | 'DEPT'>(canSelectAllOrAnyDept ? 'ALL' : 'DEPT');
  const [selectedDeptId, setSelectedDeptId] = useState<string>(userDeptId);
  const [taskStatusFilter, setTaskStatusFilter] = useState<'ONGOING' | 'COMPLETED' | 'ALL'>('ONGOING');
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    Promise.all([
      api.reports.getSummary(),
      api.reports.getCollaborationMatrix(),
      api.departments.list()
    ])
      .then(([repData, matrixData, deptsData]) => {
        setReport(repData);
        setMatrix(matrixData);
        setDepartments(deptsData || []);

        if (!canSelectAllOrAnyDept && userDeptId) {
          setSelectedDeptId(userDeptId);
          setReportScope('DEPT');
        } else if (deptsData && deptsData.length > 0 && !selectedDeptId) {
          setSelectedDeptId(deptsData[0]._id);
        }
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

  const handleDownloadPdfReport = async () => {
    try {
      setGeneratingPdf(true);

      let deptIdToFetch: string | undefined = undefined;
      let targetDeptName = '';

      const isDeptScope = !canSelectAllOrAnyDept || reportScope === 'DEPT';

      if (isDeptScope) {
        const targetId = canSelectAllOrAnyDept ? selectedDeptId : (userDeptId || selectedDeptId);
        if (targetId) {
          deptIdToFetch = targetId;
          const foundDept = departments.find(d => d._id === targetId) || (userDepartment?._id === targetId ? userDepartment : null);
          targetDeptName = foundDept?.name?.en || foundDept?.name || 'Department';
        }
      }

      // Fetch tasks (limit 1000 to fetch full list of organizational tasks)
      const params: Record<string, any> = { limit: 1000 };
      if (deptIdToFetch) {
        params.department = deptIdToFetch;
      }

      const res = await api.tasks.list(params);
      const fetchedTasks = Array.isArray(res) ? res : (res.items || []);

      // Filter tasks based on taskStatusFilter selection
      let finalTasks = fetchedTasks;
      if (taskStatusFilter === 'ONGOING') {
        finalTasks = fetchedTasks.filter((t: any) => {
          const s = (t.status || '').toUpperCase().replace(/\s+/g, '_');
          return s !== 'COMPLETED' && s !== 'CANCELLED' && s !== 'REJECTED';
        });
      } else if (taskStatusFilter === 'COMPLETED') {
        finalTasks = fetchedTasks.filter((t: any) => {
          const s = (t.status || '').toUpperCase().replace(/\s+/g, '_');
          return s === 'COMPLETED';
        });
      } else {
        // ALL tasks: include both completed and ongoing tasks
        finalTasks = fetchedTasks.filter((t: any) => {
          const s = (t.status || '').toUpperCase().replace(/\s+/g, '_');
          return s !== 'CANCELLED';
        });
      }

      // Additional client-side department check if department-wise scope was chosen
      if (deptIdToFetch) {
        const targetId = deptIdToFetch;
        finalTasks = finalTasks.filter((t: any) => {
          return (
            t.departmentId === targetId ||
            t.targetDepartmentId === targetId ||
            t.sourceDepartmentId === targetId ||
            t.department?._id === targetId ||
            t.targetDepartment?._id === targetId ||
            t.sourceDepartment?._id === targetId
          );
        });
      }

      const filterTypeName = taskStatusFilter === 'COMPLETED'
        ? 'Completed Tasks'
        : taskStatusFilter === 'ALL'
        ? 'All Tasks (Completed & Ongoing)'
        : 'Ongoing Tasks';

      const reportTitle = deptIdToFetch
        ? `${targetDeptName} — ${filterTypeName} PDF Report`
        : `Liberation War Museum — All Departments ${filterTypeName} PDF Report`;

      const scopeName = deptIdToFetch ? `Department-Wise (${targetDeptName})` : `All Departments (All-in-One)`;

      downloadOngoingTasksPdfReport({
        reportTitle,
        scopeName,
        departmentName: deptIdToFetch ? targetDeptName : undefined,
        filterTypeName,
        tasks: finalTasks,
        generatedBy: user
      });
    } catch (err: any) {
      console.error('Failed to generate PDF report:', err);
      alert(err.message || 'Failed to generate PDF report.');
    } finally {
      setGeneratingPdf(false);
    }
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

      {/* SECTION 0: Task PDF Report Center (Trustee, CEO & Department Head Access) */}
      {(isTrustee || isCEO || isDeptHead) && (
        <div className="bg-gradient-to-r from-red-900/90 via-slate-900 to-slate-900 border border-red-800/50 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <FileText className="w-48 h-48 text-white" />
          </div>

          <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-red-500/20 text-red-300 border border-red-500/30">
                  Official PDF Report Center
                </span>
                <span className="text-xs text-slate-400">
                  User Role: <strong className="text-white">{user?.role}</strong>
                </span>
              </div>
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-red-400" />
                <span>Task PDF Report Generator</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-1">
                {canSelectAllOrAnyDept
                  ? "As Trustee / CEO, you can export All-in-One task reports across all museum departments or department-specific reports for Ongoing, Completed, or All tasks."
                  : "As Department Head, you can download the task PDF report (Ongoing, Completed, or All tasks) for your department."}
              </p>
            </div>

            <div className="w-full lg:w-auto bg-slate-950/60 backdrop-blur-md p-4 rounded-xl border border-slate-800 space-y-4 min-w-[300px]">
              {/* Scope Selection for Trustee & CEO */}
              {canSelectAllOrAnyDept ? (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Report Scope
                  </label>
                  <div className="flex rounded-lg bg-slate-900 p-1 border border-slate-800 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setReportScope('ALL')}
                      className={`flex-1 py-1.5 px-3 rounded-md transition-all ${
                        reportScope === 'ALL'
                          ? 'bg-red-700 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      All Departments (All-in-One)
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportScope('DEPT')}
                      className={`flex-1 py-1.5 px-3 rounded-md transition-all ${
                        reportScope === 'DEPT'
                          ? 'bg-red-700 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Department-Wise
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-xs font-medium text-slate-400 mb-1">
                    Authorized Scope
                  </div>
                  <div className="px-3 py-1.5 bg-slate-900 rounded-lg text-xs font-semibold text-red-300 border border-slate-800 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-red-400" />
                    <span>My Dept ({userDepartment?.name?.en || userDepartment?.code || 'Department Head'})</span>
                  </div>
                </div>
              )}

              {/* Task Category / Status Filter Selection */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Task Status Filter
                </label>
                <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-900 p-1 border border-slate-800 text-[11px] font-semibold text-center">
                  <button
                    type="button"
                    onClick={() => setTaskStatusFilter('ONGOING')}
                    className={`py-1.5 px-2 rounded-md transition-all ${
                      taskStatusFilter === 'ONGOING'
                        ? 'bg-red-700 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Ongoing
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaskStatusFilter('COMPLETED')}
                    className={`py-1.5 px-2 rounded-md transition-all ${
                      taskStatusFilter === 'COMPLETED'
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Completed
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaskStatusFilter('ALL')}
                    className={`py-1.5 px-2 rounded-md transition-all ${
                      taskStatusFilter === 'ALL'
                        ? 'bg-blue-700 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All Tasks
                  </button>
                </div>
              </div>

              {/* Department Dropdown if Department-Wise Scope is selected */}
              {(canSelectAllOrAnyDept && reportScope === 'DEPT') && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Select Target Department
                  </label>
                  <select
                    value={selectedDeptId}
                    onChange={(e) => setSelectedDeptId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 text-white text-xs rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-600 focus:outline-none font-medium"
                  >
                    {departments.map((d: any) => (
                      <option key={d._id} value={d._id}>
                        [{d.code}] {d.name?.en || d.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Action Button */}
              <button
                type="button"
                onClick={handleDownloadPdfReport}
                disabled={generatingPdf}
                className="w-full py-2.5 px-4 bg-red-700 hover:bg-red-600 active:bg-red-800 text-white font-bold text-xs rounded-lg shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {generatingPdf ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Compiling PDF Report...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Download Task PDF Report</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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

