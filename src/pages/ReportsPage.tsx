import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { downloadTasksPdfReport } from '../utils/pdfGenerator';
import { getUserRole, isDepartmentHead } from '../utils/hierarchy';
import {
  BarChart3, Users, Download, CheckCircle2, AlertCircle,
  FileText, Building2, Loader2, Printer, Search, CheckSquare,
  Calendar, Clock, Eye, ChevronDown, ChevronUp, Shield,
  ArrowUpRight, User as UserIcon, RefreshCw
} from 'lucide-react';

interface ReportsPageProps {
  onNavigateTasks?: (filters: any) => void;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({ onNavigateTasks }) => {
  const { user, department: userDepartment } = useAuth();

  // Role detection
  const role = getUserRole(user);
  const isTrustee = role === 'TRUSTEE';
  const isCEO = role === 'CEO';
  const isDeptHead = isDepartmentHead(user);
  const isStaff = !isTrustee && !isCEO && !isDeptHead && role !== 'SUPER_ADMIN';
  const canSelectAllOrAnyDept = isTrustee || isCEO;

  const userDeptId = user?.departmentId || userDepartment?._id || '';

  // Initial Scope:
  // - Staff: 'EMPLOYEE' (locked to self)
  // - Dept Head: 'DEPT' (locked to own dept)
  // - Trustee / CEO: 'ALL'
  const initialScope = isStaff ? 'EMPLOYEE' : canSelectAllOrAnyDept ? 'ALL' : 'DEPT';

  const [reportScope, setReportScope] = useState<'ALL' | 'DEPT' | 'EMPLOYEE'>(initialScope);
  const [selectedDeptId, setSelectedDeptId] = useState<string>(userDeptId);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(user?._id || '');
  const [taskStatusFilter, setTaskStatusFilter] = useState<'ONGOING' | 'COMPLETED' | 'ALL'>('ONGOING');

  // Loaded metadata
  const [departments, setDepartments] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [matrix, setMatrix] = useState<any>(null);
  const [deptStats, setDeptStats] = useState<any[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);

  // In-Page Report state
  const [reportData, setReportData] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [inReportSearch, setInReportSearch] = useState('');
  const [expandedChecklists, setExpandedChecklists] = useState<Record<string, boolean>>({});

  // Load initial dropdowns & institutional data
  useEffect(() => {
    const promises: Promise<any>[] = [
      api.departments.list(),
      api.users.list({ activeOnly: true })
    ];

    if (!isStaff) {
      promises.push(api.reports.getCollaborationMatrix().catch(() => null));
      promises.push(api.reports.getDepartmentReport().catch(() => []));
    }

    Promise.all(promises)
      .then(([deptsData, usersData, matrixData, dStatsData]) => {
        const allDepts = Array.isArray(deptsData) ? deptsData : [];
        setDepartments(allDepts);

        // Filter out Super Admin from users list
        const rawUsers = Array.isArray(usersData) ? usersData : (usersData?.items || []);
        const filteredUsers = rawUsers.filter((u: any) => u.role !== 'SUPER_ADMIN' && u.roleId !== 'SUPER_ADMIN');

        if (isDeptHead && userDeptId) {
          // Dept Head only sees employees in their department
          const deptEmployees = filteredUsers.filter((u: any) => u.departmentId === userDeptId);
          setEmployees(deptEmployees);
        } else if (canSelectAllOrAnyDept) {
          setEmployees(filteredUsers);
        } else {
          // Staff only has themselves
          setEmployees(filteredUsers.filter((u: any) => u._id === user?._id));
        }

        if (matrixData) setMatrix(matrixData);
        if (dStatsData) setDeptStats(dStatsData);

        // Set default dept
        if (!canSelectAllOrAnyDept && userDeptId) {
          setSelectedDeptId(userDeptId);
        } else if (allDepts.length > 0 && !selectedDeptId) {
          setSelectedDeptId(allDepts[0]._id);
        }

        // Set default employee
        if (isStaff) {
          setSelectedEmployeeId(user?._id || '');
        } else if (filteredUsers.length > 0 && !selectedEmployeeId) {
          setSelectedEmployeeId(user?._id || filteredUsers[0]._id);
        }
      })
      .catch(console.error)
      .finally(() => setInitialLoading(false));
  }, []);

  // Fetch / Generate the In-Page Report
  const fetchReport = async (overrideParams?: {
    scope?: 'ALL' | 'DEPT' | 'EMPLOYEE';
    deptId?: string;
    empId?: string;
    status?: 'ONGOING' | 'COMPLETED' | 'ALL';
  }) => {
    try {
      setReportLoading(true);

      const targetScope = overrideParams?.scope || reportScope;
      const targetStatus = overrideParams?.status || taskStatusFilter;
      const targetDeptId = overrideParams?.deptId || selectedDeptId;
      const targetEmpId = overrideParams?.empId || selectedEmployeeId;

      const params: Record<string, string> = {
        scope: targetScope,
        status: targetStatus
      };

      if (targetScope === 'DEPT' && targetDeptId) {
        params.departmentId = targetDeptId;
      } else if (targetScope === 'EMPLOYEE' && targetEmpId) {
        params.employeeId = targetEmpId;
      }

      // If staff, backend will strictly enforce scope=EMPLOYEE & employeeId=user._id
      if (isStaff) {
        params.scope = 'EMPLOYEE';
        params.employeeId = user?._id || '';
      }

      const res = await api.reports.getTasksReport(params);
      if (res) {
        setReportData(res);
      }
    } catch (err: any) {
      console.error('Failed to load tasks report:', err);
      alert(err.message || 'Failed to load report.');
    } finally {
      setReportLoading(false);
    }
  };

  // Automatically load report once initial metadata is ready
  useEffect(() => {
    if (!initialLoading) {
      fetchReport();
    }
  }, [initialLoading]);

  // Handle PDF Download directly from the loaded report
  const handleDownloadPdf = () => {
    if (!reportData) return;
    try {
      setGeneratingPdf(true);

      downloadTasksPdfReport({
        reportTitle: reportData.reportTitle,
        scopeName: reportData.scopeName,
        departmentName: reportData.department?.name?.en || reportData.department?.name,
        filterTypeName: reportData.filterTypeName,
        tasks: reportData.tasks || [],
        generatedBy: user,
        employee: reportData.employee
      });
    } catch (err: any) {
      console.error('Failed to download PDF:', err);
      alert(err.message || 'Failed to generate PDF.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleExportCSV = () => {
    if (!reportData || !reportData.tasks) return;
    const rows = [
      ['Task ID', 'Title', 'Priority', 'Status', 'Due Date', 'Progress', 'Source Department', 'Assigned Personnel', 'Description'],
      ...reportData.tasks.map((t: any) => [
        t.taskId || '',
        `"${(t.title || '').replace(/"/g, '""')}"`,
        t.priority || 'MEDIUM',
        t.status || 'IN_PROGRESS',
        t.dueDate || '',
        `${t.progress ?? 0}%`,
        `"${(t.sourceDepartment?.name?.en || t.sourceDepartment?.code || '').replace(/"/g, '""')}"`,
        `"${(t.assignees || []).map((a: any) => a.name?.en || a.name || '').join('; ')}"`,
        `"${(t.description || '').replace(/"/g, '""')}"`
      ])
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${(reportData.reportTitle || 'Tasks_Report').replace(/[^a-zA-Z0-9_-]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleChecklist = (taskId: string) => {
    setExpandedChecklists(prev => ({
      ...prev,
      [taskId]: !prev[taskId]
    }));
  };

  // Filter tasks in the in-page view by the quick search term
  const displayedTasks = useMemo(() => {
    if (!reportData || !reportData.tasks) return [];
    if (!inReportSearch.trim()) return reportData.tasks;
    const q = inReportSearch.toLowerCase();
    return reportData.tasks.filter((t: any) => {
      const titleMatch = (t.title || '').toLowerCase().includes(q);
      const idMatch = (t.taskId || '').toLowerCase().includes(q);
      const descMatch = (t.description || '').toLowerCase().includes(q);
      const assigneeMatch = (t.assignees || []).some((a: any) => (a.name?.en || a.name || '').toLowerCase().includes(q));
      return titleMatch || idMatch || descMatch || assigneeMatch;
    });
  }, [reportData, inReportSearch]);

  if (initialLoading) {
    return (
      <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-red-700" />
        <span className="text-sm font-medium">Preparing official report center...</span>
      </div>
    );
  }

  const stats = reportData?.stats || {
    total: 0,
    completed: 0,
    active: 0,
    overdue: 0,
    completionRate: 0,
    byPriority: { urgent: 0, high: 0, medium: 0, low: 0 }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-red-100 text-red-900 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-900/50">
              {isStaff ? 'Personal Work Report' : isDeptHead ? 'Department Report Center' : 'Executive Institutional Reports'}
            </span>
            <span className="text-xs text-slate-400">
              Role: <strong className="text-slate-700 dark:text-slate-200">{user?.role}</strong>
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-red-700" />
            <span>
              {isStaff
                ? 'My Work Performance & Task Report'
                : isDeptHead
                ? 'Department Task & Team Work Reports'
                : 'Museum Institutional & Work Reports'}
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {isStaff
              ? 'View your personal work report, completion rates, and download your official record.'
              : isDeptHead
              ? 'Analyze ongoing and completed directives for your department or inspect individual team member work reports.'
              : 'Institutional operational efficiency, department-specific directives, and personnel work performance records.'}
          </p>
        </div>

        {/* Global Export Options for Management */}
        <div className="flex items-center gap-2">
          {reportData && (
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* SECTION 1: Report Configuration / Filter Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <FileText className="w-4 h-4 text-red-600" />
              <span>Report Scope & Target Selection</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isStaff
                ? 'Your personal work report is automatically targeted. Choose the task status filter below.'
                : 'Select the report scope, target department or employee, and task category to render the report on this page.'}
            </p>
          </div>

          {/* Refresh / View Button */}
          <button
            type="button"
            onClick={() => fetchReport()}
            disabled={reportLoading}
            className="px-4 py-2 bg-red-700 hover:bg-red-800 active:bg-red-900 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {reportLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Compiling Report...</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" />
                <span>View / Refresh Report</span>
              </>
            )}
          </button>
        </div>

        {/* Filter Controls Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          
          {/* Scope Control */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
              Report Scope
            </label>

            {isStaff ? (
              // Staff: Locked to My Work Report
              <div className="px-3 py-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl text-xs font-semibold text-red-900 dark:text-red-200 flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-red-600" />
                <span>My Personal Work Report</span>
              </div>
            ) : canSelectAllOrAnyDept ? (
              // Trustee / CEO: All Departments, Dept-Wise, or Employee-Wise
              <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setReportScope('ALL');
                    fetchReport({ scope: 'ALL' });
                  }}
                  className={`py-1.5 px-2 rounded-lg transition-all ${
                    reportScope === 'ALL'
                      ? 'bg-red-700 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  All Depts
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReportScope('DEPT');
                    fetchReport({ scope: 'DEPT' });
                  }}
                  className={`py-1.5 px-2 rounded-lg transition-all ${
                    reportScope === 'DEPT'
                      ? 'bg-red-700 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Dept-Wise
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReportScope('EMPLOYEE');
                    fetchReport({ scope: 'EMPLOYEE' });
                  }}
                  className={`py-1.5 px-2 rounded-lg transition-all ${
                    reportScope === 'EMPLOYEE'
                      ? 'bg-red-700 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Employee
                </button>
              </div>
            ) : (
              // Dept Head: Dept Report or Team Member
              <div className="grid grid-cols-2 gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setReportScope('DEPT');
                    fetchReport({ scope: 'DEPT' });
                  }}
                  className={`py-1.5 px-2 rounded-lg transition-all ${
                    reportScope === 'DEPT'
                      ? 'bg-red-700 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  My Department
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReportScope('EMPLOYEE');
                    fetchReport({ scope: 'EMPLOYEE' });
                  }}
                  className={`py-1.5 px-2 rounded-lg transition-all ${
                    reportScope === 'EMPLOYEE'
                      ? 'bg-red-700 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Team Member
                </button>
              </div>
            )}
          </div>

          {/* Target Selector (Department or Employee) */}
          <div>
            {reportScope === 'DEPT' && canSelectAllOrAnyDept ? (
              <>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Select Department
                </label>
                <select
                  value={selectedDeptId}
                  onChange={e => {
                    setSelectedDeptId(e.target.value);
                    fetchReport({ deptId: e.target.value });
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded-xl px-3 py-2 font-medium focus:ring-2 focus:ring-red-600 focus:outline-none"
                >
                  {departments.map((d: any) => (
                    <option key={d._id} value={d._id}>
                      [{d.code}] {d.name?.en || d.name}
                    </option>
                  ))}
                </select>
              </>
            ) : reportScope === 'EMPLOYEE' && !isStaff ? (
              <>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  {isDeptHead ? 'Select Department Employee' : 'Select Employee'}
                </label>
                <select
                  value={selectedEmployeeId}
                  onChange={e => {
                    setSelectedEmployeeId(e.target.value);
                    fetchReport({ empId: e.target.value });
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded-xl px-3 py-2 font-medium focus:ring-2 focus:ring-red-600 focus:outline-none"
                >
                  {employees.map((emp: any) => (
                    <option key={emp._id} value={emp._id}>
                      {emp.name?.en || emp.name} ({emp.designation?.en || emp.role || 'Staff'}) {emp._id === user?._id ? '— (You)' : ''}
                    </option>
                  ))}
                </select>
              </>
            ) : reportScope === 'DEPT' && !canSelectAllOrAnyDept ? (
              <>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Authorized Department
                </label>
                <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-red-600" />
                  <span>{userDepartment?.name?.en || userDepartment?.code || 'My Department'}</span>
                </div>
              </>
            ) : (
              <>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Target Entity
                </label>
                <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-600" />
                  <span>
                    {reportScope === 'ALL' ? 'All Museum Departments (Complete)' : user?.name?.en || 'Personal Record'}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Task Status Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
              Task Status Filter
            </label>
            <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs font-semibold text-center">
              <button
                type="button"
                onClick={() => {
                  setTaskStatusFilter('ONGOING');
                  fetchReport({ status: 'ONGOING' });
                }}
                className={`py-1.5 px-2 rounded-lg transition-all ${
                  taskStatusFilter === 'ONGOING'
                    ? 'bg-red-700 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Ongoing
              </button>
              <button
                type="button"
                onClick={() => {
                  setTaskStatusFilter('COMPLETED');
                  fetchReport({ status: 'COMPLETED' });
                }}
                className={`py-1.5 px-2 rounded-lg transition-all ${
                  taskStatusFilter === 'COMPLETED'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Completed
              </button>
              <button
                type="button"
                onClick={() => {
                  setTaskStatusFilter('ALL');
                  fetchReport({ status: 'ALL' });
                }}
                className={`py-1.5 px-2 rounded-lg transition-all ${
                  taskStatusFilter === 'ALL'
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                All Tasks
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* SECTION 2: THE IN-PAGE RENDERED REPORT VIEW */}
      {/* "i want to see in the page like if i click the report it will show in that page then if they want they can download the pdf" */}
      {reportLoading ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-16 text-center shadow-md flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-red-700" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Compiling Report Records...</h3>
          <p className="text-xs text-slate-400">Loading task particulars, verification data, and metric calculations...</p>
        </div>
      ) : reportData ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xl overflow-hidden transition-all">
          
          {/* Official Document Banner / Letterhead */}
          <div className="p-6 sm:p-8 bg-gradient-to-b from-slate-50 to-white dark:from-slate-900/90 dark:to-slate-900 border-b border-slate-200/80 dark:border-slate-800">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pb-6 border-b border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl overflow-hidden bg-white dark:bg-slate-950 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-800 shadow-xs">
                  <img src="/logo.jpeg" alt="LWM Logo" className="w-full h-full object-cover" />
                </div>
                <div>
                  <div className="text-lg font-black tracking-tight text-red-900 dark:text-red-400 flex items-center gap-2">
                    <span>Liberation War Museum</span>
                    <span className="text-xs font-normal text-slate-400">(মুক্তিযুদ্ধ জাদুঘর)</span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Plot 1/1, Sher-e-Bangla Nagar, Agargaon, Dhaka-1207 • Official Task & Work Report
                  </div>
                </div>
              </div>

              {/* Action Buttons: Download PDF and Print */}
              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={generatingPdf}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-red-800 to-red-700 hover:from-red-700 hover:to-red-600 text-white shadow-md hover:shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  title="Download / Print PDF version of this report"
                >
                  {generatingPdf ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Generating PDF...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Download PDF Report</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="px-3 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors"
                  title="Print Report"
                >
                  <Printer className="w-4 h-4" />
                  <span className="hidden sm:inline">Print</span>
                </button>
              </div>
            </div>

            {/* Document Title & Metadata Row */}
            <div className="pt-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-red-700 dark:text-red-400">
                  {reportData.scopeName}
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
                  {reportData.reportTitle}
                </h2>
                <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span>Scope: <strong className="text-slate-700 dark:text-slate-300">{reportData.scope}</strong></span>
                  <span>Filter: <strong className="text-slate-700 dark:text-slate-300">{reportData.filterTypeName}</strong></span>
                  <span>Generated On: <strong className="text-slate-700 dark:text-slate-300">{new Date(reportData.generatedAt).toLocaleString()}</strong></span>
                  <span>Generated By: <strong className="text-slate-700 dark:text-slate-300">{user?.name?.en || user?.name} ({user?.role})</strong></span>
                </div>
              </div>

              {/* Total Count Badge */}
              <div className="text-left md:text-right shrink-0">
                <div className="text-xs text-slate-400 uppercase font-semibold">Included Directives</div>
                <div className="text-3xl font-black text-slate-900 dark:text-slate-100">
                  {stats.total}
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-6">

            {/* Employee Profile Card if this is an employee report */}
            {reportData.employee && (
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-800 to-slate-900 text-white font-bold text-base flex items-center justify-center shrink-0 shadow-xs">
                    {reportData.employee.name?.en?.charAt(0) || reportData.employee.name?.charAt(0) || 'E'}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base flex items-center gap-2">
                      <span>{reportData.employee.name?.en || reportData.employee.name}</span>
                      {reportData.employee.employeeId && (
                        <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          {reportData.employee.employeeId}
                        </span>
                      )}
                    </h3>
                    <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      <span>{reportData.employee.designation?.en || reportData.employee.role || 'Staff'}</span>
                      <span>•</span>
                      <span>Department: <strong>{reportData.department?.name?.en || reportData.department?.code || 'Museum'}</strong></span>
                      {reportData.employee.email && (
                        <>
                          <span>•</span>
                          <span className="font-mono text-slate-400">{reportData.employee.email}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-[11px] text-slate-400 font-semibold">Personal Completion Rate</div>
                    <div className="text-base font-black text-emerald-600 dark:text-emerald-400">
                      {stats.completionRate}%
                    </div>
                  </div>
                  <div className="w-12 bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                    <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${stats.completionRate}%` }} />
                  </div>
                </div>
              </div>
            )}

            {/* Metric KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                <div className="text-xs font-semibold text-slate-500">Total Directives</div>
                <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
                  {stats.total}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">In current report filter</div>
              </div>

              <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-200/60 dark:border-emerald-900/40">
                <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Completed Directives</div>
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  {stats.completed}
                </div>
                <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5 font-medium">
                  {stats.completionRate}% resolution efficiency
                </div>
              </div>

              <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20 rounded-2xl border border-blue-200/60 dark:border-blue-900/40">
                <div className="text-xs font-semibold text-blue-800 dark:text-blue-300">Active / In-Progress</div>
                <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
                  {stats.active}
                </div>
                <div className="text-[11px] text-blue-700 dark:text-blue-400 mt-0.5">Ongoing execution</div>
              </div>

              <div className={`p-4 rounded-2xl border ${
                stats.overdue > 0
                  ? 'bg-red-50/60 dark:bg-red-950/30 border-red-200/80 dark:border-red-900/50'
                  : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800'
              }`}>
                <div className={`text-xs font-semibold ${stats.overdue > 0 ? 'text-red-800 dark:text-red-300' : 'text-slate-500'}`}>
                  Overdue Slippage
                </div>
                <div className={`text-2xl font-black mt-1 ${stats.overdue > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-200'}`}>
                  {stats.overdue}
                </div>
                <div className={`text-[11px] mt-0.5 font-medium ${stats.overdue > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {stats.overdue > 0 ? 'Requires supervisor attention' : 'No overdue slippage'}
                </div>
              </div>
            </div>

            {/* Priority Distribution Badges */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-800 text-xs">
              <span className="font-semibold text-slate-500">Priority Breakdown:</span>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg font-bold bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300">
                  Urgent: {stats.byPriority?.urgent || 0}
                </span>
                <span className="px-2.5 py-1 rounded-lg font-bold bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300">
                  High: {stats.byPriority?.high || 0}
                </span>
                <span className="px-2.5 py-1 rounded-lg font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                  Medium: {stats.byPriority?.medium || 0}
                </span>
                <span className="px-2.5 py-1 rounded-lg font-bold bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-300">
                  Low: {stats.byPriority?.low || 0}
                </span>
              </div>
            </div>

            {/* Quick in-report search bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Task Particulars & Detailed Roster ({displayedTasks.length} {displayedTasks.length === 1 ? 'task' : 'tasks'})
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter tasks in this report..."
                  value={inReportSearch}
                  onChange={e => setInReportSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
            </div>

            {/* Task Particulars Cards */}
            <div className="space-y-4">
              {displayedTasks.length > 0 ? (
                displayedTasks.map((t: any, idx: number) => {
                  const assignees = (t.assignees || []).map((a: any) => a?.name?.en || a?.name || 'Staff').join(', ') || 'Unassigned';
                  const requester = t.requester?.name?.en || t.creator?.name?.en || 'Executive Direct';
                  const sourceDept = t.sourceDepartment?.name?.en || t.sourceDepartment?.code || 'Museum HQ';
                  const targetDept = t.targetDepartment?.name?.en || t.department?.name?.en || t.department?.code || 'General';
                  const checklistDone = t.checklist?.filter((c: any) => c.completed).length || 0;
                  const checklistTotal = t.checklist?.length || 0;
                  const isChecklistExpanded = !!expandedChecklists[t._id];

                  const priorityColor =
                    t.priority === 'URGENT'
                      ? 'bg-red-600 text-white'
                      : t.priority === 'HIGH'
                      ? 'bg-orange-600 text-white'
                      : t.priority === 'MEDIUM'
                      ? 'bg-blue-600 text-white'
                      : 'bg-emerald-600 text-white';

                  const statusColor =
                    t.status === 'COMPLETED'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : t.status === 'IN_PROGRESS'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                      : t.status === 'IN_REVIEW'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                      : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';

                  return (
                    <div
                      key={t._id || idx}
                      className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5 bg-white dark:bg-slate-900 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                    >
                      {/* Task Header */}
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono font-bold text-xs text-red-700 dark:text-red-400">
                              #{idx + 1} • {t.taskId || 'TSK-000'}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${priorityColor}`}>
                              {t.priority || 'MEDIUM'}
                            </span>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusColor}`}>
                              {(t.status || 'IN_PROGRESS').replace(/_/g, ' ')}
                            </span>
                          </div>
                          <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                            {t.title}
                          </h4>
                        </div>

                        {/* Due Date & Overdue Badge */}
                        <div className="text-left sm:text-right shrink-0">
                          <div className="text-[11px] text-slate-400">Target Deadline</div>
                          <div className={`font-mono text-xs font-bold ${t.isOverdue ? 'text-red-600' : 'text-slate-700 dark:text-slate-300'}`}>
                            {t.dueDate || 'No deadline'}
                          </div>
                          {t.isOverdue && (
                            <span className="inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 mt-0.5">
                              Overdue Slippage
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Particulars Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl text-xs border border-slate-100 dark:border-slate-800 mb-3">
                        <div>
                          <div className="text-[10px] uppercase text-slate-400 font-semibold">Source Dept & Requester</div>
                          <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 truncate">
                            {sourceDept}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">({requester})</div>
                        </div>

                        <div>
                          <div className="text-[10px] uppercase text-slate-400 font-semibold">Target Dept & Assigned Staff</div>
                          <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 truncate">
                            {targetDept}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">({assignees})</div>
                        </div>

                        <div>
                          <div className="text-[10px] uppercase text-slate-400 font-semibold">Execution Progress</div>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${t.status === 'COMPLETED' ? 'bg-emerald-600' : 'bg-red-700'}`}
                                style={{ width: `${t.progress ?? 0}%` }}
                              />
                            </div>
                            <span className="font-mono font-bold text-xs text-slate-700 dark:text-slate-300 w-9 text-right">
                              {t.progress ?? 0}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Description if present */}
                      {t.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-3 line-clamp-2">
                          {t.description}
                        </p>
                      )}

                      {/* Checklist & Attachments Footer */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
                        <div className="flex items-center gap-4">
                          {checklistTotal > 0 ? (
                            <button
                              type="button"
                              onClick={() => toggleChecklist(t._id)}
                              className="text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-red-700 flex items-center gap-1 transition-colors"
                            >
                              <CheckSquare className="w-3.5 h-3.5 text-slate-400" />
                              <span>Checklist: <strong>{checklistDone}/{checklistTotal} completed</strong></span>
                              {isChecklistExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5 ml-0.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
                              )}
                            </button>
                          ) : (
                            <span className="text-slate-400 text-[11px]">No checklist items</span>
                          )}

                          <span>
                            Attachments: <strong>{t.attachments?.length || 0} file(s)</strong>
                          </span>
                        </div>

                        {onNavigateTasks && (
                          <button
                            type="button"
                            onClick={() => onNavigateTasks({ search: t.taskId })}
                            className="text-red-700 hover:text-red-800 font-bold text-xs flex items-center gap-1 transition-colors"
                          >
                            <span>Open Task Detail</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Expanded Checklist details */}
                      {isChecklistExpanded && t.checklist && t.checklist.length > 0 && (
                        <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-800 space-y-1.5">
                          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Task Action Items
                          </div>
                          {t.checklist.map((item: any, cIdx: number) => (
                            <div key={item._id || cIdx} className="flex items-center gap-2 text-xs">
                              <span className={`w-4 h-4 rounded flex items-center justify-center shrink-0 text-[10px] font-bold ${
                                item.completed
                                  ? 'bg-emerald-600 text-white'
                                  : 'border border-slate-400 text-transparent'
                              }`}>
                                ✓
                              </span>
                              <span className={item.completed ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-300 font-medium'}>
                                {item.title}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="p-12 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                  <p className="font-semibold text-sm">No tasks found matching this criteria.</p>
                  <p className="text-xs mt-1">Try switching the task status filter or clearing your search term.</p>
                </div>
              )}
            </div>

            {/* Official Verification Signatures Row */}
            <div className="pt-8 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-8 text-xs">
              <div className="border-t border-slate-300 dark:border-slate-700 pt-3">
                <div className="font-bold text-slate-900 dark:text-slate-100">
                  {reportData.employee?.name?.en || reportData.employee?.name || user?.name?.en || 'Report Generator'}
                </div>
                <div className="text-slate-500">
                  {reportData.employee?.designation?.en || reportData.employee?.role || user?.designation?.en || 'Supervisory Authority'}
                </div>
                <div className="text-slate-400 mt-1">
                  Report Date: {new Date().toLocaleDateString()}
                </div>
              </div>

              <div className="border-t border-slate-300 dark:border-slate-700 pt-3">
                <div className="font-bold text-slate-900 dark:text-slate-100">
                  Supervisory / Directorate Verification
                </div>
                <div className="text-slate-500">
                  Liberation War Museum Directorate
                </div>
                <div className="text-slate-400 mt-1">
                  Official Seal & Authorization Record
                </div>
              </div>
            </div>

            {/* Bottom Download Bar */}
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800">
              <div className="text-xs text-slate-500">
                Official Museum Institutional Record • Validated for internal audit and operations.
              </div>

              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={generatingPdf}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-red-700 hover:bg-red-800 active:bg-red-900 text-white shadow-md flex items-center gap-2 transition-all disabled:opacity-50"
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
      ) : null}

      {/* SECTION 3: INSTITUTIONAL ANALYTICS & MATRICES (FOR TRUSTEE, CEO & DEPT HEAD) */}
      {!isStaff && matrix && (
        <div className="space-y-6 pt-4">
          <div className="border-t border-slate-200 dark:border-slate-800 pt-8">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-red-700" />
              <span>Institutional Departmental Synergy & Analytics</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Cross-functional collaboration indices, inter-departmental directive flows, and operational efficiency rates.
            </p>
          </div>

          {/* Cross-Department Collaboration Matrix */}
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

          {/* Department Performance Table */}
          {deptStats.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4">
                Department Operational Breakdown
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Department</th>
                      <th className="py-3 px-4 text-center">Total Directives</th>
                      <th className="py-3 px-4 text-center">Active</th>
                      <th className="py-3 px-4 text-center">Completed</th>
                      <th className="py-3 px-4 text-center">Overdue</th>
                      <th className="py-3 px-4 min-w-[150px]">Completion Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {deptStats.map((d: any) => (
                      <tr key={d.department?._id || d.departmentId} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 dark:text-slate-100">
                            {d.department?.name?.en || d.department?.name || d.name}
                          </div>
                          <div className="text-[11px] font-mono text-slate-400">
                            [{d.department?.code || d.code}] • {d.employeeCount || 0} Personnel
                          </div>
                        </td>

                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
                          {d.totalTasks ?? d.total ?? 0}
                        </td>

                        <td className="py-3 px-4 text-center font-mono text-blue-600 dark:text-blue-400 font-semibold">
                          {d.activeTasks ?? d.active ?? 0}
                        </td>

                        <td className="py-3 px-4 text-center font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                          {d.completedTasks ?? d.completed ?? 0}
                        </td>

                        <td className="py-3 px-4 text-center font-mono text-red-600 dark:text-red-400 font-semibold">
                          {d.overdueTasks ?? d.overdue ?? 0}
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-red-700 h-full rounded-full"
                                style={{ width: `${d.completionRate ?? 0}%` }}
                              />
                            </div>
                            <span className="font-mono text-slate-600 dark:text-slate-300 font-semibold w-10 text-right">
                              {d.completionRate ?? 0}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
