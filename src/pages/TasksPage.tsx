import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { TaskTable } from '../components/tasks/TaskTable';
import { KanbanBoard } from '../components/tasks/KanbanBoard';
import { Task, TaskPriority, TaskStatus } from '../types';
import { 
  List, Kanban, Calendar as CalendarIcon, Plus, 
  GitPullRequest, Filter, Search, CheckCircle2, Clock 
} from 'lucide-react';

interface TaskFilterParams {
  status?: string;
  priority?: string;
  departmentId?: string;
  sourceDepartmentId?: string;
  targetDepartmentId?: string;
  overdueOnly?: boolean;
  search?: string;
}

interface TasksPageProps {
  mode: 'all' | 'my';
  initialView?: 'table' | 'board' | 'calendar';
  initialFilters?: TaskFilterParams;
  onOpenTaskDetail: (taskId: string) => void;
  onOpenCreateTask: () => void;
  onOpenCreateRequest: () => void;
}

export const TasksPage: React.FC<TasksPageProps> = ({
  mode,
  initialView = 'table',
  initialFilters,
  onOpenTaskDetail,
  onOpenCreateTask,
  onOpenCreateRequest
}) => {
  const { user } = useAuth();
  const filters: TaskFilterParams = initialFilters || {};

  const [view, setView] = useState<'table' | 'board' | 'calendar'>(initialView);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Sync initialView if prop changes
  useEffect(() => {
    if (initialView) {
      setView(initialView);
    }
  }, [initialView]);

  // Filters
  const [status, setStatus] = useState<string>(filters.status || '');
  const [priority, setPriority] = useState<string>(filters.priority || '');
  const [departmentId, setDepartmentId] = useState<string>(filters.departmentId || '');
  const [overdueOnly, setOverdueOnly] = useState<boolean>(filters.overdueOnly || false);
  const [search, setSearch] = useState<string>(filters.search || '');

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const params: any = {
        page,
        limit: view === 'board' ? 60 : 20,
        status: status || undefined,
        priority: priority || undefined,
        department: departmentId || undefined,
        departmentId: departmentId || undefined,
        overdueOnly: overdueOnly || undefined,
        search: search || undefined
      };

      if (mode === 'my' && user) {
        params.myTasks = 'true';
      }

      const res = await api.tasks.list(params);
      setTasks(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [mode, view, page, status, priority, departmentId, overdueOnly, search, user?._id]);

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      
      {/* Top Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>{mode === 'my' ? 'My Assigned Directives' : 'Organization-Wide Work Management'}</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border border-red-200/80 dark:border-red-900/50 shadow-2xs">
              {total} {total === 1 ? 'Directive' : 'Directives'}
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {mode === 'my'
              ? `Tasks and responsibilities assigned directly to ${user?.name.en}`
              : 'Complete repository of active, archived, and cross-department directives'}
          </p>
        </div>

        {/* View Switcher & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* View Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/90 dark:border-slate-700 shadow-2xs">
            <button
              type="button"
              onClick={() => setView('table')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                view === 'table'
                  ? 'bg-red-800 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => setView('board')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                view === 'board'
                  ? 'bg-red-800 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>Board</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onOpenCreateTask}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-800 hover:bg-red-900 text-white shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search directives, ID (TASK-00001), keywords..."
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl placeholder-slate-400 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-700/30 focus:border-red-600 transition-all shadow-2xs"
          />
        </div>

        {/* Status */}
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-red-700/30 hover:border-slate-300 dark:hover:border-slate-600 transition-all shadow-2xs cursor-pointer"
        >
          <option value="">All Statuses</option>
          <option value="TODO">To Do</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="IN_REVIEW">In Review</option>
          <option value="COMPLETED">Completed</option>
          <option value="ON_HOLD">On Hold</option>
          <option value="CANCELLED">Cancelled</option>
        </select>

        {/* Priority */}
        <select
          value={priority}
          onChange={e => setPriority(e.target.value)}
          className="px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-red-700/30 hover:border-slate-300 dark:hover:border-slate-600 transition-all shadow-2xs cursor-pointer"
        >
          <option value="">All Priorities</option>
          <option value="URGENT">Urgent</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>

        {/* Overdue Checkbox */}
        <label className="flex items-center gap-2 text-xs font-bold text-red-700 dark:text-red-400 cursor-pointer select-none px-3 py-2 rounded-xl bg-red-50/80 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 shadow-2xs transition-colors hover:bg-red-100/70">
          <input
            type="checkbox"
            checked={overdueOnly}
            onChange={e => setOverdueOnly(e.target.checked)}
            className="accent-red-600 w-3.5 h-3.5 rounded cursor-pointer"
          />
          <span>Overdue Only</span>
        </label>

        {(status || priority || departmentId || overdueOnly || search) && (
          <button
            type="button"
            onClick={() => {
              setStatus('');
              setPriority('');
              setDepartmentId('');
              setOverdueOnly(false);
              setSearch('');
            }}
            className="text-xs text-red-700 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 font-bold ml-auto flex items-center gap-1 transition-colors"
          >
            <span>Clear Filters</span>
          </button>
        )}
      </div>

      {/* Main View Area */}
      {view === 'table' ? (
        <TaskTable
          tasks={tasks}
          loading={loading}
          total={total}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          onSelectTask={onOpenTaskDetail}
          showFilters={false}
        />
      ) : (
        <KanbanBoard
          tasks={tasks}
          onSelectTask={onOpenTaskDetail}
          onTaskUpdated={fetchTasks}
          onOpenCreateModal={onOpenCreateTask}
        />
      )}

    </div>
  );
};
