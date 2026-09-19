import React, { useState, useEffect } from 'react';
import { Department } from '../../types';
import { api } from '../../api/client';

interface DepartmentSelectorProps {
  value: string;
  onChange: (deptId: string) => void;
  label?: string;
  allowAll?: boolean;
  placeholder?: string;
  required?: boolean;
  id?: string;
}

export const DepartmentSelector: React.FC<DepartmentSelectorProps> = ({
  value,
  onChange,
  label,
  allowAll = false,
  placeholder = 'Select department...',
  required = false,
  id
}) => {
  const [departments, setDepartments] = useState<Department[]>([]);

  useEffect(() => {
    api.departments.list().then(setDepartments).catch(console.error);
  }, []);

  return (
    <div id={id} className="w-full">
      {label && (
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 shadow-xs focus:outline-none focus:ring-2 focus:ring-red-500/20"
      >
        {!required && <option value="">{allowAll ? 'All Departments' : placeholder}</option>}
        {required && !value && <option value="" disabled>{placeholder}</option>}
        {departments.map(d => (
          <option key={d._id} value={d._id}>
            {d.name.en} [{d.code}]
          </option>
        ))}
      </select>
    </div>
  );
};
