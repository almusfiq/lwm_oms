import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { UserAvatar } from '../common/UserAvatar';
import { User, Department } from '../../types';
import { 
  Network, Users, Building, ShieldCheck, ChevronDown, 
  ChevronUp, Mail, Phone, ExternalLink, Sparkles 
} from 'lucide-react';

interface OrganogramData {
  trustees: User[];
  ceo: User | null;
  ceoStaff?: User[];
  departments: Array<{
    _id: string;
    code: string;
    name: { en: string; bn: string };
    description?: string;
    head: User | null;
    subordinates: User[];
    activeTasksCount: number;
  }>;
}

interface InteractiveOrganogramProps {
  onSelectEmployee?: (userId: string) => void;
  onSelectDepartment?: (deptId: string) => void;
}

export const InteractiveOrganogram: React.FC<InteractiveOrganogramProps> = ({
  onSelectEmployee,
  onSelectDepartment
}) => {
  const [data, setData] = useState<OrganogramData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedTrustees, setExpandedTrustees] = useState(true);
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);

  useEffect(() => {
    api.organogram.get()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400">
        Loading museum organogram hierarchy...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-12 text-center text-red-500">
        Failed to load organogram.
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      
      {/* Introduction Banner */}
      <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Network className="w-5 h-5 text-red-700" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Liberation War Museum Organogram & Reporting Line
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Official institutional hierarchy from the Board of Trustees to Executive CEO, Departmental Curators, and Functional Officers.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-600"></span>
            <span className="text-slate-600 dark:text-slate-400">Trustees</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-800"></span>
            <span className="text-slate-600 dark:text-slate-400">CEO</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-blue-700"></span>
            <span className="text-slate-600 dark:text-slate-400">Heads</span>
          </div>
        </div>
      </div>

      {/* LEVEL 1: Board of Trustees */}
      <div className="flex flex-col items-center">
        <div className="w-full max-w-3xl bg-amber-50/70 dark:bg-amber-950/20 rounded-2xl border border-amber-200/80 dark:border-amber-900/40 p-4 shadow-xs">
          <div 
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setExpandedTrustees(!expandedTrustees)}
          >
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-amber-700 dark:text-amber-400" />
              <div>
                <span className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider">
                  Level 1: Board of Trustees (ট্রাস্টি বোর্ড)
                </span>
                <span className="text-xs text-amber-700/80 dark:text-amber-400/80 ml-2">
                  (8 Distinguished Members)
                </span>
              </div>
            </div>
            <button type="button" className="p-1 text-amber-700 dark:text-amber-400">
              {expandedTrustees ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          {expandedTrustees && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-amber-200/60 dark:border-amber-900/40">
              {data.trustees.map(t => (
                <div
                  key={t._id}
                  onClick={() => onSelectEmployee?.(t._id)}
                  className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-amber-200/60 dark:border-slate-800 shadow-xs hover:border-amber-400 cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <UserAvatar name={t.name} role={t.role} size="sm" />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        {t.name.en}
                      </div>
                      <div className="text-[11px] text-slate-500 font-sans truncate">
                        {t.name.bn}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-[10px] font-semibold text-amber-800 dark:text-amber-400">
                    {t.designation.en}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Hierarchy Connector Line */}
        <div className="w-0.5 h-8 bg-slate-300 dark:bg-slate-700"></div>

        {/* LEVEL 2: Chief Executive Officer (CEO) */}
        {data.ceo && (
          <div className="relative group">
            <div
              onClick={() => onSelectEmployee?.(data.ceo!._id)}
              className="w-80 p-4 bg-white dark:bg-slate-900 rounded-2xl border-2 border-red-800 dark:border-red-700 shadow-md hover:shadow-lg transition-all cursor-pointer text-center"
            >
              <div className="inline-block relative mb-2">
                <UserAvatar name={data.ceo.name} role={data.ceo.role} size="lg" className="mx-auto ring-4 ring-red-100 dark:ring-red-950" />
              </div>
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                {data.ceo.name.en}
              </h3>
              <div className="text-xs text-slate-500 font-sans">
                {data.ceo.name.bn}
              </div>
              <div className="mt-1.5 inline-block px-3 py-0.5 rounded-full text-xs font-bold bg-red-800 text-white">
                {data.ceo.designation.en}
              </div>
              <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-center gap-3">
                <span>{data.ceo.employeeId}</span>
                <span>•</span>
                <span>Plot 1/1 Agargaon</span>
              </div>
            </div>
          </div>
        )}

        {/* CEO Office Staff (Under CEO) */}
        {data.ceoStaff && data.ceoStaff.length > 0 && (
          <div className="mt-4 w-full max-w-4xl bg-red-50/70 dark:bg-red-950/20 rounded-2xl border border-red-200/80 dark:border-red-900/40 p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-red-200/60 dark:border-red-900/40">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-700"></span>
                <span className="text-xs font-bold text-red-950 dark:text-red-300 uppercase tracking-wider">
                  CEO Office Staff Section (প্রধান নির্বাহীর দপ্তর)
                </span>
                <span className="text-xs text-red-700/80 dark:text-red-400/80 font-medium">
                  ({data.ceoStaff.length} Direct Staff)
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {data.ceoStaff.map(staff => (
                <div
                  key={staff._id}
                  onClick={() => onSelectEmployee?.(staff._id)}
                  className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-red-100 dark:border-slate-800 shadow-xs hover:border-red-300 cursor-pointer transition-all flex items-center gap-2.5"
                >
                  <UserAvatar name={staff.name} role={staff.role} size="sm" />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                      {staff.name.en}
                    </div>
                    <div className="text-[10px] text-slate-500 font-sans truncate">
                      {staff.name.bn}
                    </div>
                    <div className="text-[10px] font-medium text-red-800 dark:text-red-400 truncate">
                      {staff.designation.en}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Hierarchy Connector Line to Departments */}
        <div className="w-0.5 h-8 bg-slate-300 dark:bg-slate-700"></div>
        <div className="w-full max-w-5xl h-0.5 bg-slate-300 dark:bg-slate-700 mb-8 hidden lg:block"></div>
      </div>

      {/* LEVEL 3 & 4: 7 Operational Departments */}
      <div>
        <div className="text-center mb-6">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">
            Level 3 & 4: Operational Departments & Staff Divisions
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.departments.map(dept => {
            const isSelected = selectedDeptId === dept._id;

            return (
              <div
                key={dept._id}
                className={`bg-white dark:bg-slate-900 rounded-2xl border transition-all overflow-hidden flex flex-col ${
                  isSelected 
                    ? 'border-red-700 shadow-md ring-1 ring-red-700' 
                    : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                {/* Department Header */}
                <div 
                  className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-start justify-between gap-3 cursor-pointer"
                  onClick={() => onSelectDepartment?.(dept._id)}
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                        {dept.code}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
                        {dept.name.en}
                      </h4>
                    </div>
                    <div className="text-xs text-slate-500 font-sans mt-0.5">
                      {dept.name.bn}
                    </div>
                  </div>

                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300 shrink-0">
                    {dept.activeTasksCount} active tasks
                  </span>
                </div>

                {/* Department Head (Level 3) */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Department Head / Curator
                  </div>

                  {dept.head ? (
                    <div 
                      onClick={() => onSelectEmployee?.(dept.head!._id)}
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-blue-50/40 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-900/30 hover:bg-blue-50 cursor-pointer transition-colors"
                    >
                      <UserAvatar name={dept.head.name} role={dept.head.role} size="md" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                          {dept.head.name.en}
                        </div>
                        <div className="text-[11px] text-blue-700 dark:text-blue-300 font-medium truncate">
                          {dept.head.designation.en}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {dept.head.email}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic">Position currently vacant</div>
                  )}
                </div>

                {/* Subordinates & Functional Staff (Level 4) */}
                <div className="p-4 flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Staff & Officers ({dept.subordinates.length})
                    </span>
                  </div>

                  {dept.subordinates.length === 0 ? (
                    <div className="text-xs text-slate-400">No staff allocated</div>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {dept.subordinates.map(sub => (
                        <div
                          key={sub._id}
                          onClick={() => onSelectEmployee?.(sub._id)}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <UserAvatar name={sub.name} role={sub.role} size="sm" />
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                {sub.name.en}
                              </div>
                              <div className="text-[10px] text-slate-500 truncate">
                                {sub.designation.en}
                              </div>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 shrink-0 ml-2">
                            {sub.employeeId}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
