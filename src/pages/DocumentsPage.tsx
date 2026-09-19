import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { FileText, Plus, Download, Tag, Calendar, Lock, Unlock } from 'lucide-react';
import { Modal } from '../components/common/Modal';

export const DocumentsPage: React.FC = () => {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Form
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('POLICY');
  const [fileUrl, setFileUrl] = useState('');
  const [isConfidential, setIsConfidential] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const list = await api.documents.list({ category: categoryFilter || undefined });
      setDocuments(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, [categoryFilter]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSubmitting(true);
    try {
      await api.documents.create({
        title: title.trim(),
        category,
        fileUrl: fileUrl.trim() || '/documents/lwm-archival-policy.pdf',
        isConfidential
      });
      setShowUploadModal(false);
      setTitle('');
      setFileUrl('');
      fetchDocs();
    } catch (err: any) {
      alert(err.message || 'Upload failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileText className="w-6 h-6 text-red-700" />
            <span>Museum Archival & Administrative Repository</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Preservation policies, deed of gift contracts, exhibition floor layouts, and institutional circulars.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowUploadModal(true)}
          className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-red-800 hover:bg-red-900 text-white shadow-xs flex items-center gap-1.5 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Upload Document</span>
        </button>
      </div>

      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {['', 'POLICY', 'REPORT', 'MANUAL', 'MINUTES', 'EXHIBITION'].map(cat => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoryFilter(cat)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              categoryFilter === cat ? 'bg-red-800 text-white' : 'text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {cat || 'All Documents'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full p-12 text-center text-slate-400">Loading documents...</div>
        ) : documents.length === 0 ? (
          <div className="col-span-full p-12 text-center text-slate-400">No documents found.</div>
        ) : (
          documents.map(doc => (
            <div
              key={doc._id}
              className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {doc.category}
                  </span>
                  {doc.isConfidential ? (
                    <span className="flex items-center gap-1 text-[10px] text-rose-600 font-bold">
                      <Lock className="w-3 h-3" /> Confidential
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] text-slate-400">
                      <Unlock className="w-3 h-3" /> Public Archival
                    </span>
                  )}
                </div>

                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 line-clamp-2">
                  {doc.title}
                </h3>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400">{doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : 'Active'}</span>
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
              </div>
            </div>
          ))
        )}
      </div>

      {showUploadModal && (
        <Modal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          title="Upload Archival / Institutional Document"
          subtitle="Add file to museum digital assets repository"
          maxWidth="md"
        >
          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Document Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g., Rare Document Preservation Protocol 2026"
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Category
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none"
              >
                <option value="POLICY">Institutional Policy</option>
                <option value="REPORT">Archival / Research Report</option>
                <option value="MANUAL">Operational Manual</option>
                <option value="MINUTES">Board of Trustees Minutes</option>
                <option value="EXHIBITION">Exhibition Plan</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                File Storage URL or Name
              </label>
              <input
                type="text"
                value={fileUrl}
                onChange={e => setFileUrl(e.target.value)}
                placeholder="/documents/surrender-instrument-deed.pdf"
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none"
              />
            </div>

            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isConfidential}
                onChange={e => setIsConfidential(e.target.checked)}
                className="accent-red-600 rounded"
              />
              <span>Classified / Restricted to Department Heads & Board</span>
            </label>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2 rounded-xl text-xs text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-red-800 hover:bg-red-900 text-white shadow-xs"
              >
                {submitting ? 'Uploading...' : 'Save Document'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
