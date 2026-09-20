import crypto from 'crypto';
import mongoose from 'mongoose';
import {
  User, Department, Task, TaskRequest, Project,
  TaskComment, Notification, ActivityLog, Approval,
  EventItem, Announcement, OfficeDocument
} from './types';

// Environment variable for MongoDB URI
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lwm-oms';

// ============================================================
// Mongoose models (inline schemas for full flexibility)
// ============================================================

const Mixed = mongoose.Schema.Types.Mixed;
const S = (fields: Record<string, any>) => new mongoose.Schema({ _id: Mixed, ...fields }, { strict: false, timestamps: true });

const LEGACY_DEPARTMENT_IDS: Record<string, string> = {
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

const UserModel     = model<User>      ('User',         { employeeId: String, email: { type: String, unique: true }, passwordHash: String });
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
    const [users, depts, tasks, reqs, projects, comments, notis, logs, approvals, events, anns, docs] =
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
    });

    this.taskRequests.forEach(request => {
      request.requesterDepartmentId = resolveDepartmentId(request.requesterDepartmentId, departments) || 'dept_admin';
      request.targetDepartmentId = resolveDepartmentId(request.targetDepartmentId, departments) || 'dept_admin';
    });

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
    ]);
    // Clear in-memory too
    this.users = []; this.departments = []; this.tasks = [];
    this.taskRequests = []; this.projects = []; this.comments = [];
    this.notifications = []; this.activityLogs = []; this.approvals = [];
    this.events = []; this.announcements = []; this.documents = [];
    console.log('[DB] All collections cleared.');
  }

  public async save() {
    if (!this.isConnected) return;

    try {
      await Promise.all([
        this._upsertMany(UserModel,     this.users,         '_id'),
        this._upsertMany(DeptModel,     this.departments,   '_id'),
        this._upsertMany(TaskModel,     this.tasks,         '_id'),
        this._upsertMany(ReqModel,      this.taskRequests,  '_id'),
        this._upsertMany(ProjectModel,  this.projects,      '_id'),
        this._upsertMany(CommentModel,  this.comments,      '_id'),
        this._upsertMany(NotiModel,     this.notifications, '_id'),
        this._upsertMany(LogModel,      this.activityLogs,  '_id'),
        this._upsertMany(ApprovalModel, this.approvals,     '_id'),
        this._upsertMany(EventModel,    this.events,        '_id'),
        this._upsertMany(AnnModel,      this.announcements, '_id'),
        this._upsertMany(DocModel,      this.documents,     '_id'),
      ]);
    } catch (err) {
      console.error('[DB] Save error:', err);
    }
  }

  private async _upsertMany(model: mongoose.Model<any>, items: any[], keyField: string) {
    if (!items.length) return;
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
    } catch {
      // Ignore bulk write duplicate index warnings
    }
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
    documents?: OfficeDocument[];
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
    this.normalizeReferences();
    this.save(); // persist to MongoDB
  }

  // ──────────────────────────────────────────────────────────
  // ID generators — synchronous, use in-memory array lengths
  // ──────────────────────────────────────────────────────────
  public getNextTaskId(): string {
    return `TASK-${String(this.tasks.length + 1).padStart(5, '0')}`;
  }

  public getNextRequestId(): string {
    return `REQ-${String(this.taskRequests.length + 1).padStart(5, '0')}`;
  }

  public getNextProjectId(): string {
    return `PRJ-${String(this.projects.length + 1).padStart(5, '0')}`;
  }

  public generateId(prefix: string): string {
    return `${prefix}_${crypto.randomUUID().split('-')[0]}`;
  }

  public async disconnect() {
    if (!this.isConnected) return;
    await mongoose.disconnect();
    this.isConnected = false;
    console.log('[DB] MongoDB Disconnected');
  }
}

export const db = new DatabaseManager();
