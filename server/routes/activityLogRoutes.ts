import { Router, Response } from 'express';
import { db } from '../db';
import { requireAuth, AuthenticatedRequest, sanitizeUser } from '../auth';

export const activityLogRoutes = Router();

activityLogRoutes.get('/', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  const list = db.activityLogs
    .slice(0, 40)
    .map(act => {
      const actor = db.users.find(u => u._id === act.actorId);
      return {
        ...act,
        actor: actor ? sanitizeUser(actor) : null
      };
    });

  res.json({ success: true, data: list });
});
