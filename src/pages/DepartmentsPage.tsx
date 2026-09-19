import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Department, User } from '../types';
import { UserAvatar } from '../components/common/UserAvatar';
import { Modal } from '../components/common/Modal';
import { Building2, Users, CheckSquare, AlertCircle, Phone, Mail } from 'lucide-react';

interface DepartmentsPageProps {
  onSelectEmployee?: (userId: string) => void;
  onNavigateTasksForDept?: (deptId: string) => void;
}

export const DepartmentsPage: React.FC<DepartmentsPageProps> = ({
  onSelectEmployee,
  onNavigateTasksForDept
}) => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [deptEmployees, setDeptEmployees] = useState<User[]>([]);

  useEffect(() => {
    api.departments.list()
      .then(setDepartments)
      .catch(console.error)
      .finally(() => setLoading(false));
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Building2 className="w-6 h-6 text-red-700" />
          <span>Museum Operational Departments (7 Divisions)</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Functional units executing archival conservation, outreach, research, financial administration, and facilities engineering.
        </p>
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

            {onNavigateTasksForDept && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    const dId = selectedDept._id;
                    setSelectedDept(null);
                    onNavigateTasksForDept(dId);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-800 hover:bg-red-900 text-white"
                >
                  View All Department Directives →
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}

    </div>
  );
};
