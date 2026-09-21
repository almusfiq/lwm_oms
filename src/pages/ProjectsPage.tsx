import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Project, Department } from '../types';
import { PriorityBadge } from '../components/common/PriorityBadge';
import { UserAvatar } from '../components/common/UserAvatar';
import { Modal } from '../components/common/Modal';
import { DepartmentSelector } from '../components/common/DepartmentSelector';
import { EmployeeSelector } from '../components/common/EmployeeSelector';
import { 
  FolderKanban, Plus, Calendar, CheckCircle2, 
  Users, Building, ArrowRight, Clock 
} from 'lucide-react';

interface ProjectsPageProps {
  onOpenTaskDetail: (taskId: string) => void;
  onOpenCreateTaskForProject?: (projectId: string) => void;
}

const getLocalizedText = (val: any, fallback = ''): string => {
  if (!val) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    return val.en || val.bn || fallback;
  }
  return String(val);
};

export const ProjectsPage: React.FC<ProjectsPageProps> = ({
  onOpenTaskDetail,
  onOpenCreateTaskForProject
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectTasks, setProjectTasks] = useState<any[]>([]);

  // Create Project Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [managerId, setManagerId] = useState('');
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [deadline, setDeadline] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const list = await api.projects.list();
      setProjects(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleSelectProject = async (p: Project) => {
    setSelectedProject(p);
    try {
      const res = await api.projects.get(p._id);
      if (res) {
        if (res.project) setSelectedProject(res.project);
        setProjectTasks(Array.isArray(res.tasks) ? res.tasks : []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !description.trim() || !deadline) {
      alert('Please fill all required project fields');
      return;
    }

    setSubmitting(true);
    try {
      await api.projects.create({
        name: name.trim(),
        description: description.trim(),
        managerId: managerId || undefined,
        departments: selectedDepts.length ? selectedDepts : ['dept_archive', 'dept_education'],
        deadline
      });

      setShowCreateModal(false);
      setName('');
      setDescription('');
      fetchProjects();
    } catch (err: any) {
      alert(err.message || 'Failed to create project');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FolderKanban className="w-6 h-6 text-red-700" />
            <span>Museum Strategic Projects</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Cross-department initiatives, archival exhibitions, and historical anniversary programmes.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-red-800 hover:bg-red-900 text-white shadow-xs flex items-center gap-1.5 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Strategic Project</span>
        </button>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full p-12 text-center text-slate-400">Loading projects...</div>
        ) : projects.length === 0 ? (
          <div className="col-span-full p-12 text-center text-slate-400">No active projects found.</div>
        ) : (
          projects.map(p => {
            const managerName = getLocalizedText(p.manager?.name, 'Project Lead');
            const projectName = getLocalizedText(p.name, 'Untitled Project');
            const projectDesc = getLocalizedText(p.description, '');

            return (
              <div
                key={p._id}
                onClick={() => handleSelectProject(p)}
                className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-xs font-bold text-slate-500">
                      {p.projectId}
                    </span>
                    <PriorityBadge priority={p.priority} />
                  </div>

                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 line-clamp-2">
                    {projectName}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                    {projectDesc}
                  </p>

                  {/* Progress */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-slate-600 dark:text-slate-400">Completion</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{p.progress}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="bg-red-700 h-full rounded-full transition-all"
                        style={{ width: `${p.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Milestones count & stats */}
                  <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                    <span>🎯 {p.milestones?.length || 0} Milestones</span>
                    <span>📋 {p.stats?.totalTasks || 0} Directives</span>
                  </div>
                </div>

                {/* Manager & Deadline */}
                <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <UserAvatar name={p.manager?.name || 'Project Lead'} role={p.manager?.role} size="sm" />
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[120px]">
                      {managerName}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-slate-500">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{p.deadline}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Project Detail Modal */}
      {selectedProject && (
        <Modal
          isOpen={Boolean(selectedProject)}
          onClose={() => setSelectedProject(null)}
          title={getLocalizedText(selectedProject.name, 'Strategic Project')}
          subtitle={`Project Code: ${selectedProject.projectId} • Lead: ${getLocalizedText(selectedProject.manager?.name, 'Appointed Lead')}`}
          maxWidth="3xl"
        >
          <div className="space-y-6">
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {getLocalizedText(selectedProject.description, '')}
            </p>

            {/* Milestones */}
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Project Milestones
              </h4>
              <div className="space-y-2">
                {selectedProject.milestones?.map(m => (
                  <div key={m._id} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className={`w-4 h-4 ${m.status === 'COMPLETED' ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{getLocalizedText(m.name, 'Milestone')}</span>
                    </div>
                    <span className="text-slate-500">Target: {m.dueDate}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Connected Tasks */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Assigned Project Tasks ({projectTasks.length})
                </h4>
                {onOpenCreateTaskForProject && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenCreateTaskForProject(selectedProject._id);
                      setSelectedProject(null);
                    }}
                    className="text-xs text-red-700 dark:text-red-400 font-semibold hover:underline"
                  >
                    + Add Project Task
                  </button>
                )}
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto">
                {projectTasks.map(t => (
                  <div
                    key={t._id}
                    onClick={() => {
                      setSelectedProject(null);
                      onOpenTaskDetail(t._id);
                    }}
                    className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 cursor-pointer transition-all flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono font-bold text-slate-500 shrink-0">{t.taskId}</span>
                      <span className="font-medium text-slate-900 dark:text-slate-100 truncate">{getLocalizedText(t.title, 'Directive')}</span>
                    </div>
                    <span className="text-slate-500 font-mono shrink-0 ml-2">{t.progress}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Project Modal */}
      {showCreateModal && (
        <Modal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title="Initiate Strategic Project"
          subtitle="Cross-department institutional programme"
          maxWidth="lg"
        >
          <form onSubmit={handleCreateProject} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Project Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g., National Liberation Day 2026 Memorial Exhibition"
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Description & Goal <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Core strategic objectives, historical relevance, and participating divisions..."
                className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none"
              />
            </div>

            <EmployeeSelector
              label="Project Lead / Manager"
              value={managerId}
              onChange={setManagerId}
              placeholder="Assign responsible curator or officer..."
            />

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Target Completion Deadline <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-red-800 hover:bg-red-900 text-white shadow-xs"
              >
                {submitting ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
};
