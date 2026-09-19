import mongoose, { Schema, Document } from 'mongoose';

export interface ITaskChecklistItem {
  _id?: string;
  title: string;
  completed: boolean;
  completedBy?: string;
  completedAt?: Date;
}

export interface ITaskAttachment {
  _id?: string;
  name: string;
  size: number;
  type: string;
  url: string;
  uploadedBy: string;
  uploadedAt: Date;
}

export interface ITask extends Document {
  taskId: string;
  title: string;
  description: string;
  createdBy: string;
  requestedBy?: string;
  assignedTo: string[];
  collaborators: string[];
  sourceDepartmentId?: string;
  targetDepartmentId?: string;
  departmentId: string;
  projectId?: string;
  parentTaskId?: string;
  status: 'TODO' | 'ACCEPTED' | 'IN_PROGRESS' | 'ON_HOLD' | 'IN_REVIEW' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  progress: number;
  visibility: 'PRIVATE' | 'DEPARTMENT' | 'PROJECT' | 'COLLABORATORS' | 'ORGANIZATION';
  startDate?: Date;
  dueDate: Date;
  completedAt?: Date;
  checklist: ITaskChecklistItem[];
  tags: string[];
  attachments: ITaskAttachment[];
  requiresApproval?: boolean;
  approvalStatus?: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';
  relatedRequestId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TaskChecklistSchema = new Schema({
  title: { type: String, required: true },
  completed: { type: Boolean, default: false },
  completedBy: { type: String, ref: 'User' },
  completedAt: { type: Date }
});

const TaskAttachmentSchema = new Schema({
  name: { type: String, required: true },
  size: { type: Number, required: true },
  type: { type: String, required: true },
  url: { type: String, required: true },
  uploadedBy: { type: String, ref: 'User', required: true },
  uploadedAt: { type: Date, default: Date.now }
});

const TaskSchema: Schema = new Schema(
  {
    taskId: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    createdBy: { type: String, ref: 'User', required: true },
    requestedBy: { type: String, ref: 'User' },
    assignedTo: [{ type: String, ref: 'User' }],
    collaborators: [{ type: String, ref: 'User' }],
    sourceDepartmentId: { type: String, ref: 'Department' },
    targetDepartmentId: { type: String, ref: 'Department' },
    departmentId: { type: String, ref: 'Department', required: true },
    projectId: { type: String, ref: 'Project' },
    parentTaskId: { type: String, ref: 'Task' },
    status: {
      type: String,
      enum: ['TODO', 'ACCEPTED', 'IN_PROGRESS', 'ON_HOLD', 'IN_REVIEW', 'COMPLETED', 'REJECTED', 'CANCELLED'],
      default: 'TODO'
    },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'MEDIUM'
    },
    progress: { type: Number, default: 0 },
    visibility: {
      type: String,
      enum: ['PRIVATE', 'DEPARTMENT', 'PROJECT', 'COLLABORATORS', 'ORGANIZATION'],
      default: 'DEPARTMENT'
    },
    startDate: { type: Date },
    dueDate: { type: Date, required: true },
    completedAt: { type: Date },
    checklist: [TaskChecklistSchema],
    tags: [{ type: String }],
    attachments: [TaskAttachmentSchema],
    requiresApproval: { type: Boolean, default: false },
    approvalStatus: {
      type: String,
      enum: ['NONE', 'PENDING', 'APPROVED', 'REJECTED'],
      default: 'NONE'
    },
    relatedRequestId: { type: String, ref: 'TaskRequest' }
  },
  {
    timestamps: true
  }
);

export const Task = mongoose.model<ITask>('Task', TaskSchema);
