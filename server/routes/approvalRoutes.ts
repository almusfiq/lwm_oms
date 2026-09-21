import { Router, Response } from 'express';
import { db } from '../db';
import { requireAuth, AuthenticatedRequest, sanitizeUser } from '../auth';
import { Approval } from '../types';

export const approvalRoutes = Router();

type ApprovalLevel = 'DEPT_HEAD' | 'CEO' | 'TRUSTEE';

// Which level does this role's request go to?
function getTargetLevel(requesterRole: string): ApprovalLevel {
  if (requesterRole === 'CEO') return 'TRUSTEE';
  if (requesterRole === 'DEPT_HEAD') return 'CEO';
  // OFFICER / STAFF / CONTRACTUAL → always Dept Head (cannot skip)
  return 'DEPT_HEAD';
}

function getNextLevel(current: ApprovalLevel): ApprovalLevel | null {
  if (current === 'DEPT_HEAD') return 'CEO';
  if (current === 'CEO') return 'TRUSTEE';
  return null; // TRUSTEE is top
}

// Find the best approver for a given level (returns userId)
function resolveApprover(level: ApprovalLevel, requesterDeptId?: string): string | null {
  if (level === 'TRUSTEE') {
    // Any active trustee can receive
    const trustee = db.users.find(u => u.role === 'TRUSTEE' && u.isActive);
    return trustee?._id || null;
  }
  if (level === 'CEO') {
    const ceo = db.users.find(u => u.role === 'CEO' && u.isActive);
    return ceo?._id || null;
  }
  // DEPT_HEAD — find head of the requester's department
  if (requesterDeptId) {
    const dept = db.departments.find(d => d._id === requesterDeptId);
    if (dept?.headId) return dept.headId;
  }
  const head = db.users.find(u => u.role === 'DEPT_HEAD' && u.isActive);
  return head?._id || null;
}

function populateApproval(a: Approval) {
  const requester = db.users.find(u => u._id === a.requesterId);
  const approver = db.users.find(u => u._id === a.approverId);
  const referredByUser = a.referredBy ? db.users.find(u => u._id === a.referredBy) : null;
  const requesterDept = db.departments.find(d => d._id === a.requesterDepartmentId);

  return {
    ...a,
    requester: requester ? sanitizeUser(requester) : null,
    approver: approver ? sanitizeUser(approver) : null,
    referredByUser: referredByUser ? sanitizeUser(referredByUser) : null,
    requesterDepartment: requesterDept
      ? { _id: requesterDept._id, code: requesterDept.code, name: requesterDept.name }
      : null
  };
}

// GET /api/approvals
approvalRoutes.get('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { status, type } = req.query;
  const viewer = req.user!;
  const viewerRole = viewer.role;

  let list = [...db.approvals];

  // Role-based filtering
  if (viewerRole === 'TRUSTEE') {
    // Trustees see ALL approvals at TRUSTEE level (any trustee can act)
    list = list.filter(a => a.level === 'TRUSTEE' || a.requesterId === viewer._id);
  } else if (viewerRole === 'CEO') {
    // CEO sees: approvals where they are the approver OR they submitted
    list = list.filter(a =>
      a.approverId === viewer._id ||
      a.requesterId === viewer._id ||
      a.level === 'CEO'
    );
  } else if (viewerRole === 'DEPT_HEAD') {
    // Dept head sees: incoming to their dept + requests they sent + referred from their dept
    list = list.filter(a =>
      a.approverId === viewer._id ||
      a.requesterId === viewer._id ||
      (a.requesterDepartmentId === viewer.departmentId)
    );
  } else {
    // Staff/Officer: only see their own submitted requests
    list = list.filter(a => a.requesterId === viewer._id);
  }

  if (type === 'incoming') {
    list = list.filter(a => {
      // For trustee — all TRUSTEE-level pending
      if (viewerRole === 'TRUSTEE') return a.level === 'TRUSTEE' && a.status === 'PENDING';
      return a.approverId === viewer._id && a.status === 'PENDING';
    });
  } else if (type === 'my_requests') {
    list = list.filter(a => a.requesterId === viewer._id);
  }

  if (status && typeof status === 'string') {
    list = list.filter(a => a.status === status.toUpperCase());
  }

  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json({ success: true, data: list.map(populateApproval) });
});

// GET /api/approvals/:id
approvalRoutes.get('/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const approval = db.approvals.find(a => a._id === req.params.id);
  if (!approval) {
    res.status(404).json({ success: false, message: 'Approval request not found' });
    return;
  }
  res.json({ success: true, data: populateApproval(approval) });
});

// POST /api/approvals — Submit new approval request
approvalRoutes.post('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const requesterRole = req.user!.role;

    // Trustees cannot submit approval requests (they are the top authority)
    if (requesterRole === 'TRUSTEE') {
      res.status(403).json({ success: false, message: 'Trustees do not submit approval requests.' });
      return;
    }

    const { title, description, requestType, resourceType = 'GENERAL', resourceId, targetLevel } = req.body;

    if (!title || !description) {
      res.status(400).json({ success: false, message: 'Title and description are required.' });
      return;
    }

    // Determine the correct approval level based on role
    // Staff/Officer: can ONLY go to DEPT_HEAD (enforced, no override)
    // Dept Head: goes to CEO by default, cannot skip to Trustee directly (CEO can refer up)
    // CEO: goes to TRUSTEE
    const mandatoryLevel = getTargetLevel(requesterRole);

    // Validate targetLevel — staff cannot override to a higher level
    let level: ApprovalLevel = mandatoryLevel;
    if (requesterRole === 'DEPT_HEAD' && targetLevel === 'CEO') {
      level = 'CEO';
    } else if (requesterRole === 'DEPT_HEAD' && targetLevel === 'TRUSTEE') {
      // Dept Head CAN send directly to Trustee for special items
      level = 'TRUSTEE';
    }
    // For staff/officer, always use mandatoryLevel regardless of targetLevel

    const approverId = resolveApprover(level, req.user?.departmentId);
    if (!approverId) {
      res.status(400).json({ success: false, message: 'No active approver found for this level.' });
      return;
    }

    const newApproval: Approval = {
      _id: db.generateId('appr'),
      requesterId: req.user!._id,
      requesterDepartmentId: req.user?.departmentId || '',
      requestType: requestType || 'GENERAL_REQUEST',
      resourceType: resourceType || 'GENERAL',
      resourceId,
      title,
      description,
      approverId,
      level,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.approvals.unshift(newApproval);

    // Notify the approver
    db.notifications.unshift({
      _id: db.generateId('notif'),
      recipientId: approverId,
      type: 'APPROVAL_REQUESTED',
      title: '📋 New Approval Request',
      message: `${req.user?.name.en} submitted: "${title}". Your action is required.`,
      resourceType: 'APPROVAL',
      resourceId: newApproval._id,
      isRead: false,
      createdAt: new Date().toISOString()
    });

    // If sent to TRUSTEE level, notify ALL active trustees
    if (level === 'TRUSTEE') {
      const allTrustees = db.users.filter(u => u.role === 'TRUSTEE' && u.isActive && u._id !== approverId);
      allTrustees.forEach(t => {
        db.notifications.unshift({
          _id: db.generateId('notif'),
          recipientId: t._id,
          type: 'APPROVAL_REQUESTED',
          title: '📋 New Approval Request (Board)',
          message: `${req.user?.name.en} submitted: "${title}". Any trustee can act.`,
          resourceType: 'APPROVAL',
          resourceId: newApproval._id,
          isRead: false,
          createdAt: new Date().toISOString()
        });
      });
    }

    db.save();
    res.status(201).json({ success: true, data: populateApproval(newApproval) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to submit approval.' });
  }
});

// POST /api/approvals/:id/approve
approvalRoutes.post('/:id/approve', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const approval = db.approvals.find(a => a._id === req.params.id);
  if (!approval) {
    res.status(404).json({ success: false, message: 'Approval not found.' });
    return;
  }

  const viewer = req.user!;

  // Any active trustee can approve TRUSTEE-level approvals; Super Admin or assigned approver can also approve
  const canApprove =
    viewer.role === 'SUPER_ADMIN' ||
    (viewer.role === 'TRUSTEE' && approval.level === 'TRUSTEE') ||
    (viewer.role === 'CEO' && approval.level === 'CEO') ||
    (viewer.role === 'DEPT_HEAD' && approval.level === 'DEPT_HEAD' && approval.approverId === viewer._id) ||
    approval.approverId === viewer._id;

  if (!canApprove) {
    res.status(403).json({ success: false, message: 'You are not authorized to approve this request.' });
    return;
  }

  if (approval.status !== 'PENDING' && approval.status !== 'REFERRED') {
    res.status(400).json({ success: false, message: 'This approval is no longer pending.' });
    return;
  }

  approval.status = 'APPROVED';
  approval.approvedAt = new Date().toISOString();
  approval.reason = req.body.reason || 'Approved.';
  approval.updatedAt = new Date().toISOString();
  // Track who actually approved (for trustee board where any can act)
  approval.approverId = viewer._id;

  if (approval.resourceType === 'TASK' && approval.resourceId) {
    const task = db.tasks.find(t => t._id === approval.resourceId);
    if (task) { 
      task.status = 'COMPLETED'; 
      task.progress = 100;
      task.approvalStatus = 'APPROVED'; 
      task.completedAt = new Date().toISOString();
      task.updatedAt = new Date().toISOString(); 
    }
  }

  // Notify requester
  db.notifications.unshift({
    _id: db.generateId('notif'),
    recipientId: approval.requesterId,
    type: 'APPROVAL_COMPLETED',
    title: '✅ Request Approved',
    message: `"${approval.title}" has been approved by ${viewer.name.en}.`,
    resourceType: 'APPROVAL',
    resourceId: approval._id,
    isRead: false,
    createdAt: new Date().toISOString()
  });

  // If referred, also notify the referrer
  if (approval.referredBy && approval.referredBy !== approval.requesterId) {
    db.notifications.unshift({
      _id: db.generateId('notif'),
      recipientId: approval.referredBy,
      type: 'APPROVAL_COMPLETED',
      title: '✅ Referred Request Approved',
      message: `"${approval.title}" (which you referred) has been approved by ${viewer.name.en}.`,
      resourceType: 'APPROVAL',
      resourceId: approval._id,
      isRead: false,
      createdAt: new Date().toISOString()
    });
  }

  db.save();
  res.json({ success: true, data: populateApproval(approval) });
});

// POST /api/approvals/:id/reject
approvalRoutes.post('/:id/reject', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const approval = db.approvals.find(a => a._id === req.params.id);
  if (!approval) {
    res.status(404).json({ success: false, message: 'Approval not found.' });
    return;
  }

  const viewer = req.user!;
  const canReject =
    viewer.role === 'SUPER_ADMIN' ||
    (viewer.role === 'TRUSTEE' && approval.level === 'TRUSTEE') ||
    (viewer.role === 'CEO' && approval.level === 'CEO') ||
    (viewer.role === 'DEPT_HEAD' && approval.level === 'DEPT_HEAD' && approval.approverId === viewer._id) ||
    approval.approverId === viewer._id;

  if (!canReject) {
    res.status(403).json({ success: false, message: 'You are not authorized to reject this request.' });
    return;
  }

  if (approval.status !== 'PENDING' && approval.status !== 'REFERRED') {
    res.status(400).json({ success: false, message: 'This approval is no longer pending.' });
    return;
  }

  approval.status = 'REJECTED';
  approval.rejectedAt = new Date().toISOString();
  approval.reason = req.body.reason || 'Declined.';
  approval.updatedAt = new Date().toISOString();
  approval.approverId = viewer._id;

  if (approval.resourceType === 'TASK' && approval.resourceId) {
    const task = db.tasks.find(t => t._id === approval.resourceId);
    if (task) { 
      task.status = 'REJECTED'; 
      task.approvalStatus = 'REJECTED'; 
      task.updatedAt = new Date().toISOString(); 
    }
  }

  db.notifications.unshift({
    _id: db.generateId('notif'),
    recipientId: approval.requesterId,
    type: 'APPROVAL_COMPLETED',
    title: '❌ Request Declined',
    message: `"${approval.title}" was declined: ${approval.reason}`,
    resourceType: 'APPROVAL',
    resourceId: approval._id,
    isRead: false,
    createdAt: new Date().toISOString()
  });

  db.save();
  res.json({ success: true, data: populateApproval(approval) });
});

// POST /api/approvals/:id/refer — Refer to next authority level
approvalRoutes.post('/:id/refer', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const approval = db.approvals.find(a => a._id === req.params.id);
  if (!approval) {
    res.status(404).json({ success: false, message: 'Approval not found.' });
    return;
  }

  const viewer = req.user!;
  const canRefer =
    (viewer.role === 'CEO' && approval.level === 'CEO') ||
    (viewer.role === 'DEPT_HEAD' && approval.level === 'DEPT_HEAD' && approval.approverId === viewer._id);

  if (!canRefer) {
    res.status(403).json({ success: false, message: 'You cannot refer this request.' });
    return;
  }

  const nextLevel = getNextLevel(approval.level);
  if (!nextLevel) {
    res.status(400).json({ success: false, message: 'Already at the highest approval level.' });
    return;
  }

  const nextApproverId = resolveApprover(nextLevel, approval.requesterDepartmentId);
  if (!nextApproverId) {
    res.status(400).json({ success: false, message: 'No active approver found at next level.' });
    return;
  }

  approval.level = nextLevel;
  approval.approverId = nextApproverId;
  approval.status = 'PENDING';
  approval.referredBy = viewer._id;
  approval.referredAt = new Date().toISOString();
  approval.referralNote = req.body.note || `Referred to ${nextLevel} by ${viewer.name.en}.`;
  approval.updatedAt = new Date().toISOString();

  // Notify all trustees if referred to TRUSTEE level
  const notifyIds = nextLevel === 'TRUSTEE'
    ? db.users.filter(u => u.role === 'TRUSTEE' && u.isActive).map(u => u._id)
    : [nextApproverId];

  notifyIds.forEach(nid => {
    db.notifications.unshift({
      _id: db.generateId('notif'),
      recipientId: nid,
      type: 'APPROVAL_REFERRED',
      title: '📤 Approval Request Referred to You',
      message: `${viewer.name.en} referred "${approval.title}" for your decision.`,
      resourceType: 'APPROVAL',
      resourceId: approval._id,
      isRead: false,
      createdAt: new Date().toISOString()
    });
  });

  // Notify requester
  db.notifications.unshift({
    _id: db.generateId('notif'),
    recipientId: approval.requesterId,
    type: 'APPROVAL_REFERRED',
    title: '🔁 Request Referred Up',
    message: `Your request "${approval.title}" has been referred to a higher authority by ${viewer.name.en}.`,
    resourceType: 'APPROVAL',
    resourceId: approval._id,
    isRead: false,
    createdAt: new Date().toISOString()
  });

  db.save();
  res.json({ success: true, data: populateApproval(approval) });
});
