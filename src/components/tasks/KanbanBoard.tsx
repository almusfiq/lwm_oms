import React, { useState } from 'react';
import { Task, TaskStatus } from '../../types';
import { api } from '../../api/client';
import { PriorityBadge } from '../common/PriorityBadge';
import { UserAvatar } from '../common/UserAvatar';
import { Calendar, Plus, MoreHorizontal } from 'lucide-react';

interface KanbanBoardProps {
  tasks: Task[];
  onSelectTask: (taskId: string) => void;
  onTaskUpdated: () => void;
  onOpenCreateModal?: () => void;
}

const COLUMNS: Array<{ id: TaskStatus; title: string; color: string; border: string }> = [
  { id: 'TODO', title: 'To Do', color: 'bg-slate-50 dark:bg-slate-900/60', border: 'border-slate-300' },
  { id: 'ACCEPTED', title: 'Accepted', color: 'bg-sky-50/50 dark:bg-sky-950/20', border: 'border-sky-300' },
  { id: 'IN_PROGRESS', title: 'In Progress', color: 'bg-blue-50/50 dark:bg-blue-950/20', border: 'border-blue-300' },
  { id: 'IN_REVIEW', title: 'In Review', color: 'bg-indigo-50/50 dark:bg-indigo-950/20', border: 'border-indigo-300' },
  { id: 'COMPLETED', title: 'Completed', color: 'bg-emerald-50/50 dark:bg-emerald-950/20', border: 'border-emerald-300' },
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  tasks,
  onSelectTask,
  onTaskUpdated,
  onOpenCreateModal
}) => {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    setDraggedTaskId(id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
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

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-210px)] min-h-[500px]">
      {COLUMNS.map(col => {
        const colTasks = tasks.filter(t => t.status === col.id);

        return (
          <div
            key={col.id}
            onDragOver={handleDragOver}
            onDrop={e => handleDrop(e, col.id)}
            className={`w-80 shrink-0 flex flex-col rounded-2xl border border-slate-200/80 dark:border-slate-800 ${col.color} overflow-hidden`}
          >
            {/* Column Header */}
            <div className="p-3.5 border-b border-slate-200/70 dark:border-slate-800 flex items-center justify-between bg-white/40 dark:bg-slate-900/40">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100">
                  {col.title}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {colTasks.length}
                </span>
              </div>
              {col.id === 'TODO' && onOpenCreateModal && (
                <button
                  type="button"
                  onClick={onOpenCreateModal}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 dark:hover:bg-slate-800"
                  title="Quick add task"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Column Task Cards */}
            <div className="p-2.5 overflow-y-auto flex-1 space-y-2.5">
              {colTasks.map(task => (
                <div
                  key={task._id}
                  draggable
                  onDragStart={e => handleDragStart(e, task._id)}
                  onClick={() => onSelectTask(task._id)}
                  className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer transition-all active:scale-98 select-none"
                >
                  {/* ID and Priority */}
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[11px] font-mono font-bold text-slate-500">
                      {task.taskId}
                    </span>
                    <PriorityBadge priority={task.priority} showIcon={false} />
                  </div>

                  {/* Title */}
                  <h4 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug">
                    {task.title}
                  </h4>

                  {/* Department & Project Info */}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-medium text-slate-600 dark:text-slate-400">
                      {task.department?.code || 'ADMIN'}
                    </span>
                    {task.project && (
                      <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-medium truncate max-w-[140px]">
                        {task.project.name}
                      </span>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-1 overflow-hidden">
                      <div
                        className="bg-red-700 h-full rounded-full transition-all"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono font-medium text-slate-400">
                      {task.progress}%
                    </span>
                  </div>

                  {/* Footer: Due Date & Assignee Avatar */}
                  <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                    <div className="flex items-center gap-1 text-[11px] text-slate-500">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span>{task.dueDate}</span>
                    </div>

                    <div className="flex items-center -space-x-1.5">
                      {task.assignees?.map(u => (
                        <UserAvatar key={u._id} name={u.name} role={u.role} size="sm" />
                      ))}
                    </div>
                  </div>
                </div>
              ))}

              {colTasks.length === 0 && (
                <div className="h-32 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-center text-xs text-slate-400">
                  Drop tasks here
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
