import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../common/Modal';
import { EmployeeSelector } from '../common/EmployeeSelector';
import { DepartmentSelector } from '../common/DepartmentSelector';
import { Project, TaskPriority, User } from '../../types';
import { getUserRole, isHigherLevel } from '../../utils/hierarchy';
import {
  Plus, Trash2, Upload, X, FileText, Image, Table2,
  Presentation, File, Paperclip, AlertCircle, CheckCircle2, Loader2
} from 'lucide-react';

interface UploadedFile {
  _id: string;
  name: string;
  size: number;
  type: string;
  mimeType: string;
  url: string;
  storedFilename: string;
  uploadedBy: string;
  uploadedAt: string;
}

interface FileUploadState {
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  result?: UploadedFile;
  error?: string;
}

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated: (task?: any) => void;
  onRequestCreated?: (request?: any) => void;
  defaultDepartmentId?: string;
  defaultProjectId?: string;
  prefilledProjectId?: string;
  prefilledAssigneeId?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(type: string, name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
    return <Image className="w-4 h-4 text-emerald-500" />;
  }
  if (ext === 'pdf') return <FileText className="w-4 h-4 text-red-500" />;
  if (['xls', 'xlsx', 'csv'].includes(ext)) return <Table2 className="w-4 h-4 text-green-600" />;
  if (['ppt', 'pptx'].includes(ext)) return <Presentation className="w-4 h-4 text-orange-500" />;
  if (['doc', 'docx'].includes(ext)) return <FileText className="w-4 h-4 text-blue-500" />;
  return <File className="w-4 h-4 text-slate-400" />;
}

function getProjectName(project: Project): string {
  const name = project.name as unknown;
  if (typeof name === 'string') return name;
  if (name && typeof name === 'object' && 'en' in name && typeof name.en === 'string') {
    return name.en;
  }
  return project.projectId;
}

const ALLOWED_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.txt', '.csv'
];

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  isOpen,
  onClose,
  onTaskCreated,
  onRequestCreated,
  defaultDepartmentId,
  defaultProjectId,
  prefilledProjectId,
  prefilledAssigneeId
}) => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [departmentId, setDepartmentId] = useState(defaultDepartmentId || user?.departmentId || '');
  const [sourceDepartmentId, setSourceDepartmentId] = useState(user?.departmentId || '');
  const [targetDepartmentId, setTargetDepartmentId] = useState('');
  const [targetEmployee, setTargetEmployee] = useState<User | null>(null);
  const [primaryAssignee, setPrimaryAssignee] = useState('');
  const [collaborators, setCollaborators] = useState<string[]>([]);
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [projectId, setProjectId] = useState(defaultProjectId || '');
  const [visibility, setVisibility] = useState('ORGANIZATION');
  const [projects, setProjects] = useState<Project[]>([]);
  const [checklist, setChecklist] = useState<string[]>([]);
  const [newChecklistText, setNewChecklistText] = useState('');
  const [tags, setTags] = useState('');
  const [requiresApproval, setRequiresApproval] = useState(false);

  // File upload state
  const [fileQueue, setFileQueue] = useState<FileUploadState[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      setDueDate(d.toISOString().split('T')[0]);
      setStartDate(new Date().toISOString().split('T')[0]);
      setSourceDepartmentId(user?.departmentId || '');
      setDepartmentId(defaultDepartmentId || user?.departmentId || '');
      api.projects.list().then(res => setProjects(Array.isArray(res) ? res : [])).catch(console.error);

      if (prefilledAssigneeId) {
        setPrimaryAssignee(prefilledAssigneeId);
        api.users.list({ activeOnly: true }).then(users => {
          const matched = Array.isArray(users) ? users.find((u: any) => u._id === prefilledAssigneeId) : null;
          if (matched) {
            setTargetEmployee(matched);
            if (matched.departmentId) {
              setTargetDepartmentId(matched.departmentId);
              setDepartmentId(matched.departmentId);
            }
          }
        }).catch(console.error);
      }
    } else {
      // Reset form on close
      setTitle(''); setDescription(''); setChecklist([]);
      setTags(''); setPrimaryAssignee(''); setCollaborators([]);
      setFileQueue([]); setError(''); setTargetDepartmentId(''); setTargetEmployee(null);
      setVisibility('ORGANIZATION'); setRequiresApproval(false);
    }
  }, [isOpen, user?.departmentId, defaultDepartmentId, prefilledAssigneeId]);

  // === File handling ===
  const validateFile = (file: File): string | null => {
    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return `"${file.name}" — file type not allowed. Allowed: PDF, DOC, XLS, PPT, JPG, PNG, etc.`;
    }
    if (file.size > 25 * 1024 * 1024) {
      return `"${file.name}" exceeds 25MB limit (${formatFileSize(file.size)}).`;
    }
    return null;
  };

  const addFiles = useCallback((newFiles: File[]) => {
    const validFiles: FileUploadState[] = [];
    const errors: string[] = [];

    for (const f of newFiles) {
      const err = validateFile(f);
      if (err) {
        errors.push(err);
      } else {
        validFiles.push({ file: f, status: 'pending' });
      }
    }

    if (errors.length > 0) {
      setError(errors.join('\n'));
    }

    setFileQueue(prev => [...prev, ...validFiles]);
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
      e.target.value = ''; // reset so same file can be added again
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const removeFile = (index: number) => {
    setFileQueue(prev => prev.filter((_, i) => i !== index));
  };

  // Upload all pending files
  const uploadAllFiles = async (): Promise<UploadedFile[]> => {
    const pendingIndices = fileQueue
      .map((f, i) => f.status === 'pending' ? i : -1)
      .filter(i => i !== -1);

    if (pendingIndices.length === 0) {
      return fileQueue.filter(f => f.status === 'done').map(f => f.result!);
    }

    const pendingFiles = pendingIndices.map(i => fileQueue[i].file);

    // Mark as uploading
    setFileQueue(prev => prev.map((f, i) =>
      pendingIndices.includes(i) ? { ...f, status: 'uploading' } : f
    ));

    try {
      const uploaded = await api.upload.files(pendingFiles);

      // Mark as done
      setFileQueue(prev => {
        const updated = [...prev];
        pendingIndices.forEach((queueIdx, uploadIdx) => {
          updated[queueIdx] = {
            ...updated[queueIdx],
            status: 'done',
            result: uploaded[uploadIdx]
          };
        });
        return updated;
      });

      return fileQueue
        .filter((f, i) => !pendingIndices.includes(i) && f.status === 'done')
        .map(f => f.result!)
        .concat(uploaded);
    } catch (err: any) {
      setFileQueue(prev => prev.map((f, i) =>
        pendingIndices.includes(i) ? { ...f, status: 'error', error: err.message } : f
      ));
      throw err;
    }
  };

  // === Checklist ===
  const handleAddChecklistItem = () => {
    if (newChecklistText.trim()) {
      setChecklist(prev => [...prev, newChecklistText.trim()]);
      setNewChecklistText('');
    }
  };

  // === Submit ===
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!title.trim()) { setError('Task title is required.'); return; }
    if (!dueDate) { setError('Due date is required.'); return; }

    setSubmitting(true);
    try {
      // 1. Upload files first
      let uploadedAttachments: UploadedFile[] = [];
      if (fileQueue.some(f => f.status === 'pending')) {
        uploadedAttachments = await uploadAllFiles();
      } else {
        uploadedAttachments = fileQueue.filter(f => f.status === 'done').map(f => f.result!);
      }

      // 2. Route by hierarchy: a higher-level recipient receives a request, otherwise this is a direct assignment.
      const finalDeptId = targetDepartmentId || departmentId || user?.departmentId;
      if (primaryAssignee && targetEmployee && isHigherLevel(user, targetEmployee)) {
        const request = await api.taskRequests.create({
          title: title.trim(),
          description: description.trim(),
          targetEmployeeId: primaryAssignee,
          targetDepartmentId: targetEmployee.departmentId || finalDeptId,
          priority,
          dueDate,
          attachments: uploadedAttachments
        });
        onRequestCreated?.(request);
        onClose();
        return;
      }

      const createdTask = await api.tasks.create({
        title: title.trim(),
        description: description.trim(),
        departmentId: finalDeptId,
        sourceDepartmentId: sourceDepartmentId || user?.departmentId,
        targetDepartmentId: targetDepartmentId || finalDeptId,
        assignedTo: primaryAssignee ? [primaryAssignee] : [],
        collaborators,
        priority,
        dueDate,
        startDate,
        projectId: projectId || prefilledProjectId || undefined,
        visibility,
        checklist,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        requiresApproval,
        attachments: uploadedAttachments
      });

      onTaskCreated(createdTask);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create task. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const pendingCount = fileQueue.filter(f => f.status === 'pending').length;
  const doneCount = fileQueue.filter(f => f.status === 'done').length;
  const errorCount = fileQueue.filter(f => f.status === 'error').length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Task"
      subtitle="Assign work or send it as a request when the recipient is higher in the hierarchy"
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">

        {/* Error Banner */}
        {error && (
          <div className="flex items-start gap-2.5 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-xl text-xs text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <pre className="whitespace-pre-wrap font-sans">{error}</pre>
            <button type="button" onClick={() => setError('')} className="ml-auto shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Title */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
            Task Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g., Prepare Exhibition Budget for Victory Day 2026"
            className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
            Description
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Provide context, expected deliverables, references, or special instructions..."
            className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 resize-none"
          />
        </div>

        {/* Assign to — can select ANY employee from any dept */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
          <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
            Assignment (Cross-Department Supported)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DepartmentSelector
              label="Target Department"
              value={targetDepartmentId}
              onChange={(deptId) => {
                setTargetDepartmentId(deptId);
                setDepartmentId(deptId);
                setPrimaryAssignee('');
                setTargetEmployee(null);
              }}
            />
            <EmployeeSelector
              label="Assign To (Employee)"
              value={primaryAssignee}
              onChange={(userId, userObj) => {
                setPrimaryAssignee(userId);
                setTargetEmployee(userObj || null);
                if (userObj?.departmentId) {
                  setTargetDepartmentId(userObj.departmentId);
                  setDepartmentId(userObj.departmentId);
                }
              }}
              departmentId={targetDepartmentId}
              placeholder="Search any employee..."
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DepartmentSelector
              label="Source Department (Requester)"
              value={sourceDepartmentId}
              onChange={setSourceDepartmentId}
            />
            <DepartmentSelector
              label="Owning Department"
              value={departmentId}
              onChange={setDepartmentId}
              required
            />
          </div>
          <div>
            <EmployeeSelector
              label="Add Collaborators / Co-assignees"
              value=""
              onChange={(userId) => {
                if (userId && !collaborators.includes(userId) && userId !== primaryAssignee) {
                  setCollaborators(prev => [...prev, userId]);
                }
              }}
              excludeUserIds={primaryAssignee ? [primaryAssignee, ...collaborators] : collaborators}
              placeholder="Select additional team members..."
            />
            {collaborators.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {collaborators.map(cId => (
                  <span key={cId} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-xs">
                    <span>{cId}</span>
                    <button
                      type="button"
                      onClick={() => setCollaborators(prev => prev.filter(id => id !== cId))}
                      className="text-slate-400 hover:text-red-600 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Priority, Dates, Project */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">Priority</label>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value as TaskPriority)}
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
            >
              <option value="LOW">🟢 Low</option>
              <option value="MEDIUM">🔵 Medium</option>
              <option value="HIGH">🟠 High</option>
              <option value="URGENT">🔴 Urgent</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">Due Date <span className="text-red-500">*</span></label>
            <input
              type="date"
              required
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">Visibility</label>
            <select
              value={visibility}
              onChange={e => setVisibility(e.target.value)}
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
            >
              <option value="ORGANIZATION">Organization</option>
              <option value="DEPARTMENT">Department</option>
              <option value="COLLABORATORS">Collaborators</option>
              <option value="PRIVATE">Private</option>
            </select>
          </div>
        </div>

        {/* Project */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
            Link to Project
          </label>
          <select
            value={projectId}
            onChange={e => setProjectId(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none"
          >
            <option value="">No Project (Ad-hoc Task)</option>
            {projects.map(p => (
              <option key={p._id} value={p._id}>{getProjectName(p)} ({p.projectId})</option>
            ))}
          </select>
        </div>

        {/* ===== FILE ATTACHMENTS ===== */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
            Attachments <span className="text-slate-400 font-normal normal-case ml-1">(PDF, DOC, XLS, PPT, JPG, PNG — Max 25MB each)</span>
          </label>

          {/* Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center gap-2 p-5 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
              isDragOver
                ? 'border-red-500 bg-red-50 dark:bg-red-950/20'
                : 'border-slate-300 dark:border-slate-700 hover:border-red-400 dark:hover:border-red-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ALLOWED_EXTENSIONS.join(',')}
              onChange={handleFileInputChange}
              className="hidden"
            />
            <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
              <Upload className="w-5 h-5" />
              <span className="text-xs font-medium">
                {isDragOver ? 'Drop files here...' : 'Click to browse or drag & drop files'}
              </span>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5 mt-1">
              {['PDF', 'DOC', 'DOCX', 'XLS', 'XLSX', 'PPT', 'PPTX', 'JPG', 'PNG'].map(ext => (
                <span key={ext} className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded">
                  {ext}
                </span>
              ))}
            </div>
          </div>

          {/* File Queue */}
          {fileQueue.length > 0 && (
            <div className="mt-2.5 space-y-1.5">
              {/* Summary bar */}
              {fileQueue.length > 1 && (
                <div className="flex items-center gap-3 text-[11px] text-slate-500 px-1">
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>{fileQueue.length} file(s)</span>
                  {doneCount > 0 && <span className="text-emerald-600">✓ {doneCount} uploaded</span>}
                  {pendingCount > 0 && <span className="text-blue-600">⋯ {pendingCount} pending</span>}
                  {errorCount > 0 && <span className="text-red-600">✗ {errorCount} failed</span>}
                </div>
              )}

              {fileQueue.map((f, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs ${
                    f.status === 'error'
                      ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/50'
                      : f.status === 'done'
                      ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50'
                      : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {getFileIcon(f.file.type, f.file.name)}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-800 dark:text-slate-200 truncate">{f.file.name}</div>
                    <div className="text-slate-400">{formatFileSize(f.file.size)}</div>
                  </div>

                  {/* Status indicator */}
                  {f.status === 'uploading' && (
                    <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0" />
                  )}
                  {f.status === 'done' && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  )}
                  {f.status === 'error' && (
                    <span className="text-red-500 text-[10px] shrink-0 max-w-[100px] truncate" title={f.error}>
                      {f.error}
                    </span>
                  )}

                  {f.status !== 'uploading' && (
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="shrink-0 text-slate-400 hover:text-red-600 transition-colors"
                      title="Remove file"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Checklist */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
            Checklist Items
          </label>
          <div className="space-y-1.5 mb-2">
            {checklist.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded border border-slate-300 dark:border-slate-600 shrink-0" />
                  <span className="text-slate-700 dark:text-slate-300">{item}</span>
                </div>
                <button type="button" onClick={() => setChecklist(prev => prev.filter((_, i) => i !== idx))} className="text-slate-400 hover:text-red-600">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newChecklistText}
              onChange={e => setNewChecklistText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddChecklistItem(); } }}
              placeholder="Add a checklist item and press Enter..."
              className="flex-1 px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none"
            />
            <button type="button" onClick={handleAddChecklistItem} className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
            Tags <span className="text-slate-400 font-normal normal-case">(comma-separated)</span>
          </label>
          <input
            type="text"
            value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder="e.g., Budget, Exhibition, Urgent, Cross-Dept"
            className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none"
          />
        </div>

        {/* Requires Approval */}
        <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
          <input
            type="checkbox"
            checked={requiresApproval}
            onChange={e => setRequiresApproval(e.target.checked)}
            className="w-4 h-4 accent-red-600 rounded"
          />
          <div>
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">Requires Approval</div>
            <div className="text-[11px] text-slate-500">Task will be sent to IN REVIEW when completed, awaiting approval.</div>
          </div>
        </label>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 sticky bottom-0 bg-white dark:bg-slate-950 pb-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-800 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-red-800 hover:bg-red-900 text-white shadow-xs disabled:opacity-50 transition-colors flex items-center gap-2"
          >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {fileQueue.some(f => f.status === 'uploading') ? 'Uploading files...' : 'Submitting...'}
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Assign / Request {fileQueue.length > 0 ? `(${fileQueue.length} file${fileQueue.length > 1 ? 's' : ''})` : ''}
                  </>
                )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
