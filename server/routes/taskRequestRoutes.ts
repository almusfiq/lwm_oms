import { Router, Response } from 'express';
import { db, resolveDepartmentId } from '../db';
import { requireAuth, AuthenticatedRequest, sanitizeUser, getEffectiveRole, isHigherLevel } from '../auth';
import { TaskRequest, Task } from '../types';

export const taskRequestRoutes = Router();

function populateRequest(r: TaskRequest) {
  const requester = db.users.find(u => u._id === r.requesterId);
  const targetEmployee = db.users.find(u => u._id === r.targetEmployeeId);
  const requesterDept = db.departments.find(d => d._id === r.requesterDepartmentId);
  const targetDept = db.departments.find(d => d._id === r.targetDepartmentId);
  const convertedTask = r.convertedTaskId ? db.tasks.find(t => t._id === r.convertedTaskId) : null;

  return {
    ...r,
    requester: requester ? sanitizeUser(requester) : null,
    targetEmployee: targetEmployee ? sanitizeUser(targetEmployee) : null,
    requesterDepartment: requesterDept ? { _id: requesterDept._id, code: requesterDept.code, name: requesterDept.name } : null,
    targetDepartment: targetDept ? { _id: targetDept._id, code: targetDept.code, name: targetDept.name } : null,
    convertedTask: convertedTask ? { _id: convertedTask._id, taskId: convertedTask.taskId, title: convertedTask.title, status: convertedTask.status } : null
  };
}

// GET /api/task-requests
taskRequestRoutes.get('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { status, type, departmentId } = req.query;
  const currentUserId = req.user!._id;

  let list = [...db.taskRequests];

  // Incoming to me vs Outgoing by me vs All
  if (type === 'incoming') {
    list = list.filter(r => r.targetEmployeeId === currentUserId);
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

    if (!targetEmployeeId || !title || !dueDate) {
      res.status(400).json({ success: false, message: 'Target employee, title, and deadline are required' });
      return;
    }

    const targetUser = db.users.find(u => u._id === targetEmployeeId);
    if (!targetUser || !targetUser.isActive) {
      res.status(404).json({ success: false, message: 'Target employee is invalid or inactive' });
      return;
    }

    if (!isHigherLevel(req.user, targetUser)) {
      res.status(400).json({ success: false, message: 'Task requests must be sent to a higher-level recipient.' });
      return;
    }

    const requesterDeptId = resolveDepartmentId(req.user?.departmentId, db.departments) || 'dept_admin';
    const finalTargetDeptId = resolveDepartmentId(targetDepartmentId || targetUser.departmentId, db.departments) || 'dept_admin';

    const newRequest: TaskRequest = {
      _id: db.generateId('req'),
      requestId: db.getNextRequestId(),
      requesterId: req.user!._id,
      requesterDepartmentId: requesterDeptId,
      targetEmployeeId,
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

    // Notify target employee
    db.notifications.unshift({
      _id: db.generateId('notif'),
      recipientId: targetEmployeeId,
      type: 'TASK_REQUEST',
      title: `New Work Request: ${newRequest.requestId}`,
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

  // Verification: current user must be target employee or authorized manager/CEO
  const isTarget = req.user?._id === request.targetEmployeeId;
  const isExec = getEffectiveRole(req.user!) === 'CEO' || getEffectiveRole(req.user!) === 'TRUSTEE';
  const isDeptHead = getEffectiveRole(req.user!) === 'DEPT_HEAD' && req.user?.departmentId === request.targetDepartmentId;

  if (!isTarget && !isExec && !isDeptHead) {
    res.status(403).json({ success: false, message: 'Only the requested employee or department head can accept this request' });
    return;
  }

  // Create real Task record!
  const newTask: Task = {
    _id: db.generateId('task'),
    taskId: db.getNextTaskId(),
    title: request.title,
    description: request.description,
    createdBy: request.requesterId,
    requestedBy: request.requesterId,
    assignedTo: [request.targetEmployeeId],
    collaborators: [request.requesterId],
    sourceDepartmentId: request.requesterDepartmentId,
    targetDepartmentId: request.targetDepartmentId,
    departmentId: request.targetDepartmentId,
    status: 'ACCEPTED',
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
  request.responseMessage = req.body.responseMessage || 'Request accepted and converted into active task.';
  request.updatedAt = new Date().toISOString();

  // Activity Log
  db.activityLogs.unshift({
    _id: db.generateId('act'),
    actorId: req.user!._id,
    action: 'TASK_REQUEST_ACCEPTED',
    resourceType: 'TASK_REQUEST',
    resourceId: request._id,
    metadata: { convertedTaskId: newTask.taskId },
    createdAt: new Date().toISOString()
  });

  // Notify original requester
  db.notifications.unshift({
    _id: db.generateId('notif'),
    recipientId: request.requesterId,
    type: 'TASK_ACCEPTED',
    title: `Request Accepted: ${newTask.taskId}`,
    message: `${req.user?.name.en} accepted your request "${request.title}". It is now active as ${newTask.taskId}.`,
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
