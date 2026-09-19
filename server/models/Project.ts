import mongoose, { Schema, Document } from 'mongoose';

export interface IProject extends Document {
  projectId: string;
  name: string;
  description: string;
  managerId: string;
  departments: string[];
  members: string[];
  status: 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  startDate: Date;
  deadline: Date;
  progress: number;
  milestones: any[];
  attachments: any[];
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema: Schema = new Schema(
  {
    projectId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    managerId: { type: String, ref: 'User', required: true },
    departments: [{ type: String, ref: 'Department' }],
    members: [{ type: String, ref: 'User' }],
    status: {
      type: String,
      enum: ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'],
      default: 'PLANNING'
    },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'MEDIUM'
    },
    startDate: { type: Date, required: true },
    deadline: { type: Date, required: true },
    progress: { type: Number, default: 0 },
    milestones: [{ type: Schema.Types.Mixed }],
    attachments: [{ type: Schema.Types.Mixed }]
  },
  {
    timestamps: true
  }
);

export const Project = mongoose.model<IProject>('Project', ProjectSchema);
