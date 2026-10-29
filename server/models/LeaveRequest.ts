import mongoose, { Schema, Document } from 'mongoose';
import { LeaveType, LeaveStatus, LeaveStayAddress } from '../types';

export interface ILeaveRequest extends Document {
  leaveId: string;
  applicantId: string;
  applicantDepartmentId?: string;
  startDate: string;
  returnDate: string;
  daysCount: number;
  leaveType: LeaveType;
  leaveTypeName: string;
  reason: string;
  stayAddress: LeaveStayAddress;
  reliefUserId: string;
  reliefNote?: string;
  currentApproverId: string;
  currentApproverRole: 'DEPT_HEAD' | 'CEO';
  status: LeaveStatus;
  decisionReason?: string;
  referredAt?: string;
  referralNote?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: Date;
  updatedAt: Date;
}

const LeaveRequestSchema: Schema = new Schema(
  {
    leaveId: { type: String, required: true, unique: true },
    applicantId: { type: String, ref: 'User', required: true },
    applicantDepartmentId: { type: String, ref: 'Department' },
    startDate: { type: String, required: true },
    returnDate: { type: String, required: true },
    daysCount: { type: Number, required: true, default: 1 },
    leaveType: {
      type: String,
      enum: ['EARNED', 'CASUAL', 'SICK', 'MATERNITY', 'PATERNITY'],
      required: true
    },
    leaveTypeName: { type: String, required: true },
    reason: { type: String, required: true },
    stayAddress: {
      village: { type: String, required: true },
      postOffice: { type: String, required: true },
      thana: { type: String, required: true },
      upazila: { type: String, required: true },
      district: { type: String, required: true },
      emergencyContact: { type: String, required: true }
    },
    reliefUserId: { type: String, ref: 'User', required: true },
    reliefNote: { type: String },
    currentApproverId: { type: String, ref: 'User', required: true },
    currentApproverRole: {
      type: String,
      enum: ['DEPT_HEAD', 'CEO'],
      required: true
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'REFERRED_TO_CEO', 'CANCELLED'],
      default: 'PENDING'
    },
    decisionReason: { type: String },
    referredAt: { type: String },
    referralNote: { type: String },
    reviewedBy: { type: String, ref: 'User' },
    reviewedAt: { type: String }
  },
  {
    timestamps: true
  }
);

export const LeaveRequestModel = mongoose.model<ILeaveRequest>('LeaveRequest', LeaveRequestSchema);

