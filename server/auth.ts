import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { db } from './db';
import { User, UserRole } from './types';

const JWT_SECRET = process.env.JWT_SECRET || 'lwm_secret_enterprise_token_key_2026';

export interface AuthTokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  departmentId?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export function generateToken(user: User): string {
  const payload: AuthTokenPayload = {
    userId: user._id,
    email: user.email,
    role: getEffectiveRole(user),
    departmentId: user.departmentId
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): AuthTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
  } catch (err) {
    return null;
  }
}

export function getEffectiveRole(user: Pick<User, 'role' | 'roleId'>): UserRole {
  const candidate = user.roleId || user.role;
  if (candidate === 'SUPER_ADMIN') return 'SUPER_ADMIN';
  if (candidate === 'DEPARTMENT_HEAD') return 'DEPT_HEAD';
  if (candidate === 'SUPER_ADMIN' || candidate === 'TRUSTEE' || candidate === 'CEO' || candidate === 'DEPT_HEAD' || candidate === 'OFFICER' || candidate === 'ASSISTANT_OFFICER' || candidate === 'STAFF' || candidate === 'CONTRACTUAL') {
    return candidate as UserRole;
  }
  return user.role;
}

export function getHierarchyLevel(user: Pick<User, 'role' | 'roleId'> | undefined): number {
  switch (getEffectiveRole(user || { role: 'EMPLOYEE', roleId: undefined })) {
    case 'SUPER_ADMIN': return 5;
    case 'TRUSTEE': return 4;
    case 'CEO': return 3;
    case 'DEPT_HEAD': return 2;
    case 'OFFICER':
    case 'ASSISTANT_OFFICER': return 1;
    default: return 0;
  }
}

export function isHigherLevel(requester: Pick<User, 'role' | 'roleId'> | undefined, target: Pick<User, 'role' | 'roleId'> | undefined): boolean {
  return getHierarchyLevel(target) > getHierarchyLevel(requester);
}

export function sanitizeUser(user: User): Omit<User, 'password' | 'passwordHash'> {
  const { password, passwordHash, ...safeUser } = user;
  return safeUser;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  let token = req.headers.authorization;
  if (token && token.startsWith('Bearer ')) {
    token = token.slice(7);
  } else if (req.query.token && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    res.status(401).json({ success: false, message: 'Authentication required. Please log in.' });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ success: false, message: 'Invalid or expired authentication session.' });
    return;
  }

  const user = db.users.find(u => u._id === payload.userId);
  if (!user || !user.isActive) {
    res.status(401).json({ success: false, message: 'User account is inactive or not found.' });
    return;
  }

  req.user = user;
  next();
}

export function checkRole(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const role = getEffectiveRole(req.user);
    if (role === 'SUPER_ADMIN' || role === 'CEO' || role === 'TRUSTEE') {
      // High-level executive oversight & Super Admin have universal access
      return next();
    }

    if (!allowedRoles.includes(role)) {
      res.status(403).json({ success: false, message: 'Access denied. Insufficient role permissions.' });
      return;
    }

    next();
  };
}
