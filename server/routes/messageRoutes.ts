import { Router, Response } from 'express';
import { db } from '../db';
import { requireAuth, AuthenticatedRequest, sanitizeUser, getEffectiveRole } from '../auth';

export const messageRoutes = Router();

// Only CEO, Trustee, and Dept Head can SEND messages
function canSend(role: string) {
  return role === 'CEO' || role === 'TRUSTEE' || role === 'DEPT_HEAD' || role === 'DEPARTMENT_HEAD';
}

// GET /api/messages/inbox — messages received by the current user
messageRoutes.get('/inbox', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!._id;

  const inbox = db.messages
    .filter(m => Array.isArray(m.recipientIds) && m.recipientIds.includes(userId))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map(m => {
      const sender = db.users.find(u => u._id === m.senderId);
      return {
        ...m,
        sender: sender ? sanitizeUser(sender) : null,
        isRead: Array.isArray(m.readBy) ? m.readBy.includes(userId) : false
      };
    });

  res.json({ success: true, data: inbox });
});

// GET /api/messages/sent — messages sent by the current user
messageRoutes.get('/sent', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!._id;

  const sent = db.messages
    .filter(m => m.senderId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map(m => {
      const recipientUsers = m.recipientIds.map(id => {
        const u = db.users.find(u => u._id === id);
        return u ? { _id: u._id, name: u.name, designation: u.designation, role: u.role } : null;
      }).filter(Boolean);
      return { ...m, recipientUsers };
    });

  res.json({ success: true, data: sent });
});

// GET /api/messages/unread-count
messageRoutes.get('/unread-count', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!._id;
  const count = db.messages.filter(m =>
    Array.isArray(m.recipientIds) && m.recipientIds.includes(userId) &&
    (!Array.isArray(m.readBy) || !m.readBy.includes(userId))
  ).length;
  res.json({ success: true, data: { count } });
});

// POST /api/messages/:id/read — mark message as read
messageRoutes.post('/:id/read', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!._id;
  const msg = db.messages.find(m => m._id === req.params.id);

  if (!msg) {
    res.status(404).json({ success: false, message: 'Message not found' });
    return;
  }

  if (!Array.isArray(msg.readBy)) msg.readBy = [];
  if (!msg.readBy.includes(userId)) {
    msg.readBy.push(userId);
    db.save();
  }
  res.json({ success: true });
});

// POST /api/messages — send a message (CEO, Trustee, Dept Head only)
messageRoutes.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const senderRole = getEffectiveRole(req.user!);
  if (!canSend(senderRole)) {
    res.status(403).json({ success: false, message: 'Only CEO, Dept Head, or Trustee can send direct messages.' });
    return;
  }

  const { subject, body, recipientType, recipientIds, departmentId } = req.body;

  if (!subject?.trim() || !body?.trim()) {
    res.status(400).json({ success: false, message: 'Subject and message body are required.' });
    return;
  }

  if (!recipientType || !['individual', 'department', 'all'].includes(recipientType)) {
    res.status(400).json({ success: false, message: 'Invalid recipient type.' });
    return;
  }

  let finalRecipientIds: string[] = [];

  if (recipientType === 'individual') {
    if (!Array.isArray(recipientIds) || recipientIds.length === 0) {
      res.status(400).json({ success: false, message: 'At least one recipient is required for individual messages.' });
      return;
    }
    finalRecipientIds = recipientIds.filter((id: string) => {
      const u = db.users.find(u => u._id === id);
      return u && u.isActive && getEffectiveRole(u) !== 'SUPER_ADMIN';
    });
  } else if (recipientType === 'department') {
    if (!departmentId) {
      res.status(400).json({ success: false, message: 'Department is required for department-wide messages.' });
      return;
    }
    finalRecipientIds = db.users
      .filter(u => u.isActive && u.departmentId === departmentId && u._id !== req.user!._id && getEffectiveRole(u) !== 'SUPER_ADMIN')
      .map(u => u._id);
  } else if (recipientType === 'all') {
    // Dept Head can only send to their dept; CEO/Trustee can send to all
    if (senderRole === 'DEPT_HEAD' || senderRole === 'DEPARTMENT_HEAD') {
      const senderDeptId = req.user!.departmentId;
      finalRecipientIds = db.users
        .filter(u => u.isActive && u.departmentId === senderDeptId && u._id !== req.user!._id && getEffectiveRole(u) !== 'SUPER_ADMIN')
        .map(u => u._id);
    } else {
      finalRecipientIds = db.users
        .filter(u => u.isActive && u._id !== req.user!._id && getEffectiveRole(u) !== 'SUPER_ADMIN')
        .map(u => u._id);
    }
  }

  if (finalRecipientIds.length === 0) {
    res.status(400).json({ success: false, message: 'No valid recipients found.' });
    return;
  }

  // Create the message
  const newMessage = {
    _id: db.generateId('msg'),
    senderId: req.user!._id,
    subject: subject.trim(),
    body: body.trim(),
    recipientType,
    departmentId: recipientType === 'department' ? departmentId : undefined,
    recipientIds: finalRecipientIds,
    readBy: [],
    createdAt: new Date().toISOString()
  };

  db.messages.unshift(newMessage as any);

  // Send in-app notifications to all recipients
  finalRecipientIds.forEach(recipientId => {
    db.notifications.unshift({
      _id: db.generateId('notif'),
      recipientId,
      type: 'ANNOUNCEMENT',
      title: `📨 New Message: ${newMessage.subject}`,
      message: `${req.user?.name.en} sent you a message: "${newMessage.subject}"`,
      resourceType: 'ANNOUNCEMENT',
      resourceId: newMessage._id,
      isRead: false,
      createdAt: new Date().toISOString()
    });
  });

  db.save();

  const sender = req.user!;
  res.status(201).json({
    success: true,
    data: {
      ...newMessage,
      sender: sanitizeUser(sender),
      recipientCount: finalRecipientIds.length
    }
  });
});
