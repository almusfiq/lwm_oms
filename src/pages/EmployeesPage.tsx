import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { User, Department } from '../types';
import { UserAvatar } from '../components/common/UserAvatar';
import { Modal } from '../components/common/Modal';
import { 
  Users, Search, Mail, Phone, Calendar, 
  Building2, CheckSquare, GitPullRequest, ArrowRight 
} from 'lucide-react';

interface EmployeesPageProps {
  onOpenTaskDetail: (taskId: string) => void;
  onRequestWorkFromUser?: (user: User) => void;
}

export const EmployeesPage: React.FC<EmployeesPageProps> = ({
  onOpenTaskDetail,
  onRequestWorkFromUser
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userProfileData, setUserProfileData] = useState<{ assignedTasks: any[]; managedTasks: any[] } | null>(null);

  useEffect(() => {
    Promise.all([
      api.users.list({ activeOnly: true }),
      api.departments.list()
    ])
      .then(([userData, deptData]) => {
        setUsers(userData);
        setDepartments(deptData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSelectUser = async (u: User) => {
    setSelectedUser(u);
    try {
      const details = await api.users.get(u._id);
      setUserProfileData({
        assignedTasks: details.assignedTasks || [],
        managedTasks: details.managedTasks || []
      });
    } catch (err) {
      console.error(err);
    }
  };

  const filteredUsers = users.filter(u => {
    if (selectedDept && u.departmentId !== selectedDept) return false;
    if (!search.trim()) return true;

    const q = search.toLowerCase();
    return (
      u.name.en.toLowerCase().includes(q) ||
      u.name.bn.toLowerCase().includes(q) ||
      u.designation.en.toLowerCase().includes(q) ||
      u.designation.bn.toLowerCase().includes(q) ||
      u.employeeId.toLowerCase().includes(q) ||
      (u.department && u.department.name.en.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Users className="w-6 h-6 text-red-700" />
            <span>Personnel & Staff Directory</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Full organizational roster of trustees, executive leadership, curators, managers, officers, and staff.
          </p>
        </div>

        <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
          {filteredUsers.length} Active Personnel
        </span>
      </div>

      {/* Filter / Search Bar */}
      <div className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search employee by name, designation, or ID (e.g. LWM-ARCHIVE-001)..."
            className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl placeholder-slate-400 text-slate-800 dark:text-slate-100 focus:outline-none"
          />
        </div>

        <select
          value={selectedDept}
          onChange={e => setSelectedDept(e.target.value)}
          className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 focus:outline-none"
        >
          <option value="">All Departments</option>
          {departments.map(d => (
            <option key={d._id} value={d._id}>
              {d.name.en} ({d.code})
            </option>
          ))}
        </select>
      </div>

      {/* Employees Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {loading ? (
          <div className="col-span-full p-12 text-center text-slate-400">Loading personnel roster...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="col-span-full p-12 text-center text-slate-400">No matching personnel found.</div>
        ) : (
          filteredUsers.map(u => (
            <div
              key={u._id}
              onClick={() => handleSelectUser(u)}
              className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <UserAvatar name={u.name} role={u.role} size="lg" />
                  <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {u.employeeId}
                  </span>
                </div>

                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 group-hover:text-red-700 dark:group-hover:text-red-400 transition-colors">
                  {u.name.en}
                </h3>
                <div className="text-xs text-slate-500 font-sans">
                  {u.name.bn}
                </div>

                <div className="mt-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {u.designation.en}
                </div>
                <div className="text-[11px] text-slate-500 font-sans">
                  {u.designation.bn}
                </div>

                <div className="mt-2 inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-300">
                  {u.department?.name.en || 'Executive Board'}
                </div>
              </div>

              {/* Contact Footer */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 space-y-1">
                <div className="flex items-center gap-1.5 truncate">
                  <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="truncate">{u.email}</span>
                </div>
                {u.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>{u.phone}</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* User Profile Detail Modal */}
      {selectedUser && (
        <Modal
          isOpen={Boolean(selectedUser)}
          onClose={() => setSelectedUser(null)}
          title={`${selectedUser.name.en} (${selectedUser.name.bn})`}
          subtitle={`${selectedUser.designation.en} • ID: ${selectedUser.employeeId}`}
          maxWidth="2xl"
        >
          <div className="space-y-6">
            
            {/* Top Identity Card */}
            <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
              <UserAvatar name={selectedUser.name} role={selectedUser.role} size="xl" />
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {selectedUser.name.en}
                </h3>
                <div className="text-xs text-slate-500 font-sans">
                  {selectedUser.name.bn}
                </div>
                <div className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {selectedUser.designation.en} • {selectedUser.department?.name.en || 'Executive'}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span>✉️ {selectedUser.email}</span>
                  {selectedUser.phone && <span>📞 {selectedUser.phone}</span>}
                </div>
              </div>
            </div>

            {/* Workload / Active Tasks */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Active Assigned Directives ({userProfileData?.assignedTasks?.length || 0})
                </h4>
              </div>

              <div className="space-y-2 max-h-52 overflow-y-auto">
                {userProfileData?.assignedTasks && userProfileData.assignedTasks.length > 0 ? (
                  userProfileData.assignedTasks.map((t: any) => (
                    <div
                      key={t._id}
                      onClick={() => {
                        setSelectedUser(null);
                        onOpenTaskDetail(t._id);
                      }}
                      className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 cursor-pointer transition-all flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono font-bold text-slate-500 shrink-0">{t.taskId}</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">{t.title}</span>
                      </div>
                      <span className="text-slate-500 font-mono shrink-0 ml-2">{t.status} • {t.progress}%</span>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                    No active tasks currently assigned.
                  </div>
                )}
              </div>
            </div>

            {/* Action to Request Work Directly from this Colleague */}
            {onRequestWorkFromUser && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    const u = selectedUser;
                    setSelectedUser(null);
                    onRequestWorkFromUser(u);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-800 hover:bg-red-900 text-white shadow-xs flex items-center gap-1.5"
                >
                  <GitPullRequest className="w-3.5 h-3.5" />
                  <span>Request Work from {selectedUser.name.en}</span>
                </button>
              </div>
            )}

          </div>
        </Modal>
      )}

    </div>
  );
};
