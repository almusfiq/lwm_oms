export type UserRole = 
  | 'SUPER_ADMIN'
  | 'TRUSTEE'
  | 'CEO'
  | 'DEPT_HEAD'
  | 'OFFICER'
  | 'ASSISTANT_OFFICER'
  | 'STAFF'
  | 'CONTRACTUAL'
  | 'EMPLOYEE'
  | 'DEPARTMENT_HEAD';

export type UserTier = 'SUPER_ADMIN' | 'TRUSTEE' | 'EXECUTIVE' | 'DEPT_HEAD' | 'OFFICER' | 'STAFF' | 'CONTRACTUAL';


export interface LocalizedString {
  en: string;
  bn: string;
}

export interface User {
  _id: string;
  employeeId: string;
  uniqueId: string;       // e.g. "LWM-00001" — can be used to login
  name: LocalizedString;
  email: string;          // e.g. "ceo@lwmbd.org"  — can be used to login
  password?: string;
  passwordHash?: string;
  designation: LocalizedString;
  departmentId?: string;
  role: UserRole;
  roleId?: UserRole | string;
  tier?: UserTier | string | null;
  phone?: string;
  photo?: string;
  isActive: boolean;
  joiningDate?: string;
  lastLoginAt?: string;
  performanceScore?: number;  // 0-100, computed from tasks
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  _id: string;
  code: string;
  name: LocalizedString;
  description?: string;
  headId?: string; // User ID
  isActive: boolean;
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
  type: string; // pdf, xls, img, doc
  url: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface Task {
  _id: string;
  taskId: string; // e.g. TASK-00001
  title: string;
  description: string;
  createdBy: string; // User ID
  requestedBy?: string; // User ID
  assignedTo: string[]; // User IDs
  collaborators: string[]; // User IDs
  sourceDepartmentId?: string; // Dept ID of requester
  targetDepartmentId?: string; // Dept ID of assignee
  departmentId: string; // Main department responsible
  projectId?: string;
  parentTaskId?: string;
  status: TaskStatus;
  priority: TaskPriority;
  progress: number; // 0 to 100
  visibility: TaskVisibility;
  startDate?: string;
  dueDate: string;
  completedAt?: string;
  checklist: TaskChecklistItem[];
  tags: string[];
  attachments: TaskAttachment[];
  requiresApproval?: boolean;
  approvalStatus?: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';
  relatedRequestId?: string; // If converted from TaskRequest
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
  requestId: string; // e.g. REQ-00001
  requesterId: string;
  requesterDepartmentId: string;
  targetEmployeeId: string;
  suggestedEmployeeId?: string;
  targetDepartmentId: string;
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
  projectId: string; // e.g. PRJ-00001
  name: string;
  description: string;
  managerId: string; // User ID
  departments: string[]; // Department IDs involved
  members: string[]; // User IDs
  status: 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
  priority: TaskPriority;
  startDate: string;
  deadline: string;
  progress: number; // dynamically computed or persisted
  milestones: ProjectMilestone[];
  attachments: TaskAttachment[];
  createdAt: string;
  updatedAt: string;
}

export interface TaskComment {
  _id: string;
  taskId: string;
  userId: string;
  parentCommentId?: string;
  content: string;
  mentions: string[]; // user IDs
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
    | 'APPROVAL_REFERRED'
    | 'CROSS_DEPT_TASK'
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
  action: string;
  module: 'AUTH' | 'USERS' | 'TASKS' | 'PROJECTS' | 'DEPARTMENTS' | 'DOCUMENTS' | 'APPROVALS' | 'SECURITY' | 'SYSTEM' | string;
  resourceType?: 'TASK' | 'TASK_REQUEST' | 'PROJECT' | 'APPROVAL' | 'USER' | 'DEPARTMENT' | 'DOCUMENT' | 'SYSTEM' | string;
  resourceId?: string;
  resourceName?: string;
  description: string;
  ipAddress?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface Approval {
  _id: string;
  requesterId: string;
  requesterDepartmentId: string;
  requestType: 'BUDGET_APPROVAL' | 'SPECIAL_PROCUREMENT' | 'EXHIBITION_PLAN' | 'LEAVE_REQUEST' | 'CROSS_DEPT_INITIATIVE' | 'GENERAL_REQUEST' | string;
  resourceType: 'TASK' | 'PROJECT' | 'DEPARTMENT' | 'GENERAL';
  resourceId?: string;
  title: string;
  description: string;
  approverId: string;           // current approver
  level: 'DEPT_HEAD' | 'CEO' | 'TRUSTEE'; // current approval level
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REFERRED' | 'CANCELLED';
  reason?: string;
  referredBy?: string;          // userId who referred up
  referredAt?: string;
  referralNote?: string;
  comments?: Array<{
    userId: string;
    comment: string;
    createdAt: string;
  }>;
  attachments?: TaskAttachment[];
  approvedAt?: string;
  rejectedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PerformanceRecord {
  userId: string;
  totalTasks: number;
  completedOnTime: number;
  completedLate: number;
  overduePending: number;
  score: number;  // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  lastCalculated: string;
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
  departments: string[];
  participants: string[];
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
  authorId: string;
  priority: TaskPriority;
  publishedDate: string;
  expiryDate?: string;
  attachments: TaskAttachment[];
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
  uploadedBy: string;
  isConfidential?: boolean;
  createdAt: string;
}


