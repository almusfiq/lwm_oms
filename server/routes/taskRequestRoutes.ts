import { Router, Response } from 'express';
import { db, resolveDepartmentId } from '../db';
import { requireAuth, AuthenticatedRequest, sanitizeUser, getEffectiveRole, isHigherLevel } from '../auth';
import { TaskRequest, Task } from '../types';

export const taskRequestRoutes = Router();

// Can the current user manage (approve / assign) a request targeting a department?
function canManageTargetDept(user: any, request: TaskRequest): boolean {
  const role = getEffectiveRole(user);
  if (role === 'CEO' || role === 'TRUSTEE') return true;
  if (role === 'DEPT_HEAD' || role === 'DEPARTMENT_HEAD') {
    const userDeptId = resolveDepartmentId(user.departmentId, db.departments) || user.departmentId;
    return userDeptId === request.targetDepartmentId;
  }
  return false;
}

// Is the given user an assignable, active, non-super-admin member of the department?
function isAssignableInDept(userId: string, deptId: string): boolean {
  const u = db.users.find(x => x._id === userId);
  if (!u || !u.isActive || getEffectiveRole(u) === 'SUPER_ADMIN') return false;
  const uDept = resolveDepartmentId(u.departmentId, db.departments) || u.departmentId;
  return uDept === deptId;
}

function populateRequest(r: TaskRequest) {
  const requester = db.users.find(u => u._id === r.requesterId);
  const targetEmployee = db.users.find(u => u._id === r.targetEmployeeId);
  const suggestedEmployee = r.suggestedEmployeeId ? db.users.find(u => u._id === r.suggestedEmployeeId) : null;
  const requesterDept = db.departments.find(d => d._id === r.requesterDepartmentId);
  const targetDept = db.departments.find(d => d._id === r.targetDepartmentId);
  const convertedTask = r.convertedTaskId ? db.tasks.find(t => t._id === r.convertedTaskId) : null;

  return {
    ...r,
    requester: requester ? sanitizeUser(requester) : null,
    targetEmployee: targetEmployee ? sanitizeUser(targetEmployee) : null,
    suggestedEmployee: suggestedEmployee ? sanitizeUser(suggestedEmployee) : null,
    requesterDepartment: requesterDept ? { _id: requesterDept._id, code: requesterDept.code, name: requesterDept.name } : null,
    targetDepartment: targetDept ? { _id: targetDept._id, code: targetDept.code, name: targetDept.name } : null,
    convertedTask: convertedTask ? {
      _id: convertedTask._id,
      taskId: convertedTask.taskId,
      title: convertedTask.title,
      status: convertedTask.status,
      progress: convertedTask.progress,
      assignedTo: convertedTask.assignedTo,
      assignees: convertedTask.assignedTo.map(id => db.users.find(u => u._id === id)).filter(Boolean).map(u => sanitizeUser(u!))
    } : null
  };
}

// GET /api/task-requests
taskRequestRoutes.get('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { status, type, departmentId } = req.query;
  const currentUserId = req.user!._id;

  let list = [...db.taskRequests];

  // Incoming to me vs Outgoing by me vs All
  if (type === 'incoming') {
    list = list.filter(r => r.targetEmployeeId === currentUserId || (req.user?.departmentId && r.targetDepartmentId === req.user.departmentId && (getEffectiveRole(req.user!) === 'DEPT_HEAD' || getEffectiveRole(req.user!) === 'DEPARTMENT_HEAD')));
  } else if (type === 'outgoing') {
    list = list.filter(r => r.requesterId === currentUserId);
  } else if (getEffectiveRole(req.user!) !== 'CEO' && getEffectiveRole(req.user!) !== 'TRUSTEE') {
    // Regular employees see requests they sent, requests they received, or department requests
    list = list.filter(r => 
      r.targetEmployeeId === currentUserId || 
      r.requesterId === currentUserId ||
      (req.user?.departmentId && (r.targetDepartmentId === req.user.departmentId || r.requesterDepartmentId === req.user.departmentId))
    );
  }

  if (status && typeof status === 'string') {
    list = list.filter(r => r.status === status.toUpperCase());
  }

  if (departmentId && typeof departmentId === 'string') {
    list = list.filter(r => r.targetDepartmentId === resolveDepartmentId(departmentId, db.departments) || r.requesterDepartmentId === resolveDepartmentId(departmentId, db.departments));
  }

  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json({
    success: true,
    data: list.map(populateRequest)
  });
});

// GET /api/task-requests/:id
taskRequestRoutes.get('/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const request = db.taskRequests.find(r => r._id === req.params.id || r.requestId === req.params.id);
  if (!request) {
    res.status(404).json({ success: false, message: 'Work request not found' });
    return;
  }

  res.json({ success: true, data: populateRequest(request) });
});

// POST /api/task-requests (Create cross-department work request)
taskRequestRoutes.post('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { 
      targetEmployeeId, targetDepartmentId, 
      title, description, priority = 'MEDIUM', 
      dueDate, attachments = [] 
    } = req.body;

    if (!title || !dueDate) {
      res.status(400).json({ success: false, message: 'Title and deadline are required' });
      return;
    }

    const requesterDeptId = resolveDepartmentId(req.user?.departmentId, db.departments) || 'dept_admin';
    let targetUser = targetEmployeeId ? db.users.find(u => u._id === targetEmployeeId) : null;
    let finalTargetDeptId = resolveDepartmentId(targetDepartmentId || targetUser?.departmentId, db.departments) || requesterDeptId;

    let primaryTargetEmployeeId = targetEmployeeId;
    let suggestedEmployeeId: string | undefined = undefined;

    // Restriction: Only CEO and Dept Head can submit task requests to Trustees
    const isTargetTopLevel = targetUser?.role === 'TRUSTEE' || targetUser?.role === 'CEO' || targetUser?.role === 'SUPER_ADMIN';
    if (targetUser?.role === 'TRUSTEE') {
      const requesterRole = getEffectiveRole(req.user!);
      if (requesterRole !== 'CEO' && requesterRole !== 'DEPT_HEAD' && requesterRole !== 'DEPARTMENT_HEAD' && requesterRole !== 'TRUSTEE' && requesterRole !== 'SUPER_ADMIN') {
        res.status(403).json({ success: false, message: 'Only the CEO or a Department Head can submit task requests to the Trustee Board.' });
        return;
      }
    }

    // Cross-department request logic: Route to Head of Target Department
    // (Unless the request is targeted specifically to a Trustee, CEO, or Super Admin)
    if (!isTargetTopLevel && finalTargetDeptId !== requesterDeptId) {
      const targetDeptObj = db.departments.find(d => d._id === finalTargetDeptId);
      let deptHead = targetDeptObj?.headId ? db.users.find(u => u._id === targetDeptObj.headId && u.isActive) : null;
      if (!deptHead) {
        deptHead = db.users.find(u => u.departmentId === finalTargetDeptId && (u.role === 'DEPT_HEAD' || u.role === 'DEPARTMENT_HEAD') && u.isActive) || null;
      }

      if (deptHead) {
        if (targetUser && targetUser._id !== deptHead._id) {
          suggestedEmployeeId = targetUser._id;
        }
        primaryTargetEmployeeId = deptHead._id;
        targetUser = deptHead;
      }
    }

    if (!primaryTargetEmployeeId || !targetUser || !targetUser.isActive) {
      res.status(404).json({ success: false, message: 'Target employee or department head is invalid or inactive' });
      return;
    }

    const newRequest: TaskRequest = {
      _id: db.generateId('req'),
      requestId: db.getNextRequestId(),
      requesterId: req.user!._id,
      requesterDepartmentId: requesterDeptId,
      targetEmployeeId: primaryTargetEmployeeId,
      suggestedEmployeeId,
      targetDepartmentId: finalTargetDeptId,
      title,
      description,
      priority: priority || 'MEDIUM',
      dueDate,
      attachments: attachments || [],
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.taskRequests.unshift(newRequest);

    // Activity Log
    db.activityLogs.unshift({
      _id: db.generateId('act'),
      actorId: req.user!._id,
      action: 'TASK_REQUEST_SENT',
      resourceType: 'TASK_REQUEST',
      resourceId: newRequest._id,
      metadata: { 
        requestId: newRequest.requestId, 
        target: targetUser.name.en, 
        targetDept: finalTargetDeptId 
      },
      createdAt: new Date().toISOString()
    });

    // Notify target department head / employee
    db.notifications.unshift({
      _id: db.generateId('notif'),
      recipientId: primaryTargetEmployeeId,
      type: 'TASK_REQUEST',
      title: `Incoming Cross-Dept Request (${priority}): ${newRequest.requestId}`,
      message: `${req.user?.name.en} requested work: "${newRequest.title}".`,
      resourceType: 'TASK_REQUEST',
      resourceId: newRequest._id,
      isRead: false,
      createdAt: new Date().toISOString()
    });

    db.save();
    res.status(201).json({ success: true, data: populateRequest(newRequest) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to submit request' });
  }
});

// POST /api/task-requests/:id/accept (Convert Request into Real Task!)
taskRequestRoutes.post('/:id/accept', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const request = db.taskRequests.find(r => r._id === req.params.id || r.requestId === req.params.id);
  if (!request) {
    res.status(404).json({ success: false, message: 'Request not found' });
    return;
  }

  // Verification: current user must be target employee or authorized manager/CEO/Dept Head
  const isTarget = req.user?._id === request.targetEmployeeId;
  const isExec = getEffectiveRole(req.user!) === 'CEO' || getEffectiveRole(req.user!) === 'TRUSTEE';
  const isDeptHead = (getEffectiveRole(req.user!) === 'DEPT_HEAD' || getEffectiveRole(req.user!) === 'DEPARTMENT_HEAD') && req.user?.departmentId === request.targetDepartmentId;

  if (!isTarget && !isExec && !isDeptHead) {
    res.status(403).json({ success: false, message: 'Only the requested employee or department head can accept this request' });
    return;
  }

  const { responseMessage, assignedToId } = req.body;

  if (assignedToId && assignedToId !== req.user!._id && !isAssignableInDept(assignedToId, request.targetDepartmentId)) {
    res.status(400).json({ success: false, message: 'The selected assignee must be an active employee of the target department.' });
    return;
  }

  const finalAssigneeId = assignedToId || request.suggestedEmployeeId || request.targetEmployeeId;
  const assignedUser = db.users.find(u => u._id === finalAssigneeId && u.isActive);
  const actualAssigneeId = assignedUser ? assignedUser._id : (request.targetEmployeeId || req.user!._id);

  // Create real Task record!
  const newTask: Task = {
    _id: db.generateId('task'),
    taskId: db.getNextTaskId(),
    title: request.title,
    description: request.description,
    createdBy: request.requesterId,
    requestedBy: request.requesterId,
    assignedTo: [actualAssigneeId].filter(Boolean),
    collaborators: [request.requesterId, req.user!._id].filter(Boolean),
    sourceDepartmentId: request.requesterDepartmentId,
    targetDepartmentId: request.targetDepartmentId,
    departmentId: request.targetDepartmentId,
    status: 'IN_PROGRESS',
    priority: request.priority,
    progress: 0,
    visibility: 'ORGANIZATION',
    startDate: new Date().toISOString().split('T')[0],
    dueDate: request.dueDate,
    checklist: [],
    tags: ['Cross-Dept', 'Converted-Request'],
    attachments: request.attachments || [],
    relatedRequestId: request._id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.tasks.unshift(newTask);

  // Update request state
  request.status = 'CONVERTED_TO_TASK';
  request.convertedTaskId = newTask._id;
  request.targetEmployeeId = actualAssigneeId;
  request.responseMessage = responseMessage || `Request accepted by Department Head and assigned to ${assignedUser?.name.en || 'department staff'}.`;
  request.updatedAt = new Date().toISOString();

  // Activity Log
  db.activityLogs.unshift({
    _id: db.generateId('act'),
    actorId: req.user!._id,
    action: 'TASK_REQUEST_ACCEPTED',
    resourceType: 'TASK_REQUEST',
    resourceId: request._id,
    metadata: { convertedTaskId: newTask.taskId, assignedTo: actualAssigneeId },
    createdAt: new Date().toISOString()
  });

  // Notify assigned employee if different from Department Head
  if (actualAssigneeId !== req.user!._id) {
    db.notifications.unshift({
      _id: db.generateId('notif'),
      recipientId: actualAssigneeId,
      type: 'TASK_ASSIGNED',
      title: `Task Assigned by Department Head: ${newTask.taskId}`,
      message: `${req.user?.name.en} assigned you to cross-department task "${request.title}".`,
      resourceType: 'TASK',
      resourceId: newTask._id,
      isRead: false,
      createdAt: new Date().toISOString()
    });
  }

  // Notify original requester
  db.notifications.unshift({
    _id: db.generateId('notif'),
    recipientId: request.requesterId,
    type: 'TASK_ACCEPTED',
    title: `Request Accepted: ${newTask.taskId}`,
    message: `${req.user?.name.en} accepted your request "${request.title}" and assigned it to ${assignedUser?.name.en || 'department staff'}.`,
    resourceType: 'TASK',
    resourceId: newTask._id,
    isRead: false,
    createdAt: new Date().toISOString()
  });

  db.save();

  res.json({
    success: true,
    data: {
      request: populateRequest(request),
      task: newTask
    }
  });
});

// POST /api/task-requests/:id/assign (Dept Head assigns/reassigns the approved task to dept employees)
taskRequestRoutes.post('/:id/assign', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const request = db.taskRequests.find(r => r._id === req.params.id || r.requestId === req.params.id);
  if (!request) {
    res.status(404).json({ success: false, message: 'Request not found' });
    return;
  }

  if (!canManageTargetDept(req.user, request)) {
    res.status(403).json({ success: false, message: 'Only the Department Head of the target department can assign this task.' });
    return;
  }

  if (request.status !== 'CONVERTED_TO_TASK' || !request.convertedTaskId) {
    res.status(400).json({ success: false, message: 'This request must be approved before it can be assigned.' });
    return;
  }

  const task = db.tasks.find(t => 
    t._id === request.convertedTaskId || 
    t.relatedRequestId === request._id || 
    t.taskId === request.convertedTaskId
  );
  if (!task) {
    res.status(404).json({ success: false, message: 'Converted task not found' });
    return;
  }

  const { assigneeIds, note } = req.body as { assigneeIds?: string[]; note?: string };
  const ids = Array.from(new Set((assigneeIds || []).filter(Boolean)));
  if (ids.length === 0) {
    res.status(400).json({ success: false, message: 'Select at least one employee to assign.' });
    return;
  }

  const invalid = ids.filter(id => id !== req.user!._id && !isAssignableInDept(id, request.targetDepartmentId));
  if (invalid.length > 0) {
    res.status(400).json({ success: false, message: 'All assignees must be active employees of your department.' });
    return;
  }

  const previous = [...task.assignedTo];
  const newlyAdded = ids.filter(id => !previous.includes(id));

  task.assignedTo = ids;
  // Keep the Dept Head and requester in the loop as collaborators
  const collabs = new Set([...(task.collaborators || []), req.user!._id, request.requesterId]);
  ids.forEach(id => collabs.delete(id));
  task.collaborators = Array.from(collabs);
  task.updatedAt = new Date().toISOString();

  request.targetEmployeeId = ids[0];
  request.updatedAt = new Date().toISOString();

  const names = ids.map(id => db.users.find(u => u._id === id)?.name.en).filter(Boolean).join(', ');

  db.activityLogs.unshift({
    _id: db.generateId('act'),
    actorId: req.user!._id,
    action: 'TASK_REQUEST_ASSIGNED',
    module: 'TASKS',
    description: `Assigned cross-dept task ${task.taskId} to ${names}`,
    resourceType: 'TASK',
    resourceId: task._id,
    metadata: { taskId: task.taskId, requestId: request.requestId, from: previous, to: ids, note },
    createdAt: new Date().toISOString()
  });

  newlyAdded.filter(id => id !== req.user!._id).forEach(id => {
    db.notifications.unshift({
      _id: db.generateId('notif'),
      recipientId: id,
      type: 'TASK_ASSIGNED',
      title: `Task Assigned by Department Head: ${task.taskId}`,
      message: `${req.user?.name.en} assigned you to cross-department task "${task.title}".${note ? ` Note: ${note}` : ''}`,
      resourceType: 'TASK',
      resourceId: task._id,
      isRead: false,
      createdAt: new Date().toISOString()
    });
  });

  db.notifications.unshift({
    _id: db.generateId('notif'),
    recipientId: request.requesterId,
    type: 'TASK_ASSIGNED',
    title: `Request ${request.requestId} assigned`,
    message: `${req.user?.name.en} assigned your request "${task.title}" to ${names}.`,
    resourceType: 'TASK',
    resourceId: task._id,
    isRead: false,
    createdAt: new Date().toISOString()
  });

  db.save();
  res.json({ success: true, data: populateRequest(request) });
});

// POST /api/task-requests/:id/reject
taskRequestRoutes.post('/:id/reject', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const request = db.taskRequests.find(r => r._id === req.params.id || r.requestId === req.params.id);
  if (!request) {
    res.status(404).json({ success: false, message: 'Request not found' });
    return;
  }

  const { reason } = req.body;
  request.status = 'REJECTED';
  request.responseMessage = reason || 'Unable to fulfill request at this time.';
  request.updatedAt = new Date().toISOString();

  // Activity Log
  db.activityLogs.unshift({
    _id: db.generateId('act'),
    actorId: req.user!._id,
    action: 'TASK_REQUEST_REJECTED',
    resourceType: 'TASK_REQUEST',
    resourceId: request._id,
    metadata: { reason: request.responseMessage },
    createdAt: new Date().toISOString()
  });

  // Notify requester
  db.notifications.unshift({
    _id: db.generateId('notif'),
    recipientId: request.requesterId,
    type: 'TASK_REJECTED',
    title: `Work Request Declined: ${request.requestId}`,
    message: `${req.user?.name.en} was unable to accept your request: "${request.responseMessage}".`,
    resourceType: 'TASK_REQUEST',
    resourceId: request._id,
    isRead: false,
    createdAt: new Date().toISOString()
  });

  db.save();
  res.json({ success: true, data: populateRequest(request) });
});

// POST /api/task-requests/:id/clarify
taskRequestRoutes.post('/:id/clarify', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const request = db.taskRequests.find(r => r._id === req.params.id || r.requestId === req.params.id);
  if (!request) {
    res.status(404).json({ success: false, message: 'Request not found' });
    return;
  }

  const { message } = req.body;
  if (!message || !message.trim()) {
    res.status(400).json({ success: false, message: 'Clarification message cannot be empty' });
    return;
  }

  request.status = 'CLARIFICATION_REQUIRED';
  if (!request.clarificationComments) {
    request.clarificationComments = [];
  }
  request.clarificationComments.push({
    userId: req.user!._id,
    message: message.trim(),
    createdAt: new Date().toISOString()
  });
  request.updatedAt = new Date().toISOString();

  // Notify the other party
  const otherParty = req.user?._id === request.targetEmployeeId ? request.requesterId : request.targetEmployeeId;
  db.notifications.unshift({
    _id: db.generateId('notif'),
    recipientId: otherParty,
    type: 'CLARIFICATION_REQUEST',
    title: `Clarification for ${request.requestId}`,
    message: `${req.user?.name.en}: "${message.slice(0, 70)}"`,
    resourceType: 'TASK_REQUEST',
    resourceId: request._id,
    isRead: false,
    createdAt: new Date().toISOString()
  });

  db.save();
  res.json({ success: true, data: populateRequest(request) });
});
