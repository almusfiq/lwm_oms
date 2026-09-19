import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { TaskRequest, TaskRequestStatus } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { PriorityBadge } from '../components/common/PriorityBadge';
import { UserAvatar } from '../components/common/UserAvatar';
import { Modal } from '../components/common/Modal';
import { 
  GitPullRequest, ArrowRight, CheckCircle2, XCircle, 
  HelpCircle, Calendar, Plus, MessageSquare, Building 
} from 'lucide-react';

interface TaskRequestsPageProps {
  onOpenCreateRequest: () => void;
  onOpenTaskDetail: (taskId: string) => void;
}

export const TaskRequestsPage: React.FC<TaskRequestsPageProps> = ({
  onOpenCreateRequest,
  onOpenTaskDetail
}) => {
  const { user, refreshMe } = useAuth();

  const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [requests, setRequests] = useState<TaskRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog States
  const [selectedRequest, setSelectedRequest] = useState<TaskRequest | null>(null);
  const [actionType, setActionType] = useState<'ACCEPT' | 'REJECT' | 'CLARIFY' | null>(null);
  const [actionMessage, setActionMessage] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await api.taskRequests.list({ type: activeTab });
      setRequests(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error(err);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [activeTab, user?._id]);

  const handleExecuteAction = async () => {
    if (!selectedRequest || !actionType) return;
    setSubmittingAction(true);
    try {
      if (actionType === 'ACCEPT') {
        const res = await api.taskRequests.accept(selectedRequest._id, actionMessage);
        alert(`Request accepted! Task #${res.task.taskId} has been created and assigned.`);
      } else if (actionType === 'REJECT') {
        if (!actionMessage.trim()) {
          alert('Please state the reason for declining this request.');
          setSubmittingAction(false);
          return;
        }
        await api.taskRequests.reject(selectedRequest._id, actionMessage);
      } else if (actionType === 'CLARIFY') {
        if (!actionMessage.trim()) {
          alert('Please enter your clarification inquiry.');
          setSubmittingAction(false);
          return;
        }
        await api.taskRequests.clarify(selectedRequest._id, actionMessage);
      }

      setActionType(null);
      setSelectedRequest(null);
      setActionMessage('');
      await fetchRequests();
      await refreshMe();
    } catch (err: any) {
      alert(err.message || 'Action failed');
    } finally {
      setSubmittingAction(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* Page Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <GitPullRequest className="w-6 h-6 text-red-700" />
            <span>Cross-Department Collaboration Requests</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Structured inter-departmental work dispatch with approval, clarification threads, and automatic task conversion.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenCreateRequest}
          className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-red-800 hover:bg-red-900 text-white shadow-xs flex items-center gap-1.5 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Cross-Dept Request</span>
        </button>
      </div>

      {/* Tabs: Incoming vs Outgoing */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-4">
        <button
          type="button"
          onClick={() => setActiveTab('incoming')}
          className={`pb-3 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'incoming'
              ? 'border-red-700 text-red-700 dark:text-red-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          <span>Incoming Requests (To You / Your Dept)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('outgoing')}
          className={`pb-3 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'outgoing'
              ? 'border-red-700 text-red-700 dark:text-red-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          <span>Outgoing Requests (From You / Your Dept)</span>
        </button>
      </div>

      {/* Requests List */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            Loading cross-department requests...
          </div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            No {activeTab} requests found.
          </div>
        ) : (
          requests.map(req => {
            const isPending = req.status === 'PENDING';
            const isIncoming = activeTab === 'incoming';

            return (
              <div
                key={req._id}
                className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-4"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-bold text-slate-500">
                      {req.requestId}
                    </span>
                    <StatusBadge status={req.status} />
                    <PriorityBadge priority={req.priority} />
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Deliverable Due: <strong>{req.dueDate}</strong></span>
                  </div>
                </div>

                {/* Title & Description */}
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {req.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-line leading-relaxed">
                    {req.description}
                  </p>
                </div>

                {/* Synergy Department Path & People */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
                  {/* From */}
                  <div className="flex items-center gap-2">
                    <UserAvatar name={req.requester?.name || 'Requester'} role={req.requester?.role} size="sm" />
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Requester</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {req.requester?.name.en} ({req.requesterDepartment?.code})
                      </span>
                    </div>
                  </div>

                  <ArrowRight className="w-4 h-4 text-red-600 hidden sm:block" />

                  {/* To */}
                  <div className="flex items-center gap-2">
                    <UserAvatar name={req.targetEmployee?.name || 'Target'} role={req.targetEmployee?.role} size="sm" />
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Assigned Colleague</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {req.targetEmployee?.name.en} ({req.targetDepartment?.code})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Clarification Notes if Any */}
                {req.clarificationComments && req.clarificationComments.length > 0 && (
                  <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900/30 text-xs space-y-1.5">
                    <div className="font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Clarification Inquiry</span>
                    </div>
                    {req.clarificationComments.map((cc, i) => (
                      <p key={i} className="text-slate-700 dark:text-slate-300 italic">
                        "{cc.message}"
                      </p>
                    ))}
                  </div>
                )}

                {/* Decline reason if rejected */}
                {req.responseMessage && req.status === 'REJECTED' && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-xl border border-rose-200 text-xs text-rose-800 dark:text-rose-200">
                    <strong>Decline Reason:</strong> {req.responseMessage}
                  </div>
                )}

                {/* Converted Task Link */}
                {req.convertedTaskId && (
                  <div className="flex items-center gap-2 text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="text-slate-600 dark:text-slate-400">Converted into active task:</span>
                    <button
                      type="button"
                      onClick={() => onOpenTaskDetail(req.convertedTaskId!)}
                      className="font-bold text-red-700 dark:text-red-400 hover:underline"
                    >
                      View Converted Task →
                    </button>
                  </div>
                )}

                {/* Action Buttons for Incoming Pending Requests */}
                {isIncoming && isPending && (
                  <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRequest(req);
                        setActionType('ACCEPT');
                        setActionMessage('Accepted. Converting into active task immediately.');
                      }}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs flex items-center gap-1.5 transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Accept & Create Task</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRequest(req);
                        setActionType('CLARIFY');
                        setActionMessage('');
                      }}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1.5 hover:bg-blue-100 transition-colors"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>Ask Clarification</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRequest(req);
                        setActionType('REJECT');
                        setActionMessage('');
                      }}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-center gap-1.5 hover:bg-rose-100 transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Decline</span>
                    </button>
                  </div>
                )}

              </div>
            );
          })
        )}
      </div>

      {/* Action Dialog Modal */}
      {actionType && selectedRequest && (
        <Modal
          isOpen={Boolean(actionType)}
          onClose={() => setActionType(null)}
          title={
            actionType === 'ACCEPT' ? 'Accept Request & Create Task' :
            actionType === 'REJECT' ? 'Decline Request' : 'Ask for Clarification'
          }
          subtitle={`Directive: ${selectedRequest.title}`}
          maxWidth="md"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                {actionType === 'ACCEPT' ? 'Acceptance Note' :
                 actionType === 'REJECT' ? 'State Reason for Declining *' : 'Inquiry / Question to Requester *'}
              </label>
              <textarea
                rows={4}
                value={actionMessage}
                onChange={e => setActionMessage(e.target.value)}
                placeholder={
                  actionType === 'ACCEPT' ? 'e.g., Accepting into our department schedule for delivery this week.' :
                  actionType === 'REJECT' ? 'e.g., Currently prioritizing exhibition catalog deadlines. Can reschedule after the 25th.' :
                  'e.g., What resolution and dpi are required for this print format?'
                }
                className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setActionType(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteAction}
                disabled={submittingAction}
                className={`px-5 py-2 rounded-xl text-xs font-semibold text-white shadow-xs transition-colors ${
                  actionType === 'ACCEPT' ? 'bg-emerald-700 hover:bg-emerald-800' :
                  actionType === 'REJECT' ? 'bg-rose-700 hover:bg-rose-800' : 'bg-blue-700 hover:bg-blue-800'
                }`}
              >
                {submittingAction ? 'Processing...' : 'Confirm Action'}
              </button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
};
