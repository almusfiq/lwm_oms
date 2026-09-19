import React, { useState, useRef, useCallback } from 'react';
import { Task } from '../../types';
import { api } from '../../api/client';
import { Modal } from '../common/Modal';
import { 
  CheckCircle2, Upload, X, FileText, Image, Table2, 
  Presentation, File, Loader2, AlertCircle, Sparkles, Check, Paperclip, ShieldCheck
} from 'lucide-react';

interface FileUploadState {
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  result?: any;
  error?: string;
}

interface SubmitWorkModalProps {
  isOpen: boolean;
  task: Task | null;
  onClose: () => void;
  onSubmitted: (updatedTask: any) => void;
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
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.txt', '.csv', '.zip'
];

export const SubmitWorkModal: React.FC<SubmitWorkModalProps> = ({
  isOpen,
  task,
  onClose,
  onSubmitted
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [note, setNote] = useState('');
  const [markChecklistComplete, setMarkChecklistComplete] = useState(true);
  const [fileQueue, setFileQueue] = useState<FileUploadState[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!task) return null;

  const remainingChecklistCount = task.checklist?.filter(c => !c.completed).length || 0;

  const addFiles = (newFiles: File[]) => {
    const errors: string[] = [];
    const valid: FileUploadState[] = [];
    for (const f of newFiles) {
      const ext = '.' + (f.name.split('.').pop() || '').toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        errors.push(`"${f.name}" — file type not allowed.`);
        continue;
      }
      if (f.size > 25 * 1024 * 1024) {
        errors.push(`"${f.name}" exceeds 25MB limit (${formatFileSize(f.size)}).`);
        continue;
      }
      valid.push({ file: f, status: 'pending' });
    }
    if (errors.length) setError(errors.join('\n'));
    setFileQueue(prev => [...prev, ...valid]);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const removeFile = (idx: number) => {
    setFileQueue(prev => prev.filter((_, i) => i !== idx));
  };

  const uploadAllFiles = async (): Promise<any[]> => {
    const pendingIndices = fileQueue
      .map((f, i) => f.status === 'pending' ? i : -1)
      .filter(i => i !== -1);

    if (pendingIndices.length === 0) {
      return fileQueue.filter(f => f.status === 'done').map(f => f.result);
    }

    const pendingFiles = pendingIndices.map(i => fileQueue[i].file);

    setFileQueue(prev => prev.map((f, i) =>
      pendingIndices.includes(i) ? { ...f, status: 'uploading' } : f
    ));

    try {
      const uploaded = await api.upload.files(pendingFiles);
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
        .map(f => f.result)
        .concat(uploaded);
    } catch (err: any) {
      setFileQueue(prev => prev.map((f, i) =>
        pendingIndices.includes(i) ? { ...f, status: 'error', error: err.message } : f
      ));
      throw err;
    }
  };

  const handleSubmitWork = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      // 1. Upload any pending attachments
      let uploadedAttachments: any[] = [];
      if (fileQueue.length > 0) {
        uploadedAttachments = await uploadAllFiles();
      }

      // 2. Submit task work
      const updatedTask = await api.tasks.submit(task._id, {
        note: note.trim(),
        attachments: uploadedAttachments,
        markChecklistComplete
      });

      // Reset & notify parent
      setNote('');
      setFileQueue([]);
      onSubmitted(updatedTask);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit work. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Submit Work: ${task.taskId}`}
      subtitle={`Fulfill & submit deliverables for "${task.title}"`}
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmitWork} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">

        {/* Auto-Complete / Review Status Banner */}
        <div className={`p-3.5 rounded-xl border flex items-start gap-3 ${
          task.requiresApproval
            ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200'
            : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-200'
        }`}>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
            task.requiresApproval ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
          }`}>
            {task.requiresApproval ? <ShieldCheck className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider">
              {task.requiresApproval ? 'Approval Required Upon Submission' : 'Auto-Complete Upon Submission'}
            </div>
            <div className="text-xs mt-0.5 leading-relaxed opacity-90">
              {task.requiresApproval
                ? 'Your work & files will be set to IN REVIEW (100% Progress) and sent to your manager/requester for formal approval.'
                : 'Submitting will automatically mark this directive as COMPLETED (100% Progress) and record your deliverables.'
              }
            </div>
          </div>
        </div>

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

        {/* Completion Note / Deliverables Description */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
            Completion Summary & Deliverable Notes
          </label>
          <textarea
            rows={4}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Describe what was accomplished, key findings, summary of attached reports, or notes for the requester..."
            className="w-full p-3.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20"
          />
        </div>

        {/* Deliverable File Attachments */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
            Attach Evidence & Deliverable Files <span className="text-slate-400 font-normal normal-case">(PDF, DOC, XLS, PPT, JPG, PNG, ZIP — Max 25MB each)</span>
          </label>

          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
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
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <Upload className="w-5 h-5 text-red-700" />
              <span className="text-xs font-semibold">
                {isDragOver ? 'Drop deliverable files here...' : 'Click or drag & drop deliverable files here'}
              </span>
            </div>
            <span className="text-[11px] text-slate-400">Reports, spreadsheets, scanned documents, media assets, or compressed packages</span>
          </div>

          {/* File Queue */}
          {fileQueue.length > 0 && (
            <div className="mt-2.5 space-y-1.5">
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
                  {getFileIcon(f.file.name)}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-800 dark:text-slate-200 truncate">{f.file.name}</div>
                    <div className="text-slate-400">{formatFileSize(f.file.size)}</div>
                  </div>

                  {f.status === 'uploading' && <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0" />}
                  {f.status === 'done' && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                  {f.status === 'error' && <span className="text-red-500 text-[10px] shrink-0 truncate">{f.error}</span>}

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

        {/* Checklist Auto-Complete Option */}
        {remainingChecklistCount > 0 && (
          <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={markChecklistComplete}
              onChange={e => setMarkChecklistComplete(e.target.checked)}
              className="w-4 h-4 accent-red-600 rounded"
            />
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Automatically mark remaining {remainingChecklistCount} checklist subtask{remainingChecklistCount > 1 ? 's' : ''} as completed
            </div>
          </label>
        )}

        {/* Modal Action Footer */}
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
                {fileQueue.some(f => f.status === 'uploading') ? 'Uploading files...' : 'Submitting work...'}
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>{task.requiresApproval ? 'Submit Work for Review' : 'Submit Work & Auto-Complete'}</span>
              </>
            )}
          </button>
        </div>

      </form>
    </Modal>
  );
};
