import { Router, Response } from 'express';
import { db } from '../db';
import { requireAuth, AuthenticatedRequest, sanitizeUser } from '../auth';
import { EventItem } from '../types';

export const eventRoutes = Router();

eventRoutes.get('/', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  const list = db.events.map(evt => {
    const organizer = db.users.find(u => u._id === evt.organizerId);
    const depts = evt.departments.map(dId => db.departments.find(d => d._id === dId)).filter(Boolean);
    return {
      ...evt,
      organizer: organizer ? sanitizeUser(organizer) : null,
      departments: depts
    };
  });

  list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  res.json({ success: true, data: list });
});

eventRoutes.post('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { name, description, date, startTime, endTime, location, departments = [], associatedTaskIds = [] } = req.body;
  if (!name || !date || !location) {
    res.status(400).json({ success: false, message: 'Name, date and location are required' });
    return;
  }

  const newEvent: EventItem = {
    _id: db.generateId('evt'),
    name,
    description: description || '',
    date,
    startTime: startTime || '10:00 AM',
    endTime: endTime || '01:00 PM',
    location,
    organizerId: req.user!._id,
    departments: Array.isArray(departments) ? departments : [departments],
    participants: [req.user!._id],
    associatedTaskIds,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.events.push(newEvent);
  db.save();
  res.status(201).json({ success: true, data: newEvent });
});
