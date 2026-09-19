import { Router, Response } from 'express';
import { db } from '../db';
import { requireAuth, AuthenticatedRequest } from '../auth';

export const analyticsRoutes = Router();

// GET /api/analytics/overview
analyticsRoutes.get('/overview', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  const now = new Date().toISOString().split('T')[0];

  const totalEmployees = db.users.filter(u => u.isActive).length;
  const totalDepartments = db.departments.filter(d => d.isActive).length;
  const activeProjects = db.projects.filter(p => p.status === 'ACTIVE').length;

  const totalTasks = db.tasks.length;
  const activeTasks = db.tasks.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED').length;
  const completedTasks = db.tasks.filter(t => t.status === 'COMPLETED').length;
  const overdueTasks = db.tasks.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED' && t.dueDate < now).length;
  const inReviewTasks = db.tasks.filter(t => t.status === 'IN_REVIEW').length;
  const pendingRequests = db.taskRequests.filter(r => r.status === 'PENDING').length;
  const pendingApprovals = db.approvals.filter(a => a.status === 'PENDING').length;
  const upcomingEvents = db.events.filter(e => e.date >= now).length;

  // Status breakdown array for charts
  const statusDistribution = [
    { name: 'TODO', count: db.tasks.filter(t => t.status === 'TODO').length, color: '#94a3b8' },
    { name: 'ACCEPTED', count: db.tasks.filter(t => t.status === 'ACCEPTED').length, color: '#38bdf8' },
    { name: 'IN PROGRESS', count: db.tasks.filter(t => t.status === 'IN_PROGRESS').length, color: '#3b82f6' },
    { name: 'IN REVIEW', count: inReviewTasks, color: '#eab308' },
    { name: 'COMPLETED', count: completedTasks, color: '#10b981' },
    { name: 'OVERDUE', count: overdueTasks, color: '#ef4444' }
  ];

  // Department workload distribution
  const departmentWorkload = db.departments.map(d => {
    const deptTasks = db.tasks.filter(t => t.departmentId === d._id || t.targetDepartmentId === d._id);
    const active = deptTasks.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED').length;
    const completed = deptTasks.filter(t => t.status === 'COMPLETED').length;
    const overdue = deptTasks.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED' && t.dueDate < now).length;

    return {
      departmentId: d._id,
      name: d.name.en,
      code: d.code,
      active,
      completed,
      overdue,
      total: deptTasks.length
    };
  });

  // Recent activity
  const recentActivities = db.activityLogs.slice(0, 8).map(act => {
    const actor = db.users.find(u => u._id === act.actorId);
    return {
      ...act,
      actorName: actor ? actor.name.en : 'System'
    };
  });

  res.json({
    success: true,
    data: {
      stats: {
        totalEmployees,
        totalDepartments,
        activeProjects,
        totalTasks,
        activeTasks,
        completedTasks,
        overdueTasks,
        inReviewTasks,
        pendingRequests,
        pendingApprovals,
        upcomingEvents
      },
      statusDistribution,
      departmentWorkload,
      recentActivities
    }
  });
});

// GET /api/analytics/collaboration (Matrix for Cross-Department Collaboration)
analyticsRoutes.get('/collaboration', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  const departments = db.departments.filter(d => d.isActive);

  // Matrix: rows = source department, cols = target department
  const matrix = departments.map(source => {
    const row: Record<string, any> = {
      sourceDeptId: source._id,
      sourceDeptCode: source.code,
      sourceDeptName: source.name.en,
      targets: {} as Record<string, number>
    };

    departments.forEach(target => {
      if (source._id === target._id) {
        row.targets[target.code] = 0; // internal
      } else {
        // Count tasks and requests from source to target
        const tasksCount = db.tasks.filter(t => t.sourceDepartmentId === source._id && t.targetDepartmentId === target._id).length;
        const requestsCount = db.taskRequests.filter(r => r.requesterDepartmentId === source._id && r.targetDepartmentId === target._id).length;
        row.targets[target.code] = tasksCount + requestsCount;
      }
    });

    return row;
  });

  res.json({
    success: true,
    data: {
      departments: departments.map(d => ({ _id: d._id, code: d.code, name: d.name.en })),
      matrix
    }
  });
});
