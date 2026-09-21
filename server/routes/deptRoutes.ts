import { Router, Response } from 'express';
import { db, resolveDepartmentId } from '../db';
import { requireAuth, sanitizeUser, AuthenticatedRequest, getEffectiveRole } from '../auth';

export const deptRoutes = Router();

// GET /api/departments
deptRoutes.get('/', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  try {
    const now = new Date().toISOString().split('T')[0];

    const list = db.departments.map(d => {
      const head = db.users.find(u => u._id === d.headId);
      const employees = db.users.filter(u => u.departmentId === d._id && u.isActive);
      const deptTasks = db.tasks.filter(t => t.departmentId === d._id || t.targetDepartmentId === d._id);
      const activeTasks = deptTasks.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED');
      const completedTasks = deptTasks.filter(t => t.status === 'COMPLETED');
      const overdueTasks = activeTasks.filter(t => t.dueDate < now);

      return {
        _id: d._id,
        code: d.code,
        name: typeof d.name === 'string' ? { en: d.name, bn: d.name } : d.name,
        description: d.description,
        isActive: d.isActive,
        head: head ? sanitizeUser(head) : null,
        stats: {
          totalEmployees: employees.length,
          activeTasks: activeTasks.length,
          completedTasks: completedTasks.length,
          overdueTasks: overdueTasks.length,
          totalTasks: deptTasks.length
        }
      };
    });

    res.json({ success: true, data: list });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch departments' });
  }
});

// GET /api/departments/:id
deptRoutes.get('/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const dept = db.departments.find(d => d._id === resolveDepartmentId(req.params.id, db.departments));
    if (!dept) {
      res.status(404).json({ success: false, message: 'Department not found' });
      return;
    }

    const now = new Date().toISOString().split('T')[0];
    const head = db.users.find(u => u._id === dept.headId);
    const employees = db.users.filter(u => u.departmentId === dept._id && u.isActive).map(sanitizeUser);

    // Department Tasks
    const allDeptTasks = db.tasks.filter(t => t.departmentId === dept._id || t.targetDepartmentId === dept._id || t.sourceDepartmentId === dept._id);
    const activeTasks = allDeptTasks.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED');
    const completedTasks = allDeptTasks.filter(t => t.status === 'COMPLETED');
    const overdueTasks = activeTasks.filter(t => t.dueDate < now);

    // Cross-department tasks
    const incomingCrossDept = db.tasks.filter(t => t.targetDepartmentId === dept._id && t.sourceDepartmentId && t.sourceDepartmentId !== dept._id);
    const outgoingCrossDept = db.tasks.filter(t => t.sourceDepartmentId === dept._id && t.targetDepartmentId && t.targetDepartmentId !== dept._id);

    // Task Requests involving this dept
    const incomingRequests = db.taskRequests.filter(r => r.targetDepartmentId === dept._id);
    const outgoingRequests = db.taskRequests.filter(r => r.requesterDepartmentId === dept._id);

    // Projects involving this dept
    const deptProjects = db.projects.filter(p => p.departments.includes(dept._id));

    // Department documents
    const documents = db.documents.filter(doc => doc.departmentId === dept._id);

    res.json({
      success: true,
      data: {
        department: dept,
        head: head ? sanitizeUser(head) : null,
        employees,
        stats: {
          totalEmployees: employees.length,
          activeTasks: activeTasks.length,
          completedTasks: completedTasks.length,
          overdueTasks: overdueTasks.length,
          incomingCrossDeptCount: incomingCrossDept.length,
          outgoingCrossDeptCount: outgoingCrossDept.length,
          totalProjects: deptProjects.length
        },
        activeTasks: activeTasks.slice(0, 10),
        completedTasks: completedTasks.slice(0, 10),
        incomingRequests: incomingRequests.slice(0, 10),
        outgoingRequests: outgoingRequests.slice(0, 10),
        projects: deptProjects,
        documents
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch department details' });
  }
});

// POST /api/departments (Create Department - Super Admin & CEO)
deptRoutes.post('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const callerRole = getEffectiveRole(req.user!);
    if (callerRole !== 'SUPER_ADMIN' && callerRole !== 'CEO') {
      res.status(403).json({ success: false, message: 'Only Super Admin or CEO can create departments.' });
      return;
    }

    const { code, name, description, headId } = req.body;
    const nameEn = typeof name === 'string' ? name.trim() : name?.en?.trim();
    const nameBn = typeof name === 'string' ? name.trim() : (name?.bn?.trim() || nameEn);

    if (!code || !nameEn) {
      res.status(400).json({ success: false, message: 'Department code and English name are required.' });
      return;
    }

    const existingCode = db.departments.find(d => d.code.toUpperCase() === code.toUpperCase().trim());
    if (existingCode) {
      res.status(409).json({ success: false, message: `Department with code ${code} already exists.` });
      return;
    }

    const now = new Date().toISOString();
    const newDept: any = {
      _id: `dept_${code.toLowerCase().trim()}`,
      code: code.toUpperCase().trim(),
      name: {
        en: nameEn,
        bn: nameBn
      },
      description: description?.trim() || '',
      headId: headId || undefined,
      isActive: true,
      createdAt: now,
      updatedAt: now
    };

    db.departments.push(newDept);
    db.logActivity({
      actorId: req.user!._id,
      action: 'CREATE_DEPARTMENT',
      module: 'DEPARTMENTS',
      description: `Created operational department ${newDept.name.en} (${newDept.code})`,
      resourceType: 'DEPARTMENT',
      resourceId: newDept._id,
      resourceName: `${newDept.code} - ${newDept.name.en}`,
      ipAddress: req.ip || '127.0.0.1'
    });
    db.save();

    res.status(201).json({ success: true, data: newDept });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to create department' });
  }
});

// PATCH /api/departments/:id (Update Department - Super Admin & CEO)
deptRoutes.patch('/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const callerRole = getEffectiveRole(req.user!);
    if (callerRole !== 'SUPER_ADMIN' && callerRole !== 'CEO') {
      res.status(403).json({ success: false, message: 'Only Super Admin or CEO can update departments.' });
      return;
    }

    const dept = db.departments.find(d => d._id === req.params.id || d.code.toUpperCase() === req.params.id.toUpperCase());
    if (!dept) {
      res.status(404).json({ success: false, message: 'Department not found' });
      return;
    }

    const { name, description, headId, code, isActive } = req.body;

    if (name) {
      if (typeof name === 'string') {
        dept.name.en = name.trim();
        dept.name.bn = name.trim();
      } else {
        if (name.en) dept.name.en = name.en.trim();
        if (name.bn) dept.name.bn = name.bn.trim();
      }
    }
    if (code) dept.code = code.toUpperCase().trim();
    if (description !== undefined) dept.description = description.trim();
    if (headId !== undefined) dept.headId = headId;
    if (isActive !== undefined) dept.isActive = Boolean(isActive);

    dept.updatedAt = new Date().toISOString();
    db.logActivity({
      actorId: req.user!._id,
      action: 'UPDATE_DEPARTMENT',
      module: 'DEPARTMENTS',
      description: `Updated operational department ${dept.name.en} (${dept.code})`,
      resourceType: 'DEPARTMENT',
      resourceId: dept._id,
      resourceName: `${dept.code} - ${dept.name.en}`,
      ipAddress: req.ip || '127.0.0.1'
    });
    db.save();

    res.json({ success: true, data: dept });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update department' });
  }
});

// DELETE /api/departments/:id (Delete Department - Super Admin & CEO)
deptRoutes.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const callerRole = getEffectiveRole(req.user!);
    if (callerRole !== 'SUPER_ADMIN' && callerRole !== 'CEO') {
      res.status(403).json({ success: false, message: 'Only Super Admin or CEO can delete departments.' });
      return;
    }

    const idx = db.departments.findIndex(d => d._id === req.params.id || d.code.toUpperCase() === req.params.id.toUpperCase());
    if (idx === -1) {
      res.status(404).json({ success: false, message: 'Department not found' });
      return;
    }

    const targetDept = db.departments[idx];
    db.logActivity({
      actorId: req.user!._id,
      action: 'DELETE_DEPARTMENT',
      module: 'DEPARTMENTS',
      description: `Permanently deleted department ${targetDept.name.en} (${targetDept.code})`,
      resourceType: 'DEPARTMENT',
      resourceId: targetDept._id,
      resourceName: `${targetDept.code} - ${targetDept.name.en}`,
      ipAddress: req.ip || '127.0.0.1'
    });
    await db.deleteDepartmentFromDb(targetDept._id);
    res.json({ success: true, message: `Department ${targetDept.name.en} deleted successfully.` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to delete department' });
  }
});
