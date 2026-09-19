import React, { useState } from 'react';
import { Task } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { PriorityBadge } from '../common/PriorityBadge';
import { UserAvatar } from '../common/UserAvatar';
import { 
  Calendar, CheckCircle2, Copy, Search, Filter, 
  ArrowUpDown, ChevronLeft, ChevronRight, ArrowRight 
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
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
      
      {/* Table Header & Controls */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {title && (
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
              {title}
            </h3>
            {total !== undefined && (
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {total}
              </span>
            )}
          </div>
        )}

        {showFilters && (
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            {/* Search */}
            <div className="relative flex-1 sm:w-48 min-w-[150px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Filter tasks..."
                className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none"
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
              className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none"
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

      {/* Table Element */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              <th className="py-3 px-4">Task ID</th>
              <th className="py-3 px-4 min-w-[240px]">Task & Description</th>
              <th className="py-3 px-4">Department / Synergy</th>
              <th className="py-3 px-4">Assigned To</th>
              <th className="py-3 px-4">Priority</th>
              <th className="py-3 px-4">Due Date</th>
              <th className="py-3 px-4 min-w-[120px]">Progress</th>
              <th className="py-3 px-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
            {loading ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400">
                  Loading tasks...
                </td>
              </tr>
            ) : filteredTasks.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400">
                  No matching tasks found.
                </td>
              </tr>
            ) : (
              filteredTasks.map(task => (
                <tr
                  key={task._id}
                  onClick={() => onSelectTask(task._id)}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                >
                  {/* ID */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={e => handleCopy(e, task.taskId)}
                      className="inline-flex items-center gap-1 font-mono font-bold text-slate-700 dark:text-slate-300 hover:text-red-700 dark:hover:text-red-400 group"
                      title="Copy Task ID"
                    >
                      <span>{task.taskId}</span>
                      {copiedId === task.taskId ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </button>
                  </td>

                  {/* Title */}
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900 dark:text-slate-100 line-clamp-1">
                      {task.title}
                    </div>
                    {task.project && (
                      <div className="text-[11px] text-blue-600 dark:text-blue-400 line-clamp-1 mt-0.5">
                        📁 {task.project.name}
                      </div>
                    )}
                  </td>

                  {/* Department Synergy */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    {task.sourceDepartment && task.targetDepartment ? (
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{task.sourceDepartment.code}</span>
                        <ArrowRight className="w-3 h-3 text-red-500" />
                        <span className="font-bold text-red-800 dark:text-red-300">{task.targetDepartment.code}</span>
                      </div>
                    ) : (
                      <span className="font-medium text-slate-600 dark:text-slate-400">
                        {task.department?.code || 'ADMIN'}
                      </span>
                    )}
                  </td>

                  {/* Assignee */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    {task.assignees && task.assignees.length > 0 ? (
                      <div className="flex items-center gap-2">
                        <UserAvatar name={task.assignees[0].name} role={task.assignees[0].role} size="sm" />
                        <span className="text-slate-800 dark:text-slate-200 font-medium truncate max-w-[120px]">
                          {task.assignees[0].name.en}
                        </span>
                        {task.assignees.length > 1 && (
                          <span className="text-[10px] px-1 bg-slate-200 dark:bg-slate-700 rounded-full font-bold">
                            +{task.assignees.length - 1}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400 text-xs">Unassigned</span>
                    )}
                  </td>

                  {/* Priority */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <PriorityBadge priority={task.priority} />
                  </td>

                  {/* Due Date */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{task.dueDate}</span>
                    </div>
                  </td>

                  {/* Progress */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            task.progress === 100 
                              ? 'bg-emerald-600' 
                              : task.progress > 50 
                                ? 'bg-blue-600' 
                                : 'bg-red-700'
                          }`}
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-mono font-medium text-slate-500 w-8 text-right">
                        {task.progress}%
                      </span>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <StatusBadge status={task.status} isOverdue={task.isOverdue} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <div>
            Page {page} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange?.(page - 1)}
              className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPageChange?.(page + 1)}
              className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
