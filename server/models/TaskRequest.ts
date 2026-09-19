import mongoose, { Schema, Document } from 'mongoose';

export interface ITaskRequest extends Document {
  requestId: string;
  requesterId: string;
  requesterDepartmentId: string;
  targetEmployeeId: string;
  targetDepartmentId: string;
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate: Date;
  attachments: any[]; // Similar to TaskAttachment
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CLARIFICATION_REQUIRED' | 'CONVERTED_TO_TASK' | 'CANCELLED';
  responseMessage?: string;
  clarificationComments?: Array<{
    userId: string;
    message: string;
    createdAt: Date;
  }>;
  convertedTaskId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TaskRequestSchema: Schema = new Schema(
  {
    requestId: { type: String, required: true, unique: true },
    requesterId: { type: String, ref: 'User', required: true },
    requesterDepartmentId: { type: String, ref: 'Department', required: true },
    targetEmployeeId: { type: String, ref: 'User', required: true },
    targetDepartmentId: { type: String, ref: 'Department', required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'MEDIUM'
    },
    dueDate: { type: Date, required: true },
    attachments: [{ type: Schema.Types.Mixed }], // Simplify for now
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'CLARIFICATION_REQUIRED', 'CONVERTED_TO_TASK', 'CANCELLED'],
      default: 'PENDING'
    },
    responseMessage: { type: String },
    clarificationComments: [
      {
        userId: { type: String, ref: 'User' },
        message: { type: String },
        createdAt: { type: Date, default: Date.now }
      }
    ],
    convertedTaskId: { type: String, ref: 'Task' }
  },
  {
    timestamps: true
  }
);

export const TaskRequest = mongoose.model<ITaskRequest>('TaskRequest', TaskRequestSchema);
