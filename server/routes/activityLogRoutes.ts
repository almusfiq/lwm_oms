import { Router, Response } from 'express';
import { db } from '../db';
import { requireAuth, checkRole, AuthenticatedRequest, sanitizeUser } from '../auth';

export const activityLogRoutes = Router();

// GET /api/activity-logs (Strictly Super Admin Only)
activityLogRoutes.get('/', requireAuth, checkRole(['SUPER_ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { 
      search, 
      module: modFilter, 
      action: actFilter, 
      userId, 
      startDate, 
      endDate, 
      page = '1', 
      limit = '50' 
    } = req.query;

    let list = [...db.activityLogs];

    // Filter by module
    if (modFilter && typeof modFilter === 'string' && modFilter !== 'ALL') {
      list = list.filter(a => (a.module || 'SYSTEM').toUpperCase() === modFilter.toUpperCase());
    }

    // Filter by action
    if (actFilter && typeof actFilter === 'string' && actFilter !== 'ALL') {
      list = list.filter(a => a.action.toUpperCase() === actFilter.toUpperCase());
    }

    // Filter by user ID
    if (userId && typeof userId === 'string') {
      list = list.filter(a => a.actorId === userId);
    }

    // Filter by date range
    if (startDate && typeof startDate === 'string') {
      const start = new Date(startDate).getTime();
      list = list.filter(a => new Date(a.createdAt).getTime() >= start);
    }
    if (endDate && typeof endDate === 'string') {
      const end = new Date(endDate).getTime() + 86400000; // include full end day
      list = list.filter(a => new Date(a.createdAt).getTime() <= end);
    }

    // Keyword search across description, action, module, resourceName, ipAddress, user name
    if (search && typeof search === 'string') {
      const q = search.toLowerCase();
      list = list.filter(a => {
        const actor = db.users.find(u => u._id === a.actorId);
        const actorNameEn = actor ? actor.name.en.toLowerCase() : '';
        const actorNameBn = actor ? actor.name.bn.toLowerCase() : '';
        const actorEmail = actor ? actor.email.toLowerCase() : '';
        const desc = (a.description || '').toLowerCase();
        const act = (a.action || '').toLowerCase();
        const mod = (a.module || '').toLowerCase();
        const resName = (a.resourceName || '').toLowerCase();
        const ip = (a.ipAddress || '').toLowerCase();

        return (
          desc.includes(q) ||
          act.includes(q) ||
          mod.includes(q) ||
          resName.includes(q) ||
          ip.includes(q) ||
          actorNameEn.includes(q) ||
          actorNameBn.includes(q) ||
          actorEmail.includes(q)
        );
      });
    }

    const total = list.length;
    const pageNum = Math.max(1, parseInt(String(page), 10));
    const limitNum = Math.min(200, Math.max(1, parseInt(String(limit), 10)));
    const totalPages = Math.ceil(total / limitNum) || 1;
    const startIndex = (pageNum - 1) * limitNum;
    const paginated = list.slice(startIndex, startIndex + limitNum);

    const populated = paginated.map(act => {
      const actor = db.users.find(u => u._id === act.actorId);
      return {
        ...act,
        actor: actor ? sanitizeUser(actor) : null
      };
    });

    res.json({
      success: true,
      data: {
        items: populated,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch activity logs' });
  }
});

// GET /api/activity-logs/stats (Super Admin Audit Intelligence Metrics)
activityLogRoutes.get('/stats', requireAuth, checkRole(['SUPER_ADMIN']), (_req: AuthenticatedRequest, res: Response) => {
  const totalLogs = db.activityLogs.length;
  const failedLoginsCount = db.activityLogs.filter(a => a.action === 'FAILED_LOGIN').length;

  const todayStr = new Date().toISOString().split('T')[0];
  const todayLogs = db.activityLogs.filter(a => a.createdAt.startsWith(todayStr));
  const activeUserIdsToday = new Set(todayLogs.map(a => a.actorId).filter(id => id && id !== 'system'));

  const moduleCounts: Record<string, number> = {
    AUTH: 0,
    USERS: 0,
    TASKS: 0,
    PROJECTS: 0,
    DEPARTMENTS: 0,
    DOCUMENTS: 0,
    APPROVALS: 0,
    SECURITY: 0,
    SYSTEM: 0
  };

  db.activityLogs.forEach(a => {
    const mod = (a.module || 'SYSTEM').toUpperCase();
    moduleCounts[mod] = (moduleCounts[mod] || 0) + 1;
  });

  res.json({
    success: true,
    data: {
      totalLogs,
      failedLoginsCount,
      activeUsersTodayCount: activeUserIdsToday.size,
      todayTotalEvents: todayLogs.length,
      moduleCounts
    }
  });
});

// POST /api/activity-logs/clear (Super Admin Purge Logs)
activityLogRoutes.post('/clear', requireAuth, checkRole(['SUPER_ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const previousCount = db.activityLogs.length;
  
  // Keep last 10 logs for baseline audit integrity
  db.activityLogs = db.activityLogs.slice(0, 10);

  db.logActivity({
    actorId: req.user!._id,
    action: 'CLEAR_ACTIVITY_LOGS',
    module: 'SECURITY',
    description: `Super Admin cleared system activity logs (${previousCount - db.activityLogs.length} entries purged)`,
    ipAddress: req.ip || '127.0.0.1'
  });

  db.save();
  res.json({ success: true, message: `Purged activity log history.` });
});
