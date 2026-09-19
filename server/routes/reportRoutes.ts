import { Router, Response } from 'express';
import { db } from '../db';
import { requireAuth, AuthenticatedRequest, sanitizeUser } from '../auth';

export const reportRoutes = Router();

// GET /api/reports/tasks
reportRoutes.get('/tasks', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  const now = new Date().toISOString().split('T')[0];
  const total = db.tasks.length;
  const completed = db.tasks.filter(t => t.status === 'COMPLETED').length;
  const inProgress = db.tasks.filter(t => t.status === 'IN_PROGRESS').length;
  const todo = db.tasks.filter(t => t.status === 'TODO').length;
  const inReview = db.tasks.filter(t => t.status === 'IN_REVIEW').length;
  const overdue = db.tasks.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED' && t.dueDate < now).length;

  // By Priority
  const urgent = db.tasks.filter(t => t.priority === 'URGENT').length;
  const high = db.tasks.filter(t => t.priority === 'HIGH').length;
  const medium = db.tasks.filter(t => t.priority === 'MEDIUM').length;
  const low = db.tasks.filter(t => t.priority === 'LOW').length;

  res.json({
    success: true,
    data: {
      total,
      completed,
      inProgress,
      todo,
      inReview,
      overdue,
      byPriority: { urgent, high, medium, low }
    }
  });
});

// GET /api/reports/employees
reportRoutes.get('/employees', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  const now = new Date().toISOString().split('T')[0];

  const results = db.users.filter(u => u.isActive).map(u => {
    const dept = db.departments.find(d => d._id === u.departmentId);
    const assigned = db.tasks.filter(t => t.assignedTo.includes(u._id));
    const active = assigned.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED');
    const completed = assigned.filter(t => t.status === 'COMPLETED');
    const overdue = active.filter(t => t.dueDate < now);

    return {
      user: sanitizeUser(u),
      department: dept ? { _id: dept._id, code: dept.code, name: dept.name } : null,
      stats: {
        totalAssigned: assigned.length,
        active: active.length,
        completed: completed.length,
        overdue: overdue.length,
        completionRate: assigned.length > 0 ? Math.round((completed.length / assigned.length) * 100) : 0
      }
    };
  });

  res.json({ success: true, data: results });
});

// GET /api/reports/departments
reportRoutes.get('/departments', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  const now = new Date().toISOString().split('T')[0];

  const results = db.departments.map(d => {
    const employees = db.users.filter(u => u.departmentId === d._id && u.isActive);
    const deptTasks = db.tasks.filter(t => t.departmentId === d._id || t.targetDepartmentId === d._id);
    const active = deptTasks.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED');
    const completed = deptTasks.filter(t => t.status === 'COMPLETED');
    const overdue = active.filter(t => t.dueDate < now);

    return {
      department: d,
      employeeCount: employees.length,
      totalTasks: deptTasks.length,
      activeTasks: active.length,
      completedTasks: completed.length,
      overdueTasks: overdue.length,
      completionRate: deptTasks.length > 0 ? Math.round((completed.length / deptTasks.length) * 100) : 0
    };
  });

  res.json({ success: true, data: results });
});

// GET /api/reports/cross-department
reportRoutes.get('/cross-department', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  const crossTasks = db.tasks.filter(t => t.sourceDepartmentId && t.targetDepartmentId && t.sourceDepartmentId !== t.targetDepartmentId);
  const crossRequests = db.taskRequests.filter(r => r.requesterDepartmentId !== r.targetDepartmentId);

  res.json({
    success: true,
    data: {
      totalCrossTasks: crossTasks.length,
      totalCrossRequests: crossRequests.length,
      tasks: crossTasks,
      requests: crossRequests
    }
  });
});
