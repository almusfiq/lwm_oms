import React, { useState } from 'react';
import { Task, TaskStatus } from '../../types';
import { api } from '../../api/client';
import { PriorityBadge } from '../common/PriorityBadge';
import { UserAvatar } from '../common/UserAvatar';
import { 
  Calendar, Plus, MoreHorizontal, ArrowRight, 
  Folder, AlertTriangle, ListTodo, CheckCircle, 
  Clock, Eye, CheckCheck, Hash, Building2
} from 'lucide-react';

interface KanbanBoardProps {
  tasks: Task[];
  onSelectTask: (taskId: string) => void;
  onTaskUpdated: () => void;
  onOpenCreateModal?: () => void;
}

interface ColumnConfig {
  id: TaskStatus;
  title: string;
  icon: React.ElementType;
  topBorder: string;
  headerBg: string;
  badgeBg: string;
  badgeText: string;
  columnBg: string;
}

const COLUMNS: ColumnConfig[] = [
  { 
    id: 'TODO', 
    title: 'To Do', 
    icon: ListTodo,
    topBorder: 'border-t-slate-500', 
    headerBg: 'bg-slate-100/80 dark:bg-slate-800/80',
    badgeBg: 'bg-slate-200 dark:bg-slate-700',
    badgeText: 'text-slate-800 dark:text-slate-200',
    columnBg: 'bg-slate-50/70 dark:bg-slate-900/50' 
  },
  { 
    id: 'ACCEPTED', 
    title: 'Accepted', 
    icon: CheckCircle,
    topBorder: 'border-t-sky-500', 
    headerBg: 'bg-sky-50/90 dark:bg-sky-950/60',
    badgeBg: 'bg-sky-100 dark:bg-sky-900/70',
    badgeText: 'text-sky-900 dark:text-sky-200',
    columnBg: 'bg-sky-50/30 dark:bg-sky-950/20' 
  },
  { 
    id: 'IN_PROGRESS', 
    title: 'In Progress', 
    icon: Clock,
    topBorder: 'border-t-blue-600', 
    headerBg: 'bg-blue-50/90 dark:bg-blue-950/60',
    badgeBg: 'bg-blue-100 dark:bg-blue-900/70',
    badgeText: 'text-blue-900 dark:text-blue-200',
    columnBg: 'bg-blue-50/30 dark:bg-blue-950/20' 
  },
  { 
    id: 'IN_REVIEW', 
    title: 'In Review', 
    icon: Eye,
    topBorder: 'border-t-purple-600', 
    headerBg: 'bg-purple-50/90 dark:bg-purple-950/60',
    badgeBg: 'bg-purple-100 dark:bg-purple-900/70',
    badgeText: 'text-purple-900 dark:text-purple-200',
    columnBg: 'bg-purple-50/30 dark:bg-purple-950/20' 
  },
  { 
    id: 'COMPLETED', 
    title: 'Completed', 
    icon: CheckCheck,
    topBorder: 'border-t-emerald-600', 
    headerBg: 'bg-emerald-50/90 dark:bg-emerald-950/60',
    badgeBg: 'bg-emerald-100 dark:bg-emerald-900/70',
    badgeText: 'text-emerald-900 dark:text-emerald-200',
    columnBg: 'bg-emerald-50/30 dark:bg-emerald-950/20' 
  },
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  tasks,
  onSelectTask,
  onTaskUpdated,
  onOpenCreateModal
}) => {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    setDraggedTaskId(id);
  };

  const handleDragOver = (e: React.DragEvent, colId: TaskStatus) => {
    e.preventDefault();
    if (dragOverCol !== colId) {
      setDragOverCol(colId);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    setDragOverCol(null);
    const id = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (!id) return;

    setDraggedTaskId(null);
    try {
      await api.tasks.updateStatus(id, targetStatus);
      onTaskUpdated();
    } catch (err: any) {
      alert(err.message || 'Failed to update task status');
    }
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

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-210px)] min-h-[550px] select-none">
      {COLUMNS.map(col => {
        const colTasks = tasks.filter(t => t.status === col.id);
        const IconComponent = col.icon;
        const isTargeted = dragOverCol === col.id;

        return (
          <div
            key={col.id}
            onDragOver={e => handleDragOver(e, col.id)}
            onDragLeave={handleDragLeave}
            onDrop={e => handleDrop(e, col.id)}
            className={`w-80 shrink-0 flex flex-col rounded-2xl border-t-4 ${col.topBorder} border-x border-b border-slate-200/90 dark:border-slate-800 ${col.columnBg} shadow-xs overflow-hidden transition-all duration-200 ${
              isTargeted ? 'ring-2 ring-red-500/50 bg-red-50/20 dark:bg-red-950/20' : ''
            }`}
          >
            {/* Column Header */}
            <div className={`p-3.5 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between ${col.headerBg}`}>
              <div className="flex items-center gap-2">
                <IconComponent className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 tracking-tight">
                  {col.title}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${col.badgeBg} ${col.badgeText} border border-black/5 dark:border-white/10 shadow-2xs`}>
                  {colTasks.length}
                </span>
              </div>
              {col.id === 'TODO' && onOpenCreateModal && (
                <button
                  type="button"
                  onClick={onOpenCreateModal}
                  className="p-1 rounded-lg text-slate-500 hover:text-red-700 hover:bg-white/80 dark:hover:bg-slate-800 transition-colors shadow-2xs"
                  title="Quick add directive"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Column Task Cards */}
            <div className="p-2.5 overflow-y-auto flex-1 space-y-3">
              {colTasks.map(task => {
                const overdue = isTaskOverdue(task);
                const priorityBorder = 
                  task.priority === 'URGENT' 
                    ? 'border-l-4 border-l-red-600'
                    : task.priority === 'HIGH'
                      ? 'border-l-4 border-l-amber-500'
                      : task.priority === 'MEDIUM'
                        ? 'border-l-4 border-l-blue-500'
                        : 'border-l-4 border-l-slate-400';

                return (
                  <div
                    key={task._id}
                    draggable
                    onDragStart={e => handleDragStart(e, task._id)}
                    onClick={() => onSelectTask(task._id)}
                    className={`p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs hover:shadow-md hover:border-red-300 dark:hover:border-red-800/80 ${priorityBorder} cursor-grab active:cursor-grabbing hover:-translate-y-0.5 group transition-all duration-150 select-none relative overflow-hidden`}
                  >
                    {/* ID and Priority Row */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200/80 dark:border-slate-700 group-hover:border-red-300 dark:group-hover:border-red-800/60 group-hover:bg-red-50 dark:group-hover:bg-red-950/40 group-hover:text-red-800 dark:group-hover:text-red-300 transition-colors shadow-2xs">
                        <span className="text-slate-400 group-hover:text-red-500 font-sans text-[10px]">#</span>
                        <span>{task.taskId}</span>
                      </span>
                      <PriorityBadge priority={task.priority} showIcon={false} />
                    </div>

                    {/* Task Title */}
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-red-900 dark:group-hover:text-red-300 line-clamp-2 leading-snug transition-colors">
                      {task.title}
                    </h4>

                    {/* Department Synergy & Project Badges */}
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                      {task.sourceDepartment && task.targetDepartment ? (
                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-[10px]">
                          <span className="font-bold text-slate-700 dark:text-slate-300">{task.sourceDepartment.code}</span>
                          <ArrowRight className="w-2.5 h-2.5 text-red-600 dark:text-red-400 font-bold" />
                          <span className="font-bold text-red-800 dark:text-red-300">{task.targetDepartment.code}</span>
                        </div>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700">
                          {task.department?.code || 'ADMIN'}
                        </span>
                      )}

                      {task.project && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/40 font-semibold truncate max-w-[130px]">
                          <Folder className="w-2.5 h-2.5 text-blue-500" />
                          <span className="truncate">
                            {typeof task.project.name === 'object' ? (task.project.name as any).en : task.project.name}
                          </span>
                        </span>
                      )}
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden p-0.5 border border-slate-200/50 dark:border-slate-700/50">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            task.progress === 100 
                              ? 'bg-gradient-to-r from-emerald-600 to-teal-500' 
                              : task.progress > 50 
                                ? 'bg-gradient-to-r from-blue-600 to-indigo-500' 
                                : 'bg-gradient-to-r from-red-700 to-rose-500'
                          }`}
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                        {task.progress}%
                      </span>
                    </div>

                    {/* Footer: Due Date & Assignees */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                      {overdue ? (
                        <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded border border-red-200/70 dark:border-red-900/40">
                          <AlertTriangle className="w-3 h-3 text-red-600 dark:text-red-400" />
                          <span>{task.dueDate}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{task.dueDate}</span>
                        </div>
                      )}

                      <div className="flex items-center -space-x-1.5">
                        {task.assignees?.map(u => (
                          <div key={u._id} className="ring-2 ring-white dark:ring-slate-900 rounded-full shadow-2xs">
                            <UserAvatar name={u.name} role={u.role} size="sm" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}

              {colTasks.length === 0 && (
                <div className="h-36 border-2 border-dashed border-slate-300/80 dark:border-slate-800 rounded-xl flex flex-col items-center justify-center text-xs text-slate-400 gap-1.5 bg-white/40 dark:bg-slate-900/20">
                  <span className="font-semibold text-slate-500 dark:text-slate-400">Empty Column</span>
                  <span className="text-[11px] text-slate-400">Drop directives here</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
