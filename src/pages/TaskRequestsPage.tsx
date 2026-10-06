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
  HelpCircle, Calendar, Plus, MessageSquare, Building,
  UserPlus, Users, Search, Check
} from 'lucide-react';
import { getUserRole, isDepartmentHead } from '../utils/hierarchy';

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
  const [actionType, setActionType] = useState<'ACCEPT' | 'REJECT' | 'CLARIFY' | 'ASSIGN' | null>(null);
  const [actionMessage, setActionMessage] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  // Assignment state (Dept Head assigning approved task to department staff)
  const [deptEmployees, setDeptEmployees] = useState<any[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [acceptAssigneeId, setAcceptAssigneeId] = useState<string>('');
  const [assignIds, setAssignIds] = useState<string[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState('');

  const role = getUserRole(user);
  const isExec = role === 'CEO' || role === 'TRUSTEE';
  const isHead = isDepartmentHead(user);

  const canManage = (req: TaskRequest) =>
    isExec || (isHead && !!user?.departmentId && (user.departmentId === req.targetDepartmentId || (req.targetDepartment as any)?.code === user.departmentId));

  const loadDeptEmployees = async (deptId: string) => {
    setLoadingEmployees(true);
    try {
      const list = await api.users.list({ departmentId: deptId, activeOnly: true });
      const arr = (Array.isArray(list) ? list : []).filter((u: any) => u.role !== 'SUPER_ADMIN' && u.roleId !== 'SUPER_ADMIN');
      setDeptEmployees(arr);
      return arr;
    } catch (err) {
      console.error(err);
      setDeptEmployees([]);
      return [];
    } finally {
      setLoadingEmployees(false);
    }
  };

  const openAccept = async (req: TaskRequest) => {
    setSelectedRequest(req);
    setActionType('ACCEPT');
    setActionMessage('Accepted. Converting into active task immediately.');
    setAcceptAssigneeId(req.suggestedEmployeeId || user?._id || '');
    await loadDeptEmployees(req.targetDepartmentId);
  };

  const openAssign = async (req: TaskRequest) => {
    setSelectedRequest(req);
    setActionType('ASSIGN');
    setActionMessage('');
    setEmployeeSearch('');
    setAssignIds(req.convertedTask?.assignedTo || (req.targetEmployeeId ? [req.targetEmployeeId] : []));
    await loadDeptEmployees(req.targetDepartmentId);
  };

  const toggleAssignId = (id: string) => {
    setAssignIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const closeDialog = () => {
    setActionType(null);
    setSelectedRequest(null);
    setActionMessage('');
    setAssignIds([]);
    setAcceptAssigneeId('');
  };

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
        const res = await api.taskRequests.accept(selectedRequest._id, {
          responseMessage: actionMessage,
          assignedToId: acceptAssigneeId || undefined
        });
        alert(`Request approved! Task #${res.task.taskId} has been created and assigned. You can reassign it anytime using "Assign to Team Member".`);
      } else if (actionType === 'ASSIGN') {
        if (assignIds.length === 0) {
          alert('Select at least one employee to assign.');
          setSubmittingAction(false);
          return;
        }
        await api.taskRequests.assign(selectedRequest._id, assignIds, actionMessage.trim() || undefined);
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

      closeDialog();
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

                {/* Converted Task Link + Assignment */}
                {req.convertedTaskId && (
                  <div className="p-3 rounded-xl border border-emerald-200/70 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span className="text-slate-600 dark:text-slate-400">Approved & converted into task</span>
                        <button
                          type="button"
                          onClick={() => onOpenTaskDetail(req.convertedTaskId!)}
                          className="font-bold text-red-700 dark:text-red-400 hover:underline"
                        >
                          {req.convertedTask?.taskId || 'View Task'} →
                        </button>
                      </div>
                      {req.convertedTask?.assignees && req.convertedTask.assignees.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-slate-500">Assigned to:</span>
                          {req.convertedTask.assignees.map((a: any) => (
                            <span key={a._id} className="px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-200">
                              {a.name?.en || a.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {isIncoming && canManage(req) && req.convertedTask?.status !== 'COMPLETED' && (
                      <button
                        type="button"
                        onClick={() => openAssign(req)}
                        className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-red-800 hover:bg-red-900 text-white shadow-xs flex items-center gap-1.5 transition-colors shrink-0"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Assign to Team Member</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Action Buttons for Incoming Pending Requests */}
                {isIncoming && isPending && (
                  <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => openAccept(req)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs flex items-center gap-1.5 transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve & Create Task</span>
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
          onClose={closeDialog}
          title={
            actionType === 'ACCEPT' ? 'Approve Request & Create Task' :
            actionType === 'ASSIGN' ? 'Assign Task to Team Member' :
            actionType === 'REJECT' ? 'Decline Request' : 'Ask for Clarification'
          }
          subtitle={`Directive: ${selectedRequest.title}`}
          maxWidth="md"
        >
          <div className="space-y-4">
            {/* Accept: optional assignee picker */}
            {actionType === 'ACCEPT' && canManage(selectedRequest) && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Assign To (optional)
                </label>
                <select
                  value={acceptAssigneeId}
                  onChange={e => setAcceptAssigneeId(e.target.value)}
                  disabled={loadingEmployees}
                  className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                >
                  <option value={user?._id || ''}>Keep with me ({user?.name?.en})</option>
                  {deptEmployees.filter(e => e._id !== user?._id).map(emp => (
                    <option key={emp._id} value={emp._id}>
                      {emp.name?.en} — {emp.designation?.en || emp.role}
                      {emp._id === selectedRequest.suggestedEmployeeId ? ' (suggested by requester)' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  You can change or add more assignees later with “Assign to Team Member”.
                </p>
              </div>
            )}

            {/* Assign: multi-select department staff */}
            {actionType === 'ASSIGN' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Select Employees ({selectedRequest.targetDepartment?.code || 'Department'}) *
                </label>
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={employeeSearch}
                    onChange={e => setEmployeeSearch(e.target.value)}
                    placeholder="Search by name or designation..."
                    className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  />
                </div>
                <div className="max-h-64 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
                  {loadingEmployees ? (
                    <div className="p-4 text-center text-xs text-slate-400">Loading department staff...</div>
                  ) : deptEmployees.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">No employees found in this department.</div>
                  ) : (
                    deptEmployees
                      .filter(emp => {
                        const q = employeeSearch.trim().toLowerCase();
                        if (!q) return true;
                        return (emp.name?.en || '').toLowerCase().includes(q) || (emp.designation?.en || '').toLowerCase().includes(q);
                      })
                      .map(emp => {
                        const checked = assignIds.includes(emp._id);
                        return (
                          <button
                            key={emp._id}
                            type="button"
                            onClick={() => toggleAssignId(emp._id)}
                            className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left transition-colors ${
                              checked ? 'bg-red-50 dark:bg-red-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <UserAvatar name={emp.name} role={emp.role} size="sm" />
                              <div>
                                <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                                  {emp.name?.en}{emp._id === user?._id ? ' (You)' : ''}
                                </div>
                                <div className="text-[11px] text-slate-500">{emp.designation?.en || emp.role}</div>
                              </div>
                            </div>
                            <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                              checked ? 'bg-red-700 border-red-700 text-white' : 'border-slate-300 dark:border-slate-600'
                            }`}>
                              {checked && <Check className="w-3.5 h-3.5" />}
                            </span>
                          </button>
                        );
                      })
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  {assignIds.length} selected • New assignees are notified. You and the requester stay on the task as collaborators.
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                {actionType === 'ACCEPT' ? 'Approval Note' :
                 actionType === 'ASSIGN' ? 'Instruction for Assignee (optional)' :
                 actionType === 'REJECT' ? 'State Reason for Declining *' : 'Inquiry / Question to Requester *'}
              </label>
              <textarea
                rows={actionType === 'ASSIGN' ? 3 : 4}
                value={actionMessage}
                onChange={e => setActionMessage(e.target.value)}
                placeholder={
                  actionType === 'ACCEPT' ? 'e.g., Accepting into our department schedule for delivery this week.' :
                  actionType === 'ASSIGN' ? 'e.g., Please coordinate with the requester and deliver by the deadline.' :
                  actionType === 'REJECT' ? 'e.g., Currently prioritizing exhibition catalog deadlines. Can reschedule after the 25th.' :
                  'e.g., What resolution and dpi are required for this print format?'
                }
                className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={closeDialog}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteAction}
                disabled={submittingAction || (actionType === 'ASSIGN' && assignIds.length === 0)}
                className={`px-5 py-2 rounded-xl text-xs font-semibold text-white shadow-xs transition-colors disabled:opacity-50 ${
                  actionType === 'ACCEPT' ? 'bg-emerald-700 hover:bg-emerald-800' :
                  actionType === 'ASSIGN' ? 'bg-red-800 hover:bg-red-900' :
                  actionType === 'REJECT' ? 'bg-rose-700 hover:bg-rose-800' : 'bg-blue-700 hover:bg-blue-800'
                }`}
              >
                {submittingAction ? 'Processing...' : actionType === 'ASSIGN' ? 'Assign Task' : actionType === 'ACCEPT' ? 'Approve' : 'Confirm Action'}
              </button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
};
