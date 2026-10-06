import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { NavigationTab } from './types';

// Pages
import { DashboardPage } from './pages/DashboardPage';
import { TasksPage } from './pages/TasksPage';
import { TaskRequestsPage } from './pages/TaskRequestsPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { InteractiveOrganogram } from './components/organogram/InteractiveOrganogram';
import { DepartmentsPage } from './pages/DepartmentsPage';
import { EmployeesPage } from './pages/EmployeesPage';
import { ApprovalsPage } from './pages/ApprovalsPage';
import { ReportsPage } from './pages/ReportsPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { EventsPage } from './pages/EventsPage';
import { AnnouncementsPage } from './pages/AnnouncementsPage';
import { PerformancePage } from './pages/PerformancePage';
import { ActivityLogsPage } from './pages/ActivityLogsPage';
import { CalendarPage } from './pages/CalendarPage';
import { LoginPage } from './pages/LoginPage';
import { MessagingPage } from './pages/MessagingPage';



// Global Task Modals
import { TaskDetailModal } from './components/tasks/TaskDetailModal';
import { CreateTaskModal } from './components/tasks/CreateTaskModal';
import { TaskRequestModal } from './components/tasks/TaskRequestModal';
import { ProfileDrawer } from './components/layout/ProfileDrawer';
import { ErrorBoundary } from './components/common/ErrorBoundary';

function MainApp() {
  const { user, loading } = useAuth();

  const [currentTab, setCurrentTab] = useState<NavigationTab>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Global Modals State
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [isCreateRequestOpen, setIsCreateRequestOpen] = useState(false);
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);
  const [prefilledProjectId, setPrefilledProjectId] = useState<string | undefined>(undefined);
  const [prefilledAssigneeId, setPrefilledAssigneeId] = useState<string | undefined>(undefined);
  const [taskFilters, setTaskFilters] = useState<any>({});
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 rounded-2xl overflow-hidden animate-pulse mb-3 shadow-lg">
          <img src="/logo.jpeg" alt="Liberation War Museum Logo" className="w-full h-full object-contain" />
        </div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
          Loading Liberation War Museum Portal...
        </p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const navigateToTabWithFilter = (tab: NavigationTab, filters: any = {}) => {
    setTaskFilters(filters);
    setCurrentTab(tab);
  };

  const handleOpenCreateTaskForProject = (projectId: string) => {
    setPrefilledProjectId(projectId);
    setIsCreateTaskOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col antialiased">
      
      {/* Top Header */}
      <Header
        onOpenTaskDetail={setActiveTaskId}
        onOpenCreateTask={() => {
          setPrefilledProjectId(undefined);
          setPrefilledAssigneeId(undefined);
          setIsCreateTaskOpen(true);
        }}
        onOpenTaskRequest={() => setIsCreateRequestOpen(true)}
        onOpenProfileDrawer={() => setIsProfileDrawerOpen(true)}
        onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
      />



      <div className="flex-1 flex overflow-hidden">
        {/* Left Navigation Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={tab => {
            setTaskFilters({});
            setCurrentTab(tab);
          }}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          
          {currentTab === 'dashboard' && (
            <DashboardPage
              onOpenTaskDetail={setActiveTaskId}
              onNavigateTab={navigateToTabWithFilter}
              onOpenCreateTask={() => {
                setPrefilledProjectId(undefined);
                setIsCreateTaskOpen(true);
              }}
              onOpenCreateRequest={() => setIsCreateRequestOpen(true)}
              refreshKey={dashboardRefreshKey}
            />
          )}

          {currentTab === 'my-tasks' && (
            <TasksPage
              mode="my"
              initialFilters={taskFilters}
              onOpenTaskDetail={setActiveTaskId}
              onOpenCreateTask={() => {
                setPrefilledProjectId(undefined);
                setIsCreateTaskOpen(true);
              }}
              onOpenCreateRequest={() => setIsCreateRequestOpen(true)}
            />
          )}

          {currentTab === 'all-tasks' && (
            <TasksPage
              mode="all"
              initialFilters={taskFilters}
              onOpenTaskDetail={setActiveTaskId}
              onOpenCreateTask={() => {
                setPrefilledProjectId(undefined);
                setIsCreateTaskOpen(true);
              }}
              onOpenCreateRequest={() => setIsCreateRequestOpen(true)}
            />
          )}

          {currentTab === 'board' && (
            <TasksPage
              mode="all"
              initialFilters={taskFilters}
              onOpenTaskDetail={setActiveTaskId}
              onOpenCreateTask={() => {
                setPrefilledProjectId(undefined);
                setIsCreateTaskOpen(true);
              }}
              onOpenCreateRequest={() => setIsCreateRequestOpen(true)}
            />
          )}

          {currentTab === 'requests' && (
            <TaskRequestsPage
              onOpenCreateRequest={() => setIsCreateRequestOpen(true)}
              onOpenTaskDetail={setActiveTaskId}
            />
          )}

          {currentTab === 'calendar' && (
            <CalendarPage
              onOpenTaskDetail={setActiveTaskId}
            />
          )}

          {currentTab === 'projects' && (
            <ProjectsPage
              onOpenTaskDetail={setActiveTaskId}
              onOpenCreateTaskForProject={handleOpenCreateTaskForProject}
            />
          )}

          {currentTab === 'organogram' && (user?.role === 'TRUSTEE' || user?.role === 'CEO') && (
            <InteractiveOrganogram
              onSelectEmployee={userId => {
                // Navigate to employees tab or open task for employee
                setCurrentTab('employees');
              }}
              onSelectDepartment={deptId => {
                navigateToTabWithFilter('all-tasks', { departmentId: deptId });
              }}
            />
          )}

          {currentTab === 'departments' && (
            <DepartmentsPage
              onSelectEmployee={() => setCurrentTab('employees')}
              onNavigateTasksForDept={deptId => {
                navigateToTabWithFilter('all-tasks', { departmentId: deptId });
              }}
            />
          )}

          {currentTab === 'employees' && (
            <EmployeesPage
              onOpenTaskDetail={setActiveTaskId}
              onRequestWorkFromUser={targetUser => {
                setPrefilledAssigneeId(targetUser._id);
                setIsCreateTaskOpen(true);
              }}
            />
          )}

          {currentTab === 'approvals' && (
            <ApprovalsPage />
          )}

          {currentTab === 'reports' && (
            <ReportsPage
              onNavigateTasks={filters => navigateToTabWithFilter('all-tasks', filters)}
            />
          )}

          {currentTab === 'documents' && (
            <DocumentsPage />
          )}

          {currentTab === 'events' && (
            <EventsPage />
          )}

          {currentTab === 'announcements' && (
            <AnnouncementsPage />
          )}

          {currentTab === 'performance' && (
            <PerformancePage />
          )}

          {currentTab === 'activity-logs' && user?.role === 'SUPER_ADMIN' && (
            <ActivityLogsPage />
          )}

          {currentTab === 'messages' && (
            <MessagingPage />
          )}

        </main>
      </div>

      {/* Global Modals */}
      <TaskDetailModal
        taskId={activeTaskId}
        onClose={() => setActiveTaskId(null)}
      />

      <CreateTaskModal
        isOpen={isCreateTaskOpen}
        onClose={() => {
          setIsCreateTaskOpen(false);
          setPrefilledProjectId(undefined);
          setPrefilledAssigneeId(undefined);
        }}
        onTaskCreated={(newTask) => {
          setIsCreateTaskOpen(false);
          setPrefilledProjectId(undefined);
          setPrefilledAssigneeId(undefined);
          setDashboardRefreshKey(k => k + 1);
          if (newTask?._id) {
            setActiveTaskId(newTask._id);
          }
        }}
        onRequestCreated={(newRequest) => {
          setIsCreateTaskOpen(false);
          setPrefilledProjectId(undefined);
          setPrefilledAssigneeId(undefined);
          setDashboardRefreshKey(k => k + 1);
          if (newRequest?._id) {
            setCurrentTab('requests');
          }
        }}
        prefilledProjectId={prefilledProjectId}
        prefilledAssigneeId={prefilledAssigneeId}
      />

      <TaskRequestModal
        isOpen={isCreateRequestOpen}
        onClose={() => setIsCreateRequestOpen(false)}
        onRequestCreated={() => {
          setDashboardRefreshKey(k => k + 1);
          setCurrentTab('requests');
        }}
      />

      <ProfileDrawer
        isOpen={isProfileDrawerOpen}
        onClose={() => setIsProfileDrawerOpen(false)}
      />

    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ErrorBoundary>
  );
}
