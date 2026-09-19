import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

import { seedDatabase } from './server/seedData';

import { authRoutes } from './server/routes/authRoutes';
import { userRoutes } from './server/routes/userRoutes';
import { deptRoutes } from './server/routes/deptRoutes';
import { taskRoutes } from './server/routes/taskRoutes';
import { taskRequestRoutes } from './server/routes/taskRequestRoutes';
import { projectRoutes } from './server/routes/projectRoutes';
import { notificationRoutes } from './server/routes/notificationRoutes';
import { approvalRoutes } from './server/routes/approvalRoutes';
import { eventRoutes } from './server/routes/eventRoutes';
import { announcementRoutes } from './server/routes/announcementRoutes';
import { documentRoutes } from './server/routes/documentRoutes';
import { activityLogRoutes } from './server/routes/activityLogRoutes';
import { reportRoutes } from './server/routes/reportRoutes';
import { analyticsRoutes } from './server/routes/analyticsRoutes';
import { organogramRoutes } from './server/routes/organogramRoutes';
import { uploadRoutes } from './server/routes/uploadRoutes';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Check whether we are running without MongoDB
  const DEMO_MODE = process.env.DEMO_MODE === 'true';

  // ============================================================
  // MIDDLEWARE
  // ============================================================

  app.use(express.json({ limit: '50mb' }));

  app.use(
    express.urlencoded({
      extended: true,
      limit: '50mb',
    })
  );

  // ============================================================
  // CORS
  // ============================================================

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');

    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, PATCH, DELETE, OPTIONS'
    );

    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization'
    );

    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }

    next();
  });

  // ============================================================
  // DATABASE CONNECTION
  // ============================================================

  let databaseConnected = false;

  if (DEMO_MODE) {
    console.log('');
    console.log('[LWM] DEMO MODE ENABLED');
    console.log('[LWM] MongoDB connection skipped');
    console.log('[LWM] Starting UI-only local mode');
    console.log('');
  } else {
    try {
      const { db } = await import('./server/db');

      await db.connect();

      databaseConnected = true;

      console.log('[DB] MongoDB connected successfully');

      await seedDatabase(false);

      console.log('[DB] Database seeded successfully');
    } catch (error) {
      console.error('[DB] MongoDB connection failed');
      console.error(error);
      console.log('[LWM] Continuing without database');
      console.log('[LWM] Database APIs will be unavailable');
    }
  }

  // ============================================================
  // HEALTH CHECK
  // ============================================================

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      system: 'Liberation War Museum Office Management System',
      mode: databaseConnected ? 'database' : 'demo',
      database: databaseConnected ? 'connected' : 'not connected',
    });
  });

  // ============================================================
  // DATABASE-DEPENDENT ROUTES
  // ============================================================

  if (databaseConnected) {
    // Seed reset
    app.post('/api/seed/reset', async (_req, res) => {
      try {
        const { db } = await import('./server/db');
        await seedDatabase(true);
        // Reload in-memory arrays from MongoDB so changes take effect immediately
        await db.loadAll();

        res.json({
          success: true,
          message: 'Database re-seeded successfully',
        });
      } catch (error) {
        console.error('[Seed Reset Error]', error);

        res.status(500).json({
          success: false,
          message: 'Failed to reset database',
        });
      }
    });

    // Authentication
    app.use('/api/auth', authRoutes);

    // Users
    app.use('/api/users', userRoutes);

    // Departments
    app.use('/api/departments', deptRoutes);

    // Tasks
    app.use('/api/tasks', taskRoutes);

    // Task Requests
    app.use('/api/task-requests', taskRequestRoutes);

    // Projects
    app.use('/api/projects', projectRoutes);

    // Notifications
    app.use('/api/notifications', notificationRoutes);

    // Approvals
    app.use('/api/approvals', approvalRoutes);

    // Events
    app.use('/api/events', eventRoutes);

    // Announcements
    app.use('/api/announcements', announcementRoutes);

    // Documents
    app.use('/api/documents', documentRoutes);

    // Activity Logs
    app.use('/api/activity-logs', activityLogRoutes);

    // Reports
    app.use('/api/reports', reportRoutes);

    // Analytics
    app.use('/api/analytics', analyticsRoutes);

    // Organogram
    app.use('/api/organogram', organogramRoutes);

    // Upload
    app.use('/api/upload', uploadRoutes);
  } else {
    // ==========================================================
    // DEMO MODE
    // ==========================================================

    app.use('/api', (req, res) => {
      if (req.path === '/health') {
        return;
      }

      res.status(503).json({
        success: false,
        demoMode: true,
        databaseConnected: false,
        message:
          'MongoDB is not connected. The OMS is running in UI-only demo mode.',
      });
    });
  }

  // ============================================================
  // UPLOADED FILES
  // ============================================================

  app.use(
    '/uploads',
    express.static(path.join(process.cwd(), 'uploads'))
  );

  // ============================================================
  // VITE DEVELOPMENT SERVER
  // ============================================================

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
      },
      appType: 'spa',
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');

    app.use(express.static(distPath));

    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // ============================================================
  // START SERVER
  // ============================================================

  app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('==============================================');
    console.log('Liberation War Museum Office Management System');
    console.log('==============================================');
    console.log('Local URL: http://localhost:3000');

    if (DEMO_MODE || !databaseConnected) {
      console.log('Mode: UI-ONLY DEMO');
      console.log('MongoDB: NOT CONNECTED');
    } else {
      console.log('Mode: DATABASE');
      console.log('MongoDB: CONNECTED');
    }

    console.log('==============================================');
    console.log('');
  });
}

// ============================================================
// START APPLICATION
// ============================================================

startServer().catch((error) => {
  console.error('');
  console.error('[Server Startup Error]');
  console.error(error);
  console.error('');
});
// Server reload triggered