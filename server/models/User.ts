import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  employeeId: string;
  name: string;
  email: string;
  phone?: string;
  photo?: string;
  designation: string;
  departmentId: string;
  roleId: string;
  role: 'TRUSTEE' | 'CEO' | 'DEPT_HEAD' | 'DEPARTMENT_HEAD' | 'OFFICER' | 'ASSISTANT_OFFICER' | 'STAFF' | 'EMPLOYEE';
  passwordHash: string;
  status: 'ACTIVE' | 'INACTIVE';
  joiningDate?: Date;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    employeeId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String },
    photo: { type: String },
    designation: { type: String, required: true },
    departmentId: { type: String, required: true },
    roleId: { type: String },
    role: { 
      type: String, 
      enum: ['TRUSTEE', 'CEO', 'DEPT_HEAD', 'DEPARTMENT_HEAD', 'OFFICER', 'ASSISTANT_OFFICER', 'STAFF', 'EMPLOYEE'],
      default: 'EMPLOYEE'
    },
    passwordHash: { type: String, required: true },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
    joiningDate: { type: Date },
    lastLoginAt: { type: Date }
  },
  {
    timestamps: true
  }
);

export const User = mongoose.model<IUser>('User', UserSchema);
