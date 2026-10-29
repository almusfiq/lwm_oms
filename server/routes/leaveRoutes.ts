import { Router, Response } from 'express';
import { db } from '../db';
import { requireAuth, AuthenticatedRequest, sanitizeUser, getEffectiveRole } from '../auth';
import { LeaveRequest, LeaveType, LeaveStatus, LeaveStats } from '../types';

export const leaveRoutes = Router();

export const LEAVE_TYPE_MAP: Record<LeaveType, string> = {
  EARNED: 'Earned Leave',
  CASUAL: 'Casual Leave',
  SICK: 'Medical Leave',
  MATERNITY: 'Maternity Leave',
  PATERNITY: 'Paternity Leave'
};

// Calculate calendar days between two dates inclusive
export function calculateDaysCount(startStr: string, returnStr: string): number {
  try {
    const start = new Date(startStr);
    const end = new Date(returnStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 1;
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(diffDays, 1);
  } catch {
    return 1;
  }
}

// Compute statistics and previous leave history for a specific employee
export function getEmployeeLeaveStats(applicantId: string, currentLeaveId?: string) {
  const applicantLeaves = db.leaves.filter(l => l.applicantId === applicantId);
  const approvedLeaves = applicantLeaves.filter(l => l.status === 'APPROVED');

  const totalLeavesTaken = approvedLeaves.length;
  const totalDaysTaken = approvedLeaves.reduce((sum, l) => sum + (l.daysCount || 0), 0);

  const typeBreakdown: Record<LeaveType, { name: string; count: number; days: number }> = {
    EARNED: { name: 'Earned Leave', count: 0, days: 0 },
    CASUAL: { name: 'Casual Leave', count: 0, days: 0 },
    SICK: { name: 'Medical Leave', count: 0, days: 0 },
    MATERNITY: { name: 'Maternity Leave', count: 0, days: 0 },
    PATERNITY: { name: 'Paternity Leave', count: 0, days: 0 }
  };

  approvedLeaves.forEach(l => {
    if (typeBreakdown[l.leaveType]) {
      typeBreakdown[l.leaveType].count += 1;
      typeBreakdown[l.leaveType].days += (l.daysCount || 0);
    }
  });

  // Previous leaves excluding current one, sorted descending by creation date
  const previousLeaves = applicantLeaves
    .filter(l => !currentLeaveId || l._id !== currentLeaveId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map(l => ({
      _id: l._id,
      leaveId: l.leaveId,
      startDate: l.startDate,
      returnDate: l.returnDate,
      daysCount: l.daysCount,
      leaveType: l.leaveType,
      leaveTypeName: LEAVE_TYPE_MAP[l.leaveType] || l.leaveTypeName,
      status: l.status,
      reason: l.reason,
      decisionReason: l.decisionReason,
      reviewedAt: l.reviewedAt,
      createdAt: l.createdAt
    }));

  return {
    totalLeavesTaken,
    totalDaysTaken,
    typeBreakdown,
    previousLeaves
  };
}

function populateLeave(leave: LeaveRequest) {
  const applicant = db.users.find(u => u._id === leave.applicantId);
  const dept = leave.applicantDepartmentId ? db.departments.find(d => d._id === leave.applicantDepartmentId) : null;
  const reliefUser = leave.reliefUserId ? db.users.find(u => u._id === leave.reliefUserId) : null;
  const currentApprover = leave.currentApproverId ? db.users.find(u => u._id === leave.currentApproverId) : null;
  const reviewer = leave.reviewedBy ? db.users.find(u => u._id === leave.reviewedBy) : null;

  return {
    ...leave,
    leaveTypeName: LEAVE_TYPE_MAP[leave.leaveType] || leave.leaveTypeName,
    applicant: applicant ? sanitizeUser(applicant) : null,
    department: dept ? { _id: dept._id, code: dept.code, name: dept.name } : null,
    reliefUser: reliefUser ? sanitizeUser(reliefUser) : null,
    currentApprover: currentApprover ? sanitizeUser(currentApprover) : null,
    reviewer: reviewer ? sanitizeUser(reviewer) : null
  };
}

// GET /api/leaves/stats/summary - Summary stats for logged in user and department
leaveRoutes.get('/stats/summary', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const myStats = getEmployeeLeaveStats(user._id);

  let pendingApprovalCount = 0;
  const role = getEffectiveRole(user);
  if (role === 'DEPT_HEAD') {
    pendingApprovalCount = db.leaves.filter(l =>
      l.status === 'PENDING' &&
      (l.currentApproverId === user._id || (l.applicantDepartmentId === user.departmentId && l.currentApproverRole === 'DEPT_HEAD'))
    ).length;
  } else if (role === 'CEO') {
    pendingApprovalCount = db.leaves.filter(l =>
      (l.status === 'PENDING' && l.currentApproverRole === 'CEO') ||
      l.status === 'REFERRED_TO_CEO' ||
      l.currentApproverId === user._id
    ).length;
  } else if (role === 'TRUSTEE' || role === 'SUPER_ADMIN') {
    pendingApprovalCount = db.leaves.filter(l => l.status === 'PENDING' || l.status === 'REFERRED_TO_CEO').length;
  }

  res.json({
    success: true,
    data: {
      myStats,
      pendingApprovalCount
    }
  });
});

// GET /api/leaves - List leaves with filtering
leaveRoutes.get('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { status, view, employeeId } = req.query;
  const user = req.user!;
  const role = getEffectiveRole(user);

  let list = [...db.leaves];

  // Specific employee leaves requested (e.g. for history inspect)
  if (employeeId && typeof employeeId === 'string') {
    list = list.filter(l => l.applicantId === employeeId);
  } else if (view === 'mine') {
    list = list.filter(l => l.applicantId === user._id);
  } else if (view === 'pending_approval') {
    if (role === 'DEPT_HEAD') {
      list = list.filter(l =>
        l.status === 'PENDING' &&
        (l.currentApproverId === user._id || (l.applicantDepartmentId === user.departmentId && l.currentApproverRole === 'DEPT_HEAD'))
      );
    } else if (role === 'CEO') {
      list = list.filter(l =>
        (l.status === 'PENDING' && l.currentApproverRole === 'CEO') ||
        l.status === 'REFERRED_TO_CEO' ||
        l.currentApproverId === user._id
      );
    } else if (role === 'TRUSTEE' || role === 'SUPER_ADMIN') {
      list = list.filter(l => l.status === 'PENDING' || l.status === 'REFERRED_TO_CEO');
    } else {
      list = [];
    }
  } else if (view === 'department' && user.departmentId) {
    list = list.filter(l => l.applicantDepartmentId === user.departmentId);
  } else if (view === 'all') {
    if (role === 'STAFF') {
      list = list.filter(l => l.applicantId === user._id);
    } else if (role === 'DEPT_HEAD' && user.departmentId) {
      list = list.filter(l => l.applicantDepartmentId === user.departmentId || l.applicantId === user._id);
    }
    // CEO, Trustee, Super Admin see all
  } else {
    // Default visibility based on role
    if (role === 'STAFF') {
      list = list.filter(l => l.applicantId === user._id);
    } else if (role === 'DEPT_HEAD') {
      list = list.filter(l =>
        l.applicantDepartmentId === user.departmentId ||
        l.applicantId === user._id ||
        l.currentApproverId === user._id
      );
    }
  }

  // Filter by status if provided
  if (status && typeof status === 'string' && status !== 'ALL') {
    list = list.filter(l => l.status === status);
  }

  // Sort newest first
  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const populatedList = list.map(populateLeave);
  res.json({ success: true, data: populatedList });
});

// GET /api/leaves/:id - Single leave details WITH applicant's previous leave history
leaveRoutes.get('/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const leave = db.leaves.find(l => l._id === id || l.leaveId === id);

  if (!leave) {
    res.status(404).json({ success: false, message: 'Leave request not found' });
    return;
  }

  // Get full previous leave statistics and past records of the applicant
  const applicantStats = getEmployeeLeaveStats(leave.applicantId, leave._id);

  res.json({
    success: true,
    data: {
      ...populateLeave(leave),
      applicantLeaveStats: applicantStats
    }
  });
});

// POST /api/leaves - Apply for a new leave
leaveRoutes.post('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const {
    startDate,
    returnDate,
    leaveType,
    reason,
    stayAddress,
    reliefUserId,
    reliefNote
  } = req.body;

  const user = req.user!;
  const role = getEffectiveRole(user);

  // Validation
  if (!startDate || !returnDate) {
    res.status(400).json({ success: false, message: 'Start date and return date are required' });
    return;
  }

  if (!leaveType || !LEAVE_TYPE_MAP[leaveType as LeaveType]) {
    res.status(400).json({
      success: false,
      message: 'Valid leave type is required (EARNED, CASUAL, SICK, MATERNITY, PATERNITY)'
    });
    return;
  }

  if (!reason || !reason.trim()) {
    res.status(400).json({ success: false, message: 'Reason for leave is required' });
    return;
  }

  if (!stayAddress || typeof stayAddress !== 'object') {
    res.status(400).json({ success: false, message: 'Address during leave is required' });
    return;
  }

  const { village, postOffice, thana, upazila, district, emergencyContact } = stayAddress;
  if (!village || !postOffice || !thana || !upazila || !district || !emergencyContact) {
    res.status(400).json({
      success: false,
      message: 'All address fields (village, Post, Thana, Upazila, District, and emergency number) are required'
    });
    return;
  }

  if (!reliefUserId) {
    res.status(400).json({ success: false, message: 'Reliever employee (who will do this work) is required' });
    return;
  }

  const daysCount = calculateDaysCount(startDate, returnDate);

  // Routing Logic:
  // "If any dept head request for leave it will go to CEO"
  // "after this request will go to dept head, department head can approve if they thing also they can refer to ceo if needed"
  let currentApproverId = '';
  let currentApproverRole: 'DEPT_HEAD' | 'CEO' = 'DEPT_HEAD';

  const ceoUser = db.users.find(u => u.role === 'CEO' && u.isActive) || db.users.find(u => u.role === 'CEO');

  if (role === 'DEPT_HEAD' || role === 'CEO') {
    // If Dept Head (or CEO) applies for leave, route directly to CEO
    if (ceoUser) {
      currentApproverId = ceoUser._id;
      currentApproverRole = 'CEO';
    } else {
      const trustee = db.users.find(u => u.role === 'TRUSTEE' && u.isActive);
      currentApproverId = trustee?._id || 'usr_ceo';
      currentApproverRole = 'CEO';
    }
  } else {
    // Regular employee / officer: routes to their Department Head
    const userDept = user.departmentId ? db.departments.find(d => d._id === user.departmentId) : null;
    let deptHead = userDept?.headId ? db.users.find(u => u._id === userDept.headId && u.isActive) : null;

    if (!deptHead && userDept) {
      deptHead = db.users.find(u => u.departmentId === userDept._id && u.role === 'DEPT_HEAD' && u.isActive) || null;
    }

    if (deptHead && deptHead._id !== user._id) {
      currentApproverId = deptHead._id;
      currentApproverRole = 'DEPT_HEAD';
    } else if (ceoUser) {
      // Fallback to CEO if department head not configured or is the same person
      currentApproverId = ceoUser._id;
      currentApproverRole = 'CEO';
    }
  }

  const newLeave: LeaveRequest = {
    _id: db.generateId('lev'),
    leaveId: db.getNextLeaveId(),
    applicantId: user._id,
    applicantDepartmentId: user.departmentId,
    startDate,
    returnDate,
    daysCount,
    leaveType: leaveType as LeaveType,
    leaveTypeName: LEAVE_TYPE_MAP[leaveType as LeaveType],
    reason: reason.trim(),
    stayAddress: {
      village: village.trim(),
      postOffice: postOffice.trim(),
      thana: thana.trim(),
      upazila: upazila.trim(),
      district: district.trim(),
      emergencyContact: emergencyContact.trim()
    },
    reliefUserId,
    reliefNote: reliefNote ? reliefNote.trim() : undefined,
    currentApproverId,
    currentApproverRole,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.leaves.unshift(newLeave);

  // Notify Approver
  if (currentApproverId) {
    db.notifications.unshift({
      _id: db.generateId('notif'),
      recipientId: currentApproverId,
      type: 'APPROVAL_REQUESTED',
      title: '🏖️ New Leave Application',
      message: `${user.name.en} applied for ${newLeave.leaveTypeName} (${daysCount} day${daysCount > 1 ? 's' : ''}) from ${startDate} to ${returnDate}. Action required.`,
      resourceType: 'APPROVAL',
      resourceId: newLeave._id,
      isRead: false,
      createdAt: new Date().toISOString()
    });
  }

  // Notify Reliever
  if (reliefUserId && reliefUserId !== user._id) {
    db.notifications.unshift({
      _id: db.generateId('notif'),
      recipientId: reliefUserId,
      type: 'STATUS_CHANGED',
      title: '🤝 Nominated as Leave Reliever',
      message: `${user.name.en} nominated you as duty reliever during their leave from ${startDate} to ${returnDate}.`,
      resourceType: 'APPROVAL',
      resourceId: newLeave._id,
      isRead: false,
      createdAt: new Date().toISOString()
    });
  }

  // Log activity
  db.logActivity({
    actorId: user._id,
    action: 'LEAVE_APPLIED',
    module: 'APPROVALS',
    resourceType: 'APPROVAL',
    resourceId: newLeave._id,
    resourceName: `${newLeave.leaveId} - ${newLeave.leaveTypeName}`,
    description: `${user.name.en} applied for ${newLeave.leaveTypeName} (${daysCount} days)`
  });

  db.save().catch(err => console.error('[Leaves Save Error]', err));

  res.status(201).json({
    success: true,
    data: populateLeave(newLeave),
    message: 'Leave application submitted successfully'
  });
});

// POST /api/leaves/:id/approve - Approve a leave request
leaveRoutes.post('/:id/approve', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;
  const user = req.user!;
  const role = getEffectiveRole(user);

  const leave = db.leaves.find(l => l._id === id || l.leaveId === id);
  if (!leave) {
    res.status(404).json({ success: false, message: 'Leave request not found' });
    return;
  }

  if (leave.status === 'APPROVED') {
    res.status(400).json({ success: false, message: 'Leave request is already approved' });
    return;
  }

  // Authorization check
  const isApprover = leave.currentApproverId === user._id;
  const isSuper = role === 'SUPER_ADMIN' || role === 'TRUSTEE';
  const isCeo = role === 'CEO';
  const isDeptHeadOfApplicant = role === 'DEPT_HEAD' && user.departmentId === leave.applicantDepartmentId;

  if (!isApprover && !isSuper && !isCeo && !isDeptHeadOfApplicant) {
    res.status(403).json({ success: false, message: 'You are not authorized to approve this leave request' });
    return;
  }

  leave.status = 'APPROVED';
  leave.reviewedBy = user._id;
  leave.reviewedAt = new Date().toISOString();
  leave.decisionReason = reason || 'Approved';
  leave.updatedAt = new Date().toISOString();

  // Notify Applicant
  db.notifications.unshift({
    _id: db.generateId('notif'),
    recipientId: leave.applicantId,
    type: 'APPROVAL_COMPLETED',
    title: '✅ Leave Application Approved',
    message: `Your ${leave.leaveTypeName} from ${leave.startDate} to ${leave.returnDate} (${leave.daysCount} days) has been APPROVED by ${user.name.en}.`,
    resourceType: 'APPROVAL',
    resourceId: leave._id,
    isRead: false,
    createdAt: new Date().toISOString()
  });

  // Notify Reliever that leave is approved and duties take effect
  if (leave.reliefUserId) {
    db.notifications.unshift({
      _id: db.generateId('notif'),
      recipientId: leave.reliefUserId,
      type: 'APPROVAL_COMPLETED',
      title: '📋 Reliever Duty Confirmed',
      message: `The leave application for ${leave.startDate} to ${leave.returnDate} has been approved. Please cover assigned duties.`,
      resourceType: 'APPROVAL',
      resourceId: leave._id,
      isRead: false,
      createdAt: new Date().toISOString()
    });
  }

  db.logActivity({
    actorId: user._id,
    action: 'LEAVE_APPROVED',
    module: 'APPROVALS',
    resourceType: 'APPROVAL',
    resourceId: leave._id,
    resourceName: `${leave.leaveId} - ${leave.leaveTypeName}`,
    description: `${user.name.en} approved leave request ${leave.leaveId}`
  });

  db.save().catch(err => console.error('[Leaves Save Error]', err));

  res.json({
    success: true,
    data: populateLeave(leave),
    message: 'Leave approved successfully'
  });
});

// POST /api/leaves/:id/reject - Reject a leave request
leaveRoutes.post('/:id/reject', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;
  const user = req.user!;
  const role = getEffectiveRole(user);

  const leave = db.leaves.find(l => l._id === id || l.leaveId === id);
  if (!leave) {
    res.status(404).json({ success: false, message: 'Leave request not found' });
    return;
  }

  // Authorization check
  const isApprover = leave.currentApproverId === user._id;
  const isSuper = role === 'SUPER_ADMIN' || role === 'TRUSTEE';
  const isCeo = role === 'CEO';
  const isDeptHeadOfApplicant = role === 'DEPT_HEAD' && user.departmentId === leave.applicantDepartmentId;

  if (!isApprover && !isSuper && !isCeo && !isDeptHeadOfApplicant) {
    res.status(403).json({ success: false, message: 'You are not authorized to reject this leave request' });
    return;
  }

  if (!reason || !reason.trim()) {
    res.status(400).json({ success: false, message: 'Rejection reason is required' });
    return;
  }

  leave.status = 'REJECTED';
  leave.reviewedBy = user._id;
  leave.reviewedAt = new Date().toISOString();
  leave.decisionReason = reason.trim();
  leave.updatedAt = new Date().toISOString();

  // Notify Applicant
  db.notifications.unshift({
    _id: db.generateId('notif'),
    recipientId: leave.applicantId,
    type: 'APPROVAL_COMPLETED',
    title: '❌ Leave Application Rejected',
    message: `Your ${leave.leaveTypeName} from ${leave.startDate} to ${leave.returnDate} was rejected by ${user.name.en}. Reason: ${reason.trim()}`,
    resourceType: 'APPROVAL',
    resourceId: leave._id,
    isRead: false,
    createdAt: new Date().toISOString()
  });

  db.logActivity({
    actorId: user._id,
    action: 'LEAVE_REJECTED',
    module: 'APPROVALS',
    resourceType: 'APPROVAL',
    resourceId: leave._id,
    resourceName: `${leave.leaveId} - ${leave.leaveTypeName}`,
    description: `${user.name.en} rejected leave request ${leave.leaveId}: ${reason.trim()}`
  });

  db.save().catch(err => console.error('[Leaves Save Error]', err));

  res.json({
    success: true,
    data: populateLeave(leave),
    message: 'Leave application rejected'
  });
});

// POST /api/leaves/:id/refer - Refer leave request to CEO
// "department head can approve if they thing also they can refer to ceo if needed"
leaveRoutes.post('/:id/refer', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { note } = req.body;
  const user = req.user!;
  const role = getEffectiveRole(user);

  const leave = db.leaves.find(l => l._id === id || l.leaveId === id);
  if (!leave) {
    res.status(404).json({ success: false, message: 'Leave request not found' });
    return;
  }

  if (leave.status !== 'PENDING') {
    res.status(400).json({ success: false, message: 'Only pending leave requests can be referred' });
    return;
  }

  // Only Dept Head (or Super Admin) can refer
  const isDeptHeadOfApplicant = role === 'DEPT_HEAD' && user.departmentId === leave.applicantDepartmentId;
  const isApprover = leave.currentApproverId === user._id;

  if (!isApprover && !isDeptHeadOfApplicant && role !== 'SUPER_ADMIN') {
    res.status(403).json({ success: false, message: 'Only the Department Head can refer this leave to the CEO' });
    return;
  }

  const ceoUser = db.users.find(u => u.role === 'CEO' && u.isActive) || db.users.find(u => u.role === 'CEO');
  if (!ceoUser) {
    res.status(400).json({ success: false, message: 'CEO user not found to refer this leave to' });
    return;
  }

  leave.status = 'REFERRED_TO_CEO';
  leave.currentApproverId = ceoUser._id;
  leave.currentApproverRole = 'CEO';
  leave.referralNote = note ? note.trim() : 'Referred to CEO for final determination';
  leave.referredAt = new Date().toISOString();
  leave.updatedAt = new Date().toISOString();

  // Notify CEO
  const applicant = db.users.find(u => u._id === leave.applicantId);
  db.notifications.unshift({
    _id: db.generateId('notif'),
    recipientId: ceoUser._id,
    type: 'APPROVAL_REFERRED',
    title: '🏛️ Leave Referred to CEO',
    message: `${user.name.en} (Dept Head) referred ${applicant?.name.en}'s ${leave.leaveTypeName} (${leave.daysCount} days) to you for final approval.`,
    resourceType: 'APPROVAL',
    resourceId: leave._id,
    isRead: false,
    createdAt: new Date().toISOString()
  });

  // Notify Applicant
  db.notifications.unshift({
    _id: db.generateId('notif'),
    recipientId: leave.applicantId,
    type: 'APPROVAL_REFERRED',
    title: '📤 Leave Referred to Director General / CEO',
    message: `Your department head ${user.name.en} has referred your leave application to the Director General / CEO for review.`,
    resourceType: 'APPROVAL',
    resourceId: leave._id,
    isRead: false,
    createdAt: new Date().toISOString()
  });

  db.logActivity({
    actorId: user._id,
    action: 'LEAVE_REFERRED',
    module: 'APPROVALS',
    resourceType: 'APPROVAL',
    resourceId: leave._id,
    resourceName: `${leave.leaveId} - ${leave.leaveTypeName}`,
    description: `${user.name.en} referred leave request ${leave.leaveId} to CEO`
  });

  db.save().catch(err => console.error('[Leaves Save Error]', err));

  res.json({
    success: true,
    data: populateLeave(leave),
    message: 'Leave request successfully referred to the Director General / CEO'
  });
});

