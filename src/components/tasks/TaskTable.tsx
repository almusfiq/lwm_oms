import React, { useState } from 'react';
import { Task } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { PriorityBadge } from '../common/PriorityBadge';
import { UserAvatar } from '../common/UserAvatar';
import { 
  Calendar, CheckCircle2, Copy, Search, 
  ChevronLeft, ChevronRight, ArrowRight, Hash,
  FileText, Building2, Users, Flag, Activity,
  Clock, AlertTriangle, Folder
} from 'lucide-react';

interface TaskTableProps {
  tasks: Task[];
  loading?: boolean;
  onSelectTask: (taskId: string) => void;
  title?: string;
  total?: number;
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  onFilterChange?: (filters: any) => void;
  showFilters?: boolean;
}

export const TaskTable: React.FC<TaskTableProps> = ({
  tasks,
  loading = false,
  onSelectTask,
  title,
  total,
  page = 1,
  totalPages = 1,
  onPageChange,
  showFilters = true
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  const handleCopy = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isTaskOverdue = (task: Task) => {
    if (task.isOverdue) return true;
    if (!task.dueDate) return false;
    if (task.status === 'COMPLETED' || task.status === 'CANCELLED') return false;
    try {
      const due = new Date(task.dueDate).getTime();
      return !isNaN(due) && due < Date.now();
    } catch {
      return false;
    }
  };

  const filteredTasks = tasks.filter(t => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const match = t.title.toLowerCase().includes(q) || 
                    t.taskId.toLowerCase().includes(q) ||
                    (t.department && t.department.name.en.toLowerCase().includes(q)) ||
                    t.assignees?.some(a => a.name.en.toLowerCase().includes(q));
      if (!match) return false;
    }
    if (statusFilter && t.status !== statusFilter) return false;
    if (priorityFilter && t.priority !== priorityFilter) return false;
    return true;
  });

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden">
      
      {/* Museum Brand Accent Bar */}
      <div className="h-1 bg-gradient-to-r from-red-800 via-red-600 to-amber-600 dark:from-red-700 dark:via-red-600 dark:to-amber-500" />

      {/* Table Header & Controls (if title or standalone filters enabled) */}
      {(title || showFilters) && (
        <div className="p-4 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {title && (
            <div className="flex items-center gap-2.5">
              <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>{title}</span>
              </h3>
              {total !== undefined && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-900/40 shadow-2xs">
                  {total}
                </span>
              )}
            </div>
          )}

          {showFilters && (
            <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
              {/* Search */}
              <div className="relative flex-1 sm:w-52 min-w-[160px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Filter tasks..."
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/30 focus:border-red-600 transition-all"
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-red-700/30"
              >
                <option value="">All Statuses</option>
                <option value="TODO">To Do</option>
                <option value="ACCEPTED">Accepted</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="IN_REVIEW">In Review</option>
                <option value="COMPLETED">Completed</option>
              </select>

              {/* Priority Filter */}
              <select
                value={priorityFilter}
                onChange={e => setPriorityFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-red-700/30"
              >
                <option value="">All Priorities</option>
                <option value="URGENT">Urgent</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
          )}
        </div>
      )}

      {/* Table Element */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gradient-to-r from-slate-100/90 via-slate-50 to-slate-100/90 dark:from-slate-800 dark:via-slate-800/80 dark:to-slate-800 border-b-2 border-slate-200 dark:border-slate-700 select-none">
            <tr className="text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
              <th className="py-3.5 px-4 font-bold">
                <div className="flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-red-700 dark:text-red-400" />
                  <span>Task ID</span>
                </div>
              </th>
              <th className="py-3.5 px-4 min-w-[260px]">
                <div className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span>Task & Directive</span>
                </div>
              </th>
              <th className="py-3.5 px-4">
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span>Department / Synergy</span>
                </div>
              </th>
              <th className="py-3.5 px-4">
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span>Assigned To</span>
                </div>
              </th>
              <th className="py-3.5 px-4">
                <div className="flex items-center gap-1.5">
                  <Flag className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span>Priority</span>
                </div>
              </th>
              <th className="py-3.5 px-4">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span>Due Date</span>
                </div>
              </th>
              <th className="py-3.5 px-4 min-w-[130px]">
                <div className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span>Progress</span>
                </div>
              </th>
              <th className="py-3.5 px-4">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span>Status</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
            {loading ? (
              <tr>
                <td colSpan={8} className="py-16 text-center text-slate-400">
                  <div className="inline-flex items-center gap-2 font-medium">
                    <Clock className="w-4 h-4 animate-spin text-red-700" />
                    <span>Loading directives repository...</span>
                  </div>
                </td>
              </tr>
            ) : filteredTasks.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-16 text-center text-slate-400">
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-600 dark:text-slate-400">No matching directives found.</p>
                    <p className="text-xs text-slate-400">Try adjusting your filters or search terms.</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredTasks.map(task => {
                const overdue = isTaskOverdue(task);

                return (
                  <tr
                    key={task._id}
                    onClick={() => onSelectTask(task._id)}
                    className="border-b border-slate-100 dark:border-slate-800/80 even:bg-slate-50/30 dark:even:bg-slate-850/30 hover:bg-gradient-to-r hover:from-red-50/50 hover:via-slate-50/60 hover:to-transparent dark:hover:from-red-950/25 dark:hover:via-slate-800/40 dark:hover:to-transparent cursor-pointer transition-all duration-150 group relative"
                  >
                    {/* Hover indicator accent bar */}
                    <td className="py-3.5 px-4 whitespace-nowrap relative">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-transparent group-hover:bg-red-700 dark:group-hover:bg-red-500 rounded-r transition-all duration-150" />
                      
                      {/* Task ID pill badge */}
                      <button
                        type="button"
                        onClick={e => handleCopy(e, task.taskId)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono font-bold text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/90 dark:border-slate-700 group-hover:border-red-300 dark:group-hover:border-red-800/70 group-hover:bg-red-50 dark:group-hover:bg-red-950/50 group-hover:text-red-800 dark:group-hover:text-red-300 transition-all shadow-2xs"
                        title="Copy Task ID"
                      >
                        <span className="text-slate-400 group-hover:text-red-600 dark:group-hover:text-red-400 font-sans text-[10px]">#</span>
                        <span>{task.taskId}</span>
                        {copiedId === task.taskId ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 animate-in fade-in" />
                        ) : (
                          <Copy className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </button>
                    </td>

                    {/* Task Title & Project */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-red-900 dark:group-hover:text-red-200 text-sm transition-colors line-clamp-1">
                        {task.title}
                      </div>
                      {task.project && (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/40 mt-1">
                          <Folder className="w-3 h-3 text-blue-500" />
                          <span className="truncate max-w-[200px]">
                            {typeof task.project.name === 'object' ? (task.project.name as any).en : task.project.name}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Department Synergy */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {task.sourceDepartment && task.targetDepartment ? (
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <span className="px-2 py-0.5 rounded-md font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/90 dark:border-slate-700 shadow-2xs">
                            {task.sourceDepartment.code}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-red-600 dark:text-red-400 font-bold shrink-0" />
                          <span className="px-2 py-0.5 rounded-md font-bold bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-900/50 shadow-2xs">
                            {task.targetDepartment.code}
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md font-semibold text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          <span>{task.department?.code || 'ADMIN'}</span>
                        </span>
                      )}
                    </td>

                    {/* Assignee */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {task.assignees && task.assignees.length > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="ring-1 ring-slate-200 dark:ring-slate-700 rounded-full">
                            <UserAvatar name={task.assignees[0].name} role={task.assignees[0].role} size="sm" />
                          </div>
                          <span className="text-slate-800 dark:text-slate-200 font-semibold truncate max-w-[130px]">
                            {task.assignees[0].name.en}
                          </span>
                          {task.assignees.length > 1 && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200/60 dark:border-red-900/40 rounded-full font-bold shadow-2xs">
                              +{task.assignees.length - 1}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Unassigned</span>
                      )}
                    </td>

                    {/* Priority */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <PriorityBadge priority={task.priority} />
                    </td>

                    {/* Due Date */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {overdue ? (
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/40 shadow-2xs">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                          <span>{task.dueDate}</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{task.dueDate}</span>
                        </div>
                      )}
                    </td>

                    {/* Progress */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden p-0.5 border border-slate-200/60 dark:border-slate-700/60">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              task.progress === 100 
                                ? 'bg-gradient-to-r from-emerald-600 to-teal-500 shadow-2xs' 
                                : task.progress > 50 
                                  ? 'bg-gradient-to-r from-blue-600 to-indigo-500 shadow-2xs' 
                                  : 'bg-gradient-to-r from-red-700 to-rose-500 shadow-2xs'
                            }`}
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300 w-9 text-right tabular-nums">
                          {task.progress}%
                        </span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <StatusBadge status={task.status} isOverdue={overdue} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="p-3.5 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
          <div className="font-medium">
            Page <span className="font-bold text-slate-900 dark:text-slate-100">{page}</span> of <span className="font-bold text-slate-900 dark:text-slate-100">{totalPages}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange?.(page - 1)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 transition-colors shadow-2xs"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPageChange?.(page + 1)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 transition-colors shadow-2xs"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
