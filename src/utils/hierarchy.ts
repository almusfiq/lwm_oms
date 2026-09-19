import { User, UserRole } from '../types';

type HierarchyUser = Pick<User, 'role' | 'roleId'>;

const HIERARCHY_LEVELS: Record<UserRole, number> = {
  TRUSTEE: 4,
  CEO: 3,
  DEPT_HEAD: 2,
  OFFICER: 1,
  ASSISTANT_OFFICER: 1,
  STAFF: 0,
  CONTRACTUAL: 0,
  EMPLOYEE: 0,
  DEPARTMENT_HEAD: 2
};

export function getUserRole(user?: HierarchyUser | null): UserRole {
  const candidate = user?.roleId || user?.role || 'EMPLOYEE';
  if (candidate === 'DEPARTMENT_HEAD') return 'DEPT_HEAD';
  return (HIERARCHY_LEVELS[candidate as UserRole] !== undefined ? candidate : 'EMPLOYEE') as UserRole;
}

export function getHierarchyLevel(user?: HierarchyUser | null): number {
  return HIERARCHY_LEVELS[getUserRole(user)];
}

export function isHigherLevel(requester?: HierarchyUser | null, target?: HierarchyUser | null): boolean {
  return getHierarchyLevel(target) > getHierarchyLevel(requester);
}

export function isDepartmentHead(user?: HierarchyUser | null): boolean {
  return getUserRole(user) === 'DEPT_HEAD';
}
