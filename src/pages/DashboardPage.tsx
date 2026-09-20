import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { StatCard } from '../components/common/StatCard';
import { TaskTable } from '../components/tasks/TaskTable';
import { Task } from '../types';
import { getUserRole, isDepartmentHead } from '../utils/hierarchy';
import {
  CheckSquare, AlertCircle, GitPullRequest, FolderKanban,
  Plus, ArrowRight, ShieldCheck, Users, Building2,
  TrendingUp, CheckCheck, Clock, UserCog, BarChart3,
  Shield, Briefcase, FileText
} from 'lucide-react';

interface DashboardPageProps {
  onOpenTaskDetail: (taskId: string) => void;
  onNavigateTab: (tab: any, filter?: any) => void;
  onOpenCreateTask: () => void;
  onOpenCreateRequest: () => void;
  refreshKey?: number;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onOpenTaskDetail,
  onNavigateTab,
  onOpenCreateTask,
  onOpenCreateRequest,
  refreshKey = 0
}) => {
  const { user, department } = useAuth();
  const [analytics, setAnalytics] = useState<any>(null);
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const role = getUserRole(user);
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const isTrustee = role === 'TRUSTEE';
  const isCEO = role === 'CEO';
  const isDeptHead = isDepartmentHead(user);
  const isStaff = !isSuperAdmin && !isTrustee && !isCEO && !isDeptHead;

  const normalizedDepartmentId = user?.departmentId || department?._id || '';

  useEffect(() => {
    setLoading(true);
    const fetches: Promise<any>[] = [
      api.analytics.getOverview(),
      api.tasks.list({ limit: 8, ...(isStaff ? { assignee: user?._id } : {}) }),
      api.taskRequests.list({ type: 'incoming', status: 'PENDING' })
    ];

    // Approvals pending for this user (incoming to act on)
    if (!isStaff) {
      fetches.push(api.approvals.list({ type: 'incoming' } as any));
    } else {
      fetches.push(api.approvals.list({ type: 'my_requests' } as any));
    }

    Promise.allSettled(fetches)
      .then(([overviewRes, tasksRes, reqsRes, approvalsRes]) => {
        if (overviewRes.status === 'fulfilled') setAnalytics(overviewRes.value);
        if (tasksRes.status === 'fulfilled') setRecentTasks(tasksRes.value?.items || []);
        if (reqsRes.status === 'fulfilled') setIncomingRequests(Array.isArray(reqsRes.value) ? reqsRes.value : []);
        if (approvalsRes?.status === 'fulfilled') setPendingApprovals(Array.isArray(approvalsRes.value) ? approvalsRes.value : []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user?._id, refreshKey]);

  const stats = analytics?.stats || {};

  // ─── Role label banner ───────────────────────────────────────────────────
  const roleConfig = isSuperAdmin
    ? { label: 'Super Admin Platform Governance (Root)', icon: UserCog, color: 'from-purple-950 via-slate-900 to-indigo-950' }
    : isTrustee
    ? { label: 'Trustee Board View', icon: Shield, color: 'from-red-900 via-red-800 to-slate-900' }
    : isCEO
    ? { label: 'CEO Command View', icon: UserCog, color: 'from-slate-900 via-blue-950 to-slate-900' }
    : isDeptHead
    ? { label: 'Department Head View', icon: Briefcase, color: 'from-slate-900 via-amber-950 to-slate-900' }
    : { label: 'Employee Work View', icon: CheckSquare, color: 'from-slate-800 via-slate-900 to-slate-800' };

  const RoleIcon = roleConfig.icon;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">

      {/* Welcome Banner */}
      <div className={`p-5 sm:p-6 bg-gradient-to-r ${roleConfig.color} rounded-3xl text-white shadow-lg`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-white/60 uppercase tracking-wider mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>Liberation War Museum • {roleConfig.label}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Welcome back, {user?.name.en}
              <span className="text-sm font-normal text-white/60 ml-2 font-sans">
                ({user?.name.bn})
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-white/70 mt-1">
              {user?.designation.en} {department ? `• ${department.name.en} (${department.code})` : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Staff and Dept Head can make requests */}
            {!isTrustee && (
              <button
                type="button"
                onClick={onOpenCreateRequest}
                className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/20 flex items-center gap-1.5 transition-colors"
              >
                <GitPullRequest className="w-4 h-4" />
                <span>{isStaff ? 'Request to Dept Head' : isDeptHead || isCEO ? 'Request Work / Event' : 'Request Work'}</span>
              </button>
            )}

            {/* Everyone can create/assign tasks */}
            <button
              type="button"
              onClick={onOpenCreateTask}
              className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-white text-slate-900 hover:bg-white/90 shadow-sm flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>{isStaff ? 'Assign Task to Peer' : 'Assign Task'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── TRUSTEE DASHBOARD ─── */}
      {isTrustee && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Employees" value={stats.totalEmployees || analytics?.totalUsers || 0} icon={Users}
              sublabel="All active staff across museum" color="blue" onClick={() => onNavigateTab('employees')} />
            <StatCard label="Departments" value={stats.totalDepts || 8} icon={Building2}
              sublabel="Operational divisions" color="emerald" onClick={() => onNavigateTab('departments')} />
            <StatCard label="Pending Approvals" value={pendingApprovals.length} icon={CheckCheck}
              sublabel="Awaiting your decision" color="amber" onClick={() => onNavigateTab('approvals')} />
            <StatCard label="Overdue Tasks" value={stats.overdueTasks || 0} icon={AlertCircle}
              sublabel="Requires urgent attention" color="red" onClick={() => onNavigateTab('all-tasks', { overdueOnly: true })} />
          </div>

          {pendingApprovals.length > 0 && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 flex items-center justify-center shrink-0">
                  <CheckCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-bold text-amber-950 dark:text-amber-200">
                    {pendingApprovals.length} approval request{pendingApprovals.length > 1 ? 's' : ''} awaiting Trustee Board decision
                  </div>
                  <div className="text-xs text-amber-700 dark:text-amber-400">
                    Latest: "{pendingApprovals[0]?.title}" from {pendingApprovals[0]?.requester?.name?.en}
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => onNavigateTab('approvals')}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1 shrink-0">
                Review Now <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </>
      )}

      {/* ─── CEO DASHBOARD ─── */}
      {isCEO && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Active Tasks" value={stats.activeTasks || 0} icon={CheckSquare}
              sublabel="Museum-wide in progress" color="blue" onClick={() => onNavigateTab('all-tasks', { status: 'IN_PROGRESS' })} />
            <StatCard label="Overdue Directives" value={stats.overdueTasks || 0} icon={AlertCircle}
              sublabel="Past deadline" color="red" onClick={() => onNavigateTab('all-tasks', { overdueOnly: true })} />
            <StatCard label="Pending Approvals" value={pendingApprovals.length} icon={CheckCheck}
              sublabel="Dept Heads awaiting your review" color="amber" onClick={() => onNavigateTab('approvals')} />
            <StatCard label="Active Projects" value={stats.activeProjects || 0} icon={FolderKanban}
              sublabel="Strategic initiatives" color="emerald" onClick={() => onNavigateTab('projects')} />
          </div>

          {pendingApprovals.length > 0 && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 flex items-center justify-center shrink-0">
                  <CheckCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-bold text-amber-950 dark:text-amber-200">
                    {pendingApprovals.length} approval request{pendingApprovals.length > 1 ? 's' : ''} from Department Heads
                  </div>
                  <div className="text-xs text-amber-700 dark:text-amber-400">
                    Latest: "{pendingApprovals[0]?.title}"
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => onNavigateTab('approvals')}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1 shrink-0">
                Review <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </>
      )}

      {/* ─── DEPT HEAD DASHBOARD ─── */}
      {isDeptHead && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Dept Active Tasks" value={stats.activeTasks || 0} icon={CheckSquare}
              sublabel={`In ${department?.code || 'your'} department`} color="blue"
              onClick={() => onNavigateTab('all-tasks', { departmentId: normalizedDepartmentId })} />
            <StatCard label="Dept Overdue" value={stats.overdueTasks || 0} icon={AlertCircle}
              sublabel="Past deadline in your dept" color="red" onClick={() => onNavigateTab('all-tasks', { overdueOnly: true })} />
            <StatCard label="Pending Approvals" value={pendingApprovals.length} icon={CheckCheck}
              sublabel="Staff requests for your review" color="amber" onClick={() => onNavigateTab('approvals')} />
            <StatCard label="Pending Requests" value={incomingRequests.length} icon={GitPullRequest}
              sublabel="Cross-dept work requests" color="purple" onClick={() => onNavigateTab('requests')} />
          </div>

          {pendingApprovals.length > 0 && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 flex items-center justify-center shrink-0">
                  <CheckCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-bold text-amber-950 dark:text-amber-200">
                    {pendingApprovals.length} staff request{pendingApprovals.length > 1 ? 's' : ''} need your decision
                  </div>
                  <div className="text-xs text-amber-700 dark:text-amber-400">
                    You can approve or refer to CEO
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => onNavigateTab('approvals')}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1 shrink-0">
                Review <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </>
      )}

      {/* ─── STAFF DASHBOARD ─── */}
      {isStaff && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="My Active Tasks" value={recentTasks.filter(t => t.status === 'IN_PROGRESS' || t.status === 'TODO').length}
              icon={CheckSquare} sublabel="Currently assigned to you" color="blue"
              onClick={() => onNavigateTab('my-tasks')} />
            <StatCard label="Due Today" value={recentTasks.filter(t => t.dueDate === new Date().toISOString().split('T')[0]).length}
              icon={Clock} sublabel="Complete before EOD" color="amber"
              onClick={() => onNavigateTab('my-tasks')} />
            <StatCard label="Completed" value={recentTasks.filter(t => t.status === 'COMPLETED').length}
              icon={CheckSquare} sublabel="Total finished tasks" color="emerald"
              onClick={() => onNavigateTab('my-tasks')} />
            <StatCard label="My Submissions" value={pendingApprovals.filter(a => a.status === 'PENDING').length}
              icon={CheckCheck} sublabel="Pending dept head decision" color="purple"
              onClick={() => onNavigateTab('approvals')} />
          </div>

          {/* Pending approval submissions banner */}
          {pendingApprovals.filter(a => a.status === 'PENDING').length > 0 && (
            <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-2xl border border-purple-200 dark:border-purple-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300 flex items-center justify-center shrink-0">
                  <CheckCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-bold text-purple-950 dark:text-purple-200">
                    {pendingApprovals.filter(a => a.status === 'PENDING').length} of your approval request{pendingApprovals.filter(a => a.status === 'PENDING').length > 1 ? 's are' : ' is'} awaiting Dept Head decision
                  </div>
                  <div className="text-xs text-purple-700 dark:text-purple-400">
                    Latest: "{pendingApprovals[0]?.title}"
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => onNavigateTab('approvals')}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1 shrink-0">
                Track Status <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </>
      )}

      {/* Dept Workload — visible to non-staff */}
      {!isStaff && analytics?.departmentWorkload && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {isDeptHead ? `${department?.name?.en || 'Department'} Workload Summary` : 'Department Workload Overview'}
                </h3>
                <p className="text-xs text-slate-500">
                  {isDeptHead ? `Live task volume for ${department?.name?.en || 'your department'}` : 'Live task volume across all operational divisions'}
                </p>
              </div>
              <button type="button" onClick={() => onNavigateTab(isDeptHead ? 'reports' : 'departments')}
                className="text-xs text-red-700 dark:text-red-400 font-semibold hover:underline">
                {isDeptHead ? 'Task Reports →' : 'View Depts →'}
              </button>
            </div>
            <div className="space-y-3">
              {analytics.departmentWorkload
                .filter((dw: any) => {
                  if (!isDeptHead) return true;
                  const userDeptCode = department?.code?.toUpperCase();
                  const userDeptId = normalizedDepartmentId;
                  const dwCode = dw.code?.toUpperCase();
                  return (
                    dw.departmentId === userDeptId ||
                    (userDeptCode && dwCode === userDeptCode) ||
                    (department?._id && dw.departmentId === department._id) ||
                    (userDeptCode === 'FIN' && dwCode === 'FINANCE') ||
                    (userDeptCode === 'FINANCE' && dwCode === 'FIN')
                  );
                })
                .map((dw: any) => (
                <div key={dw.departmentId} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300 w-12">[{dw.code}]</span>
                      <span className="font-medium text-slate-900 dark:text-slate-100">{dw.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-500">
                      <span>{dw.active} active</span>
                      {dw.overdue > 0 && <span className="text-red-600 font-semibold">{dw.overdue} overdue</span>}
                      <span className="font-bold text-slate-700 dark:text-slate-300">{dw.total} total</span>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                    <div className="bg-blue-500 h-full" style={{ width: `${dw.total > 0 ? (dw.active / dw.total) * 100 : 0}%` }} />
                    <div className="bg-red-500 h-full" style={{ width: `${dw.total > 0 ? (dw.overdue / dw.total) * 100 : 0}%` }} />
                    <div className="bg-emerald-500 h-full" style={{ width: `${dw.total > 0 ? (dw.completed / dw.total) * 100 : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500"><div className="w-2.5 h-2.5 rounded-full bg-blue-500" />Active</div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500"><div className="w-2.5 h-2.5 rounded-full bg-red-500" />Overdue</div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />Completed</div>
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">Workflow Status</h3>
            <p className="text-xs text-slate-500 mb-4">Real-time pipeline</p>
            <div className="space-y-2.5">
              {analytics?.statusDistribution?.map((item: any) => (
                <div key={item.name}
                  onClick={() => onNavigateTab('all-tasks', { status: item.name.replace(' ', '_') })}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors border border-slate-100 dark:border-slate-800"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{item.name}</span>
                  </div>
                  <span className="text-xs font-bold font-mono text-slate-900 dark:text-slate-100">{item.count}</span>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => onNavigateTab('board')}
              className="w-full mt-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              Open Kanban Board →
            </button>
          </div>
        </div>
      )}

      {/* Cross-dept requests banner — for non-staff */}
      {!isStaff && incomingRequests.length > 0 && (
        <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-2xl border border-blue-200 dark:border-blue-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 flex items-center justify-center shrink-0">
              <GitPullRequest className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-bold text-blue-950 dark:text-blue-200">
                {incomingRequests.length} cross-department work request{incomingRequests.length > 1 ? 's' : ''} pending
              </div>
              <div className="text-xs text-blue-700 dark:text-blue-400">
                Latest: "{incomingRequests[0].title}" from {incomingRequests[0].requester?.name?.en}
              </div>
            </div>
          </div>
          <button type="button" onClick={() => onNavigateTab('requests')}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1 shrink-0">
            Review <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Recent tasks */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            {isStaff ? 'My Recent Tasks' : isDeptHead ? `${department?.name?.en || 'Department'} Recent Tasks` : 'Recent Work Directives'}
          </h2>
          <button type="button" onClick={() => onNavigateTab(isStaff ? 'my-tasks' : 'all-tasks')}
            className="text-xs text-red-700 dark:text-red-400 font-semibold hover:underline">
            View All →
          </button>
        </div>
        <TaskTable tasks={recentTasks} loading={loading} onSelectTask={onOpenTaskDetail} showFilters={false} />
      </div>

    </div>
  );
};
