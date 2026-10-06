import { Router, Response } from 'express';
import { db, resolveDepartmentId } from '../db';
import { requireAuth, AuthenticatedRequest, sanitizeUser, getEffectiveRole } from '../auth';
import { populateTask } from './taskRoutes';

export const reportRoutes = Router();

// GET /api/reports/tasks (Summary task counts)
reportRoutes.get('/tasks', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const role = getEffectiveRole(req.user!);
  const isTrustee = role === 'TRUSTEE';
  const isCEO = role === 'CEO';
  const isDeptHead = role === 'DEPT_HEAD';
  const now = new Date().toISOString().split('T')[0];

  let tasks = db.tasks.filter(t => !t.isDeleted && !(t as any).deleted);

  if (!isTrustee && !isCEO) {
    if (isDeptHead && req.user?.departmentId) {
      const deptId = resolveDepartmentId(req.user.departmentId, db.departments) || req.user.departmentId;
      tasks = tasks.filter(t => 
        t.departmentId === deptId || 
        t.targetDepartmentId === deptId || 
        t.sourceDepartmentId === deptId ||
        t.assignedTo.includes(req.user!._id)
      );
    } else {
      // Regular employee: ONLY their tasks!
      const uid = req.user!._id;
      tasks = tasks.filter(t => 
        t.assignedTo.includes(uid) || 
        t.collaborators.includes(uid) ||
        t.createdBy === uid || 
        t.requestedBy === uid
      );
    }
  }

  const total = tasks.length;
  const completed = tasks.filter(t => t.status === 'COMPLETED').length;
  const inProgress = tasks.filter(t => t.status === 'IN_PROGRESS').length;
  const todo = tasks.filter(t => t.status === 'TODO').length;
  const inReview = tasks.filter(t => t.status === 'IN_REVIEW').length;
  const overdue = tasks.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED' && t.dueDate < now).length;

  const urgent = tasks.filter(t => t.priority === 'URGENT').length;
  const high = tasks.filter(t => t.priority === 'HIGH').length;
  const medium = tasks.filter(t => t.priority === 'MEDIUM').length;
  const low = tasks.filter(t => t.priority === 'LOW').length;

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

// GET /api/reports/employees (Per-employee performance metrics)
reportRoutes.get('/employees', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const role = getEffectiveRole(req.user!);
  const isTrustee = role === 'TRUSTEE';
  const isCEO = role === 'CEO';
  const isDeptHead = role === 'DEPT_HEAD';
  const { employeeId, departmentId } = req.query;
  const now = new Date().toISOString().split('T')[0];

  let candidateUsers = db.users.filter(u => u.isActive && getEffectiveRole(u) !== 'SUPER_ADMIN');

  // Enforce role-based access:
  // - Regular employees: can ONLY see themselves!
  // - Dept Head: can ONLY see employees in their department!
  // - Trustee / CEO: can see all employees.
  if (!isTrustee && !isCEO) {
    if (isDeptHead && req.user?.departmentId) {
      const userDeptId = resolveDepartmentId(req.user.departmentId, db.departments) || req.user.departmentId;
      candidateUsers = candidateUsers.filter(u => u.departmentId === userDeptId);
      if (employeeId && typeof employeeId === 'string') {
        const found = candidateUsers.find(u => u._id === employeeId);
        if (!found && employeeId !== req.user._id) {
          return res.status(403).json({ success: false, error: 'Access denied. You can only view reports for employees in your department.' });
        }
      }
    } else {
      // Regular staff
      if (employeeId && typeof employeeId === 'string' && employeeId !== req.user?._id) {
        return res.status(403).json({ success: false, error: 'Access denied. You can only view your own work report.' });
      }
      candidateUsers = candidateUsers.filter(u => u._id === req.user?._id);
    }
  } else {
    // Trustee or CEO
    if (departmentId && typeof departmentId === 'string') {
      const targetDeptId = resolveDepartmentId(departmentId, db.departments) || departmentId;
      candidateUsers = candidateUsers.filter(u => u.departmentId === targetDeptId);
    }
    if (employeeId && typeof employeeId === 'string') {
      candidateUsers = candidateUsers.filter(u => u._id === employeeId);
    }
  }

  const results = candidateUsers.map(u => {
    const dept = db.departments.find(d => d._id === u.departmentId);
    const assigned = db.tasks.filter(t => !t.isDeleted && !(t as any).deleted && (t.assignedTo.includes(u._id) || t.collaborators.includes(u._id)));
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

// GET /api/reports/departments (Per-department task breakdowns)
reportRoutes.get('/departments', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const role = getEffectiveRole(req.user!);
  const isTrustee = role === 'TRUSTEE';
  const isCEO = role === 'CEO';
  const now = new Date().toISOString().split('T')[0];

  let targetDepts = db.departments.filter(d => d.isActive);

  // Non-CEO/Trustee only sees their own department
  if (!isTrustee && !isCEO) {
    if (req.user?.departmentId) {
      const userDeptId = resolveDepartmentId(req.user.departmentId, db.departments) || req.user.departmentId;
      targetDepts = targetDepts.filter(d => d._id === userDeptId);
    } else {
      targetDepts = [];
    }
  }

  const results = targetDepts.map(d => {
    const employees = db.users.filter(u => u.departmentId === d._id && u.isActive && getEffectiveRole(u) !== 'SUPER_ADMIN');
    const deptTasks = db.tasks.filter(t => !t.isDeleted && !(t as any).deleted && (t.departmentId === d._id || t.targetDepartmentId === d._id || t.sourceDepartmentId === d._id));
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

// GET /api/reports/cross-department (Synergy metrics between departments)
reportRoutes.get('/cross-department', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const role = getEffectiveRole(req.user!);
  if (role !== 'TRUSTEE' && role !== 'CEO' && role !== 'DEPT_HEAD') {
    return res.status(403).json({ success: false, error: 'Access denied. Cross-department metrics are restricted to executive roles.' });
  }

  const crossTasks = db.tasks.filter(t => !t.isDeleted && !(t as any).deleted && t.sourceDepartmentId && t.targetDepartmentId && t.sourceDepartmentId !== t.targetDepartmentId);
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

// GET /api/reports/tasks-report (Primary endpoint for in-page report viewing and PDF compilation)
reportRoutes.get('/tasks-report', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const role = getEffectiveRole(req.user!);
  const isTrustee = role === 'TRUSTEE';
  const isCEO = role === 'CEO';
  const isDeptHead = role === 'DEPT_HEAD';
  const isStaff = !isTrustee && !isCEO && !isDeptHead && role !== 'SUPER_ADMIN';

  let { scope = 'ALL', departmentId, employeeId, status = 'ONGOING' } = req.query as Record<string, string>;

  const now = new Date().toISOString().split('T')[0];

  // 1. Strict Role Boundary Enforcement:
  // - Staff: STRICTLY locked to their own employee report. Cannot query other scopes or users.
  if (isStaff) {
    if (employeeId && employeeId !== req.user!._id) {
      return res.status(403).json({ success: false, error: 'Access denied. You can only view your own work report.' });
    }
    scope = 'EMPLOYEE';
    employeeId = req.user!._id;
  }

  // - Dept Head: Cannot query 'ALL'. Can query own department or an employee within their department.
  if (isDeptHead) {
    if (scope === 'ALL') {
      scope = 'DEPT';
    }
    const userDeptId = resolveDepartmentId(req.user!.departmentId, db.departments) || req.user!.departmentId;
    
    if (scope === 'DEPT') {
      departmentId = userDeptId;
    } else if (scope === 'EMPLOYEE') {
      if (!employeeId) {
        employeeId = req.user!._id;
      }
      const targetUser = db.users.find(u => u._id === employeeId);
      if (!targetUser || (targetUser.departmentId !== userDeptId && targetUser._id !== req.user!._id)) {
        return res.status(403).json({ success: false, error: 'Access denied. Department Heads can only view reports for personnel in their department.' });
      }
    }
  }

  // - Trustee / CEO: Can query 'ALL', any 'DEPT', or any 'EMPLOYEE'.
  if (isTrustee || isCEO) {
    if (scope === 'DEPT' && !departmentId) {
      departmentId = db.departments[0]?._id;
    }
    if (scope === 'EMPLOYEE' && !employeeId) {
      employeeId = req.user!._id;
    }
  }

  // 2. Fetch Tasks by Scope
  let allMatchingTasks = db.tasks.filter(t => !t.isDeleted && !(t as any).deleted);

  let targetDepartment: any = null;
  let targetEmployee: any = null;

  if (scope === 'EMPLOYEE' && employeeId) {
    const emp = db.users.find(u => u._id === employeeId);
    if (!emp) {
      return res.status(404).json({ success: false, error: 'Employee not found.' });
    }
    targetEmployee = sanitizeUser(emp);
    const empDept = db.departments.find(d => d._id === emp.departmentId);
    targetDepartment = empDept ? { _id: empDept._id, code: empDept.code, name: empDept.name } : null;

    allMatchingTasks = allMatchingTasks.filter(t => 
      t.assignedTo.includes(employeeId) || 
      t.collaborators.includes(employeeId)
    );
  } else if (scope === 'DEPT' && departmentId) {
    const resolvedId = resolveDepartmentId(departmentId, db.departments) || departmentId;
    const dept = db.departments.find(d => d._id === resolvedId);
    targetDepartment = dept ? { _id: dept._id, code: dept.code, name: dept.name } : null;

    allMatchingTasks = allMatchingTasks.filter(t => 
      t.departmentId === resolvedId || 
      t.targetDepartmentId === resolvedId || 
      t.sourceDepartmentId === resolvedId
    );
  }

  // 3. Filter by Task Status
  const statusUpper = (status || 'ONGOING').toUpperCase();
  let filteredTasks = allMatchingTasks;

  if (statusUpper === 'ONGOING') {
    filteredTasks = allMatchingTasks.filter(t => {
      const s = (t.status || '').toUpperCase().replace(/\s+/g, '_');
      return s !== 'COMPLETED' && s !== 'CANCELLED' && s !== 'REJECTED';
    });
  } else if (statusUpper === 'COMPLETED') {
    filteredTasks = allMatchingTasks.filter(t => {
      const s = (t.status || '').toUpperCase().replace(/\s+/g, '_');
      return s === 'COMPLETED';
    });
  } else {
    // ALL tasks (excluding cancelled)
    filteredTasks = allMatchingTasks.filter(t => {
      const s = (t.status || '').toUpperCase().replace(/\s+/g, '_');
      return s !== 'CANCELLED';
    });
  }

  // 4. Compute Comprehensive Statistics
  const total = filteredTasks.length;
  const completedCount = filteredTasks.filter(t => t.status === 'COMPLETED').length;
  const activeCount = filteredTasks.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED').length;
  const overdueCount = filteredTasks.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED' && t.dueDate < now).length;
  const completionRate = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  const urgentCount = filteredTasks.filter(t => t.priority === 'URGENT').length;
  const highCount = filteredTasks.filter(t => t.priority === 'HIGH').length;
  const mediumCount = filteredTasks.filter(t => t.priority === 'MEDIUM').length;
  const lowCount = filteredTasks.filter(t => t.priority === 'LOW').length;

  // 5. Construct Report Titles
  const filterTypeName = statusUpper === 'COMPLETED'
    ? 'Completed Tasks'
    : statusUpper === 'ALL'
    ? 'All Tasks'
    : 'Ongoing Tasks';

  let reportTitle = '';
  let scopeName = '';

  if (scope === 'EMPLOYEE' && targetEmployee) {
    const isSelf = targetEmployee._id === req.user?._id;
    reportTitle = isSelf
      ? `My Work Report (${filterTypeName})`
      : `${targetEmployee.name.en} — Work Report (${filterTypeName})`;
    scopeName = `Employee Work Report (${targetEmployee.name.en} • ${targetEmployee.designation?.en || 'Staff'})`;
  } else if (scope === 'DEPT' && targetDepartment) {
    const deptName = targetDepartment.name?.en || targetDepartment.name || targetDepartment.code || 'Department';
    reportTitle = `${deptName} — ${filterTypeName} Report`;
    scopeName = `Department-Wise (${deptName})`;
  } else {
    reportTitle = `Liberation War Museum — All Departments ${filterTypeName} Report`;
    scopeName = `All Departments (All-in-One)`;
  }

  res.json({
    success: true,
    data: {
      reportTitle,
      scopeName,
      scope,
      filterTypeName,
      status: statusUpper,
      department: targetDepartment,
      employee: targetEmployee,
      generatedAt: new Date().toISOString(),
      stats: {
        total,
        completed: completedCount,
        active: activeCount,
        overdue: overdueCount,
        completionRate,
        byPriority: {
          urgent: urgentCount,
          high: highCount,
          medium: mediumCount,
          low: lowCount
        }
      },
      tasks: filteredTasks.map(populateTask)
    }
  });
});
