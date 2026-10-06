import { Router, Response } from 'express';
import { db } from '../db';
import { requireAuth, AuthenticatedRequest, sanitizeUser } from '../auth';

export const organogramRoutes = Router();

organogramRoutes.get('/', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  // 1. Trustees
  const trustees = db.users.filter(u => u.role === 'TRUSTEE').map(sanitizeUser);

  // 2. Executive: CEO and Direct Reports
  const ceo = db.users.find(u => u.role === 'CEO');
  const ceoStaff = db.users.filter(u => u.departmentId === 'dept_ceo' && u.role !== 'CEO' && u.isActive).map(sanitizeUser);

  // 3. Departments with their head and staff members
  const departments = db.departments
    .filter(d => d._id !== 'dept_ceo') // CEO section returned separately above
    .map(d => {
      const head = db.users.find(u => u._id === d.headId);
      const subordinates = db.users.filter(u => u.departmentId === d._id && u._id !== d.headId && u.isActive).map(sanitizeUser);
      const activeTasksCount = db.tasks.filter(t => (t.departmentId === d._id || t.targetDepartmentId === d._id) && t.status !== 'COMPLETED').length;

      return {
        _id: d._id,
        code: d.code,
        name: d.name,
        description: d.description,
        head: head ? sanitizeUser(head) : null,
        subordinates,
        activeTasksCount
      };
    });

  res.json({
    success: true,
    data: {
      trustees,
      ceo: ceo ? sanitizeUser(ceo) : null,
      ceoStaff,
      departments
    }
  });
});
