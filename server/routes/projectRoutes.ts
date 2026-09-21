import { Router, Response } from 'express';
import { db } from '../db';
import { requireAuth, AuthenticatedRequest, sanitizeUser } from '../auth';
import { Project } from '../types';

export const projectRoutes = Router();

function populateProject(p: Project) {
  const manager = db.users.find(u => u._id === p.managerId);
  const rawDepts = Array.isArray(p.departments) ? p.departments : [];
  const rawMembers = Array.isArray(p.members) ? p.members : [];

  const departments = rawDepts.map(dId => {
    if (typeof dId === 'string') {
      return db.departments.find(d => d._id === dId);
    }
    return dId;
  }).filter(Boolean);

  const members = rawMembers.map(mId => {
    if (typeof mId === 'string') {
      const u = db.users.find(user => user._id === mId);
      return u ? sanitizeUser(u) : null;
    }
    return mId;
  }).filter(Boolean);

  // Compute actual task progress dynamically from real tasks
  const projectTasks = db.tasks.filter(t => t.projectId === p._id);
  const totalTasks = projectTasks.length;
  const completedTasks = projectTasks.filter(t => t.status === 'COMPLETED').length;
  const inProgressTasks = projectTasks.filter(t => t.status === 'IN_PROGRESS').length;
  
  let dynamicProgress = p.progress;
  if (totalTasks > 0) {
    dynamicProgress = Math.round((completedTasks / totalTasks) * 100);
  }

  return {
    ...p,
    progress: dynamicProgress,
    manager: manager ? sanitizeUser(manager) : null,
    departments,
    members,
    stats: {
      totalTasks,
      completedTasks,
      inProgressTasks,
      pendingTasks: totalTasks - completedTasks - inProgressTasks
    }
  };
}

// GET /api/projects
projectRoutes.get('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { status, departmentId } = req.query;

  let list = [...db.projects];

  if (status && typeof status === 'string') {
    list = list.filter(p => p.status === status.toUpperCase());
  }

  if (departmentId && typeof departmentId === 'string') {
    list = list.filter(p => p.departments.includes(departmentId));
  }

  res.json({
    success: true,
    data: list.map(populateProject)
  });
});

// GET /api/projects/:id
projectRoutes.get('/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const project = db.projects.find(p => p._id === req.params.id || p.projectId === req.params.id);
  if (!project) {
    res.status(404).json({ success: false, message: 'Project not found' });
    return;
  }

  const populated = populateProject(project);
  const tasks = db.tasks.filter(t => t.projectId === project._id);

  res.json({
    success: true,
    data: {
      project: populated,
      tasks
    }
  });
});

// POST /api/projects
projectRoutes.post('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description, managerId, departments = [], members = [], priority = 'MEDIUM', startDate, deadline, milestones = [] } = req.body;

    if (!name || !description || !deadline) {
      res.status(400).json({ success: false, message: 'Project name, description, and deadline are required' });
      return;
    }

    const newProject: Project = {
      _id: db.generateId('prj'),
      projectId: db.getNextProjectId(),
      name,
      description,
      managerId: managerId || req.user!._id,
      departments: Array.isArray(departments) ? departments : [departments],
      members: Array.isArray(members) ? members : [members],
      status: 'ACTIVE',
      priority: priority || 'MEDIUM',
      startDate: startDate || new Date().toISOString().split('T')[0],
      deadline,
      progress: 0,
      milestones: milestones.map((m: any) => ({
        _id: db.generateId('m'),
        name: typeof m === 'string' ? m : m.name,
        dueDate: m.dueDate || deadline,
        status: 'PENDING'
      })),
      attachments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.projects.unshift(newProject);

    db.logActivity({
      actorId: req.user!._id,
      action: 'CREATE_PROJECT',
      module: 'PROJECTS',
      description: `Initiated strategic project ${newProject.projectId}: "${newProject.name}"`,
      resourceType: 'PROJECT',
      resourceId: newProject._id,
      resourceName: `${newProject.projectId} - ${newProject.name}`,
      ipAddress: req.ip || '127.0.0.1',
      metadata: { name: newProject.name, projectId: newProject.projectId, priority: newProject.priority }
    });

    db.save();
    res.status(201).json({ success: true, data: populateProject(newProject) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to create project' });
  }
});
