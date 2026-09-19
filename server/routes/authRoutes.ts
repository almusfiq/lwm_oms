import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import { generateToken, requireAuth, sanitizeUser, AuthenticatedRequest } from '../auth';

export const authRoutes = Router();

// POST /api/auth/login
authRoutes.post('/login', async (req, res: Response) => {
  try {
    const { identifier, email, password } = req.body;

    // Accept either `identifier` (new field) or legacy `email` field
    const loginInput = (identifier || email || '').trim();

    if (!loginInput || !password) {
      res.status(400).json({ success: false, message: 'Identifier (email or Employee ID) and password are required' });
      return;
    }

    // Find user by email OR uniqueId (case-insensitive)
    const user = db.users.find(u =>
      u.email.toLowerCase() === loginInput.toLowerCase() ||
      (u.uniqueId && u.uniqueId.toLowerCase() === loginInput.toLowerCase())
    );

    if (!user) {
      res.status(401).json({ success: false, message: 'Invalid credentials. No account found with this email or ID.' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ success: false, message: 'This account is inactive (In Memoriam / Deactivated).' });
      return;
    }

    // Verify password
    const passwordField = user.password || (user as any).passwordHash;
    if (!passwordField) {
      res.status(500).json({ success: false, message: 'Account has no password configured. Contact admin.' });
      return;
    }
    const isMatch = await bcrypt.compare(password, passwordField);
    if (!isMatch) {
      res.status(401).json({ success: false, message: 'Incorrect password.' });
      return;
    }

    // Update last login
    user.lastLoginAt = new Date().toISOString();
    db.save();

    const token = generateToken(user);
    res.json({
      success: true,
      data: {
        token,
        user: sanitizeUser(user)
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Login failed' });
  }
});

// GET /api/auth/me
authRoutes.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Not authenticated' });
    return;
  }

  const dept = db.departments.find(d => d._id === req.user?.departmentId);
  const unreadNotifications = db.notifications.filter(n => n.recipientId === req.user?._id && !n.isRead).length;
  const pendingRequests = db.taskRequests.filter(r => r.targetEmployeeId === req.user?._id && r.status === 'PENDING').length;

  res.json({
    success: true,
    data: {
      user: sanitizeUser(req.user),
      department: dept || null,
      unreadNotifications,
      pendingRequests
    }
  });
});

// POST /api/auth/switch-user (Fast interactive role switcher for demoing CEO, Trustee, Dept Head, Officer, Staff)
authRoutes.post('/switch-user', (req, res: Response) => {
  const { userId } = req.body;
  if (!userId) {
    res.status(400).json({ success: false, message: 'userId required' });
    return;
  }

  const user = db.users.find(u => u._id === userId);
  if (!user || !user.isActive) {
    res.status(404).json({ success: false, message: 'Active user not found' });
    return;
  }

  user.lastLoginAt = new Date().toISOString();
  db.save();

  const token = generateToken(user);
  res.json({
    success: true,
    data: {
      token,
      user: sanitizeUser(user)
    }
  });
});

// GET /api/auth/demo-users (Returns convenient list of key accounts for quick switcher)
authRoutes.get('/demo-users', (_req, res: Response) => {
  const keyUsers = [
    // CEO
    db.users.find(u => u.role === 'CEO'),
    // Trustee
    db.users.find(u => u.role === 'TRUSTEE' && u.isActive),
    // Dept Heads
    db.users.find(u => u._id === 'usr_archive_head'),
    db.users.find(u => u._id === 'usr_finance_head'),
    db.users.find(u => u._id === 'usr_edu_head'),
    db.users.find(u => u._id === 'usr_admin_head'),
    db.users.find(u => u._id === 'usr_research_head'),
    db.users.find(u => u._id === 'usr_maint_head'),
    db.users.find(u => u._id === 'usr_comm_head'),
    // Officers & Staff
    db.users.find(u => u._id === 'usr_archive_1'), // Shri Montu Basu (Archive Officer)
    db.users.find(u => u._id === 'usr_research_1'), // Sabrina Afreen (Research Associate)
    db.users.find(u => u._id === 'usr_edu_3'), // Ronika Islam (Education Officer)
    db.users.find(u => u._id === 'usr_finance_1'), // Md. Abul Kalam (Finance Asst Manager)
    db.users.find(u => u._id === 'usr_maint_1') // Abul Hossain Shamim (Maintenance Staff)
  ].filter(Boolean) as typeof db.users;

  const results = keyUsers.map(u => {
    const dept = db.departments.find(d => d._id === u.departmentId);
    return {
      _id: u._id,
      employeeId: u.employeeId,
      name: u.name,
      email: u.email,
      role: u.role,
      designation: u.designation,
      department: dept ? { _id: dept._id, code: dept.code, name: dept.name } : null
    };
  });

  res.json({ success: true, data: results });
});
