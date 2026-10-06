import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { downloadTasksPdfReport, generateTasksReportHtml } from '../utils/pdfGenerator';
import { getUserRole, isDepartmentHead } from '../utils/hierarchy';
import {
  BarChart3, Users, Download, CheckCircle2, AlertCircle,
  FileText, Building2, Loader2, Printer, Search, CheckSquare,
  Eye, Shield, ArrowUpRight, User as UserIcon, RefreshCw,
  ZoomIn, ZoomOut, Maximize2, Sparkles
} from 'lucide-react';

interface ReportsPageProps {
  onNavigateTasks?: (filters: any) => void;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({ onNavigateTasks }) => {
  const { user, department: userDepartment } = useAuth();
  const iframeRef = useRef<HTMLIFrameElement>(null);

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

  // Active view tab for executive/managerial roles
  const [activeTab, setActiveTab] = useState<'preview' | 'synergy'>('preview');

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

  // PDF Preview Controls
  const [zoom, setZoom] = useState<number>(100);
  const [iframeHeight, setIframeHeight] = useState<number>(1000);

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

  // Generate the full standalone PDF HTML string for the in-page document viewer
  const previewHtml = useMemo(() => {
    if (!reportData) return '';
    return generateTasksReportHtml({
      reportTitle: reportData.reportTitle,
      scopeName: reportData.scopeName,
      departmentName: reportData.department?.name?.en || reportData.department?.name,
      filterTypeName: reportData.filterTypeName,
      tasks: reportData.tasks || [],
      generatedBy: user,
      employee: reportData.employee
    });
  }, [reportData, user]);

  // Adjust iframe height dynamically to match content height
  const handleIframeLoad = () => {
    try {
      const doc = iframeRef.current?.contentDocument || iframeRef.current?.contentWindow?.document;
      if (doc?.body) {
        const scrollH = doc.body.scrollHeight || doc.documentElement.scrollHeight;
        setIframeHeight(Math.max(900, scrollH + 40));
      }
    } catch (e) {
      // ignore cross-domain if any
    }
  };

  useEffect(() => {
    if (previewHtml) {
      const timer = setTimeout(() => {
        handleIframeLoad();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [previewHtml, zoom]);

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

  // Direct print from the preview iframe
  const handlePrint = () => {
    if (iframeRef.current?.contentWindow) {
      try {
        iframeRef.current.contentWindow.focus();
        iframeRef.current.contentWindow.print();
        return;
      } catch (e) {
        // Fallback to generator
      }
    }
    handleDownloadPdf();
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

  if (initialLoading) {
    return (
      <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-red-700" />
        <span className="text-sm font-medium">Preparing official report center...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      
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
                ? 'My Work Performance & Task PDF Report'
                : isDeptHead
                ? 'Department Task & Team Work PDF Reports'
                : 'Museum Institutional Task & Performance Reports'}
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {isStaff
              ? 'Preview your authenticated work report sheet directly on this page, and download the official PDF.'
              : isDeptHead
              ? 'Preview official PDF reports for your entire department or individual team members with full verification.'
              : 'Institutional operational directives, cross-functional flows, and personnel work performance records.'}
          </p>
        </div>

        {/* Global Action Options */}
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

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={generatingPdf || !reportData}
            className="px-4 py-2 bg-gradient-to-r from-red-800 to-red-700 hover:from-red-700 hover:to-red-600 active:from-red-900 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {generatingPdf ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Preparing PDF...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Download PDF</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tabs if Executive or Dept Head */}
      {!isStaff && matrix && (
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === 'preview'
                ? 'bg-red-700 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800/60'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>PDF Document Sheet Preview</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('synergy')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === 'synergy'
                ? 'bg-red-700 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800/60'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Institutional Synergy & Analytics</span>
          </button>
        </div>
      )}

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
                ? 'Your personal work report is automatically targeted. Choose the task status filter below to preview your document.'
                : 'Select the report scope, target department or employee, and task category to update the PDF preview sheet.'}
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
                <span>Compiling Document...</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" />
                <span>Update Document Preview</span>
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

      {/* SECTION 2: THE AUTHENTIC PDF DOCUMENT SHEET PREVIEW */}
      {/* "we want to see the preview of the pdf not like current interface fix iyt" */}
      {activeTab === 'preview' && (
        <div className="space-y-4">
          
          {/* PDF Viewer Top Action Bar */}
          <div className="bg-slate-900 text-white px-4 py-3 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-md border border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-700/80 flex items-center justify-center text-white shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold flex items-center gap-2">
                  <span>{reportData?.reportTitle || 'Official Task Report Preview'}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300">
                    A4 PDF Sheet
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">
                  {reportData?.tasks?.length || 0} Directives Included • {reportData?.filterTypeName || 'Ongoing'}
                </div>
              </div>
            </div>

            {/* Viewer Zoom & Print Controls */}
            <div className="flex items-center gap-2">
              
              {/* Zoom Buttons */}
              <div className="flex items-center bg-slate-800 rounded-xl px-1.5 py-1 text-xs">
                <button
                  type="button"
                  onClick={() => setZoom(prev => Math.max(60, prev - 10))}
                  title="Zoom Out"
                  className="p-1 hover:text-red-400 text-slate-300 rounded transition-colors"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="px-2 font-mono text-[11px] text-slate-200 select-none">
                  {zoom}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom(prev => Math.min(140, prev + 10))}
                  title="Zoom In"
                  className="p-1 hover:text-red-400 text-slate-300 rounded transition-colors"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(100)}
                  title="Reset Zoom (100%)"
                  className="ml-1 px-1.5 py-0.5 text-[10px] bg-slate-700 hover:bg-slate-600 rounded text-slate-200 transition-colors"
                >
                  100%
                </button>
              </div>

              {/* Print Document */}
              <button
                type="button"
                onClick={handlePrint}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 transition-colors border border-slate-700"
                title="Print Preview Document"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>

              {/* Download PDF Document */}
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={generatingPdf || !reportData}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-red-700 hover:bg-red-600 active:bg-red-800 text-white flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
              >
                {generatingPdf ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Document Canvas Backdrop */}
          <div className="bg-slate-800/90 dark:bg-slate-950 p-4 sm:p-8 md:p-10 rounded-3xl border border-slate-300 dark:border-slate-800 flex justify-center items-start overflow-x-auto min-h-[850px] shadow-inner">
            
            {reportLoading ? (
              <div className="bg-white rounded-lg p-16 text-center shadow-2xl flex flex-col items-center justify-center gap-3 w-full max-w-[850px] min-h-[600px] border border-slate-300">
                <Loader2 className="w-10 h-10 animate-spin text-red-700" />
                <h3 className="text-base font-bold text-slate-800">Compiling PDF Document Sheet...</h3>
                <p className="text-xs text-slate-400">Rendering official letterhead, directive particulars, and verification metadata...</p>
              </div>
            ) : previewHtml ? (
              <div
                className="w-full flex justify-center transition-transform origin-top"
                style={{
                  transform: zoom !== 100 ? `scale(${zoom / 100})` : undefined,
                  transformOrigin: 'top center'
                }}
              >
                {/* Authentic A4 Document Paper Sheet */}
                <div className="bg-white text-slate-900 rounded-sm shadow-2xl border border-slate-300 w-full max-w-[850px] min-h-[950px] overflow-hidden">
                  <iframe
                    ref={iframeRef}
                    srcDoc={previewHtml}
                    title="Official PDF Document Sheet Preview"
                    onLoad={handleIframeLoad}
                    className="w-full bg-white block"
                    style={{
                      height: `${iframeHeight}px`,
                      minHeight: '850px',
                      border: 'none',
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg p-16 text-center shadow-2xl flex flex-col items-center justify-center gap-3 w-full max-w-[850px] min-h-[500px] border border-slate-300">
                <AlertCircle className="w-10 h-10 text-slate-400" />
                <h3 className="text-base font-bold text-slate-800">No Document Records Loaded</h3>
                <p className="text-xs text-slate-400">Click &quot;Update Document Preview&quot; above to render the authenticated PDF sheet.</p>
              </div>
            )}

          </div>

          {/* Document Footer Callout */}
          <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 shadow-xs">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Official Liberation War Museum Record • Validated for departmental audits and performance reviews.</span>
            </div>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={generatingPdf || !reportData}
              className="font-bold text-red-700 hover:text-red-800 flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Save / Download PDF File</span>
            </button>
          </div>

        </div>
      )}

      {/* SECTION 3: INSTITUTIONAL ANALYTICS & MATRICES (FOR TRUSTEE, CEO & DEPT HEAD) */}
      {activeTab === 'synergy' && !isStaff && matrix && (
        <div className="space-y-6">
          <div className="border-t border-slate-200 dark:border-slate-800 pt-2">
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
