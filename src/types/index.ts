export type UserRole = 
  | 'SUPER_ADMIN'
  | 'TRUSTEE'
  | 'CEO'
  | 'DEPT_HEAD'
  | 'DEPARTMENT_HEAD'
  | 'OFFICER'
  | 'ASSISTANT_OFFICER'
  | 'STAFF'
  | 'CONTRACTUAL'
  | 'EMPLOYEE';

export type UserTier = 'SUPER_ADMIN' | 'TRUSTEE' | 'EXECUTIVE' | 'DEPT_HEAD' | 'OFFICER' | 'STAFF' | 'CONTRACTUAL';


export interface LocalizedString {
  en: string;
  bn: string;
}

export interface DepartmentRef {
  _id: string;
  code: string;
  name: LocalizedString;
}

export interface User {
  _id: string;
  employeeId: string;
  name: LocalizedString;
  email: string;
  designation: LocalizedString;
  departmentId?: string;
  department?: DepartmentRef | null;
  role: UserRole;
  roleId?: UserRole | string;
  tier?: UserTier | string | null;
  phone?: string;
  photo?: string;
  isActive: boolean;
  joiningDate?: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  _id: string;
  code: string;
  name: LocalizedString;
  description?: string;
  headId?: string;
  head?: User | null;
  isActive: boolean;
  stats?: {
    totalEmployees: number;
    activeTasks: number;
    completedTasks: number;
    overdueTasks: number;
    totalTasks: number;
    incomingCrossDeptCount?: number;
    outgoingCrossDeptCount?: number;
    totalProjects?: number;
  };
  employees?: User[];
  createdAt: string;
  updatedAt: string;
}

export type TaskStatus = 
  | 'TODO'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'ON_HOLD'
  | 'IN_REVIEW'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type TaskVisibility = 'PRIVATE' | 'DEPARTMENT' | 'PROJECT' | 'COLLABORATORS' | 'ORGANIZATION';

export interface TaskChecklistItem {
  _id: string;
  title: string;
  completed: boolean;
  completedBy?: string;
  completedAt?: string;
}

export interface TaskAttachment {
  _id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface Task {
  _id: string;
  taskId: string;
  title: string;
  description: string;
  createdBy: string;
  requestedBy?: string;
  creator?: User | null;
  requester?: User | null;
  assignedTo: string[];
  assignees?: User[];
  collaborators: string[];
  collaboratorUsers?: User[];
  sourceDepartmentId?: string;
  targetDepartmentId?: string;
  sourceDepartment?: DepartmentRef | null;
  targetDepartment?: DepartmentRef | null;
  departmentId: string;
  department?: DepartmentRef | null;
  projectId?: string;
  project?: { _id: string; projectId: string; name: string } | null;
  parentTaskId?: string;
  status: TaskStatus;
  priority: TaskPriority;
  progress: number;
  visibility: TaskVisibility;
  startDate?: string;
  dueDate: string;
  completedAt?: string;
  checklist: TaskChecklistItem[];
  tags: string[];
  attachments: TaskAttachment[];
  requiresApproval?: boolean;
  approvalStatus?: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';
  relatedRequestId?: string;
  isOverdue?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type TaskRequestStatus = 
  | 'PENDING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'CLARIFICATION_REQUIRED'
  | 'CONVERTED_TO_TASK'
  | 'CANCELLED';

export interface TaskRequest {
  _id: string;
  requestId: string;
  requesterId: string;
  requester?: User | null;
  requesterDepartmentId: string;
  requesterDepartment?: DepartmentRef | null;
  targetEmployeeId: string;
  targetEmployee?: User | null;
  suggestedEmployeeId?: string;
  suggestedEmployee?: User | null;
  targetDepartmentId: string;
  targetDepartment?: DepartmentRef | null;
  title: string;
  description: string;
  priority: TaskPriority;
  dueDate: string;
  attachments: TaskAttachment[];
  status: TaskRequestStatus;
  responseMessage?: string;
  clarificationComments?: Array<{
    userId: string;
    message: string;
    createdAt: string;
  }>;
  convertedTaskId?: string;
  convertedTask?: { _id: string; taskId: string; title: string; status: TaskStatus } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMilestone {
  _id: string;
  name: string;
  dueDate: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  responsiblePersonId?: string;
}

export interface Project {
  _id: string;
  projectId: string;
  name: string;
  description: string;
  managerId: string;
  manager?: User | null;
  departments: string[];
  departmentList?: DepartmentRef[];
  members: string[];
  memberUsers?: User[];
  status: 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
  priority: TaskPriority;
  startDate: string;
  deadline: string;
  progress: number;
  milestones: ProjectMilestone[];
  attachments: TaskAttachment[];
  stats?: {
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    pendingTasks: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface TaskComment {
  _id: string;
  taskId: string;
  userId: string;
  author?: User | null;
  content: string;
  mentions: string[];
  attachments: TaskAttachment[];
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  _id: string;
  recipientId: string;
  type: 
    | 'TASK_REQUEST'
    | 'TASK_ASSIGNED'
    | 'TASK_ACCEPTED'
    | 'TASK_REJECTED'
    | 'CLARIFICATION_REQUEST'
    | 'COMMENT'
    | 'MENTION'
    | 'FILE_UPLOADED'
    | 'STATUS_CHANGED'
    | 'PROGRESS_CHANGED'
    | 'DEADLINE_APPROACHING'
    | 'TASK_OVERDUE'
    | 'TASK_COMPLETED'
    | 'APPROVAL_REQUESTED'
    | 'APPROVAL_COMPLETED'
    | 'ANNOUNCEMENT';
  title: string;
  message: string;
  resourceType: 'TASK' | 'TASK_REQUEST' | 'PROJECT' | 'APPROVAL' | 'ANNOUNCEMENT' | 'EVENT';
  resourceId: string;
  isRead: boolean;
  createdAt: string;
}

export interface ActivityLog {
  _id: string;
  actorId: string;
  actor?: User | null;
  action: string;
  resourceType: 'TASK' | 'TASK_REQUEST' | 'PROJECT' | 'APPROVAL' | 'USER' | 'DEPARTMENT';
  resourceId: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface Approval {
  _id: string;
  requesterId: string;
  requester?: User | null;
  requesterDepartmentId: string;
  requesterDepartment?: DepartmentRef | null;
  requestType: 'BUDGET_APPROVAL' | 'SPECIAL_PROCUREMENT' | 'EXHIBITION_PLAN' | 'LEAVE_REQUEST' | 'CROSS_DEPT_INITIATIVE';
  resourceType: 'TASK' | 'PROJECT' | 'DEPARTMENT' | 'GENERAL';
  resourceId?: string;
  title: string;
  description: string;
  approverId: string;
  approver?: User | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED' | 'CANCELLED';
  reason?: string;
  approvedAt?: string;
  rejectedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EventItem {
  _id: string;
  name: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  organizerId: string;
  organizer?: User | null;
  departments: DepartmentRef[];
  associatedTaskIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Announcement {
  _id: string;
  title: string;
  content: string;
  audience: 'EVERYONE' | 'DEPARTMENT' | 'SELECTED';
  departmentId?: string;
  department?: DepartmentRef | null;
  authorId: string;
  author?: User | null;
  priority: TaskPriority;
  publishedDate: string;
  createdAt: string;
}

export interface OfficeDocument {
  _id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  resourceType: 'TASK' | 'PROJECT' | 'DEPARTMENT' | 'EVENT' | 'GENERAL';
  resourceId?: string;
  departmentId?: string;
  department?: DepartmentRef | null;
  uploadedBy: string;
  uploader?: User | null;
  isConfidential?: boolean;
  createdAt: string;
}

export type NavigationTab = 
  | 'dashboard'
  | 'my-tasks'
  | 'all-tasks'
  | 'requests'
  | 'board'
  | 'calendar'
  | 'projects'
  | 'organogram'
  | 'departments'
  | 'employees'
  | 'approvals'
  | 'reports'
  | 'documents'
  | 'announcements'
  | 'events'
  | 'performance';

export type NavTab = NavigationTab;


