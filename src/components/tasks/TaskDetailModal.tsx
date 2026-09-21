import React, { useState, useEffect } from 'react';
import { Task, TaskComment, ActivityLog, TaskStatus } from '../../types';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../common/StatusBadge';
import { PriorityBadge } from '../common/PriorityBadge';
import { UserAvatar } from '../common/UserAvatar';
import { 
  X, Check, Plus, Paperclip, Send, Clock, Calendar, 
  Building, Copy, CheckCircle2, ChevronRight, FileText, ArrowRight, ShieldCheck, Trash2, Download, Printer,
  RotateCcw, XCircle, ArrowUpRight, Sparkles
} from 'lucide-react';
import { SubmitWorkModal } from './SubmitWorkModal';
import { downloadTaskPdf } from '../../utils/pdfGenerator';

interface TaskDetailModalProps {
  taskId: string | null;
  onClose: () => void;
  onTaskUpdated?: () => void;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  taskId,
  onClose,
  onTaskUpdated
}) => {
  const { user } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // New comment input
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // New checklist item
  const [newChecklistText, setNewChecklistText] = useState('');

  // Active tab
  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'files' | 'history'>('details');

  // Submit Work Modal State
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);

  // Assigner Review State
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'MODIFY' | 'REJECT' | 'REFER' | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const isAssignee = Array.isArray(task?.assignedTo) && user?._id ? task.assignedTo.includes(user._id) : false;
  const isAssigner = Boolean(
    user?._id && (
      task?.createdBy === user._id ||
      task?.requestedBy === user._id ||
      user?.role === 'DEPT_HEAD' ||
      user?.role === 'CEO' ||
      user?.role === 'SUPER_ADMIN'
    )
  );

  const handleDownloadAttachment = async (url: string, name: string) => {
    if (!url) return;
    try {
      if (url.startsWith('data:')) {
        const a = document.createElement('a');
        a.href = url;
        a.download = name || 'attachment';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }

      const response = await fetch(url);
      if (!response.ok) throw new Error('Network error');
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = name || 'attachment';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      // Fallback for legacy mock URLs or cross-domain restrictions
      const content = `Liberation War Museum - Directive Attachment\n\nFilename: ${name}\nSource URL: ${url}\nDownloaded: ${new Date().toLocaleString()}`;
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = name.includes('.') ? name : `${name}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    }
  };

  const handleReviewTask = async (action: 'APPROVE' | 'MODIFY' | 'REJECT' | 'REFER', customNote?: string) => {
    if (!task) return;
    setReviewSubmitting(true);
    try {
      const targetLevel =
        user?.role === 'CEO'
          ? 'TRUSTEE'
          : user?.role === 'DEPT_HEAD'
            ? 'CEO'
            : 'DEPT_HEAD';

      const updated = await api.tasks.review(task._id, {
        action,
        note: customNote !== undefined ? customNote : reviewNote,
        targetLevel
      });
      setTask(updated);
      setReviewAction(null);
      setReviewNote('');
      onTaskUpdated?.();
      fetchTaskDetails();
    } catch (err: any) {
      alert(err.message || 'Review action failed.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const fetchTaskDetails = async () => {
    if (!taskId) return;
    setLoading(true);
    try {
      const res = await api.tasks.get(taskId);
      setTask(res.task);
      setComments(res.comments || []);
      setActivities(res.activities || []);
    } catch (err) {
      console.error('Failed to load task details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTaskDetails();
  }, [taskId]);

  if (!taskId) return null;

  const handleCopyId = () => {
    if (task) {
      navigator.clipboard.writeText(task.taskId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleStatusChange = async (newStatus: TaskStatus) => {
    if (!task) return;
    try {
      const updated = await api.tasks.updateStatus(task._id, newStatus);
      setTask(prev => prev ? { ...prev, status: newStatus, progress: updated.progress } : null);
      onTaskUpdated?.();
      fetchTaskDetails();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  const handleProgressChange = async (newProgress: number) => {
    if (!task) return;
    try {
      await api.tasks.updateProgress(task._id, newProgress);
      setTask(prev => prev ? { ...prev, progress: newProgress } : null);
      onTaskUpdated?.();
    } catch (err: any) {
      alert(err.message || 'Failed to update progress');
    }
  };

  const handleToggleChecklist = async (itemId: string, currentCompleted: boolean) => {
    if (!task) return;
    try {
      const updated = await api.tasks.checklistAction(task._id, 'TOGGLE', {
        itemId,
        completed: !currentCompleted
      });
      setTask(updated);
      onTaskUpdated?.();
    } catch (err: any) {
      alert(err.message || 'Failed to toggle checklist item');
    }
  };

  const handleAddChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !newChecklistText.trim()) return;
    try {
      const updated = await api.tasks.checklistAction(task._id, 'ADD', {
        title: newChecklistText.trim()
      });
      setTask(updated);
      setNewChecklistText('');
      onTaskUpdated?.();
    } catch (err: any) {
      alert(err.message || 'Failed to add checklist item');
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !newComment.trim()) return;
    setSubmittingComment(true);
    try {
      const added = await api.tasks.addComment(task._id, newComment.trim());
      setComments(prev => [...prev, added]);
      setNewComment('');
      fetchTaskDetails();
    } catch (err: any) {
      alert(err.message || 'Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !task) return;

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        const updated = await api.tasks.addAttachment(task._id, {
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          url: dataUrl
        });
        setTask(updated);
        onTaskUpdated?.();
        fetchTaskDetails();
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      alert(err.message || 'Failed to upload attachment');
    }
  };

  const handleDeleteTask = async () => {
    if (!task) return;
    if (!confirm(`Are you sure you want to permanently delete directive ${task.taskId} ("${task.title}")? This action cannot be undone.`)) return;

    try {
      await api.tasks.delete(task._id);
      alert('Task deleted successfully.');
      onTaskUpdated?.();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to delete task');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div 
        className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in"
        role="dialog"
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            {task && (
              <button
                type="button"
                onClick={handleCopyId}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300 transition-colors"
                title="Click to copy Task ID"
              >
                <span>{task.taskId}</span>
                {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              </button>
            )}
            {task && <StatusBadge status={task.status} isOverdue={task.isOverdue} />}
            {task && <PriorityBadge priority={task.priority} />}
          </div>

          <div className="flex items-center gap-2">
            {task && (
              <button
                type="button"
                onClick={() => downloadTaskPdf(task, task.creator || task.requester || user, task.assignees || [])}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors border border-slate-200 dark:border-slate-700"
                title="Download Task Particulars PDF"
              >
                <Printer className="w-3.5 h-3.5 text-red-700 dark:text-red-400" />
                <span>Task PDF</span>
              </button>
            )}

            {task && (user?.role === 'SUPER_ADMIN' || user?.role === 'CEO') && (
              <button
                type="button"
                onClick={handleDeleteTask}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900 transition-colors border border-red-200/60 dark:border-red-800"
                title="Permanently Delete Directive (Super Admin / CEO)"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading task particulars...</div>
        ) : !task ? (
          <div className="p-12 text-center text-red-500">Task details not found.</div>
        ) : (
          <>
            {/* Title & Cross-Department Synergy Bar */}
            <div className="px-6 pt-5 pb-3">
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-snug">
                {task.title}
              </h1>

              {/* Cross Department Synergy Badge */}
              {task.sourceDepartment && task.targetDepartment && (
                <div className="mt-2.5 inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-300 border border-red-200/70 dark:border-red-900/40">
                  <span className="font-semibold">{task.sourceDepartment.name.en} ({task.sourceDepartment.code})</span>
                  <ArrowRight className="w-3.5 h-3.5 text-red-500" />
                  <span className="font-semibold">{task.targetDepartment.name.en} ({task.targetDepartment.code})</span>
                </div>
              )}
            </div>

            {/* Assigner Decision & Review Action Bar */}
            {isAssigner && task.status === 'IN_REVIEW' && (
              <div className="mx-6 my-3 p-4 bg-gradient-to-r from-emerald-500/10 via-purple-500/10 to-amber-500/10 dark:from-emerald-950/40 dark:to-purple-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Work Submitted for Assigner Review & Decision</span>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                    Review submitted deliverables and confirm decision below.
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* 1. Approve */}
                  <button
                    type="button"
                    onClick={() => handleReviewTask('APPROVE')}
                    disabled={reviewSubmitting}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve</span>
                  </button>

                  {/* 2. Modify */}
                  <button
                    type="button"
                    onClick={() => { setReviewAction('MODIFY'); setReviewNote(''); }}
                    disabled={reviewSubmitting}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Modify</span>
                  </button>

                  {/* 3. Reject */}
                  <button
                    type="button"
                    onClick={() => handleReviewTask('REJECT')}
                    disabled={reviewSubmitting}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Reject</span>
                  </button>

                  {/* 4. Refer to Upper Hierarchy */}
                  <button
                    type="button"
                    onClick={() => { setReviewAction('REFER'); setReviewNote(''); }}
                    disabled={reviewSubmitting}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    <span>
                      {user?.role === 'CEO'
                        ? 'Refer to Trustee'
                        : user?.role === 'DEPT_HEAD'
                          ? 'Refer to CEO'
                          : 'Refer to Dept Head'}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Quick Status & Progress Action Bar */}
            <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/40 border-y border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
              {/* Status Selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status:</span>
                <select
                  value={task.status}
                  onChange={e => handleStatusChange(e.target.value as TaskStatus)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-xs focus:ring-2 focus:ring-red-500/20"
                >
                  <option value="TODO">TODO</option>
                  <option value="ACCEPTED">ACCEPTED</option>
                  <option value="IN_PROGRESS">IN PROGRESS</option>
                  <option value="ON_HOLD">ON HOLD</option>
                  <option value="IN_REVIEW">IN REVIEW</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="REJECTED">REJECTED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>

              {/* Submit Work Action Button — Restricted to assigned receivers only */}
              {isAssignee && task.status !== 'COMPLETED' && task.status !== 'CANCELLED' && (
                <button
                  type="button"
                  onClick={() => setIsSubmitModalOpen(true)}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center gap-1.5 transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{task.requiresApproval ? 'Submit Work for Review' : 'Submit Work & Auto-Complete'}</span>
                </button>
              )}

              {/* Progress Slider */}
              <div className="flex items-center gap-3 min-w-[220px]">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Progress:</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={task.progress}
                  onChange={e => handleProgressChange(Number(e.target.value))}
                  className="flex-1 accent-red-700 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 w-9 text-right font-mono">
                  {task.progress}%
                </span>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="px-6 border-b border-slate-200 dark:border-slate-800 flex gap-6 text-xs sm:text-sm font-medium">
              <button
                type="button"
                onClick={() => setActiveTab('details')}
                className={`py-3 border-b-2 transition-colors ${
                  activeTab === 'details'
                    ? 'border-red-700 text-red-700 dark:text-red-400 font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Overview & Checklist
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('comments')}
                className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === 'comments'
                    ? 'border-red-700 text-red-700 dark:text-red-400 font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <span>Comments</span>
                {comments.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-700">
                    {comments.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('files')}
                className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === 'files'
                    ? 'border-red-700 text-red-700 dark:text-red-400 font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <span>Attachments</span>
                {task.attachments?.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-700">
                    {task.attachments.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`py-3 border-b-2 transition-colors ${
                  activeTab === 'history'
                    ? 'border-red-700 text-red-700 dark:text-red-400 font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Audit History
              </button>
            </div>

            {/* Tab Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              
              {activeTab === 'details' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Left 2 Cols: Description & Checklist */}
                  <div className="md:col-span-2 space-y-6">
                    {/* Description */}
                    <div>
                      <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                        Description & Instructions
                      </h3>
                      <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                        {task.description || 'No detailed instructions provided.'}
                      </div>
                    </div>

                    {/* Checklist */}
                    <div>
                      <div className="flex items-center justify-between mb-2.5">
                        <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                          Subtasks & Deliverables Checklist
                        </h3>
                        <span className="text-xs text-slate-500">
                          {task.checklist?.filter(c => c.completed).length || 0} of {task.checklist?.length || 0} completed
                        </span>
                      </div>

                      {/* Items */}
                      <div className="space-y-2">
                        {task.checklist?.map(item => (
                          <div
                            key={item._id}
                            onClick={() => handleToggleChecklist(item._id, item.completed)}
                            className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                              item.completed
                                ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40 text-slate-500 line-through'
                                : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 border ${
                              item.completed
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'border-slate-300 dark:border-slate-600'
                            }`}>
                              {item.completed && <Check className="w-3.5 h-3.5" />}
                            </div>
                            <span className="text-xs sm:text-sm font-medium">{item.title}</span>
                          </div>
                        ))}
                      </div>

                      {/* Add Item form */}
                      <form onSubmit={handleAddChecklist} className="mt-3 flex gap-2">
                        <input
                          type="text"
                          value={newChecklistText}
                          onChange={e => setNewChecklistText(e.target.value)}
                          placeholder="Add new checklist item..."
                          className="flex-1 px-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 text-slate-800 dark:text-slate-200"
                        />
                        <button
                          type="submit"
                          disabled={!newChecklistText.trim()}
                          className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-red-800 hover:bg-red-900 text-white disabled:opacity-50 transition-colors flex items-center gap-1 shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add</span>
                        </button>
                      </form>
                    </div>

                    {/* Tags */}
                    {task.tags?.length > 0 && (
                      <div>
                        <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                          Tags
                        </h3>
                        <div className="flex flex-wrap gap-1.5">
                          {task.tags.map((t, idx) => (
                            <span key={idx} className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              #{t}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right 1 Col: Metadata & People */}
                  <div className="space-y-5 p-4 bg-slate-50/80 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-xs">
                    
                    {/* Due Date */}
                    <div>
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Due Date
                      </div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        <Calendar className="w-4 h-4 text-red-700" />
                        <span>{task.dueDate}</span>
                      </div>
                      {task.isOverdue && (
                        <span className="text-[11px] font-medium text-red-600 dark:text-red-400 block mt-1">
                          Deadline expired
                        </span>
                      )}
                    </div>

                    {/* Requester */}
                    <div>
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Requested By
                      </div>
                      {task.requester ? (
                        <div className="flex items-center gap-2.5">
                          <UserAvatar name={task.requester.name} role={task.requester.role} size="sm" />
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-slate-100">
                              {task.requester.name.en}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {task.requester.designation.en}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-500">Directly assigned</span>
                      )}
                    </div>

                    {/* Assignees */}
                    <div>
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Assigned Personnel
                      </div>
                      <div className="space-y-1.5">
                        {task.assignees?.length ? (
                          task.assignees.map(u => (
                            <div key={u._id} className="flex items-center gap-2">
                              <UserAvatar name={u.name} role={u.role} size="sm" />
                              <div className="min-w-0">
                                <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                                  {u.name.en}
                                </div>
                                <div className="text-[10px] text-slate-500 truncate">
                                  {u.designation.en} • {u.department?.code || 'Executive'}
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <span className="text-slate-400">No assignees</span>
                        )}
                      </div>
                    </div>

                    {/* Department */}
                    <div>
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Owning Department
                      </div>
                      <div className="flex items-center gap-2 font-medium text-slate-800 dark:text-slate-200">
                        <Building className="w-4 h-4 text-slate-400" />
                        <span>{task.department?.name.en || 'Administration'}</span>
                      </div>
                    </div>

                    {/* Project */}
                    {task.project && (
                      <div>
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          Connected Project
                        </div>
                        <span className="inline-block px-2.5 py-1 rounded-md bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 font-medium">
                          {typeof task.project.name === 'object' ? (task.project.name as any).en : task.project.name}
                        </span>
                      </div>
                    )}

                  </div>

                </div>
              )}

              {/* Comments Thread */}
              {activeTab === 'comments' && (
                <div className="space-y-4">
                  <div className="space-y-3">
                    {comments.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                        No comments yet. Start a discussion or request a status update.
                      </div>
                    ) : (
                      comments.map(c => (
                        <div key={c._id} className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-800">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <UserAvatar name={c.author?.name || 'User'} role={c.author?.role} size="sm" />
                              <div>
                                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                  {c.author?.name.en || 'LWM Colleague'}
                                </span>
                                <span className="text-[10px] text-slate-500 ml-2">
                                  {c.author?.designation.en}
                                </span>
                              </div>
                            </div>
                            <span className="text-[11px] text-slate-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(c.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line pl-9">
                            {c.content}
                          </p>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add Comment */}
                  <form onSubmit={handleAddComment} className="pt-2">
                    <div className="relative">
                      <textarea
                        rows={3}
                        value={newComment}
                        onChange={e => setNewComment(e.target.value)}
                        placeholder="Write a message, note, or @mention a colleague..."
                        className="w-full p-3 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 text-slate-900 dark:text-slate-100 placeholder-slate-400"
                      />
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[11px] text-slate-400">
                          Posting as <strong className="text-slate-700 dark:text-slate-300">{user?.name.en}</strong>
                        </span>
                        <button
                          type="submit"
                          disabled={submittingComment || !newComment.trim()}
                          className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-800 hover:bg-red-900 text-white disabled:opacity-50 transition-colors flex items-center gap-1.5"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Post Comment</span>
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              )}

              {/* Attachments */}
              {activeTab === 'files' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Attached Documents & Evidence
                    </h3>
                    <label className="cursor-pointer px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors">
                      <Paperclip className="w-3.5 h-3.5" />
                      <span>Upload Document</span>
                      <input type="file" className="hidden" onChange={handleFileUpload} />
                    </label>
                  </div>

                  {task.attachments?.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                      No documents or files attached yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {task.attachments.map(att => (
                        <div key={att._id} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 flex items-center justify-center shrink-0">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                                {att.name}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {(att.size / 1024).toFixed(1)} KB • {new Date(att.uploadedAt).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDownloadAttachment(att.url, att.name)}
                            className="px-3 py-1 rounded-lg text-xs font-semibold bg-slate-200/80 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 transition-colors flex items-center gap-1.5 shrink-0"
                            title="Download Attachment File"
                          >
                            <Download className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                            <span>Download</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Audit History */}
              {activeTab === 'history' && (
                <div className="space-y-3">
                  {activities.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                      No activity logged yet.
                    </div>
                  ) : (
                    <div className="relative pl-6 border-l-2 border-slate-200 dark:border-slate-800 space-y-4">
                      {activities.map(act => (
                        <div key={act._id} className="relative">
                          <div className="absolute -left-[31px] top-1 w-3 h-3 rounded-full bg-red-700 border-2 border-white dark:border-slate-900" />
                          <div className="text-xs">
                            <span className="font-bold text-slate-900 dark:text-slate-100">
                              {act.actor?.name.en || 'System'}
                            </span>{' '}
                            <span className="text-slate-600 dark:text-slate-400">
                              {act.action.replace(/_/g, ' ').toLowerCase()}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {new Date(act.createdAt).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          </>
        )}
      </div>

        {/* Submit Work Modal */}
        {isSubmitModalOpen && task && (
          <SubmitWorkModal
            isOpen={isSubmitModalOpen}
            task={task}
            onClose={() => setIsSubmitModalOpen(false)}
            onSubmitted={(updatedTask) => {
              setTask(updatedTask);
              setIsSubmitModalOpen(false);
              onTaskUpdated?.();
              fetchTaskDetails();
            }}
          />
        )}

        {/* Assigner Rework / Referral Modal */}
        {reviewAction && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                  {reviewAction === 'MODIFY'
                    ? 'Request Task Modification / Re-work'
                    : `Refer Task to ${
                        user?.role === 'CEO'
                          ? 'Trustee Board'
                          : user?.role === 'DEPT_HEAD'
                            ? 'CEO'
                            : 'Department Head'
                      }`}
                </h3>
                <button type="button" onClick={() => setReviewAction(null)} className="p-1 text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-slate-500">
                {reviewAction === 'MODIFY'
                  ? 'Provide specific instructions or feedback on what the assigned user needs to modify.'
                  : 'Add optional referral notes before escalating to upper hierarchy for final approval.'}
              </p>

              <textarea
                rows={4}
                value={reviewNote}
                onChange={e => setReviewNote(e.target.value)}
                placeholder={reviewAction === 'MODIFY' ? 'Explain what needs to be changed or improved...' : 'Add notes for upper hierarchy review...'}
                className="w-full p-3 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400"
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReviewAction(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={reviewSubmitting || (reviewAction === 'MODIFY' && !reviewNote.trim())}
                  onClick={() => handleReviewTask(reviewAction, reviewNote)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-xs disabled:opacity-50 transition-colors ${
                    reviewAction === 'MODIFY' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-purple-600 hover:bg-purple-700'
                  }`}
                >
                  {reviewSubmitting ? 'Submitting...' : reviewAction === 'MODIFY' ? 'Submit Rework Request' : 'Confirm Referral'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };
