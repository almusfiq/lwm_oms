import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db, resolveDepartmentId } from '../db';
import { requireAuth, sanitizeUser, AuthenticatedRequest, getEffectiveRole } from '../auth';
import { User } from '../types';

export const userRoutes = Router();

// GET /api/users
userRoutes.get('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { departmentId, role, search, activeOnly } = req.query;

  let list = [...db.users];

  if (req.user) {
    const callerRole = getEffectiveRole(req.user);
    const isSuperAdmin = callerRole === 'SUPER_ADMIN';
    const isTrustee = callerRole === 'TRUSTEE';
    const isCEO = callerRole === 'CEO';

    if (!isSuperAdmin && (activeOnly === 'true' || activeOnly === undefined)) {
      list = list.filter(u => u.isActive);
    }

    if (!isSuperAdmin && !isTrustee && !isCEO && req.user.departmentId) {
      const callerDeptId = resolveDepartmentId(req.user.departmentId, db.departments) || req.user.departmentId;
      list = list.filter(u => u.departmentId === callerDeptId);
    }
  }

  if (departmentId && typeof departmentId === 'string') {
    list = list.filter(u => u.departmentId === resolveDepartmentId(departmentId, db.departments));
  }

  if (role && typeof role === 'string') {
    list = list.filter(u => getEffectiveRole(u) === role);
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    list = list.filter(u => 
      u.name.en.toLowerCase().includes(q) ||
      u.name.bn.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.employeeId.toLowerCase().includes(q) ||
      u.designation.en.toLowerCase().includes(q) ||
      u.designation.bn.toLowerCase().includes(q)
    );
  }

  // Populate department info
  const sanitized = list.map(u => {
    const dept = db.departments.find(d => d._id === u.departmentId);
    return {
      ...sanitizeUser(u),
      department: dept ? { _id: dept._id, code: dept.code, name: dept.name } : null
    };
  });

  res.json({ success: true, data: sanitized });
});

// GET /api/users/:id
userRoutes.get('/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const user = db.users.find(u => u._id === req.params.id);
  if (!user) {
    res.status(404).json({ success: false, message: 'User not found' });
    return;
  }

  const dept = db.departments.find(d => d._id === user.departmentId);

  // User workload metrics
  const now = new Date().toISOString().split('T')[0];
  const assignedTasks = db.tasks.filter(t => t.assignedTo.includes(user._id));
  const activeTasks = assignedTasks.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED');
  const completedTasks = assignedTasks.filter(t => t.status === 'COMPLETED');
  const overdueTasks = activeTasks.filter(t => t.dueDate < now);

  const requestedTasks = db.tasks.filter(t => t.requestedBy === user._id || t.createdBy === user._id);
  const userProjects = db.projects.filter(p => p.managerId === user._id || p.members.includes(user._id));

  // Recent activity involving this user
  const recentActivities = db.activityLogs
    .filter(a => a.actorId === user._id || a.resourceId === user._id)
    .slice(0, 10);

  res.json({
    success: true,
    data: {
      user: sanitizeUser(user),
      department: dept ? { _id: dept._id, code: dept.code, name: dept.name } : null,
      workload: {
        activeTasksCount: activeTasks.length,
        completedTasksCount: completedTasks.length,
        overdueTasksCount: overdueTasks.length,
        requestedTasksCount: requestedTasks.length,
        projectsCount: userProjects.length
      },
      assignedTasks: assignedTasks.slice(0, 15),
      projects: userProjects,
      recentActivities
    }
  });
});

// POST /api/users (Create new user/employee)
userRoutes.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const callerRole = getEffectiveRole(req.user!);
    if (callerRole !== 'SUPER_ADMIN' && callerRole !== 'CEO' && callerRole !== 'TRUSTEE') {
      res.status(403).json({ success: false, message: 'Only Super Admin, CEO or Trustee can add users.' });
      return;
    }

    const { name, email, password, designation, departmentId, role, tier, phone, uniqueId } = req.body;

    if (!name?.en || !email || !designation?.en) {
      res.status(400).json({ success: false, message: 'Name, email and designation are required' });
      return;
    }

    const existing = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      res.status(409).json({ success: false, message: 'User with this email already exists' });
      return;
    }

    const initialPassword = password ? await bcrypt.hash(password, 10) : await bcrypt.hash('LWM@2026', 10);
    const count = db.users.length + 1;
    const dept = db.departments.find(d => d._id === departmentId);
    const code = dept ? dept.code : 'GEN';

    const newUser: User = {
      _id: db.generateId('usr'),
      employeeId: `LWM-${code}-${String(count).padStart(3, '0')}`,
      uniqueId: uniqueId || `LWM-${code}-${String(count).padStart(3, '0')}`,
      name: {
        en: name.en,
        bn: name.bn || name.en
      },
      email: email.toLowerCase(),
      password: initialPassword,
      designation: {
        en: designation.en,
        bn: designation.bn || designation.en
      },
      departmentId,
      role: role || 'OFFICER',
      roleId: role || undefined,
      tier: tier || (role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'OFFICER'),
      phone: phone || '',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.users.push(newUser);
    db.activityLogs.unshift({
      _id: db.generateId('act'),
      actorId: req.user!._id,
      action: 'USER_CREATED',
      resourceType: 'USER',
      resourceId: newUser._id,
      metadata: { name: newUser.name.en, email: newUser.email, role: newUser.role },
      createdAt: new Date().toISOString()
    });

    db.save();
    res.status(201).json({ success: true, data: sanitizeUser(newUser) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to create user' });
  }
});

// POST /api/users/change-password (Change logged-in user password)
userRoutes.post('/change-password', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ success: false, message: 'Current password and new password are required' });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ success: false, message: 'New password must be at least 6 characters long' });
      return;
    }

    const user = db.users.find(u => u._id === req.user?._id);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      res.status(400).json({ success: false, message: 'Incorrect current password' });
      return;
    }

    // Hash and update password
    user.password = await bcrypt.hash(newPassword, 10);
    user.updatedAt = new Date().toISOString();

    db.activityLogs.unshift({
      _id: db.generateId('act'),
      actorId: user._id,
      action: 'PASSWORD_CHANGED',
      resourceType: 'USER',
      resourceId: user._id,
      metadata: { name: user.name.en, email: user.email },
      createdAt: new Date().toISOString()
    });

    db.save();
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update password' });
  }
});

// PATCH /api/users/:id (Update user - Super Admin, CEO, Trustee or Self)
userRoutes.patch('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = db.users.find(u => u._id === req.params.id);
  if (!user) {
    res.status(404).json({ success: false, message: 'User not found' });
    return;
  }

  const callerRole = getEffectiveRole(req.user!);
  const isSelf = req.user?._id === user._id;
  const isSuperAdmin = callerRole === 'SUPER_ADMIN';
  const isPrivileged = isSuperAdmin || callerRole === 'CEO' || callerRole === 'TRUSTEE';

  if (!isSelf && !isPrivileged) {
    res.status(403).json({ success: false, message: 'Not authorized to edit this user' });
    return;
  }

  const { name, email, password, phone, photo, designation, departmentId, role, isActive } = req.body;

  if (name) {
    if (name.en) user.name.en = name.en;
    if (name.bn) user.name.bn = name.bn;
  }
  if (email && isPrivileged) {
    user.email = email.toLowerCase();
  }
  if (password && (isSuperAdmin || isSelf || isPrivileged)) {
    user.password = await bcrypt.hash(password, 10);
  }
  if (phone !== undefined) user.phone = phone;
  if (photo !== undefined) user.photo = photo;

  // Privileged fields
  if (isPrivileged) {
    if (designation) {
      if (designation.en) user.designation.en = designation.en;
      if (designation.bn) user.designation.bn = designation.bn;
    }
    if (departmentId !== undefined) user.departmentId = departmentId;
    if (role) {
      user.role = role;
      user.roleId = role;
      if (role === 'SUPER_ADMIN') user.tier = 'SUPER_ADMIN';
    }
    if (isActive !== undefined) user.isActive = Boolean(isActive);
  }

  user.updatedAt = new Date().toISOString();
  db.save();
  res.json({ success: true, data: sanitizeUser(user) });
});

// DELETE /api/users/:id (Delete user - Super Admin can delete anyone!)
userRoutes.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const viewer = req.user!;
  const viewerRole = getEffectiveRole(viewer);
  const isSuperAdmin = viewerRole === 'SUPER_ADMIN';

  if (!isSuperAdmin && viewerRole !== 'TRUSTEE' && viewerRole !== 'CEO') {
    res.status(403).json({ success: false, message: 'Only Super Admin, Trustee, or CEO can delete users.' });
    return;
  }

  const userIdx = db.users.findIndex(u => u._id === req.params.id);
  if (userIdx === -1) {
    res.status(404).json({ success: false, message: 'User not found.' });
    return;
  }

  const target = db.users[userIdx];
  // Super Admin can delete anyone (including Trustee or CEO). Non-Super Admin cannot delete Trustee or CEO.
  if (!isSuperAdmin && (target.role === 'TRUSTEE' || target.role === 'CEO')) {
    res.status(403).json({ success: false, message: 'Cannot delete Trustee or CEO accounts.' });
    return;
  }

  db.activityLogs.unshift({
    _id: db.generateId('act'),
    actorId: viewer._id,
    action: 'USER_DELETED',
    resourceType: 'USER',
    resourceId: target._id,
    metadata: { name: target.name.en, email: target.email },
    createdAt: new Date().toISOString()
  });
  await db.deleteUserFromDb(target._id);
  res.json({ success: true, message: 'User account deleted successfully.' });
});


// GET /api/users/performance — role-gated performance scores
userRoutes.get('/performance/all', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const viewer = req.user!;
  const { departmentId } = req.query;

  const viewerRole = getEffectiveRole(viewer);

  const canView =
    viewerRole === 'TRUSTEE' ||
    viewerRole === 'CEO' ||
    viewerRole === 'DEPT_HEAD';

  if (!canView) {
    res.status(403).json({ success: false, message: 'Access denied.' });
    return;
  }

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  let users = db.users.filter(u => u.isActive);

  // Trustee sees everyone; CEO sees all except Trustees; Dept Head sees own dept only
  if (viewerRole === 'CEO') {
    users = users.filter(u => getEffectiveRole(u) !== 'TRUSTEE');
  } else if (viewerRole === 'DEPT_HEAD') {
    users = users.filter(u => u.departmentId === viewer.departmentId && getEffectiveRole(u) !== 'TRUSTEE');
  }

  if (departmentId && typeof departmentId === 'string' && viewerRole !== 'DEPT_HEAD') {
    users = users.filter(u => u.departmentId === departmentId);
  }

  const records = users.map(u => {
    const tasks = db.tasks.filter(t => t.assignedTo.includes(u._id));
    const completed = tasks.filter(t => t.status === 'COMPLETED');
    const completedOnTime = completed.filter(t => !t.completedAt || t.completedAt <= t.dueDate).length;
    const completedLate = completed.length - completedOnTime;
    const overduePending = tasks.filter(t =>
      t.status !== 'COMPLETED' && t.status !== 'CANCELLED' && t.dueDate < todayStr
    ).length;
    const total = tasks.length;

    let score = 100;
    if (total > 0) {
      score = Math.max(0, Math.round(
        ((completedOnTime * 10 + completedLate * 5) / Math.max(total, 1)) * 10
        - overduePending * 8
      ));
      score = Math.min(100, score);
    }

    const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 45 ? 'D' : 'F';
    const dept = db.departments.find(d => d._id === u.departmentId);

    return {
      userId: u._id,
      name: u.name,
      role: u.role,
      employeeId: u.employeeId,
      uniqueId: u.uniqueId,
      department: dept ? { _id: dept._id, code: dept.code, name: dept.name } : null,
      totalTasks: total,
      completedOnTime,
      completedLate,
      overduePending,
      score,
      grade,
      lastCalculated: now.toISOString()
    };
  });

  records.sort((a, b) => b.score - a.score);
  res.json({ success: true, data: records });
});
