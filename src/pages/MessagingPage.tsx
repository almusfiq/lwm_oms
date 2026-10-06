import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { getUserRole, isDepartmentHead } from '../utils/hierarchy';
import { Modal } from '../components/common/Modal';
import { UserAvatar } from '../components/common/UserAvatar';
import {
  MessageSquare, Send, Inbox, PenSquare, Users, Building2,
  CheckCircle2, Circle, Clock, ChevronRight, X, Search, RefreshCw
} from 'lucide-react';

type Tab = 'inbox' | 'sent';

const PRIORITY_TYPES = [
  { value: 'individual', label: 'Individual Employee(s)', icon: Users },
  { value: 'department', label: 'Entire Department', icon: Building2 },
  { value: 'all', label: 'All Employees', icon: Send },
];

export const MessagingPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('inbox');
  const [inbox, setInbox] = useState<any[]>([]);
  const [sent, setSent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<any | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Compose form state
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipientType, setRecipientType] = useState<'individual' | 'department' | 'all'>('individual');
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [employees, setEmployees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [empSearch, setEmpSearch] = useState('');

  const role = getUserRole(user);
  const isDeptHead = isDepartmentHead(user);
  const canSend = role === 'CEO' || role === 'TRUSTEE' || isDeptHead;

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const [inboxData, sentData] = await Promise.all([
        api.messages.inbox(),
        api.messages.sent()
      ]);
      setInbox(inboxData);
      setSent(sentData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    if (showCompose) {
      api.users.list({ activeOnly: true }).then((data: any) => {
        const users = Array.isArray(data) ? data : (data.items || []);
        setEmployees(users.filter((u: any) => u._id !== user?._id && u.role !== 'SUPER_ADMIN'));
      }).catch(console.error);
      api.departments.list().then((data: any) => {
        const depts = Array.isArray(data) ? data : (data.departments || data.items || []);
        setDepartments(depts);
      }).catch(console.error);
    }
  }, [showCompose, user]);

  const handleOpenMessage = async (msg: any) => {
    setSelectedMessage(msg);
    if (!msg.isRead && activeTab === 'inbox') {
      try {
        await api.messages.markRead(msg._id);
        setInbox(prev => prev.map(m => m._id === msg._id ? { ...m, isRead: true } : m));
      } catch { /* silent */ }
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) return;
    setSubmitting(true);
    try {
      await api.messages.send({
        subject: subject.trim(),
        body: body.trim(),
        recipientType,
        recipientIds: recipientType === 'individual' ? selectedEmployees : undefined,
        departmentId: recipientType === 'department' ? selectedDeptId : undefined
      });
      setShowCompose(false);
      setSubject('');
      setBody('');
      setSelectedEmployees([]);
      setSelectedDeptId('');
      setRecipientType('individual');
      setEmpSearch('');
      fetchMessages();
    } catch (err: any) {
      alert(err.message || 'Failed to send message');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleEmployee = (id: string) => {
    setSelectedEmployees(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const filteredEmployees = employees.filter(e =>
    e.name?.en?.toLowerCase().includes(empSearch.toLowerCase()) ||
    e.designation?.en?.toLowerCase().includes(empSearch.toLowerCase()) ||
    e.employeeId?.toLowerCase().includes(empSearch.toLowerCase())
  );

  const messages = activeTab === 'inbox' ? inbox : sent;
  const filteredMessages = messages.filter(m =>
    m.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.sender?.name?.en?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.body?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const unreadCount = inbox.filter(m => !m.isRead).length;

  return (
    <div className="max-w-7xl mx-auto pb-12 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-red-700" />
            <span>Internal Messaging</span>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-600 text-white">
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {canSend
              ? 'Send direct messages to individual employees or entire departments.'
              : 'View messages sent to you by management.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchMessages}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {canSend && (
            <button
              type="button"
              onClick={() => setShowCompose(true)}
              className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-red-800 hover:bg-red-900 text-white shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <PenSquare className="w-4 h-4" />
              <span>Compose Message</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Panel */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col lg:flex-row" style={{ minHeight: '600px' }}>
        {/* Sidebar */}
        <div className="w-full lg:w-72 border-b lg:border-b-0 lg:border-r border-slate-200/80 dark:border-slate-800 flex flex-col">
          {/* Tabs */}
          <div className="flex lg:flex-col p-3 gap-1">
            <button
              type="button"
              onClick={() => { setActiveTab('inbox'); setSelectedMessage(null); }}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all flex-1 lg:flex-none ${
                activeTab === 'inbox'
                  ? 'bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Inbox className="w-4 h-4" />
              <span>Inbox</span>
              {unreadCount > 0 && (
                <span className="ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-600 text-white">
                  {unreadCount}
                </span>
              )}
            </button>
            {canSend && (
              <button
                type="button"
                onClick={() => { setActiveTab('sent'); setSelectedMessage(null); }}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all flex-1 lg:flex-none ${
                  activeTab === 'sent'
                    ? 'bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Send className="w-4 h-4" />
                <span>Sent</span>
              </button>
            )}
          </div>

          {/* Search */}
          <div className="px-3 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search messages..."
                className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-red-400"
              />
            </div>
          </div>

          {/* Message list */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <div className="p-6 text-center text-sm text-slate-400">Loading...</div>
            ) : filteredMessages.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-400">
                {searchQuery ? 'No messages match your search.' : activeTab === 'inbox' ? 'Your inbox is empty.' : 'No sent messages yet.'}
              </div>
            ) : filteredMessages.map(msg => (
              <button
                key={msg._id}
                type="button"
                onClick={() => handleOpenMessage(msg)}
                className={`w-full text-left px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex items-start gap-3 ${
                  selectedMessage?._id === msg._id ? 'bg-red-50/60 dark:bg-red-950/20' : ''
                }`}
              >
                <div className="mt-0.5 flex-shrink-0">
                  {activeTab === 'inbox' ? (
                    msg.isRead
                      ? <CheckCircle2 className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                      : <Circle className="w-4 h-4 text-red-500 fill-red-500" />
                  ) : (
                    <Send className="w-3.5 h-3.5 text-slate-400 mt-0.5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs truncate ${!msg.isRead && activeTab === 'inbox' ? 'font-bold text-slate-900 dark:text-slate-100' : 'font-medium text-slate-700 dark:text-slate-300'}`}>
                    {activeTab === 'inbox' ? (msg.sender?.name?.en || 'Unknown') : msg.subject}
                  </p>
                  {activeTab === 'inbox' && (
                    <p className={`text-[11px] truncate mt-0.5 ${!msg.isRead ? 'text-slate-700 dark:text-slate-300' : 'text-slate-500 dark:text-slate-500'}`}>
                      {msg.subject}
                    </p>
                  )}
                  {activeTab === 'sent' && (
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      To {msg.recipientIds?.length || 0} recipient{msg.recipientIds?.length !== 1 ? 's' : ''}
                    </p>
                  )}
                  <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(msg.createdAt).toLocaleString('en-BD', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 flex-shrink-0 mt-1" />
              </button>
            ))}
          </div>
        </div>

        {/* Message Detail */}
        <div className="flex-1 flex flex-col">
          {selectedMessage ? (
            <div className="flex-1 flex flex-col overflow-y-auto">
              {/* Header */}
              <div className="p-6 border-b border-slate-200/80 dark:border-slate-800">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      {selectedMessage.subject}
                    </h2>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                      {activeTab === 'inbox' && selectedMessage.sender && (
                        <span className="flex items-center gap-1.5">
                          <UserAvatar user={selectedMessage.sender} size="xs" />
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {selectedMessage.sender.name?.en}
                          </span>
                          <span className="text-slate-400">·</span>
                          <span>{selectedMessage.sender.designation?.en}</span>
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(selectedMessage.createdAt).toLocaleString('en-BD', { dateStyle: 'long', timeStyle: 'short' })}
                      </span>
                      {activeTab === 'sent' && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          selectedMessage.recipientType === 'all'
                            ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-800'
                            : selectedMessage.recipientType === 'department'
                            ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800'
                            : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                        }`}>
                          {selectedMessage.recipientType === 'all' ? 'All Employees' :
                           selectedMessage.recipientType === 'department' ? 'Department' : 'Individual'}
                          {' · '}{selectedMessage.recipientIds?.length} recipient{selectedMessage.recipientIds?.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedMessage(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 p-6">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                    {selectedMessage.body}
                  </p>
                </div>
              </div>

              {/* Recipients (sent only) */}
              {activeTab === 'sent' && selectedMessage.recipientUsers && selectedMessage.recipientUsers.length > 0 && (
                <div className="p-6 border-t border-slate-200/80 dark:border-slate-800">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                    Recipients ({selectedMessage.recipientIds?.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedMessage.recipientUsers.slice(0, 20).map((r: any) => (
                      <span
                        key={r._id}
                        className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs text-slate-700 dark:text-slate-300"
                      >
                        {r.name?.en || 'Unknown'}
                      </span>
                    ))}
                    {selectedMessage.recipientIds?.length > 20 && (
                      <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs text-slate-500">
                        +{selectedMessage.recipientIds.length - 20} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 gap-3">
              <MessageSquare className="w-12 h-12 opacity-20" />
              <p className="text-sm font-medium">Select a message to read</p>
              {canSend && (
                <button
                  type="button"
                  onClick={() => setShowCompose(true)}
                  className="mt-2 px-4 py-2 rounded-xl text-xs font-semibold bg-red-800 hover:bg-red-900 text-white transition-colors"
                >
                  Compose New Message
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <Modal
          isOpen={showCompose}
          onClose={() => {
            setShowCompose(false);
            setSubject('');
            setBody('');
            setSelectedEmployees([]);
            setSelectedDeptId('');
            setRecipientType('individual');
          }}
          title="Compose Message"
          subtitle="Send a direct message to employees or departments"
          maxWidth="2xl"
        >
          <form onSubmit={handleSend} className="space-y-5">
            {/* Recipient Type */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Send To
              </label>
              <div className="grid grid-cols-3 gap-2">
                {PRIORITY_TYPES.map(pt => {
                  // Dept head can't send "all employees" across org
                  if (pt.value === 'all' && (role === 'DEPT_HEAD' || isDeptHead) && role !== 'CEO' && role !== 'TRUSTEE') {
                    return (
                      <button
                        key={pt.value}
                        type="button"
                        onClick={() => setRecipientType('all')}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all ${
                          recipientType === 'all'
                            ? 'border-red-500 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <pt.icon className="w-4 h-4" />
                        <span className="text-center leading-tight">My Department</span>
                      </button>
                    );
                  }
                  return (
                    <button
                      key={pt.value}
                      type="button"
                      onClick={() => setRecipientType(pt.value as any)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all ${
                        recipientType === pt.value
                          ? 'border-red-500 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <pt.icon className="w-4 h-4" />
                      <span className="text-center leading-tight">{pt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Individual recipient selector */}
            {recipientType === 'individual' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Select Recipients *
                </label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={empSearch}
                    onChange={e => setEmpSearch(e.target.value)}
                    placeholder="Search employees..."
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none"
                  />
                </div>
                {selectedEmployees.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {selectedEmployees.map(id => {
                      const emp = employees.find(e => e._id === id);
                      return emp ? (
                        <span
                          key={id}
                          className="flex items-center gap-1 px-2 py-1 bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300 rounded-lg text-[11px] font-medium"
                        >
                          {emp.name?.en}
                          <button type="button" onClick={() => toggleEmployee(id)}>
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
                <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredEmployees.slice(0, 50).map(emp => (
                    <button
                      key={emp._id}
                      type="button"
                      onClick={() => toggleEmployee(emp._id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-left transition-colors ${
                        selectedEmployees.includes(emp._id) ? 'bg-red-50/60 dark:bg-red-950/20' : ''
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                        selectedEmployees.includes(emp._id)
                          ? 'bg-red-700 border-red-700'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}>
                        {selectedEmployees.includes(emp._id) && (
                          <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">{emp.name?.en}</p>
                        <p className="text-[10px] text-slate-500 truncate">{emp.designation?.en} · {emp.employeeId}</p>
                      </div>
                    </button>
                  ))}
                  {filteredEmployees.length === 0 && (
                    <div className="p-4 text-center text-xs text-slate-400">No employees found</div>
                  )}
                </div>
              </div>
            )}

            {/* Department selector */}
            {recipientType === 'department' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Select Department *
                </label>
                <select
                  value={selectedDeptId}
                  onChange={e => setSelectedDeptId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none"
                >
                  <option value="">Select a department...</option>
                  {departments.map((d: any) => (
                    <option key={d._id} value={d._id}>{d.name?.en || d.name}</option>
                  ))}
                </select>
              </div>
            )}

            {recipientType === 'all' && (
              <div className="px-4 py-3 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-xl">
                <p className="text-xs text-purple-700 dark:text-purple-300 font-medium">
                  {(role === 'DEPT_HEAD' || isDeptHead) && role !== 'CEO' && role !== 'TRUSTEE'
                    ? '📢 This message will be sent to all employees in your department.'
                    : '📢 This message will be sent to all active employees across the organization.'}
                </p>
              </div>
            )}

            {/* Subject */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Subject *
              </label>
              <input
                type="text"
                required
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="e.g., Reminder: Monthly Report Submission"
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none"
              />
            </div>

            {/* Body */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Message *
              </label>
              <textarea
                rows={6}
                required
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Write your message here..."
                className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowCompose(false)}
                className="px-4 py-2 rounded-xl text-xs text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || (recipientType === 'individual' && selectedEmployees.length === 0) || (recipientType === 'department' && !selectedDeptId)}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-red-800 hover:bg-red-900 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-xs flex items-center gap-1.5 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                {submitting ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
