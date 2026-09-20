import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Department, User } from '../types';
import { useAuth } from '../context/AuthContext';
import { UserAvatar } from '../components/common/UserAvatar';
import { Modal } from '../components/common/Modal';
import { Building2, Users, CheckSquare, AlertCircle, Phone, Mail, Plus, Edit, Trash2 } from 'lucide-react';

interface DepartmentsPageProps {
  onSelectEmployee?: (userId: string) => void;
  onNavigateTasksForDept?: (deptId: string) => void;
}

export const DepartmentsPage: React.FC<DepartmentsPageProps> = ({
  onSelectEmployee,
  onNavigateTasksForDept
}) => {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [deptEmployees, setDeptEmployees] = useState<User[]>([]);

  // Super Admin Department Management State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    nameEn: '',
    nameBn: '',
    description: '',
    headId: ''
  });
  const [saving, setSaving] = useState(false);

  const canManage = user?.role === 'SUPER_ADMIN' || user?.role === 'CEO';

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.departments.list(),
      api.users.list()
    ])
      .then(([deptData, userData]) => {
        setDepartments(deptData);
        setUsers(userData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenDept = async (dept: Department) => {
    setSelectedDept(dept);
    try {
      const data = await api.departments.get(dept._id);
      setDeptEmployees(data.employees || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenCreate = () => {
    setFormData({
      code: '',
      nameEn: '',
      nameBn: '',
      description: '',
      headId: ''
    });
    setIsCreateModalOpen(true);
  };

  const handleOpenEdit = (d: Department) => {
    setEditingDept(d);
    setFormData({
      code: d.code,
      nameEn: d.name.en,
      nameBn: d.name.bn,
      description: d.description || '',
      headId: d.head?._id || ''
    });
    setIsEditModalOpen(true);
  };

  const handleSaveDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        code: formData.code.toUpperCase(),
        name: { en: formData.nameEn, bn: formData.nameBn },
        description: formData.description,
        headId: formData.headId || null
      };

      if (isEditModalOpen && editingDept) {
        await api.departments.update(editingDept._id, payload);
        alert('Department updated successfully!');
      } else {
        await api.departments.create(payload);
        alert('New department created successfully!');
      }

      setIsCreateModalOpen(false);
      setIsEditModalOpen(false);
      setEditingDept(null);
      setSelectedDept(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save department');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDepartment = async (d: Department) => {
    if (!confirm(`Are you sure you want to permanently delete department "${d.name.en}" (${d.code})? Tasks in this department will be affected.`)) return;

    try {
      await api.departments.delete(d._id);
      alert('Department deleted successfully.');
      setSelectedDept(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete department');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-red-700" />
            <span>Museum Operational Departments ({departments.length} Divisions)</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Functional units executing archival conservation, outreach, research, financial administration, and facilities engineering.
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={handleOpenCreate}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-red-800 hover:bg-red-900 text-white shadow-xs flex items-center gap-1.5 transition-colors self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Department</span>
          </button>
        )}
      </div>

      {/* Departments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full p-12 text-center text-slate-400">Loading departments...</div>
        ) : (
          departments.map(d => (
            <div
              key={d._id}
              onClick={() => handleOpenDept(d)}
              className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded-lg text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {d.code}
                  </span>
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    <span>{d.stats?.totalEmployees || 0} Staff</span>
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {d.name.en}
                </h3>
                <div className="text-xs text-slate-500 font-sans">
                  {d.name.bn}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 line-clamp-2">
                  {d.description}
                </p>

                {/* Head Card */}
                {d.head && (
                  <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center gap-2.5">
                    <UserAvatar name={d.head.name} role={d.head.role} size="sm" />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        {d.head.name.en}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {d.head.designation.en}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Stats Footer */}
              <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <span className="font-bold text-slate-900 dark:text-slate-100 block">
                    {d.stats?.activeTasks || 0}
                  </span>
                  <span className="text-[10px] text-slate-400">Active Tasks</span>
                </div>
                <div>
                  <span className="font-bold text-emerald-600 block">
                    {d.stats?.completedTasks || 0}
                  </span>
                  <span className="text-[10px] text-slate-400">Completed</span>
                </div>
                <div>
                  <span className="font-bold text-red-600 block">
                    {d.stats?.overdueTasks || 0}
                  </span>
                  <span className="text-[10px] text-slate-400">Overdue</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Department Detail Modal */}
      {selectedDept && (
        <Modal
          isOpen={Boolean(selectedDept)}
          onClose={() => setSelectedDept(null)}
          title={`${selectedDept.name.en} (${selectedDept.code})`}
          subtitle={selectedDept.name.bn}
          maxWidth="2xl"
        >
          <div className="space-y-6">
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {selectedDept.description}
            </p>

            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Department Personnel Roster ({deptEmployees.length})
              </h4>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-60 overflow-y-auto">
                {deptEmployees.map(emp => (
                  <div
                    key={emp._id}
                    onClick={() => {
                      setSelectedDept(null);
                      onSelectEmployee?.(emp._id);
                    }}
                    className="p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <UserAvatar name={emp.name} role={emp.role} size="md" />
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                          {emp.name.en} <span className="text-xs text-slate-400 font-normal">({emp.name.bn})</span>
                        </div>
                        <div className="text-xs text-slate-500">{emp.designation.en}</div>
                      </div>
                    </div>
                    <span className="font-mono text-xs text-slate-400">{emp.employeeId}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions Bar */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
              {canManage ? (
                <button
                  type="button"
                  onClick={() => {
                    const d = selectedDept;
                    setSelectedDept(null);
                    handleDeleteDepartment(d);
                  }}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 hover:bg-red-200 border border-red-200 dark:border-red-900/50 flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Department</span>
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                {canManage && (
                  <button
                    type="button"
                    onClick={() => {
                      const d = selectedDept;
                      setSelectedDept(null);
                      handleOpenEdit(d);
                    }}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-1.5 transition-colors"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Edit Department Particulars</span>
                  </button>
                )}

                {onNavigateTasksForDept && (
                  <button
                    type="button"
                    onClick={() => {
                      const dId = selectedDept._id;
                      setSelectedDept(null);
                      onNavigateTasksForDept(dId);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-800 hover:bg-red-900 text-white shadow-xs"
                  >
                    View All Department Directives →
                  </button>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Create / Edit Department Modal */}
      {(isCreateModalOpen || isEditModalOpen) && (
        <Modal
          isOpen={isCreateModalOpen || isEditModalOpen}
          onClose={() => {
            setIsCreateModalOpen(false);
            setIsEditModalOpen(false);
            setEditingDept(null);
          }}
          title={isEditModalOpen ? `Edit Department: ${editingDept?.name.en}` : 'Create New Department'}
          subtitle="Configure operational department particulars, head designation, and division code"
          maxWidth="lg"
        >
          <form onSubmit={handleSaveDepartment} className="space-y-4 text-xs sm:text-sm">
            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Department Code (Uppercase) *</label>
              <input
                type="text"
                required
                value={formData.code}
                onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="e.g. ARCHIVE, FIN, DIGI"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Name (English) *</label>
              <input
                type="text"
                required
                value={formData.nameEn}
                onChange={e => setFormData({ ...formData, nameEn: e.target.value })}
                placeholder="e.g. Archives & Artifacts Division"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Name (Bangla) *</label>
              <input
                type="text"
                required
                value={formData.nameBn}
                onChange={e => setFormData({ ...formData, nameBn: e.target.value })}
                placeholder="e.g. আর্কাইভস ও নিদর্শাবলী বিভাগ"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none font-sans"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Description</label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="Provide functional overview of department responsibilities..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none resize-none"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Department Head</label>
              <select
                value={formData.headId}
                onChange={e => setFormData({ ...formData, headId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
              >
                <option value="">Unassigned / Vacant</option>
                {users.map(u => (
                  <option key={u._id} value={u._id}>
                    {u.name.en} ({u.designation.en}) - {u.role}
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setIsEditModalOpen(false);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-red-800 hover:bg-red-900 text-white shadow-xs"
              >
                {saving ? 'Saving...' : isEditModalOpen ? 'Update Department' : 'Create Department'}
              </button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
};
