import crypto from 'crypto';
import mongoose from 'mongoose';
import {
  User, Department, Task, TaskRequest, Project,
  TaskComment, Notification, ActivityLog, Approval,
  EventItem, Announcement, OfficeDocument, DirectMessage, LeaveRequest
} from './types';

// Environment variable for MongoDB URI
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lwm-oms';

// ============================================================
// Mongoose models (inline schemas for full flexibility)
// ============================================================

const Mixed = mongoose.Schema.Types.Mixed;
const S = (fields: Record<string, any>) => new mongoose.Schema({ _id: Mixed, ...fields }, { strict: false, timestamps: true });

const LEGACY_DEPARTMENT_IDS: Record<string, string> = {
  dept_ceo: 'CEO',
  dept_admin: 'ADMIN',
  dept_finance: 'FINANCE',
  dept_programme: 'PROGRAMME',
  dept_education: 'EDUCATION',
  dept_archive: 'ARCHIVE',
  dept_research: 'RESEARCH',
  dept_maintenance: 'MAINTENANCE',
  dept_communications: 'COMMUNICATIONS'
};

function normalizeRoleValue(value: unknown): UserRole | undefined {
  if (value === 'DEPARTMENT_HEAD') return 'DEPT_HEAD';
  if (value === 'TRUSTEE' || value === 'CEO' || value === 'DEPT_HEAD' || value === 'OFFICER' || value === 'ASSISTANT_OFFICER' || value === 'STAFF' || value === 'CONTRACTUAL') {
    return value as UserRole;
  }
  return undefined;
}

function effectiveRole(user: User): UserRole {
  return normalizeRoleValue(user.roleId) || normalizeRoleValue(user.role) || user.role;
}

function tierForRole(role: UserRole): UserTier {
  if (role === 'TRUSTEE') return 'TRUSTEE';
  if (role === 'CEO') return 'EXECUTIVE';
  if (role === 'DEPT_HEAD') return 'DEPT_HEAD';
  if (role === 'OFFICER' || role === 'ASSISTANT_OFFICER') return 'OFFICER';
  if (role === 'CONTRACTUAL') return 'CONTRACTUAL';
  return 'STAFF';
}

export function resolveDepartmentId(value: string | undefined, departments: Department[]): string | undefined {
  if (!value) return value;
  if (departments.some(department => department._id === value)) return value;
  const code = LEGACY_DEPARTMENT_IDS[value] || value;
  return departments.find(department => department.code.toUpperCase() === code.toUpperCase())?._id || value;
}

function model<T>(name: string, fields: Record<string, any>) {
  try { return mongoose.model<T & mongoose.Document>(name); }
  catch { return mongoose.model<T & mongoose.Document>(name, S(fields)); }
}

const UserModel     = model<User>      ('User',         { employeeId: String, email: { type: String, unique: true }, personalEmail: String, alternateEmails: [String], passwordHash: String });
const DeptModel     = model<Department>('Department',   { code: { type: String, unique: true } });
const TaskModel     = model<Task>      ('Task',         { taskId: { type: String, unique: true } });
const ReqModel      = model<TaskRequest>('TaskRequest', { requestId: { type: String, unique: true } });
const ProjectModel  = model<Project>   ('Project',      { projectId: { type: String, unique: true } });
const CommentModel  = model<TaskComment>('TaskComment', {});
const NotiModel     = model<Notification>('Notification', {});
const LogModel      = model<ActivityLog>('ActivityLog', {});
const ApprovalModel = model<Approval>  ('Approval',     {});
const EventModel    = model<EventItem> ('EventItem',    {});
const AnnModel      = model<Announcement>('Announcement', {});
const DocModel      = model<OfficeDocument>('OfficeDocument', {});
const DirectMsgModel = model<DirectMessage>('DirectMessage', {});
const LeaveModel    = model<LeaveRequest>  ('LeaveRequest',   { leaveId: { type: String, unique: true } });

// ============================================================
// Helper: convert Mongoose doc → plain JS object matching types
// ============================================================
function toPlain<T>(doc: any): T {
  const obj = doc.toObject ? doc.toObject({ virtuals: false }) : { ...doc };
  // Map _id to string
  if (obj._id) obj._id = obj._id.toString();
  // Normalize name: if string, wrap as LocalizedString
  if (typeof obj.name === 'string') obj.name = { en: obj.name, bn: obj.name };
  // Normalize designation
  if (typeof obj.designation === 'string') obj.designation = { en: obj.designation, bn: obj.designation };
  // Normalize isActive from status field
  if (obj.status === 'ACTIVE') obj.isActive = true;
  if (obj.status === 'INACTIVE') obj.isActive = false;
  if (obj.isActive === undefined) obj.isActive = true;
  // Map passwordHash → password so login route always finds it
  if (obj.passwordHash && !obj.password) obj.password = obj.passwordHash;
  // Normalize dates to ISO strings
  const dateFields = ['createdAt','updatedAt','lastLoginAt','joiningDate','dueDate','startDate','deadline','completedAt'];
  for (const f of dateFields) {
    if (obj[f] instanceof Date) obj[f] = obj[f].toISOString();
  }
  return obj as T;
}

// ============================================================
// DatabaseManager — in-memory store backed by MongoDB
// ============================================================
class DatabaseManager {
  private isConnected = false;

  // In-memory arrays (same API the routes expect)
  public users:        User[]          = [];
  public departments:  Department[]    = [];
  public tasks:        Task[]          = [];
  public taskRequests: TaskRequest[]   = [];
  public projects:     Project[]       = [];
  public comments:     TaskComment[]   = [];
  public notifications:Notification[]  = [];
  public activityLogs: ActivityLog[]   = [];
  public approvals:    Approval[]      = [];
  public events:       EventItem[]     = [];
  public announcements:Announcement[]  = [];
  public documents:    OfficeDocument[]= [];
  public messages:     DirectMessage[] = [];
  public leaves:       LeaveRequest[]  = [];

  // ──────────────────────────────────────────────────────────
  // connect() — connect to MongoDB and load all data to memory
  // ──────────────────────────────────────────────────────────
  public async connect() {
    if (this.isConnected) {
      console.log('[DB] Already connected to MongoDB');
      return;
    }

    try {
      mongoose.set('strictQuery', false);
      const conn = await mongoose.connect(MONGO_URI);
      this.isConnected = true;
      console.log(`[DB] MongoDB Connected: ${conn.connection.host}`);

      // Load all collections into memory
      await this.loadAll();
    } catch (err) {
      console.error('[DB] Connection Error:', err);
      throw err; // Let server.ts handle gracefully
    }
  }

  // ──────────────────────────────────────────────────────────
  // loadAll() — pull everything from MongoDB into memory
  // ──────────────────────────────────────────────────────────
  public async loadAll() {
    const [users, depts, tasks, reqs, projects, comments, notis, logs, approvals, events, anns, docs, msgs, leaves] =
      await Promise.all([
        UserModel.find().lean(),
        DeptModel.find().lean(),
        TaskModel.find().lean(),
        ReqModel.find().lean(),
        ProjectModel.find().lean(),
        CommentModel.find().lean(),
        NotiModel.find().lean(),
        LogModel.find().lean(),
        ApprovalModel.find().lean(),
        EventModel.find().lean(),
        AnnModel.find().lean(),
        DocModel.find().lean(),
        DirectMsgModel.find().lean(),
        LeaveModel.find().lean(),
      ]);


    this.users         = users.map(d => toPlain<User>(d));
    this.departments   = depts.map(d => toPlain<Department>(d));
    this.tasks         = tasks.map(d => toPlain<Task>(d));
    this.taskRequests  = reqs.map(d => toPlain<TaskRequest>(d));
    this.projects      = projects.map(d => toPlain<Project>(d));
    this.comments      = comments.map(d => toPlain<TaskComment>(d));
    this.notifications = notis.map(d => toPlain<Notification>(d));
    this.activityLogs  = logs.map(d => toPlain<ActivityLog>(d));
    this.approvals     = approvals.map(d => toPlain<Approval>(d));
    this.events        = events.map(d => toPlain<EventItem>(d));
    this.announcements = anns.map(d => toPlain<Announcement>(d));
    this.documents     = docs.map(d => toPlain<OfficeDocument>(d));
    this.messages      = msgs.map(d => toPlain<DirectMessage>(d));
    this.leaves        = (leaves || []).map(d => toPlain<LeaveRequest>(d));



    this.normalizeReferences();

    console.log(`[DB] Loaded from MongoDB: ${this.users.length} users, ${this.departments.length} depts, ${this.tasks.length} tasks, ${this.projects.length} projects`);
  }

  private normalizeReferences() {
    // Deduplicate departments by code/id
    this.departments = this.departments.filter((d, idx, arr) =>
      idx === arr.findIndex(x => (x.code && d.code && x.code.toUpperCase() === d.code.toUpperCase()) || x._id === d._id)
    );

    const departments = this.departments;
    const users = this.users;

    users.forEach(user => {
      const role = effectiveRole(user);
      user.role = role;
      if (user.roleId) user.roleId = role;
      if (!user.tier) user.tier = tierForRole(role);
      user.departmentId = resolveDepartmentId(user.departmentId, departments);
    });

    departments.forEach(department => {
      const head = users.find(user =>
        user.departmentId === department._id &&
        effectiveRole(user) === 'DEPT_HEAD' &&
        user.isActive
      );
      if (head) department.headId = head._id;
    });

    this.tasks.forEach(task => {
      task.departmentId = resolveDepartmentId(task.departmentId, departments) || 'dept_admin';
      task.sourceDepartmentId = resolveDepartmentId(task.sourceDepartmentId, departments);
      task.targetDepartmentId = resolveDepartmentId(task.targetDepartmentId, departments);
      if (!Array.isArray(task.assignedTo)) {
        task.assignedTo = task.assignedTo ? [String(task.assignedTo)] : [];
      } else {
        task.assignedTo = task.assignedTo.map((a: any) => typeof a === 'object' ? String(a?._id || a?.id || a) : String(a)).filter(Boolean);
      }
      if (!Array.isArray(task.collaborators)) {
        task.collaborators = task.collaborators ? [String(task.collaborators)] : [];
      } else {
        task.collaborators = task.collaborators.map((c: any) => typeof c === 'object' ? String(c?._id || c?.id || c) : String(c)).filter(Boolean);
      }
    });

    // Auto-recover any converted task requests whose tasks were missing due to ID collisions
    const existingTaskIds = new Set(this.tasks.map(t => t._id));
    this.taskRequests.forEach(request => {
      request.requesterDepartmentId = resolveDepartmentId(request.requesterDepartmentId, departments) || 'dept_admin';
      request.targetDepartmentId = resolveDepartmentId(request.targetDepartmentId, departments) || 'dept_admin';

      if (request.status === 'CONVERTED_TO_TASK' && request.convertedTaskId && !existingTaskIds.has(request.convertedTaskId)) {
        const targetUserId = request.targetEmployeeId || request.suggestedEmployeeId;
        const recoveredTask: Task = {
          _id: request.convertedTaskId,
          taskId: this.getNextTaskId(),
          title: request.title,
          description: request.description,
          createdBy: request.requesterId,
          requestedBy: request.requesterId,
          assignedTo: targetUserId ? [targetUserId] : [],
          collaborators: [request.requesterId],
          sourceDepartmentId: request.requesterDepartmentId,
          targetDepartmentId: request.targetDepartmentId,
          departmentId: request.targetDepartmentId,
          status: 'IN_PROGRESS',
          priority: request.priority || 'MEDIUM',
          progress: 0,
          visibility: 'ORGANIZATION',
          startDate: new Date().toISOString().split('T')[0],
          dueDate: request.dueDate || new Date().toISOString().split('T')[0],
          checklist: [],
          tags: ['Cross-Dept', 'Recovered'],
          attachments: request.attachments || [],
          relatedRequestId: request._id,
          createdAt: request.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        this.tasks.push(recoveredTask);
        existingTaskIds.add(recoveredTask._id);
        console.log(`[DB] Auto-recovered converted task ${recoveredTask.taskId} (${recoveredTask.title}) for request ${request.requestId}`);
      }
    });

    // Auto-recover "Hello" directive for Sharif if missing
    if (!existingTaskIds.has('task_8f4ce4d2')) {
      const recoveredHello: Task = {
        _id: 'task_8f4ce4d2',
        taskId: this.getNextTaskId(),
        title: 'Hello',
        description: 'Direct task directive from CEO',
        createdBy: 'usr_ceo',
        requestedBy: 'usr_ceo',
        assignedTo: ['usr_ceo_sharif'],
        collaborators: [],
        sourceDepartmentId: 'dept_ceo',
        targetDepartmentId: 'dept_ceo',
        departmentId: 'dept_ceo',
        status: 'TODO',
        priority: 'MEDIUM',
        progress: 0,
        visibility: 'ORGANIZATION',
        startDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        checklist: [],
        tags: [],
        attachments: [],
        createdAt: '2026-10-12T05:02:27.262Z',
        updatedAt: new Date().toISOString()
      };
      this.tasks.push(recoveredHello);
      existingTaskIds.add(recoveredHello._id);
      console.log(`[DB] Auto-recovered task ${recoveredHello.taskId}: Hello for usr_ceo_sharif`);
    }

    this.projects.forEach(project => {
      project.departments = project.departments.map(departmentId => resolveDepartmentId(departmentId, departments) || departmentId);
    });

    this.documents.forEach(document => {
      document.departmentId = resolveDepartmentId(document.departmentId, departments);
    });
  }

  // ──────────────────────────────────────────────────────────
  // save() — persist in-memory state back to MongoDB
  //          Uses bulkWrite upsert so it's idempotent
  // ──────────────────────────────────────────────────────────
  // ──────────────────────────────────────────────────────────
  // clearAll() — wipe every collection in MongoDB
  // ──────────────────────────────────────────────────────────
  public async clearAll() {
    if (!this.isConnected) return;
    await Promise.all([
      UserModel.deleteMany({}),
      DeptModel.deleteMany({}),
      TaskModel.deleteMany({}),
      ReqModel.deleteMany({}),
      ProjectModel.deleteMany({}),
      CommentModel.deleteMany({}),
      NotiModel.deleteMany({}),
      LogModel.deleteMany({}),
      ApprovalModel.deleteMany({}),
      EventModel.deleteMany({}),
      AnnModel.deleteMany({}),
      DocModel.deleteMany({}),
      DirectMsgModel.deleteMany({}),
      LeaveModel.deleteMany({}),
    ]);
    // Clear in-memory too
    this.users = []; this.departments = []; this.tasks = [];
    this.taskRequests = []; this.projects = []; this.comments = [];
    this.notifications = []; this.activityLogs = []; this.approvals = [];
    this.events = []; this.announcements = []; this.documents = []; this.messages = []; this.leaves = [];
    console.log('[DB] All collections cleared.');
  }

  public async save() {
    if (!this.isConnected) return;

    try {
      await Promise.all([
        this._syncCollection(UserModel,     this.users,         '_id'),
        this._syncCollection(DeptModel,      this.departments,   '_id'),
        this._syncCollection(TaskModel,      this.tasks,         '_id'),
        this._syncCollection(ReqModel,       this.taskRequests,  '_id'),
        this._syncCollection(ProjectModel,   this.projects,      '_id'),
        this._syncCollection(CommentModel,   this.comments,      '_id'),
        this._syncCollection(NotiModel,      this.notifications, '_id'),
        this._syncCollection(LogModel,       this.activityLogs,  '_id'),
        this._syncCollection(ApprovalModel,  this.approvals,     '_id'),
        this._syncCollection(EventModel,     this.events,        '_id'),
        this._syncCollection(AnnModel,      this.announcements, '_id'),
        this._syncCollection(DocModel,      this.documents,     '_id'),
        this._syncCollection(DirectMsgModel, this.messages,     '_id'),
        this._syncCollection(LeaveModel,     this.leaves,       '_id'),
      ]);
    } catch (err) {
      console.error('[DB] Save error:', err);
    }
  }

  private async _syncCollection(model: mongoose.Model<any>, items: any[], keyField: string) {
    // 1. Delete documents from MongoDB Atlas that are no longer present in memory
    const currentIds = items.map(item => item[keyField]).filter(Boolean);
    if (currentIds.length > 0) {
      await model.deleteMany({ [keyField]: { $nin: currentIds } }).catch(() => {});
    }

    // 2. Upsert items in memory to MongoDB Atlas
    if (items.length > 0) {
      const ops = items.map(item => {
        let filter: any = { [keyField]: item[keyField] };
        if (model.modelName === 'Department' && item.code) {
          filter = { $or: [{ _id: item._id }, { code: item.code }] };
        } else if (model.modelName === 'User' && item.email) {
          filter = { $or: [{ _id: item._id }, { email: item.email.toLowerCase() }] };
        }
        return {
          updateOne: {
            filter,
            update: { $set: { ...item, passwordHash: item.password || item.passwordHash } },
            upsert: true,
          }
        };
      });
      try {
        await model.bulkWrite(ops, { ordered: false });
      } catch (err: any) {
        console.error(`[DB] bulkWrite error for ${model.modelName}:`, err?.message || err);
      }
    }
  }

  public async deleteTaskFromDb(taskId: string) {
    if (this.isConnected) {
      await TaskModel.deleteMany({ $or: [{ _id: taskId }, { taskId: taskId }] }).catch(() => {});
    }
    this.tasks = this.tasks.filter(t => t._id !== taskId && t.taskId !== taskId);
    await this.save();
  }

  public async deleteUserFromDb(userId: string) {
    if (this.isConnected) {
      await UserModel.deleteMany({ _id: userId }).catch(() => {});
    }
    this.users = this.users.filter(u => u._id !== userId);
    await this.save();
  }

  public async deleteDepartmentFromDb(deptId: string) {
    if (this.isConnected) {
      await DeptModel.deleteMany({ _id: deptId }).catch(() => {});
    }
    this.departments = this.departments.filter(d => d._id !== deptId);
    await this.save();
  }

  // ──────────────────────────────────────────────────────────
  // setRawData() — used by seedData.ts (legacy compat)
  // ──────────────────────────────────────────────────────────
  public setRawData(data: {
    users?: User[]; departments?: Department[]; tasks?: Task[];
    taskRequests?: TaskRequest[]; projects?: Project[];
    comments?: TaskComment[]; notifications?: Notification[];
    activityLogs?: ActivityLog[]; approvals?: Approval[];
    events?: EventItem[]; announcements?: Announcement[];
    documents?: OfficeDocument[]; leaves?: LeaveRequest[];
  }) {
    if (data.users)         this.users         = data.users;
    if (data.departments)   this.departments   = data.departments;
    if (data.tasks)         this.tasks         = data.tasks;
    if (data.taskRequests)  this.taskRequests  = data.taskRequests;
    if (data.projects)      this.projects      = data.projects;
    if (data.comments)      this.comments      = data.comments;
    if (data.notifications) this.notifications = data.notifications;
    if (data.activityLogs)  this.activityLogs  = data.activityLogs;
    if (data.approvals)     this.approvals     = data.approvals;
    if (data.events)        this.events        = data.events;
    if (data.announcements) this.announcements = data.announcements;
    if (data.documents)     this.documents     = data.documents;
    if (data.leaves)        this.leaves        = data.leaves;
    this.normalizeReferences();
    this.save(); // persist to MongoDB
  }

  // ──────────────────────────────────────────────────────────
  // ID generators — synchronous, calculates max numeric suffix to prevent duplicate keys
  // ──────────────────────────────────────────────────────────
  public getNextTaskId(): string {
    const existing = new Set(this.tasks.map(t => (t.taskId || '').toUpperCase()));
    let maxNum = 0;
    for (const t of this.tasks) {
      if (t.taskId) {
        const match = t.taskId.match(/(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
    }
    let nextNum = maxNum + 1;
    let candidate = `TASK-${String(nextNum).padStart(5, '0')}`;
    while (existing.has(candidate)) {
      nextNum++;
      candidate = `TASK-${String(nextNum).padStart(5, '0')}`;
    }
    return candidate;
  }

  public getNextLeaveId(): string {
    const existing = new Set(this.leaves.map(l => (l.leaveId || '').toUpperCase()));
    let maxNum = 0;
    for (const l of this.leaves) {
      if (l.leaveId) {
        const match = l.leaveId.match(/(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
    }
    let nextNum = maxNum + 1;
    let candidate = `LEV-${String(nextNum).padStart(5, '0')}`;
    while (existing.has(candidate)) {
      nextNum++;
      candidate = `LEV-${String(nextNum).padStart(5, '0')}`;
    }
    return candidate;
  }

  public getNextRequestId(): string {
    const existing = new Set(this.taskRequests.map(r => (r.requestId || '').toUpperCase()));
    let maxNum = 0;
    for (const r of this.taskRequests) {
      if (r.requestId) {
        const match = r.requestId.match(/(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
    }
    let nextNum = maxNum + 1;
    let candidate = `REQ-${String(nextNum).padStart(5, '0')}`;
    while (existing.has(candidate)) {
      nextNum++;
      candidate = `REQ-${String(nextNum).padStart(5, '0')}`;
    }
    return candidate;
  }

  public getNextProjectId(): string {
    const existing = new Set(this.projects.map(p => (p.projectId || '').toUpperCase()));
    let maxNum = 0;
    for (const p of this.projects) {
      if (p.projectId) {
        const match = p.projectId.match(/(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
    }
    let nextNum = maxNum + 1;
    let candidate = `PRJ-${String(nextNum).padStart(5, '0')}`;
    while (existing.has(candidate)) {
      nextNum++;
      candidate = `PRJ-${String(nextNum).padStart(5, '0')}`;
    }
    return candidate;
  }

  public generateId(prefix: string): string {
    return `${prefix}_${crypto.randomUUID().split('-')[0]}`;
  }

  public logActivity(params: {
    actorId: string;
    action: string;
    module: ActivityLog['module'];
    description: string;
    resourceType?: string;
    resourceId?: string;
    resourceName?: string;
    ipAddress?: string;
    metadata?: Record<string, any>;
  }): ActivityLog {
    const newLog: ActivityLog = {
      _id: this.generateId('act'),
      actorId: params.actorId || 'system',
      action: params.action,
      module: params.module || 'SYSTEM',
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      resourceName: params.resourceName,
      description: params.description,
      ipAddress: params.ipAddress || '127.0.0.1',
      metadata: params.metadata || {},
      createdAt: new Date().toISOString()
    };

    this.activityLogs.unshift(newLog);

    // Keep memory capped to max 5,000 entries
    if (this.activityLogs.length > 5000) {
      this.activityLogs = this.activityLogs.slice(0, 5000);
    }

    this.save().catch(err => console.error('[DB] logActivity Save Error:', err));
    return newLog;
  }

  public async disconnect() {
    if (!this.isConnected) return;
    await mongoose.disconnect();
    this.isConnected = false;
    console.log('[DB] MongoDB Disconnected');
  }
}

export const db = new DatabaseManager();
