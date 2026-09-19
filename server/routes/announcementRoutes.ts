import { Router, Response } from 'express';
import { db } from '../db';
import { requireAuth, AuthenticatedRequest, sanitizeUser } from '../auth';
import { Announcement } from '../types';

export const announcementRoutes = Router();

announcementRoutes.get('/', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  const list = db.announcements.map(ann => {
    const author = db.users.find(u => u._id === ann.authorId);
    const dept = ann.departmentId ? db.departments.find(d => d._id === ann.departmentId) : null;
    return {
      ...ann,
      author: author ? sanitizeUser(author) : null,
      department: dept ? { _id: dept._id, code: dept.code, name: dept.name } : null
    };
  });

  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({ success: true, data: list });
});

announcementRoutes.post('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { title, content, priority = 'MEDIUM', audience = 'EVERYONE', departmentId } = req.body;
  if (!title || !content) {
    res.status(400).json({ success: false, message: 'Title and content are required' });
    return;
  }

  const newAnn: Announcement = {
    _id: db.generateId('ann'),
    title,
    content,
    audience,
    departmentId,
    authorId: req.user!._id,
    priority: priority || 'MEDIUM',
    publishedDate: new Date().toISOString().split('T')[0],
    attachments: [],
    createdAt: new Date().toISOString()
  };

  db.announcements.unshift(newAnn);
  db.save();
  res.status(201).json({ success: true, data: newAnn });
});
