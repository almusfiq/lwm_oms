import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { getUserRole, isDepartmentHead } from '../../utils/hierarchy';
import {
  LayoutDashboard, CheckSquare, ListTodo, GitPullRequest,
  Kanban, Calendar, FolderKanban, Network, Building2,
  Users, CheckCheck, BarChart3, FileText, Megaphone,
  CalendarDays, X, TrendingUp, UserCog, ShieldAlert, Send, MessageSquare
} from 'lucide-react';

export type NavTab =
  | 'dashboard'
  | 'my-tasks'
  | 'all-tasks'
  | 'requests'
  | 'board'
  | 'calendar'
  | 'projects'
  | 'organogram'
  | 'departments'
  | 'employees'
  | 'approvals'
  | 'reports'
  | 'documents'
  | 'announcements'
  | 'events'
  | 'performance'
  | 'activity-logs'
  | 'messages';



interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  isMobileOpen?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  mobileOpen = false,
  isMobileOpen = false,
  onCloseMobile
}) => {
  const { user, pendingRequests } = useAuth();

  const isOpen = mobileOpen || isMobileOpen;

  const handleNavClick = (tab: NavTab) => {
    onSelectTab(tab);
    onCloseMobile?.();
  };

  const role = getUserRole(user);
  const isTrustee = role === 'TRUSTEE';
  const isCEO = role === 'CEO';
  const isDeptHead = isDepartmentHead(user);
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const isStaff = !isTrustee && !isCEO && !isDeptHead && !isSuperAdmin;

  const navItemClass = (tab: NavTab) => {
    const isActive = currentTab === tab;
    return `w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${
      isActive
        ? 'bg-red-800 text-white shadow-xs font-semibold'
        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-slate-200'
    }`;
  };

  const NavBtn = ({
    tab, icon: Icon, label, badge
  }: { tab: NavTab; icon: any; label: string; badge?: number }) => (
    <button type="button" onClick={() => handleNavClick(tab)} className={navItemClass(tab)}>
      <div className="flex items-center gap-2.5">
        <Icon className="w-4 h-4 shrink-0" />
        <span>{label}</span>
      </div>
      {badge && badge > 0 ? (
        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
          currentTab === tab ? 'bg-white text-red-800' : 'bg-red-600 text-white'
        }`}>
          {badge}
        </span>
      ) : null}
    </button>
  );

  const SectionLabel = ({ label }: { label: string }) => (
    <div className="px-3 pt-1 text-[11px] font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase">
      {label}
    </div>
  );

  const content = (
    <div className="h-full flex flex-col justify-between py-4 px-3 overflow-y-auto">
      <div className="space-y-5">

        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 px-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-white dark:bg-slate-900 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-800">
              <img src="/logo.jpeg" alt="Liberation War Museum Logo" className="w-full h-full object-cover" />
            </div>
            <span className="font-bold text-sm text-slate-900 dark:text-slate-100">Liberation War Museum</span>
          </div>
          <button type="button" onClick={onCloseMobile} className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dashboard — everyone */}
        <div>
          <NavBtn tab="dashboard" icon={LayoutDashboard} label="Dashboard" />
        </div>

        {/* Work & Tasks — hidden for Super Admin (they manage system, not tasks) */}
        {!isSuperAdmin && (
        <div className="space-y-1">
          <SectionLabel label="Work & Tasks" />

          {/* My Tasks — everyone sees their own tasks */}
          <NavBtn tab="my-tasks" icon={CheckSquare} label="My Tasks" />

          {/* All Tasks — only for non-staff roles */}
          {!isStaff && (
            <NavBtn tab="all-tasks" icon={ListTodo} label="All Tasks" />
          )}

          {/* Task Requests — everyone (staff uses this to request from dept head) */}
          <NavBtn tab="requests" icon={GitPullRequest} label={isStaff ? 'Work Requests' : 'Task Requests'} badge={pendingRequests} />

          {/* Kanban Board — for non-staff */}
          {!isStaff && (
            <NavBtn tab="board" icon={Kanban} label="Kanban Board" />
          )}

          {/* Calendar — for everyone */}
          <NavBtn tab="calendar" icon={Calendar} label="Calendar" />

          {/* Projects — Trustee, CEO, Dept Head */}
          {!isStaff && (
            <NavBtn tab="projects" icon={FolderKanban} label="Projects" />
          )}
        </div>
        )}

        {/* Organization — not for staff or Super Admin */}
        {!isStaff && !isSuperAdmin && (
          <div className="space-y-1">
            <SectionLabel label="Organization" />

            {(isTrustee || isCEO) && (
              <NavBtn tab="organogram" icon={Network} label="Organogram" />
            )}

            <NavBtn tab="departments" icon={Building2} label="Departments" />
            <NavBtn tab="employees" icon={Users} label={isTrustee || isCEO ? 'Personnel & Management' : 'Team Roster'} />
          </div>
        )}

        {/* Governance */}
        <div className="space-y-1">
          <SectionLabel label="Governance" />

          {/* Approvals — everyone but with different labels; hidden for Super Admin */}
          {isSuperAdmin ? null : !isStaff ? (
            <NavBtn tab="approvals" icon={CheckCheck} label="Approvals Engine" />
          ) : (
            // Staff: can submit approval requests (goes to dept head)
            <NavBtn tab="approvals" icon={Send} label="Submit Request" />
          )}

          {/* Performance — Trustee, CEO, Dept Head ONLY (staff and super admin cannot see) */}
          {!isStaff && !isSuperAdmin && (
            <NavBtn tab="performance" icon={TrendingUp} label="Performance Scores" />
          )}

          {!isSuperAdmin && (
            <NavBtn
              tab="reports"
              icon={BarChart3}
              label={isStaff ? 'My Work Report' : isDeptHead ? 'Dept Task Reports' : 'Reports & Analytics'}
            />
          )}

          {user?.role === 'SUPER_ADMIN' && (
            <NavBtn tab="activity-logs" icon={ShieldAlert} label="Activity Logs" />
          )}
        </div>

        {/* Communication — everyone except Super Admin */}
        {!isSuperAdmin && (
        <div className="space-y-1">
          <SectionLabel label="Communication" />
          <NavBtn tab="documents" icon={FileText} label="Documents" />
          <NavBtn tab="announcements" icon={Megaphone} label="Announcements" />
          <NavBtn tab="events" icon={CalendarDays} label="Museum Events" />
          {/* Direct Messaging — for CEO, Trustee, Dept Head to send; all to receive */}
          <NavBtn tab="messages" icon={MessageSquare} label="Messages" />
        </div>
        )}



      </div>

      {/* Role badge footer */}
      <div className="pt-4 mt-6 border-t border-slate-200/80 dark:border-slate-800 px-3">
        <div className="flex items-center gap-2 mb-1">
          {isTrustee && <ShieldAlert className="w-3.5 h-3.5 text-red-700" />}
          {isCEO && <UserCog className="w-3.5 h-3.5 text-blue-700" />}
          {isDeptHead && <Building2 className="w-3.5 h-3.5 text-amber-700" />}
          {isStaff && <Users className="w-3.5 h-3.5 text-slate-500" />}
          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
            {role.replace(/_/g, ' ')}
          </span>
        </div>
        <div className="text-[10px] text-slate-400 truncate">{user?.name?.en}</div>
        <div className="text-[10px] text-slate-400">Liberation War Museum</div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden md:block w-64 lg:w-72 bg-slate-50/60 dark:bg-slate-900/60 border-r border-slate-200/80 dark:border-slate-800 shrink-0 select-none">
        {content}
      </aside>

      {isOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={onCloseMobile} />
          <div className="relative w-4/5 max-w-xs bg-white dark:bg-slate-900 shadow-2xl h-full">
            {content}
          </div>
        </div>
      )}
    </>
  );
};
