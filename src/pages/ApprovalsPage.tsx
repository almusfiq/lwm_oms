import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { UserAvatar } from '../components/common/UserAvatar';
import { Modal } from '../components/common/Modal';
import { downloadApprovalPdf } from '../utils/pdfGenerator';
import { getUserRole, isDepartmentHead } from '../utils/hierarchy';
import {
  CheckCheck, Plus, CheckCircle2, XCircle, ArrowUpCircle,
  Calendar, Clock, Download, ChevronRight, AlertCircle, Info,
  Send, Shield, UserCog, Building2
} from 'lucide-react';

type ApprovalFilter = '' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'REFERRED';

export const ApprovalsPage: React.FC = () => {
  const { user } = useAuth();
  const [approvals, setApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ApprovalFilter>('');
  const [viewFilter, setViewFilter] = useState<'all' | 'incoming' | 'mine'>('all');

  // Submit Modal
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [requestType, setRequestType] = useState('GENERAL_REQUEST');
  const [targetLevel, setTargetLevel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Action Dialog
  const [selectedApproval, setSelectedApproval] = useState<any | null>(null);
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | 'REFER' | null>(null);
  const [reason, setReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const role = getUserRole(user);
  const isTrustee = role === 'TRUSTEE';
  const isCEO = role === 'CEO';
  const isDeptHead = isDepartmentHead(user);
  const isStaff = !isTrustee && !isCEO && !isDeptHead;

  // Trustees cannot submit; staff can only submit to dept head
  const canSubmit = !isTrustee;

  // Allowed target levels based on role
  const allowedTargetLevels = (): { value: string; label: string }[] => {
    if (isCEO) return [{ value: 'TRUSTEE', label: '🏛️ Trustee Board' }];
    if (isDeptHead) return [
      { value: 'CEO', label: '👔 CEO' },
      { value: 'TRUSTEE', label: '🏛️ Trustee Board (Major)' }
    ];
    // Staff / Officer → always dept head only (auto-routed, no choice)
    return [{ value: 'DEPT_HEAD', label: '🏢 Department Head' }];
  };

  const fetchApprovals = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      if (viewFilter === 'incoming') params.type = 'incoming';
      else if (viewFilter === 'mine') params.type = 'my_requests';
      const list = await api.approvals.list(params);
      setApprovals(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchApprovals(); }, [statusFilter, viewFilter]);

  const handleAction = async () => {
    if (!selectedApproval || !actionType) return;
    setActionLoading(true);
    try {
      if (actionType === 'APPROVE') {
        await api.approvals.approve(selectedApproval._id, reason || 'Approved.');
      } else if (actionType === 'REJECT') {
        await api.approvals.reject(selectedApproval._id, reason || 'Declined.');
      } else if (actionType === 'REFER') {
        await api.approvals.refer(selectedApproval._id, reason);
      }
      setSelectedApproval(null);
      setActionType(null);
      setReason('');
      fetchApprovals();
    } catch (err: any) {
      alert(err.message || 'Action failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    if (!title.trim() || !description.trim()) {
      setSubmitError('Title and description are required.');
      return;
    }
    setSubmitting(true);
    try {
      const levels = allowedTargetLevels();
      const level = targetLevel || levels[0].value;
      await api.approvals.create({
        title: title.trim(),
        description: description.trim(),
        requestType,
        targetLevel: level
      });
      setShowSubmitModal(false);
      setTitle(''); setDescription(''); setSubmitError('');
      setViewFilter('mine');
      fetchApprovals();
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to submit.');
    } finally {
      setSubmitting(false);
    }
  };

  // Can the current user act on this approval?
  const canAct = (appr: any) => {
    if (appr.status !== 'PENDING') return false;
    if (role === 'SUPER_ADMIN') return true;
    if (isTrustee && appr.level === 'TRUSTEE') return true;
    if (isCEO && appr.level === 'CEO') return true;
    if (isDeptHead && appr.level === 'DEPT_HEAD' && appr.approverId === user?._id) return true;
    if (appr.approverId === user?._id) return true;
    return false;
  };

  const canRefer = (appr: any) => {
    if (!canAct(appr)) return false;
    if (isTrustee) return false; // top level
    return true;
  };

  // Can the current user download PDF (both requester and approver/trustee)
  const canDownload = (appr: any) => {
    return (
      appr.requesterId === user?._id ||
      appr.approverId === user?._id ||
      isTrustee ||
      isCEO
    );
  };

  const levelLabel = (level: string) => {
    if (level === 'TRUSTEE') return '🏛️ Trustee Board';
    if (level === 'CEO') return '👔 CEO';
    return '🏢 Dept. Head';
  };

  const filterTabs: { label: string; value: ApprovalFilter }[] = [
    { label: 'All', value: '' },
    { label: 'Pending', value: 'PENDING' },
    { label: 'Approved', value: 'APPROVED' },
    { label: 'Declined', value: 'REJECTED' },
    { label: 'Referred', value: 'REFERRED' }
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <CheckCheck className="w-6 h-6 text-red-700" />
            <span>{isStaff ? 'Submit Requests' : 'Approvals Engine'}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {isStaff
              ? 'Submit formal requests to your Department Head for approval.'
              : isDeptHead
              ? 'Review staff requests and forward to CEO when needed.'
              : isCEO
              ? 'Review Department Head requests and refer major ones to Trustee Board.'
              : 'Final authority for all museum governance decisions.'}
          </p>
        </div>

        {/* Role context badges */}
        <div className="flex items-center gap-2">
          {isTrustee && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 text-xs font-semibold text-red-800 dark:text-red-300">
              <Shield className="w-3.5 h-3.5" />
              <span>Trustee Board Authority</span>
            </div>
          )}
          {canSubmit && (
            <button
              type="button"
              onClick={() => setShowSubmitModal(true)}
              className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-red-800 hover:bg-red-900 text-white shadow-xs flex items-center gap-1.5 transition-colors shrink-0"
            >
              <Send className="w-4 h-4" />
              <span>{isStaff ? 'Submit to Dept Head' : isDeptHead ? 'Request to CEO / Trustee' : 'Request to Trustee'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Workflow Info Banner */}
      <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400">
        <strong className="text-slate-700 dark:text-slate-300">Approval Chain:</strong>
        {' '}Staff → 🏢 Dept Head → 👔 CEO → 🏛️ Trustee Board.
        {isDeptHead && ' You can approve or refer requests from your staff to the CEO.'}
        {isCEO && ' You can approve or refer Dept Head requests to the Trustee Board.'}
        {isTrustee && ' Any trustee board member can action these requests. Once approved, both parties can download the PDF record.'}
      </div>

      {/* View Toggle */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['all', 'incoming', 'mine'] as const).map(v => (
          <button
            key={v}
            type="button"
            onClick={() => setViewFilter(v)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors capitalize ${
              viewFilter === v ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {v === 'all' ? 'All' : v === 'incoming' ? '📥 Incoming' : '📤 My Requests'}
          </button>
        ))}
        <div className="h-5 border-l border-slate-200 dark:border-slate-700 mx-1" />
        {filterTabs.map(tab => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setStatusFilter(tab.value)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              statusFilter === tab.value ? 'bg-red-800 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Approvals List */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading approval queue...</div>
        ) : approvals.length === 0 ? (
          <div className="p-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <CheckCheck className="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-700" />
            <p className="font-semibold text-slate-500">No approval requests in this view.</p>
          </div>
        ) : (
          approvals.map(appr => (
            <div
              key={appr._id}
              className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3"
            >
              {/* Top row */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div className="flex items-center flex-wrap gap-2">
                  <StatusBadge status={appr.status} />
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    {(appr.requestType || '').replace(/_/g, ' ')}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/30">
                    {levelLabel(appr.level)}
                  </span>
                </div>
                <span className="text-xs text-slate-400 flex items-center gap-1 shrink-0">
                  <Clock className="w-3.5 h-3.5" />
                  {new Date(appr.createdAt).toLocaleDateString('en-BD', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>

              {/* Title & Description */}
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{appr.title}</h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed line-clamp-3">
                  {appr.description}
                </p>
              </div>

              {/* Requester / Approver row */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <UserAvatar name={appr.requester?.name || 'Requester'} role={appr.requester?.role} size="sm" />
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Submitted By</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {appr.requester?.name?.en} {appr.requesterDepartment ? `(${appr.requesterDepartment.code})` : ''}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                <div className="flex items-center gap-2">
                  <UserAvatar name={appr.approver?.name || 'Approver'} role={appr.approver?.role} size="sm" />
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase tracking-wider">
                      {appr.status === 'APPROVED' ? 'Approved By' : appr.status === 'REJECTED' ? 'Declined By' : 'Pending With'}
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {appr.approver?.name?.en || levelLabel(appr.level)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Referral note */}
              {appr.referralNote && (
                <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/30 text-xs text-purple-800 dark:text-purple-300 flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span><strong>Referral Note:</strong> {appr.referralNote}</span>
                </div>
              )}

              {/* Decision note */}
              {appr.reason && appr.status !== 'PENDING' && (
                <div className={`p-2.5 rounded-xl text-xs flex items-start gap-2 ${
                  appr.status === 'APPROVED'
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-300'
                    : 'bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/30 text-red-800 dark:text-red-300'
                }`}>
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span><strong>Decision:</strong> {appr.reason}</span>
                </div>
              )}

              {/* Action buttons */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center flex-wrap gap-2">
                {canAct(appr) && (
                  <>
                    <button
                      type="button"
                      onClick={() => { setSelectedApproval(appr); setActionType('APPROVE'); setReason('Approved.'); }}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white flex items-center gap-1.5 transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Approve
                    </button>

                    <button
                      type="button"
                      onClick={() => { setSelectedApproval(appr); setActionType('REJECT'); setReason(''); }}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 text-rose-800 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900/40 flex items-center gap-1.5 transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Decline
                    </button>

                    {canRefer(appr) && (
                      <button
                        type="button"
                        onClick={() => { setSelectedApproval(appr); setActionType('REFER'); setReason(''); }}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-purple-50 text-purple-800 hover:bg-purple-100 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-900/40 flex items-center gap-1.5 transition-colors"
                      >
                        <ArrowUpCircle className="w-3.5 h-3.5" />
                        {isDeptHead ? 'Refer to CEO' : 'Refer to Trustee'}
                      </button>
                    )}
                  </>
                )}

                {/* PDF download — available to both requester and approver */}
                {canDownload(appr) && (
                  <button
                    type="button"
                    onClick={() => downloadApprovalPdf(appr)}
                    className="ml-auto px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {appr.status === 'APPROVED' ? 'Download PDF' : 'PDF'}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Action Confirmation Dialog */}
      {actionType && selectedApproval && (
        <Modal
          isOpen
          onClose={() => { setActionType(null); setSelectedApproval(null); }}
          title={
            actionType === 'APPROVE' ? '✅ Grant Approval'
            : actionType === 'REJECT' ? '❌ Decline Request'
            : isDeptHead ? '📤 Refer to CEO' : '📤 Refer to Trustee Board'
          }
          subtitle={selectedApproval.title}
          maxWidth="md"
        >
          <div className="space-y-4">
            {actionType === 'REFER' && (
              <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-xl border border-purple-100 dark:border-purple-900/30 text-xs text-purple-800 dark:text-purple-300">
                {isDeptHead
                  ? 'This request will be escalated to the CEO for review and decision.'
                  : 'This request will be escalated to the Trustee Board for final decision.'
                }
              </div>
            )}

            {actionType === 'APPROVE' && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-100 dark:border-emerald-900/30 text-xs text-emerald-800 dark:text-emerald-300">
                Once approved, both you and the requester can download a PDF record of this approval.
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                {actionType === 'REFER' ? 'Referral Note (optional)' : 'Decision Note'}
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder={
                  actionType === 'APPROVE' ? 'State approval conditions or remarks...'
                  : actionType === 'REJECT' ? 'Explain reason for declining...'
                  : 'Why are you referring this to a higher authority?'
                }
                className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-800/40 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => { setActionType(null); setSelectedApproval(null); }}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAction}
                disabled={actionLoading}
                className={`px-5 py-2 rounded-xl text-xs font-semibold text-white shadow-xs disabled:opacity-60 ${
                  actionType === 'APPROVE' ? 'bg-emerald-700 hover:bg-emerald-800'
                  : actionType === 'REJECT' ? 'bg-rose-700 hover:bg-rose-800'
                  : 'bg-purple-700 hover:bg-purple-800'
                }`}
              >
                {actionLoading ? 'Processing...'
                  : actionType === 'APPROVE' ? 'Confirm Approval'
                  : actionType === 'REJECT' ? 'Confirm Decline'
                  : 'Confirm Referral'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Submit New Request Modal */}
      {showSubmitModal && (
        <Modal
          isOpen
          onClose={() => { setShowSubmitModal(false); setSubmitError(''); }}
          title={isStaff ? 'Submit Request to Department Head' : isDeptHead ? 'Submit Request to CEO / Trustee' : 'Submit Request to Trustee Board'}
          subtitle="Formal governance request with full audit trail"
          maxWidth="lg"
        >
          <form onSubmit={handleSubmitNew} className="space-y-4">

            {submitError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 rounded-xl text-xs text-red-700 dark:text-red-300">
                {submitError}
              </div>
            )}

            {/* Routing info */}
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900/30 text-xs text-blue-800 dark:text-blue-300 flex items-start gap-2">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                {isStaff && 'Your request will go to your Department Head for review. They can approve, decline, or refer it to the CEO.'}
                {isDeptHead && 'Choose whether to send directly to the CEO or escalate to the Trustee Board for major decisions.'}
                {isCEO && 'Your request will be sent directly to the Trustee Board for final authorization.'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Request Category
                </label>
                <select
                  value={requestType}
                  onChange={e => setRequestType(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none"
                >
                  <option value="GENERAL_REQUEST">General Request</option>
                  <option value="BUDGET_APPROVAL">Budget Authorization</option>
                  <option value="SPECIAL_PROCUREMENT">Procurement / Acquisition</option>
                  <option value="EXHIBITION_PLAN">Exhibition Plan</option>
                  <option value="CROSS_DEPT_INITIATIVE">Cross-Department Initiative</option>
                  <option value="LEAVE_REQUEST">Leave Request</option>
                </select>
              </div>

              {/* Target level — only if multiple options (Dept Head has 2 choices) */}
              {allowedTargetLevels().length > 1 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Submit To
                  </label>
                  <select
                    value={targetLevel || allowedTargetLevels()[0].value}
                    onChange={e => setTargetLevel(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none"
                  >
                    {allowedTargetLevels().map(l => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Subject / Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g., Request for emergency archival equipment repair"
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-800/40"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Justification & Details <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={4}
                required
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Provide full context, cost estimates, urgency, and expected outcomes..."
                className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-800/40 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => { setShowSubmitModal(false); setSubmitError(''); }}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-red-800 hover:bg-red-900 text-white shadow-xs disabled:opacity-60"
              >
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
