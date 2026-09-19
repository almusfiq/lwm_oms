import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../common/Modal';
import { EmployeeSelector } from '../common/EmployeeSelector';
import { DepartmentSelector } from '../common/DepartmentSelector';
import { TaskPriority, User } from '../../types';
import { getUserRole, isDepartmentHead } from '../../utils/hierarchy';
import {
  Send, ArrowRight, Building, Sparkles, Upload, X,
  FileText, Image, Table2, Presentation, File, CheckCircle2, Loader2, AlertCircle, Info
} from 'lucide-react';

interface FileUploadState {
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  result?: any;
  error?: string;
}

interface TaskRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestCreated: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return <Image className="w-4 h-4 text-emerald-500" />;
  if (ext === 'pdf') return <FileText className="w-4 h-4 text-red-500" />;
  if (['xls', 'xlsx', 'csv'].includes(ext)) return <Table2 className="w-4 h-4 text-green-600" />;
  if (['ppt', 'pptx'].includes(ext)) return <Presentation className="w-4 h-4 text-orange-500" />;
  if (['doc', 'docx'].includes(ext)) return <FileText className="w-4 h-4 text-blue-500" />;
  return <File className="w-4 h-4 text-slate-400" />;
}

const ALLOWED_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.txt', '.csv'
];

export const TaskRequestModal: React.FC<TaskRequestModalProps> = ({
  isOpen, onClose, onRequestCreated
}) => {
  const { user, department } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const role = getUserRole(user);
  const isTrustee = role === 'TRUSTEE';
  const isCEO = role === 'CEO';
  const isDeptHead = isDepartmentHead(user);
  const isStaff = !isTrustee && !isCEO && !isDeptHead;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetDepartmentId, setTargetDepartmentId] = useState('');
  const [targetEmployeeId, setTargetEmployeeId] = useState('');
  const [targetEmployee, setTargetEmployee] = useState<User | null>(null);
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [fileQueue, setFileQueue] = useState<FileUploadState[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // For staff: filter to dept heads only
  // For dept head: can request to CEO or trustee (high-level contacts)
  // For CEO: only to trustee
  const getTargetRoleFilters = (): string[] | undefined => {
    if (isStaff) return ['DEPT_HEAD'];
    if (isDeptHead) return ['CEO', 'TRUSTEE'];
    if (isCEO) return ['TRUSTEE'];
    return undefined;
  };

  // Label based on role
  const getModalTitle = () => {
    if (isStaff) return 'Request Work to Department Head';
    if (isDeptHead) return 'Request Work / Event to CEO or Trustee';
    if (isCEO) return 'Request Work / Event to Trustee Board';
    return 'Request Work from Colleague';
  };

  const getModalSubtitle = () => {
    if (isStaff) return 'Select a department head to assign or request work';
    if (isDeptHead) return 'Send formal work/event request to the CEO or Trustee Board';
    if (isCEO) return 'Send formal work/event request to the Trustee Board';
    return 'Cross-departmental collaboration request';
  };

  const getEmployeeLabel = () => {
    if (isStaff) return 'Select Department Head';
    if (isCEO) return 'Select Trustee';
    return 'Select Target Person';
  };

  useEffect(() => {
    if (isOpen) {
      const d = new Date();
      d.setDate(d.getDate() + 5);
      setDueDate(d.toISOString().split('T')[0]);
    } else {
      setTitle(''); setDescription(''); setTargetEmployeeId('');
      setTargetDepartmentId(''); setTargetEmployee(null); setFileQueue([]); setError('');
    }
  }, [isOpen]);

  const addFiles = useCallback((newFiles: File[]) => {
    const errors: string[] = [];
    const valid: FileUploadState[] = [];
    for (const f of newFiles) {
      const ext = '.' + (f.name.split('.').pop() || '').toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) { errors.push(`"${f.name}" — type not allowed`); continue; }
      if (f.size > 25 * 1024 * 1024) { errors.push(`"${f.name}" exceeds 25MB`); continue; }
      valid.push({ file: f, status: 'pending' });
    }
    if (errors.length) setError(errors.join('\n'));
    setFileQueue(prev => [...prev, ...valid]);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragOver(false);
    if (e.dataTransfer.files.length) addFiles(Array.from(e.dataTransfer.files));
  };

  const removeFile = (idx: number) => setFileQueue(prev => prev.filter((_, i) => i !== idx));

  const uploadFiles = async (): Promise<any[]> => {
    const pending = fileQueue.filter(f => f.status === 'pending');
    if (!pending.length) return fileQueue.filter(f => f.status === 'done').map(f => f.result);

    setFileQueue(prev => prev.map(f => f.status === 'pending' ? { ...f, status: 'uploading' } : f));
    const uploaded = await api.upload.files(pending.map(f => f.file));
    setFileQueue(prev => {
      let uploadIdx = 0;
      return prev.map(f => {
        if (f.status === 'uploading') {
          const result = uploaded[uploadIdx++];
          return { ...f, status: 'done', result };
        }
        return f;
      });
    });
    return uploaded;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!targetEmployeeId) { setError('Please select a target person.'); return; }
    if (!title.trim()) { setError('Request title is required.'); return; }

    setSubmitting(true);
    try {
      let attachments: any[] = [];
      if (fileQueue.some(f => f.status === 'pending')) {
        attachments = await uploadFiles();
      } else {
        attachments = fileQueue.filter(f => f.status === 'done').map(f => f.result);
      }

      await api.taskRequests.create({
        title: title.trim(),
        description: description.trim(),
        targetEmployeeId,
        targetDepartmentId: (targetEmployee as any)?.departmentId,
        priority,
        dueDate,
        attachments
      });

      onRequestCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  const targetRoleFilters = getTargetRoleFilters();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={getModalTitle()} subtitle={getModalSubtitle()} maxWidth="2xl">
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-xl text-xs text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <pre className="whitespace-pre-wrap font-sans flex-1">{error}</pre>
            <button type="button" onClick={() => setError('')}><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {/* Role-based routing info */}
        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900/40 flex items-start gap-2 text-xs text-blue-800 dark:text-blue-300">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            {isStaff && 'As staff, you can send work requests to any Department Head. They will review and assign tasks accordingly.'}
            {isDeptHead && 'As Department Head, you can request work/events to the CEO or Trustee Board.'}
            {isCEO && 'As CEO, you can request work/events directly to the Trustee Board.'}
          </span>
        </div>

        {/* Dept-to-Dept Banner */}
        <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-100 dark:border-red-900/40 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-red-700" />
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block">From</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{department?.name.en || user?.name.en || 'You'}</span>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-red-500 shrink-0" />
          <div className="text-right">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block">To</span>
            <span className="font-bold text-red-800 dark:text-red-300">
              {(targetEmployee as any)?.name?.en || 'Select recipient below ↓'}
            </span>
          </div>
        </div>

        {/* Target Department and Employee */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Staff select a department first; senior recipients are filtered by role. */}
          {isStaff && (
            <DepartmentSelector
              label="Target Department"
              value={targetDepartmentId}
              onChange={(deptId) => {
                setTargetDepartmentId(deptId);
                setTargetEmployeeId('');
                setTargetEmployee(null);
              }}
            />
          )}
          <EmployeeSelector
            label={getEmployeeLabel()}
            value={targetEmployeeId}
            onChange={(userId, userObj) => {
              setTargetEmployeeId(userId);
              setTargetEmployee(userObj || null);
              if (userObj?.departmentId && !targetDepartmentId) {
                setTargetDepartmentId(userObj.departmentId);
              }
            }}
            departmentId={targetDepartmentId || undefined}
            roleFilters={targetRoleFilters}
            placeholder={
              isStaff
                ? 'Select a Department Head...'
                : isCEO
                ? 'Select a Trustee...'
                : 'Select senior recipient'
            }
            excludeUserIds={user ? [user._id] : []}
            disabled={isStaff && !targetDepartmentId}
            required
          />
        </div>

        {/* Title & Description */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">Request Title <span className="text-red-500">*</span></label>
          <input type="text" required value={title} onChange={e => setTitle(e.target.value)}
            placeholder="e.g., Organize Victory Day commemorative event"
            className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20" />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">Details & Expected Deliverable</label>
          <textarea rows={4} value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Provide context, specifications, deadlines, references..."
            className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 resize-none" />
        </div>

        {/* Priority & Due Date */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">Priority</label>
            <select value={priority} onChange={e => setPriority(e.target.value as TaskPriority)}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none">
              <option value="LOW">🟢 Low</option>
              <option value="MEDIUM">🔵 Medium</option>
              <option value="HIGH">🟠 High</option>
              <option value="URGENT">🔴 Urgent</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">Completion Date <span className="text-red-500">*</span></label>
            <input type="date" required value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none" />
          </div>
        </div>

        {/* FILE ATTACHMENTS */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
            Attachments <span className="text-slate-400 font-normal normal-case">(PDF, DOC, XLS, PPT, Images — max 25MB each)</span>
          </label>

          <div
            onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
              isDragOver ? 'border-red-500 bg-red-50 dark:bg-red-950/20' : 'border-slate-300 dark:border-slate-700 hover:border-red-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
            }`}
          >
            <input ref={fileInputRef} type="file" multiple accept={ALLOWED_EXTENSIONS.join(',')}
              onChange={e => { if (e.target.files) { addFiles(Array.from(e.target.files)); e.target.value = ''; } }} className="hidden" />
            <Upload className="w-5 h-5 text-slate-400" />
            <span className="text-xs text-slate-500">{isDragOver ? 'Drop here...' : 'Click or drag & drop files'}</span>
          </div>

          {fileQueue.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {fileQueue.map((f, idx) => (
                <div key={idx} className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs ${
                  f.status === 'error' ? 'bg-red-50 border-red-200' : f.status === 'done' ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
                }`}>
                  {getFileIcon(f.file.name)}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-800 dark:text-slate-200 truncate">{f.file.name}</div>
                    <div className="text-slate-400">{formatFileSize(f.file.size)}</div>
                  </div>
                  {f.status === 'uploading' && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
                  {f.status === 'done' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                  {f.status !== 'uploading' && (
                    <button type="button" onClick={() => removeFile(idx)} className="text-slate-400 hover:text-red-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Recipient can accept, decline, or clarify before acting.</span>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800">Cancel</button>
            <button type="submit" disabled={submitting}
              className="px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-red-800 hover:bg-red-900 text-white disabled:opacity-50 flex items-center gap-1.5">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {submitting ? 'Submitting...' : `Send Request${fileQueue.length > 0 ? ` (${fileQueue.length} file${fileQueue.length > 1 ? 's' : ''})` : ''}`}
            </button>
          </div>
        </div>

      </form>
    </Modal>
  );
};
