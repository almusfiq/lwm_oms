import { Router, Response } from 'express';
import { db, resolveDepartmentId } from '../db';
import { requireAuth, AuthenticatedRequest, sanitizeUser, getEffectiveRole } from '../auth';
import { Task, TaskComment, TaskAttachment, TaskChecklistItem } from '../types';

export const taskRoutes = Router();

// Helper to populate task details
function populateTask(t: Task) {
  const requester = t.requestedBy ? db.users.find(u => u._id === t.requestedBy) : null;
  const creator = db.users.find(u => u._id === t.createdBy);
  const assignees = t.assignedTo.map(id => db.users.find(u => u._id === id)).filter(Boolean).map(u => sanitizeUser(u!));
  const collaborators = t.collaborators.map(id => db.users.find(u => u._id === id)).filter(Boolean).map(u => sanitizeUser(u!));

  const dept = db.departments.find(d => d._id === t.departmentId);
  const sourceDept = t.sourceDepartmentId ? db.departments.find(d => d._id === t.sourceDepartmentId) : null;
  const targetDept = t.targetDepartmentId ? db.departments.find(d => d._id === t.targetDepartmentId) : null;
  const project = t.projectId ? db.projects.find(p => p._id === t.projectId) : null;

  const now = new Date().toISOString().split('T')[0];
  const isOverdue = t.status !== 'COMPLETED' && t.status !== 'CANCELLED' && t.dueDate < now;

  return {
    ...t,
    isOverdue,
    creator: creator ? sanitizeUser(creator) : null,
    requester: requester ? sanitizeUser(requester) : null,
    assignees,
    collaborators,
    department: dept ? { _id: dept._id, code: dept.code, name: dept.name } : null,
    sourceDepartment: sourceDept ? { _id: sourceDept._id, code: sourceDept.code, name: sourceDept.name } : null,
    targetDepartment: targetDept ? { _id: targetDept._id, code: targetDept.code, name: targetDept.name } : null,
    project: project ? { _id: project._id, projectId: project.projectId, name: project.name } : null
  };
}

// GET /api/tasks (With advanced filtering, search, pagination, and sorting)
taskRoutes.get('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { 
    search, status, priority, department, 
    sourceDepartment, targetDepartment, assignee, 
    requester, project, overdue, myTasks, 
    sortBy = 'createdAt', sortOrder = 'desc', 
    page = '1', limit = '20' 
  } = req.query;

  const now = new Date().toISOString().split('T')[0];
  let filtered = [...db.tasks];

  // 1. Role-based baseline visibility filtering:
  // - Trustee & CEO: Can see all tasks across the museum.
  // - Dept Head: Can ONLY see tasks affiliated with their department (departmentId, targetDepartmentId, sourceDepartmentId).
  // - Staff: Can ONLY see tasks assigned to, created by, requested by, or collaborating with them.
  if (req.user) {
    const role = getEffectiveRole(req.user);
    const isSuperAdmin = role === 'SUPER_ADMIN';
    const isTrustee = role === 'TRUSTEE';
    const isCEO = role === 'CEO';
    const isDeptHead = role === 'DEPT_HEAD';
    const userDeptId = req.user.departmentId;

    if (!isSuperAdmin && !isTrustee && !isCEO) {

      if (isDeptHead && userDeptId) {
        const resolvedDeptId = resolveDepartmentId(userDeptId, db.departments) || userDeptId;
        filtered = filtered.filter(t => 
          t.departmentId === resolvedDeptId || 
          t.targetDepartmentId === resolvedDeptId || 
          t.sourceDepartmentId === resolvedDeptId ||
          t.assignedTo.includes(req.user!._id) ||
          t.createdBy === req.user!._id ||
          t.requestedBy === req.user!._id ||
          t.collaborators.includes(req.user!._id)
        );
      } else {
        const uid = req.user._id;
        filtered = filtered.filter(t => 
          t.assignedTo.includes(uid) || 
          t.requestedBy === uid || 
          t.createdBy === uid || 
          t.collaborators.includes(uid)
        );
      }
    } else if (myTasks === 'true') {
      const uid = req.user._id;
      filtered = filtered.filter(t => 
        t.assignedTo.includes(uid) || 
        t.requestedBy === uid || 
        t.createdBy === uid || 
        t.collaborators.includes(uid)
      );
    }
  }

  // 2. Search
  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    filtered = filtered.filter(t => 
      t.title.toLowerCase().includes(q) ||
      t.taskId.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.tags.some(tag => tag.toLowerCase().includes(q))
    );
  }

  // 3. Status
  if (status && typeof status === 'string') {
    const statuses = status.split(',').map(s => s.trim().toUpperCase());
    filtered = filtered.filter(t => statuses.includes(t.status));
  }

  // 4. Priority
  if (priority && typeof priority === 'string') {
    filtered = filtered.filter(t => t.priority === priority.toUpperCase());
  }

  // 5. Department filters
  if (department && typeof department === 'string') {
    const resolvedId = resolveDepartmentId(department, db.departments);
    filtered = filtered.filter(t => 
      t.departmentId === resolvedId || 
      t.targetDepartmentId === resolvedId ||
      t.sourceDepartmentId === resolvedId
    );
  }
  if (sourceDepartment && typeof sourceDepartment === 'string') {
    filtered = filtered.filter(t => t.sourceDepartmentId === resolveDepartmentId(sourceDepartment, db.departments));
  }
  if (targetDepartment && typeof targetDepartment === 'string') {
    filtered = filtered.filter(t => t.targetDepartmentId === resolveDepartmentId(targetDepartment, db.departments));
  }

  // 6. Assignee & Requester
  if (assignee && typeof assignee === 'string') {
    filtered = filtered.filter(t => t.assignedTo.includes(assignee));
  }
  if (requester && typeof requester === 'string') {
    filtered = filtered.filter(t => t.requestedBy === requester || t.createdBy === requester);
  }

  // 7. Project
  if (project && typeof project === 'string') {
    filtered = filtered.filter(t => t.projectId === project);
  }

  // 8. Overdue
  if (overdue === 'true') {
    filtered = filtered.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED' && t.dueDate < now);
  }

  // 9. Sorting
  filtered.sort((a, b) => {
    let valA: any = (a as any)[sortBy as string];
    let valB: any = (b as any)[sortBy as string];

    if (valA === undefined) valA = '';
    if (valB === undefined) valB = '';

    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  // 10. Pagination
  const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));
  const total = filtered.length;
  const totalPages = Math.ceil(total / limitNum);
  const startIndex = (pageNum - 1) * limitNum;
  const paginated = filtered.slice(startIndex, startIndex + limitNum);

  res.json({
    success: true,
    data: {
      items: paginated.map(populateTask),
      total,
      page: pageNum,
      limit: limitNum,
      totalPages
    }
  });
});

// GET /api/tasks/:id (Full task detail with comments, checklist, and activity logs)
taskRoutes.get('/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const task = db.tasks.find(t => t._id === req.params.id || t.taskId === req.params.id);
  if (!task) {
    res.status(404).json({ success: false, message: 'Task not found' });
    return;
  }

  const populated = populateTask(task);

  // Get comments with user details
  const comments = db.comments
    .filter(c => c.taskId === task._id)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map(c => {
      const author = db.users.find(u => u._id === c.userId);
      return {
        ...c,
        author: author ? sanitizeUser(author) : null
      };
    });

  // Get task activity logs
  const activities = db.activityLogs
    .filter(a => a.resourceType === 'TASK' && a.resourceId === task._id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map(a => {
      const actor = db.users.find(u => u._id === a.actorId);
      return {
        ...a,
        actor: actor ? sanitizeUser(actor) : null
      };
    });

  // Subtasks if any
  const subtasks = db.tasks.filter(t => t.parentTaskId === task._id).map(populateTask);

  res.json({
    success: true,
    data: {
      task: populated,
      comments,
      activities,
      subtasks
    }
  });
});

// POST /api/tasks (Create direct assignment or work task)
taskRoutes.post('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { 
      title, description, assignedTo = [], collaborators = [], 
      sourceDepartmentId, targetDepartmentId, departmentId, 
      projectId, parentTaskId, priority = 'MEDIUM', 
      visibility = 'ORGANIZATION', startDate, dueDate, 
      checklist = [], tags = [], requiresApproval = false,
      attachments = []
    } = req.body;

    const assignedToIds = Array.isArray(assignedTo) ? assignedTo : assignedTo ? [assignedTo] : [];
    const collaboratorIds = Array.isArray(collaborators) ? collaborators : [];
    const invalidAssignee = assignedToIds.find(id => !db.users.some(user => user._id === id && user.isActive));
    const invalidCollaborator = collaboratorIds.find(id => !db.users.some(user => user._id === id && user.isActive));
    if (invalidAssignee || invalidCollaborator) {
      res.status(400).json({ success: false, message: 'Assignee and collaborator IDs must reference active employees.' });
      return;
    }

    if (!title || !dueDate) {
      res.status(400).json({ success: false, message: 'Title and due date are required' });
      return;
    }

    const creatorId = req.user!._id;
    const finalDeptId = resolveDepartmentId(departmentId || targetDepartmentId || req.user?.departmentId, db.departments) || req.user?.departmentId || 'dept_admin';

    const newTask: Task = {
      _id: db.generateId('task'),
      taskId: db.getNextTaskId(),
      title,
      description,
      createdBy: creatorId,
      requestedBy: creatorId,
      assignedTo: assignedToIds,
      collaborators: collaboratorIds,
      sourceDepartmentId: sourceDepartmentId || req.user?.departmentId,
      targetDepartmentId: targetDepartmentId || finalDeptId,
      departmentId: finalDeptId,
      projectId: projectId || undefined,
      parentTaskId: parentTaskId || undefined,
      status: 'TODO',
      priority: priority || 'MEDIUM',
      progress: 0,
      visibility: visibility || 'ORGANIZATION',
      startDate: startDate || new Date().toISOString().split('T')[0],
      dueDate,
      checklist: checklist.map((item: any) => ({
        _id: db.generateId('chk'),
        title: typeof item === 'string' ? item : item.title,
        completed: false
      })),
      tags: Array.isArray(tags) ? tags : [],
      attachments: attachments || [],
      requiresApproval: Boolean(requiresApproval),
      approvalStatus: requiresApproval ? 'PENDING' : 'NONE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.tasks.unshift(newTask);

    // Create activity log
    db.activityLogs.unshift({
      _id: db.generateId('act'),
      actorId: creatorId,
      action: 'TASK_CREATED',
      resourceType: 'TASK',
      resourceId: newTask._id,
      metadata: { taskId: newTask.taskId, title: newTask.title },
      createdAt: new Date().toISOString()
    });

    // Notify assignees
    newTask.assignedTo.forEach(assigneeId => {
      if (assigneeId !== creatorId) {
        db.notifications.unshift({
          _id: db.generateId('notif'),
          recipientId: assigneeId,
          type: 'TASK_ASSIGNED',
          title: `New Task Assigned: ${newTask.taskId}`,
          message: `${req.user?.name.en} assigned you "${newTask.title}".`,
          resourceType: 'TASK',
          resourceId: newTask._id,
          isRead: false,
          createdAt: new Date().toISOString()
        });
      }
    });

    db.save();
    res.status(201).json({ success: true, data: populateTask(newTask) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to create task' });
  }
});

// PATCH /api/tasks/:id/status (Status transition with validation)
taskRoutes.patch('/:id/status', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const task = db.tasks.find(t => t._id === req.params.id || t.taskId === req.params.id);
  if (!task) {
    res.status(404).json({ success: false, message: 'Task not found' });
    return;
  }

  const { status } = req.body;
  const validStatuses = ['TODO', 'ACCEPTED', 'IN_PROGRESS', 'ON_HOLD', 'IN_REVIEW', 'COMPLETED', 'REJECTED', 'CANCELLED'];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ success: false, message: 'Invalid status value' });
    return;
  }

  const oldStatus = task.status;
  task.status = status;
  task.updatedAt = new Date().toISOString();

  if (status === 'COMPLETED') {
    task.progress = 100;
    task.completedAt = new Date().toISOString();
  }

  // Activity Log
  db.activityLogs.unshift({
    _id: db.generateId('act'),
    actorId: req.user!._id,
    action: 'TASK_STATUS_CHANGED',
    resourceType: 'TASK',
    resourceId: task._id,
    metadata: { oldStatus, newStatus: status },
    createdAt: new Date().toISOString()
  });

  // Notify requester / creator
  const recipient = task.requestedBy || task.createdBy;
  if (recipient && recipient !== req.user?._id) {
    db.notifications.unshift({
      _id: db.generateId('notif'),
      recipientId: recipient,
      type: status === 'COMPLETED' ? 'TASK_COMPLETED' : 'STATUS_CHANGED',
      title: `Task Status: ${task.taskId}`,
      message: `${req.user?.name.en} changed status of "${task.title}" to ${status.replace('_', ' ')}.`,
      resourceType: 'TASK',
      resourceId: task._id,
      isRead: false,
      createdAt: new Date().toISOString()
    });
  }

  db.save();
  res.json({ success: true, data: populateTask(task) });
});

// POST /api/tasks/:id/submit (Submit deliverables, files, notes, and auto-complete / send for review)
taskRoutes.post('/:id/submit', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const task = db.tasks.find(t => t._id === req.params.id || t.taskId === req.params.id);
  if (!task) {
    res.status(404).json({ success: false, message: 'Task not found' });
    return;
  }

  const { note, attachments = [], markChecklistComplete = true } = req.body;

  // 1. Process attachments
  const newAttachments: TaskAttachment[] = [];
  if (Array.isArray(attachments) && attachments.length > 0) {
    attachments.forEach((att: any) => {
      const newAtt: TaskAttachment = {
        _id: db.generateId('att'),
        name: att.name || 'Attachment',
        size: att.size || 1024,
        type: att.type || 'application/octet-stream',
        url: att.url,
        uploadedBy: req.user!._id,
        uploadedAt: new Date().toISOString()
      };
      task.attachments.push(newAtt);
      newAttachments.push(newAtt);

      // Add to global documents
      db.documents.push({
        _id: db.generateId('doc'),
        name: newAtt.name,
        type: newAtt.type,
        size: newAtt.size,
        url: newAtt.url,
        resourceType: 'TASK',
        resourceId: task._id,
        departmentId: task.departmentId,
        uploadedBy: req.user!._id,
        createdAt: new Date().toISOString()
      });
    });
  }

  // 2. Mark remaining checklist items complete if requested
  if (markChecklistComplete && task.checklist && task.checklist.length > 0) {
    task.checklist.forEach(item => {
      if (!item.completed) {
        item.completed = true;
        item.completedBy = req.user!._id;
        item.completedAt = new Date().toISOString();
      }
    });
  }

  // 3. Post submission comment if note or attachments exist
  if ((note && note.trim()) || newAttachments.length > 0) {
    const commentContent = `📋 **WORK SUBMISSION / DELIVERABLES**\n\n${(note || 'Work deliverables submitted.').trim()}`;
    const submissionComment: TaskComment = {
      _id: db.generateId('cmt'),
      taskId: task._id,
      userId: req.user!._id,
      content: commentContent,
      mentions: [],
      attachments: newAttachments,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.comments.push(submissionComment);
  }

  // 4. Update status & progress (auto-complete or in-review)
  const oldStatus = task.status;
  task.progress = 100;
  task.updatedAt = new Date().toISOString();

  if (task.requiresApproval) {
    task.status = 'IN_REVIEW';
    task.approvalStatus = 'PENDING';

    // Create approval record for requester/creator
    const approverId = task.requestedBy || task.createdBy;
    if (approverId) {
      db.approvals.unshift({
        _id: db.generateId('appr'),
        title: `Work Approval for ${task.taskId}: ${task.title}`,
        description: note || `Assignee submitted deliverables for task ${task.taskId}.`,
        requesterId: req.user!._id,
        approverId,
        departmentId: task.departmentId,
        status: 'PENDING',
        resourceType: 'TASK',
        resourceId: task._id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    db.activityLogs.unshift({
      _id: db.generateId('act'),
      actorId: req.user!._id,
      action: 'TASK_SUBMITTED_FOR_REVIEW',
      resourceType: 'TASK',
      resourceId: task._id,
      metadata: { taskId: task.taskId, noteSnippet: (note || '').slice(0, 60), attachmentsCount: newAttachments.length },
      createdAt: new Date().toISOString()
    });

    const recipientId = task.requestedBy || task.createdBy;
    if (recipientId && recipientId !== req.user?._id) {
      db.notifications.unshift({
        _id: db.generateId('notif'),
        recipientId,
        type: 'STATUS_CHANGED',
        title: `Work Submitted for Review: ${task.taskId}`,
        message: `${req.user?.name.en} submitted work & deliverables for "${task.title}".`,
        resourceType: 'TASK',
        resourceId: task._id,
        isRead: false,
        createdAt: new Date().toISOString()
      });
    }
  } else {
    // Auto-complete!
    task.status = 'COMPLETED';
    task.completedAt = new Date().toISOString();

    db.activityLogs.unshift({
      _id: db.generateId('act'),
      actorId: req.user!._id,
      action: 'TASK_SUBMITTED_AND_COMPLETED',
      resourceType: 'TASK',
      resourceId: task._id,
      metadata: { taskId: task.taskId, noteSnippet: (note || '').slice(0, 60), attachmentsCount: newAttachments.length },
      createdAt: new Date().toISOString()
    });

    const recipientId = task.requestedBy || task.createdBy;
    if (recipientId && recipientId !== req.user?._id) {
      db.notifications.unshift({
        _id: db.generateId('notif'),
        recipientId,
        type: 'TASK_COMPLETED',
        title: `Task Completed & Work Submitted: ${task.taskId}`,
        message: `${req.user?.name.en} completed "${task.title}" and submitted deliverables.`,
        resourceType: 'TASK',
        resourceId: task._id,
        isRead: false,
        createdAt: new Date().toISOString()
      });
    }
  }

  db.save();
  res.json({ success: true, data: populateTask(task) });
});

// PATCH /api/tasks/:id/progress (Update progress percent 0 - 100)
taskRoutes.patch('/:id/progress', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const task = db.tasks.find(t => t._id === req.params.id || t.taskId === req.params.id);
  if (!task) {
    res.status(404).json({ success: false, message: 'Task not found' });
    return;
  }

  const { progress } = req.body;
  const num = Math.min(100, Math.max(0, parseInt(progress, 10)));
  const oldProgress = task.progress;
  task.progress = num;
  task.updatedAt = new Date().toISOString();

  if (num === 100 && task.status !== 'COMPLETED') {
    task.status = task.requiresApproval ? 'IN_REVIEW' : 'COMPLETED';
    if (task.status === 'COMPLETED') {
      task.completedAt = new Date().toISOString();
    }
  }

  db.activityLogs.unshift({
    _id: db.generateId('act'),
    actorId: req.user!._id,
    action: 'TASK_PROGRESS_UPDATED',
    resourceType: 'TASK',
    resourceId: task._id,
    metadata: { oldProgress, newProgress: num },
    createdAt: new Date().toISOString()
  });

  db.save();
  res.json({ success: true, data: populateTask(task) });
});

// POST /api/tasks/:id/checklist (Toggle or add checklist items)
taskRoutes.post('/:id/checklist', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const task = db.tasks.find(t => t._id === req.params.id || t.taskId === req.params.id);
  if (!task) {
    res.status(404).json({ success: false, message: 'Task not found' });
    return;
  }

  const { action, itemId, title, completed } = req.body;

  if (action === 'ADD' && title) {
    const newItem: TaskChecklistItem = {
      _id: db.generateId('chk'),
      title,
      completed: false
    };
    task.checklist.push(newItem);
  } else if (action === 'TOGGLE' && itemId) {
    const item = task.checklist.find(c => c._id === itemId);
    if (item) {
      item.completed = completed !== undefined ? completed : !item.completed;
      if (item.completed) {
        item.completedBy = req.user?._id;
        item.completedAt = new Date().toISOString();
      } else {
        item.completedBy = undefined;
        item.completedAt = undefined;
      }

      // Auto-compute progress if there are items
      if (task.checklist.length > 0) {
        const completedCount = task.checklist.filter(c => c.completed).length;
        task.progress = Math.round((completedCount / task.checklist.length) * 100);
        if (task.progress === 100 && task.status !== 'COMPLETED') {
          task.status = task.requiresApproval ? 'IN_REVIEW' : 'COMPLETED';
          if (task.status === 'COMPLETED') task.completedAt = new Date().toISOString();
        }
      }
    }
  }

  task.updatedAt = new Date().toISOString();
  db.save();
  res.json({ success: true, data: populateTask(task) });
});

// POST /api/tasks/:id/assign (Reassign task)
taskRoutes.post('/:id/assign', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const task = db.tasks.find(t => t._id === req.params.id || t.taskId === req.params.id);
  if (!task) {
    res.status(404).json({ success: false, message: 'Task not found' });
    return;
  }

  const { assignedTo } = req.body;
  if (!assignedTo || !Array.isArray(assignedTo) || assignedTo.length === 0) {
    res.status(400).json({ success: false, message: 'At least one assignee required' });
    return;
  }

  const oldAssignees = [...task.assignedTo];
  task.assignedTo = assignedTo;
  task.updatedAt = new Date().toISOString();

  db.activityLogs.unshift({
    _id: db.generateId('act'),
    actorId: req.user!._id,
    action: 'TASK_REASSIGNED',
    resourceType: 'TASK',
    resourceId: task._id,
    metadata: { previousAssignees: oldAssignees, newAssignees: assignedTo },
    createdAt: new Date().toISOString()
  });

  // Notify newly assigned
  assignedTo.forEach(uid => {
    if (!oldAssignees.includes(uid) && uid !== req.user?._id) {
      db.notifications.unshift({
        _id: db.generateId('notif'),
        recipientId: uid,
        type: 'TASK_ASSIGNED',
        title: `Task Reassigned: ${task.taskId}`,
        message: `${req.user?.name.en} reassigned "${task.title}" to you.`,
        resourceType: 'TASK',
        resourceId: task._id,
        isRead: false,
        createdAt: new Date().toISOString()
      });
    }
  });

  db.save();
  res.json({ success: true, data: populateTask(task) });
});

// POST /api/tasks/:id/comments (Post discussion comment with @mentions)
taskRoutes.post('/:id/comments', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const task = db.tasks.find(t => t._id === req.params.id || t.taskId === req.params.id);
  if (!task) {
    res.status(404).json({ success: false, message: 'Task not found' });
    return;
  }

  const { content, mentions = [], attachments = [] } = req.body;
  if (!content || !content.trim()) {
    res.status(400).json({ success: false, message: 'Comment content cannot be empty' });
    return;
  }

  const newComment: TaskComment = {
    _id: db.generateId('cmt'),
    taskId: task._id,
    userId: req.user!._id,
    content: content.trim(),
    mentions: Array.isArray(mentions) ? mentions : [],
    attachments: attachments || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.comments.push(newComment);

  // Activity log
  db.activityLogs.unshift({
    _id: db.generateId('act'),
    actorId: req.user!._id,
    action: 'TASK_COMMENTED',
    resourceType: 'TASK',
    resourceId: task._id,
    metadata: { commentSnippet: content.slice(0, 60) },
    createdAt: new Date().toISOString()
  });

  // Notify mentioned people
  newComment.mentions.forEach(mentionId => {
    if (mentionId !== req.user?._id) {
      db.notifications.unshift({
        _id: db.generateId('notif'),
        recipientId: mentionId,
        type: 'MENTION',
        title: `Mentioned in ${task.taskId}`,
        message: `${req.user?.name.en} mentioned you in a comment on "${task.title}".`,
        resourceType: 'TASK',
        resourceId: task._id,
        isRead: false,
        createdAt: new Date().toISOString()
      });
    }
  });

  // Also notify assignees and requester if not the commenter
  const interestedUsers = Array.from(new Set([...task.assignedTo, task.requestedBy || '', task.createdBy]));
  interestedUsers.forEach(uid => {
    if (uid && uid !== req.user?._id && !newComment.mentions.includes(uid)) {
      db.notifications.unshift({
        _id: db.generateId('notif'),
        recipientId: uid,
        type: 'COMMENT',
        title: `New Comment on ${task.taskId}`,
        message: `${req.user?.name.en} commented on "${task.title}".`,
        resourceType: 'TASK',
        resourceId: task._id,
        isRead: false,
        createdAt: new Date().toISOString()
      });
    }
  });

  db.save();

  res.status(201).json({
    success: true,
    data: {
      ...newComment,
      author: sanitizeUser(req.user!)
    }
  });
});

// POST /api/tasks/:id/attachments (Add file attachment)
taskRoutes.post('/:id/attachments', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const task = db.tasks.find(t => t._id === req.params.id || t.taskId === req.params.id);
  if (!task) {
    res.status(404).json({ success: false, message: 'Task not found' });
    return;
  }

  const { name, size, type, url } = req.body;
  if (!name || !url) {
    res.status(400).json({ success: false, message: 'File name and url are required' });
    return;
  }

  const newAttachment: TaskAttachment = {
    _id: db.generateId('att'),
    name,
    size: size || 1024,
    type: type || 'application/octet-stream',
    url,
    uploadedBy: req.user!._id,
    uploadedAt: new Date().toISOString()
  };

  task.attachments.push(newAttachment);
  task.updatedAt = new Date().toISOString();

  // Also add to global documents registry
  db.documents.push({
    _id: db.generateId('doc'),
    name: newAttachment.name,
    type: newAttachment.type,
    size: newAttachment.size,
    url: newAttachment.url,
    resourceType: 'TASK',
    resourceId: task._id,
    departmentId: task.departmentId,
    uploadedBy: req.user!._id,
    createdAt: new Date().toISOString()
  });

  db.activityLogs.unshift({
    _id: db.generateId('act'),
    actorId: req.user!._id,
    action: 'TASK_FILE_UPLOADED',
    resourceType: 'TASK',
    resourceId: task._id,
    metadata: { fileName: name },
    createdAt: new Date().toISOString()
  });

  db.save();
  res.status(201).json({ success: true, data: populateTask(task) });
});

// DELETE /api/tasks/:id (Super Admin, CEO, or Task Creator)
taskRoutes.delete('/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const callerRole = getEffectiveRole(req.user!);
  const isSuperAdmin = callerRole === 'SUPER_ADMIN';
  const isCEO = callerRole === 'CEO';

  const taskIdx = db.tasks.findIndex(t => t._id === req.params.id || t.taskId === req.params.id);
  if (taskIdx === -1) {
    res.status(404).json({ success: false, message: 'Task not found' });
    return;
  }

  const task = db.tasks[taskIdx];
  const isCreator = task.createdBy === req.user!._id;

  if (!isSuperAdmin && !isCEO && !isCreator) {
    res.status(403).json({ success: false, message: 'Only Super Admin, CEO, or task creator can delete this task.' });
    return;
  }

  db.tasks.splice(taskIdx, 1);
  db.activityLogs.unshift({
    _id: db.generateId('act'),
    actorId: req.user!._id,
    action: 'TASK_DELETED',
    resourceType: 'TASK',
    resourceId: task._id,
    metadata: { title: task.title, taskId: task.taskId },
    createdAt: new Date().toISOString()
  });

  db.save();
  res.json({ success: true, message: `Task ${task.taskId} deleted successfully.` });
});

