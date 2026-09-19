import { Router, Response } from 'express';
import { db } from '../db';
import { requireAuth, AuthenticatedRequest } from '../auth';

export const notificationRoutes = Router();

// GET /api/notifications
notificationRoutes.get('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { unreadOnly } = req.query;
  const currentUserId = req.user!._id;

  let list = db.notifications.filter(n => n.recipientId === currentUserId);

  if (unreadOnly === 'true') {
    list = list.filter(n => !n.isRead);
  }

  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const unreadCount = db.notifications.filter(n => n.recipientId === currentUserId && !n.isRead).length;

  res.json({
    success: true,
    data: {
      items: list.slice(0, 50),
      unreadCount
    }
  });
});

// PATCH /api/notifications/:id/read
notificationRoutes.patch('/:id/read', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const notif = db.notifications.find(n => n._id === req.params.id && n.recipientId === req.user?._id);
  if (!notif) {
    res.status(404).json({ success: false, message: 'Notification not found' });
    return;
  }

  notif.isRead = true;
  db.save();

  res.json({ success: true, data: notif });
});

// POST /api/notifications/read-all
notificationRoutes.post('/read-all', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const currentUserId = req.user!._id;
  db.notifications.forEach(n => {
    if (n.recipientId === currentUserId) {
      n.isRead = true;
    }
  });

  db.save();
  res.json({ success: true, message: 'All notifications marked as read' });
});
