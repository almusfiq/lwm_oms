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
  initialFilters?: TaskFilterParams;
  onOpenTaskDetail: (taskId: string) => void;
  onOpenCreateTask: () => void;
  onOpenCreateRequest: () => void;
}

export const TasksPage: React.FC<TasksPageProps> = ({
  mode,
  initialFilters,
  onOpenTaskDetail,
  onOpenCreateTask,
  onOpenCreateRequest
}) => {
  const { user } = useAuth();
  const filters: TaskFilterParams = initialFilters || {};

  const [view, setView] = useState<'table' | 'board' | 'calendar'>('table');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

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
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {mode === 'my' ? 'My Assigned Directives' : 'Organization-Wide Work Management'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {mode === 'my'
              ? `Tasks and responsibilities assigned directly to ${user?.name.en}`
              : 'Complete repository of active, archived, and cross-department directives'}
          </p>
        </div>

        {/* View Switcher & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* View Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setView('table')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                view === 'table'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => setView('board')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                view === 'board'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>Board</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onOpenCreateRequest}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-red-50 text-red-800 border border-red-200 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/40 flex items-center gap-1.5 transition-colors"
          >
            <GitPullRequest className="w-3.5 h-3.5 text-red-600" />
            <span>Request Work</span>
          </button>

          <button
            type="button"
            onClick={onOpenCreateTask}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-800 hover:bg-red-900 text-white shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search directives, ID (TASK-00001), keywords..."
            className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl placeholder-slate-400 text-slate-800 dark:text-slate-100 focus:outline-none"
          />
        </div>

        {/* Status */}
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 focus:outline-none"
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
          className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 focus:outline-none"
        >
          <option value="">All Priorities</option>
          <option value="URGENT">Urgent</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>

        {/* Overdue Checkbox */}
        <label className="flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-400 cursor-pointer select-none px-2.5 py-1.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40">
          <input
            type="checkbox"
            checked={overdueOnly}
            onChange={e => setOverdueOnly(e.target.checked)}
            className="accent-red-600 rounded"
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
            className="text-xs text-slate-500 hover:text-red-600 underline font-medium ml-auto"
          >
            Clear Filters
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
