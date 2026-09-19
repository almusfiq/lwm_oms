import mongoose, { Schema, Document } from 'mongoose';

export interface IDepartment extends Document {
  code: string;
  name: { en: string; bn: string };
  description?: string;
  headId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DepartmentSchema: Schema = new Schema(
  {
    code: { type: String, required: true, unique: true },
    name: {
      en: { type: String, required: true },
      bn: { type: String, required: true }
    },
    description: { type: String },
    headId: { type: String, ref: 'User' },
    isActive: { type: Boolean, default: true }
  },
  {
    timestamps: true
  }
);

export const Department = mongoose.model<IDepartment>('Department', DepartmentSchema);
