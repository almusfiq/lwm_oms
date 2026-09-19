import React, { useState, useEffect, useMemo } from 'react';
import { User, UserRole } from '../../types';
import { api } from '../../api/client';
import { UserAvatar } from './UserAvatar';
import { Search, ChevronDown, Check, X } from 'lucide-react';
import { getUserRole } from '../../utils/hierarchy';

interface EmployeeSelectorProps {
  value: string;
  onChange: (userId: string, userObj?: User) => void;
  label?: string;
  placeholder?: string;
  excludeUserIds?: string[];
  departmentId?: string;
  roleFilter?: string | UserRole;
  roleFilters?: Array<string | UserRole>;
  required?: boolean;
  disabled?: boolean;
  id?: string;
}

export const EmployeeSelector: React.FC<EmployeeSelectorProps> = ({
  value,
  onChange,
  label,
  placeholder = 'Search employee by name, designation, or department...',
  excludeUserIds = [],
  departmentId,
  roleFilter,
  roleFilters,
  required = false,
  disabled = false,
  id
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.users.list({ activeOnly: true })
      .then(res => setUsers(Array.isArray(res) ? res : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const selectedUser = useMemo(() => {
    return users.find(u => u._id === value);
  }, [users, value]);

  const filteredUsers = useMemo(() => {
    let list = users.filter(u => !excludeUserIds.includes(u._id));
    if (departmentId) {
      list = list.filter(u => u.departmentId === departmentId || u.department?._id === departmentId);
    }
    const requestedRoles = roleFilters?.length ? roleFilters : roleFilter ? [roleFilter] : undefined;
    if (requestedRoles?.length) {
      const roles = new Set(requestedRoles.map(role => String(role)));
      list = list.filter(u => roles.has(getUserRole(u)));
    }
    if (!search.trim()) return list;

    const q = search.toLowerCase();
    return list.filter(u => 
      u.name.en.toLowerCase().includes(q) ||
      u.name.bn.toLowerCase().includes(q) ||
      u.designation.en.toLowerCase().includes(q) ||
      u.designation.bn.toLowerCase().includes(q) ||
      u.employeeId.toLowerCase().includes(q) ||
      (u.department && (u.department.name.en.toLowerCase().includes(q) || u.department.name.bn.toLowerCase().includes(q) || u.department.code.toLowerCase().includes(q)))
    );
  }, [users, excludeUserIds, departmentId, roleFilter, roleFilters, search]);

  return (
    <div className="relative w-full" id={id}>
      {label && (
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      {/* Trigger Button */}
      <div className="relative flex items-center">
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-left shadow-xs hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${selectedUser ? 'pr-8' : ''}`}
        >
          {selectedUser ? (
            <div className="flex items-center gap-2.5 min-w-0">
              <UserAvatar name={selectedUser.name} role={selectedUser.role} size="sm" />
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                  {selectedUser.name.en} <span className="text-xs text-slate-500">({selectedUser.name.bn})</span>
                </div>
                <div className="text-xs text-slate-500 truncate">
                  {selectedUser.designation.en} • {selectedUser.department?.code || 'Board'}
                </div>
              </div>
            </div>
          ) : (
            <span className="text-sm text-slate-400 dark:text-slate-500">{placeholder}</span>
          )}
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
        </button>

        {selectedUser && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
            className="absolute right-8 p-1 text-slate-400 hover:text-red-600 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Clear selection"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden flex flex-col max-h-72">
            {/* Search Box */}
            <div className="p-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 bg-slate-50/50 dark:bg-slate-800/50">
              <Search className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
              <input
                type="text"
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Type name, designation or department..."
                className="w-full bg-transparent text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
              />
            </div>

            {/* List */}
            <div className="overflow-y-auto p-1.5 space-y-1">
              {loading ? (
                <div className="p-4 text-center text-xs text-slate-400">Loading personnel roster...</div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">No matching employees found</div>
              ) : (
                filteredUsers.map(u => {
                  const isSelected = u._id === value;
                  return (
                    <button
                      key={u._id}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          onChange('');
                        } else {
                          onChange(u._id, u);
                        }
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors ${
                        isSelected 
                          ? 'bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-200' 
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <UserAvatar name={u.name} role={u.role} size="sm" />
                        <div className="min-w-0">
                          <div className="text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                            {u.name.en} <span className="text-xs text-slate-500 font-normal">({u.name.bn})</span>
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            {u.designation.en} • <span className="font-medium text-slate-600 dark:text-slate-400">{u.department?.name.en || 'Executive'}</span>
                          </div>
                        </div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-red-600 shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
