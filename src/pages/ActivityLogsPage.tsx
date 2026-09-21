import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { ActivityLog } from '../types';
import { UserAvatar } from '../components/common/UserAvatar';
import { Modal } from '../components/common/Modal';
import { generateActivityLogsPDF } from '../utils/pdfGenerator';
import {
  ShieldAlert, Search, FileSpreadsheet, FileText,
  RotateCcw, Trash2, Layers, ChevronLeft, ChevronRight, Eye,
  AlertTriangle, UserCheck
} from 'lucide-react';

export const ActivityLogsPage: React.FC = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('ALL');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Inspection Modal
  const [inspectLog, setInspectLog] = useState<ActivityLog | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const [logsRes, statsRes] = await Promise.allSettled([
        api.activityLogs.list({
          search,
          module: moduleFilter !== 'ALL' ? moduleFilter : undefined,
          action: actionFilter !== 'ALL' ? actionFilter : undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          page,
          limit
        }),
        api.activityLogs.getStats()
      ]);

      if (logsRes.status === 'fulfilled') {
        setLogs(logsRes.value.items || []);
        setTotal(logsRes.value.total || 0);
        setTotalPages(logsRes.value.totalPages || 1);
      }

      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value);
      }
    } catch (err) {
      console.error('Failed to fetch activity logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, limit, moduleFilter, actionFilter, startDate, endDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const handleResetFilters = () => {
    setSearch('');
    setModuleFilter('ALL');
    setActionFilter('ALL');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const handleClearLogs = async () => {
    if (!confirm('Are you sure you want to purge older activity log records? Last 10 records will be preserved for security audit baseline.')) {
      return;
    }
    try {
      await api.activityLogs.clear();
      fetchLogs();
    } catch (err: any) {
      alert(err.message || 'Failed to clear activity logs');
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    if (logs.length === 0) {
      alert('No activity logs available to export.');
      return;
    }

    const headers = ['Timestamp', 'Actor Name', 'Actor Email', 'Actor Role', 'Module', 'Action', 'Description', 'IP Address', 'Resource ID'];
    const rows = logs.map(l => {
      const actorName = typeof l.actor?.name === 'object' ? l.actor.name.en : (l.actor?.name || l.actorId);
      const actorEmail = l.actor?.email || 'N/A';
      const actorRole = l.actor?.role || (l.actorId === 'system' ? 'SYSTEM' : 'USER');
      return [
        `"${new Date(l.createdAt).toLocaleString()}"`,
        `"${actorName}"`,
        `"${actorEmail}"`,
        `"${actorRole}"`,
        `"${l.module || 'SYSTEM'}"`,
        `"${l.action}"`,
        `"${(l.description || '').replace(/"/g, '""')}"`,
        `"${l.ipAddress || '127.0.0.1'}"`,
        `"${l.resourceId || 'N/A'}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `LWM_Activity_Logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // PDF Export
  const handleExportPDF = () => {
    if (logs.length === 0) {
      alert('No activity logs available to export.');
      return;
    }
    generateActivityLogsPDF(logs, user);
  };

  const getModuleBadge = (mod: string) => {
    const key = (mod || 'SYSTEM').toUpperCase();
    const map: Record<string, string> = {
      AUTH: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800/40',
      SECURITY: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/40',
      USERS: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800/40',
      TASKS: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/40',
      PROJECTS: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/40',
      DEPARTMENTS: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/40',
      DOCUMENTS: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-400 dark:border-teal-800/40',
      APPROVALS: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800/40',
      SYSTEM: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
    };
    return map[key] || map.SYSTEM;
  };

  const getActionBadge = (action: string) => {
    const act = (action || '').toUpperCase();
    if (act.includes('DELETE') || act.includes('FAILED') || act.includes('PURGE') || act.includes('CLEAR')) {
      return 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 font-bold';
    }
    if (act.includes('CREATE') || act.includes('UPLOAD') || act.includes('APPROVE') || act.includes('LOGIN')) {
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold';
    }
    if (act.includes('UPDATE') || act.includes('CHANGE') || act.includes('TRANSFER') || act.includes('ASSIGN')) {
      return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 font-medium';
    }
    return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 font-medium';
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wider mb-0.5">
            <ShieldAlert className="w-4 h-4" />
            <span>Super Admin Security Audit Intelligence</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            System Activity & Audit Logs
            <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300">
              {total} Logged Events
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Institutional activity tracking, access security logging, and system-wide administrative audit trail.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={fetchLogs}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={handleExportPDF}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-red-800 hover:bg-red-900 text-white shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>

          <button
            type="button"
            onClick={handleClearLogs}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900/40 hover:bg-rose-100 transition-colors flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Logs</span>
          </button>
        </div>
      </div>

      {/* Summary Cards Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Total Recorded Events</span>
            <Layers className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">
            {stats?.totalLogs || total}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Full persistent audit history</div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Security Alerts</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">
            {stats?.failedLoginsCount || 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Failed authentication attempts</div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Active Users Today</span>
            <UserCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {stats?.activeUsersTodayCount || 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">{stats?.todayTotalEvents || 0} events triggered today</div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Core System Modules</span>
            <ShieldAlert className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-purple-600 dark:text-purple-400">
            9 Modules
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Auth, Users, Tasks, Projects, Security</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Keyword Search */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search user, action, description, or IP..."
              className="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none"
            />
          </div>

          {/* Module Filter */}
          <div>
            <select
              value={moduleFilter}
              onChange={e => { setModuleFilter(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none"
            >
              <option value="ALL">All Modules</option>
              <option value="AUTH">Authentication (Auth)</option>
              <option value="SECURITY">Security & Access</option>
              <option value="USERS">Personnel & Users</option>
              <option value="TASKS">Directives & Tasks</option>
              <option value="PROJECTS">Strategic Projects</option>
              <option value="DEPARTMENTS">Departments</option>
              <option value="DOCUMENTS">Archival Documents</option>
              <option value="APPROVALS">Approvals</option>
              <option value="SYSTEM">System Settings</option>
            </select>
          </div>

          {/* Action Filter */}
          <div>
            <select
              value={actionFilter}
              onChange={e => { setActionFilter(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none"
            >
              <option value="ALL">All Actions</option>
              <option value="LOGIN">LOGIN</option>
              <option value="FAILED_LOGIN">FAILED_LOGIN</option>
              <option value="LOGOUT">LOGOUT</option>
              <option value="CREATE_EMPLOYEE">CREATE_EMPLOYEE</option>
              <option value="UPDATE_EMPLOYEE">UPDATE_EMPLOYEE</option>
              <option value="DELETE_EMPLOYEE">DELETE_EMPLOYEE</option>
              <option value="CREATE_TASK">CREATE_TASK</option>
              <option value="ASSIGN_TASK">ASSIGN_TASK</option>
              <option value="DELETE_TASK">DELETE_TASK</option>
              <option value="TRANSFER_TASK">TRANSFER_TASK</option>
              <option value="CHANGE_TASK_PRIORITY">CHANGE_TASK_PRIORITY</option>
              <option value="APPROVE_TASK">APPROVE_TASK</option>
              <option value="CREATE_PROJECT">CREATE_PROJECT</option>
              <option value="UPLOAD_DOCUMENT">UPLOAD_DOCUMENT</option>
              <option value="DELETE_DOCUMENT">DELETE_DOCUMENT</option>
              <option value="CHANGE_ROLE">CHANGE_ROLE</option>
              <option value="CHANGE_DEPARTMENT">CHANGE_DEPARTMENT</option>
              <option value="PASSWORD_CHANGE">PASSWORD_CHANGE</option>
            </select>
          </div>

          {/* Date Range Start */}
          <div>
            <input
              type="date"
              value={startDate}
              onChange={e => { setStartDate(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none"
              title="Filter by start date"
            />
          </div>
        </form>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
          <div>
            Showing <strong className="text-slate-800 dark:text-slate-200">{logs.length}</strong> of <strong className="text-slate-800 dark:text-slate-200">{total}</strong> activity events
          </div>
          {(search || moduleFilter !== 'ALL' || actionFilter !== 'ALL' || startDate || endDate) && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-red-700 dark:text-red-400 font-semibold hover:underline"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Activity Log Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4 min-w-[140px]">Time & Date</th>
                <th className="py-3 px-4 min-w-[160px]">Actor / User</th>
                <th className="py-3 px-4">Module</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4 min-w-[260px]">Activity Summary</th>
                <th className="py-3 px-4 whitespace-nowrap">IP Address</th>
                <th className="py-3 px-4 text-center">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Loading activity log history...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No activity logs match your search filters.
                  </td>
                </tr>
              ) : (
                logs.map(log => {
                  const actorName = typeof log.actor?.name === 'object' ? log.actor.name.en : (log.actor?.name || (log.actorId === 'system' ? 'System Service' : log.actorId));
                  const actorRole = log.actor?.role || (log.actorId === 'system' ? 'SYSTEM' : 'USER');
                  const formattedDate = new Date(log.createdAt).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  return (
                    <tr key={log._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      {/* Timestamp */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-600 dark:text-slate-400">
                        {formattedDate}
                      </td>

                      {/* Actor */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <UserAvatar name={log.actor?.name || actorName} role={actorRole} size="sm" />
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[120px]">
                              {actorName}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {actorRole}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Module */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${getModuleBadge(log.module)}`}>
                          {log.module || 'SYSTEM'}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-mono ${getActionBadge(log.action)}`}>
                          {log.action}
                        </span>
                      </td>

                      {/* Description */}
                      <td className="py-3 px-4 text-slate-800 dark:text-slate-200 font-medium">
                        {log.description}
                      </td>

                      {/* IP */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-slate-500">
                        {log.ipAddress || '127.0.0.1'}
                      </td>

                      {/* Inspect */}
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => setInspectLog(log)}
                          className="p-1.5 text-slate-400 hover:text-red-700 dark:hover:text-red-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Inspect activity details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <div className="text-slate-500">
              Page <strong className="text-slate-800 dark:text-slate-200">{page}</strong> of <strong className="text-slate-800 dark:text-slate-200">{totalPages}</strong>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 flex items-center gap-1 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 flex items-center gap-1 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Inspect Log Modal */}
      {inspectLog && (
        <Modal
          isOpen={Boolean(inspectLog)}
          onClose={() => setInspectLog(null)}
          title="Activity Log Event Inspection"
          subtitle={`Event ID: ${inspectLog._id} • ${new Date(inspectLog.createdAt).toLocaleString()}`}
          maxWidth="2xl"
        >
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Action & Module</span>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getModuleBadge(inspectLog.module)}`}>
                    {inspectLog.module || 'SYSTEM'}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-mono ${getActionBadge(inspectLog.action)}`}>
                    {inspectLog.action}
                  </span>
                </div>
              </div>

              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 pt-1">
                {inspectLog.description}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="text-slate-400 font-semibold uppercase text-[10px] mb-1">Actor Information</div>
                <div className="font-bold text-slate-900 dark:text-slate-100">
                  {typeof inspectLog.actor?.name === 'object' ? inspectLog.actor.name.en : (inspectLog.actor?.name || inspectLog.actorId)}
                </div>
                <div className="text-slate-500 mt-0.5">{inspectLog.actor?.email || 'N/A'}</div>
                <div className="text-slate-400 font-mono text-[10px] mt-0.5">Role: {inspectLog.actor?.role || 'SYSTEM'}</div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="text-slate-400 font-semibold uppercase text-[10px] mb-1">Network & Resource</div>
                <div className="font-mono text-slate-800 dark:text-slate-200">IP: {inspectLog.ipAddress || '127.0.0.1'}</div>
                <div className="text-slate-500 mt-0.5">Resource: {inspectLog.resourceType || 'N/A'}</div>
                <div className="text-slate-400 font-mono text-[10px] mt-0.5">ID: {inspectLog.resourceId || 'N/A'}</div>
              </div>
            </div>

            {inspectLog.metadata && Object.keys(inspectLog.metadata).length > 0 && (
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Event Metadata Payload
                </div>
                <pre className="p-3.5 bg-slate-900 text-slate-200 rounded-xl text-xs font-mono overflow-x-auto border border-slate-800 leading-relaxed">
                  {JSON.stringify(inspectLog.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
