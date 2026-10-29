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
  uniqueId?: string;
  name: LocalizedString;
  email: string;
  personalEmail?: string;
  alternateEmails?: string[];
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
  convertedTask?: { _id: string; taskId: string; title: string; status: TaskStatus; progress?: number; assignedTo?: string[]; assignees?: User[] } | null;
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
  | 'performance'
  | 'messages'
  | 'leaves';

export type NavTab = NavigationTab;

export interface DirectMessage {
  _id: string;
  senderId: string;
  sender?: User | null;
  subject: string;
  body: string;
  recipientType: 'individual' | 'department' | 'all';
  departmentId?: string;
  recipientIds: string[];
  recipientUsers?: Partial<User>[];
  readBy: string[];
  isRead?: boolean;
  createdAt: string;
}

// ============================================================
// Leave Management Types
// ============================================================

export type LeaveType =
  | 'EARNED'     // অমার্জিত ছুটি (Earned / Privilege Leave)
  | 'CASUAL'     // সাধারন ছুটি (Casual Leave)
  | 'SICK'       // অসুস্থজনিত ছুটি (Sick / Medical Leave)
  | 'MATERNITY'  // মাতৃত্বকালীন ছুটি (Maternity Leave)
  | 'PATERNITY'; // পিতৃত্বকালীন ছুটি (Paternity Leave)

export type LeaveStatus =
  | 'PENDING'          // অপেক্ষমাণ
  | 'APPROVED'         // অনুমোদিত
  | 'REJECTED'         // প্রত্যাখ্যাত
  | 'REFERRED_TO_CEO'  // মহাপরিচালকের নিকট প্রেরিত
  | 'CANCELLED';       // বাতিল

export interface LeaveStayAddress {
  village: string;          // গ্রাম / মহল্লা / বাড়ি / সড়ক
  postOffice: string;       // ডাকঘর
  thana: string;            // থানা
  upazila: string;          // উপজেলা
  district: string;         // জেলা
  emergencyContact: string; // জরুরি যোগাযোগের ফোন নম্বর
}

export interface LeaveRequest {
  _id: string;
  leaveId: string; // e.g. LEV-00001
  applicantId: string;
  applicant?: User | null;
  applicantDepartmentId?: string;
  department?: DepartmentRef | null;
  startDate: string; // YYYY-MM-DD
  returnDate: string; // YYYY-MM-DD (The date of arrive again)
  daysCount: number;
  leaveType: LeaveType;
  leaveTypeName: string; // অমার্জিত ছুটি, সাধারন ছুটি, অসুস্থজনিত ছুটি, মাতৃত্বকালীন ছুটি, পিতৃত্বকালীন ছুটি
  reason: string;
  stayAddress: LeaveStayAddress;
  reliefUserId: string; // who will do this work when he/she will be in leave
  reliefUser?: User | null;
  reliefNote?: string;
  currentApproverId: string; // Dept Head or CEO
  currentApprover?: User | null;
  currentApproverRole: 'DEPT_HEAD' | 'CEO';
  status: LeaveStatus;
  decisionReason?: string;
  referredAt?: string;
  referralNote?: string;
  reviewedBy?: string;
  reviewer?: User | null;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveStats {
  totalLeavesTaken: number;
  totalDaysTaken: number;
  typeBreakdown: Record<LeaveType, { name: string; count: number; days: number }>;
}

// ============================================================
// Leave Management Types
// ============================================================

export type LeaveType =
  | 'EARNED'     // অমার্জিত ছুটি (Earned / Privilege Leave)
  | 'CASUAL'     // সাধারন ছুটি (Casual Leave)
  | 'SICK'       // অসুস্থজনিত ছুটি (Sick / Medical Leave)
  | 'MATERNITY'  // মাতৃত্বকালীন ছুটি (Maternity Leave)
  | 'PATERNITY'; // পিতৃত্বকালীন ছুটি (Paternity Leave)

export type LeaveStatus =
  the | 'PENDING'          // অপেক্ষমাণ
  | 'APPROVED'         // অনুমোদিত
  | 'REJECTED'         // প্রত্যাখ্যাত
  | 'REFERRED_TO_CEO'  // মহাপরিচালকের নিকট প্রেরিত
  | 'CANCELLED';       // বাতিল

export interface LeaveStayAddress {
  village: string;          // গ্রাম / মহল্লা / বাড়ি / সড়ক
  postOffice: string;       // ডাকঘর
  thana: string;            // থানা
  upazila: string;          // উপজেলা
  district: string;         // জেলা
  emergencyContact: string; // জরুরি যোগাযোগের ফোন নম্বর
}

export interface LeaveRequest {
  _id: string;
  leaveId: string; // e.g. LEV-00001
  applicantId: string;
  applicant?: User | null;
  applicantDepartmentId?: string;
  department?: DepartmentRef | null;
  startDate: string; // YYYY-MM-DD
  returnDate: string; // YYYY-MM-DD (The date of arrive again)
  daysCount: number;
  leaveType: LeaveType;
  leaveTypeName: string; // অমার্জিত ছুটি, সাধারন ছুটি, অসুস্থজনিত ছুটি, মাতৃত্বকালীন ছুটি, পিতৃত্বকালীন ছুটি
  reason: string;
  stayAddress: LeaveStayAddress;
  reliefUserId: string; // who will do this work when he/she will be in leave
  reliefUser?: User | null;
  reliefNote?: string;
  currentApproverId: string; // Dept Head or CEO
  currentApprover?: User | null;
  currentApproverRole: 'DEPT_HEAD' | 'CEO';
  status: LeaveStatus;
  decisionReason?: string;
  referredAt?: string;
  referralNote?: string;
  reviewedBy?: string;
  reviewer?: User | null;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveStats {
  totalLeavesTaken: number;
  totalDaysTaken: number;
  typeBreakdown: Record<LeaveType, { name: string; count: number; days: number }>;
}
