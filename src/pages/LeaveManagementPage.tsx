import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/common/Modal';
import { UserAvatar } from '../components/common/UserAvatar';
import { EmployeeSelector } from '../components/common/EmployeeSelector';
import { getUserRole, isDepartmentHead } from '../utils/hierarchy';
import {
  CalendarOff, Plus, CheckCircle2, XCircle, ArrowUpRight,
  Clock, MapPin, Phone, UserCheck, Shield, AlertCircle,
  FileText, History, Check, X, Search, Filter, RefreshCw,
  Building2, Calendar, ChevronRight, Info, HeartPulse,
  Baby, Sparkles
} from 'lucide-react';
import { LeaveRequest, LeaveType, LeaveStatus } from '../types';

export const BANGLADESH_DISTRICTS = [
  'Bagerhat', 'Bandarban', 'Barguna', 'Barishal', 'Bhola', 'Bogura', 'Brahmanbaria', 'Chandpur',
  'Chattogram', 'Chuadanga', 'Cox\'s Bazar', 'Cumilla', 'Dhaka', 'Dinajpur', 'Faridpur', 'Feni',
  'Gaibandha', 'Gazipur', 'Gopalganj', 'Habiganj', 'Jamalpur', 'Jashore', 'Jhalokathi', 'Jhenaidah',
  'Joypurhat', 'Khagrachhari', 'Khulna', 'Kishoreganj', 'Kurigram', 'Kushtia', 'Lakshmipur', 'Lalmonirhat',
  'Madaripur', 'Magura', 'Manikganj', 'Meherpur', 'Moulvibazar', 'Munshiganj', 'Mymensingh', 'Naogaon',
  'Narail', 'Narayanganj', 'Narsingdi', 'Natore', 'Netrokona', 'Nilphamari', 'Noakhali', 'Pabna',
  'Panchagarh', 'Patuakhali', 'Pirojpur', 'Rajbari', 'Rajshahi', 'Rangamati', 'Rangpur', 'Satkhira',
  'Shariatpur', 'Sherpur', 'Sirajganj', 'Sunamganj', 'Sylhet', 'Tangail', 'Thakurgaon'
];

export const LEAVE_TYPE_CONFIG: Record<LeaveType, {
  name: string;
  desc: string;
  color: string;
  badgeBg: string;
  badgeText: string;
  icon: any;
}> = {
  EARNED: {
    name: 'Earned Leave',
    desc: 'Annual accrued leave',
    color: 'border-indigo-500 text-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-300',
    badgeBg: 'bg-indigo-100 dark:bg-indigo-900/60',
    badgeText: 'text-indigo-800 dark:text-indigo-300',
    icon: Sparkles
  },
  CASUAL: {
    name: 'Casual Leave',
    desc: 'Short-term urgent leave',
    color: 'border-sky-500 text-sky-700 bg-sky-50 dark:bg-sky-950/40 dark:text-sky-300',
    badgeBg: 'bg-sky-100 dark:bg-sky-900/60',
    badgeText: 'text-sky-800 dark:text-sky-300',
    icon: Calendar
  },
  SICK: {
    name: 'Medical Leave',
    desc: 'Health and recovery leave',
    color: 'border-amber-500 text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300',
    badgeBg: 'bg-amber-100 dark:bg-amber-900/60',
    badgeText: 'text-amber-800 dark:text-amber-300',
    icon: HeartPulse
  },
  MATERNITY: {
    name: 'Maternity Leave',
    desc: 'Childbirth and newborn care',
    color: 'border-pink-500 text-pink-700 bg-pink-50 dark:bg-pink-950/40 dark:text-pink-300',
    badgeBg: 'bg-pink-100 dark:bg-pink-900/60',
    badgeText: 'text-pink-800 dark:text-pink-300',
    icon: Baby
  },
  PATERNITY: {
    name: 'Paternity Leave',
    desc: 'Family support and newborn care',
    color: 'border-teal-500 text-teal-700 bg-teal-50 dark:bg-teal-950/40 dark:text-teal-300',
    badgeBg: 'bg-teal-100 dark:bg-teal-900/60',
    badgeText: 'text-teal-800 dark:text-teal-300',
    icon: UserCheck
  }
};

export const LEAVE_STATUS_CONFIG: Record<LeaveStatus | string, {
  label: string;
  bg: string;
  text: string;
  dot: string;
}> = {
  PENDING: {
    label: 'Pending Review',
    bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60',
    text: 'text-amber-800 dark:text-amber-300',
    dot: 'bg-amber-500'
  },
  APPROVED: {
    label: 'Approved',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60',
    text: 'text-emerald-800 dark:text-emerald-300',
    dot: 'bg-emerald-500'
  },
  REJECTED: {
    label: 'Rejected',
    bg: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60',
    text: 'text-rose-800 dark:text-rose-300',
    dot: 'bg-rose-500'
  },
  REFERRED_TO_CEO: {
    label: 'Referred to CEO',
    bg: 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800/60',
    text: 'text-purple-800 dark:text-purple-300',
    dot: 'bg-purple-500 animate-pulse'
  },
  CANCELLED: {
    label: 'Cancelled',
    bg: 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
    text: 'text-slate-600 dark:text-slate-400',
    dot: 'bg-slate-400'
  }
};

export const LeaveManagementPage: React.FC = () => {
  const { user } = useAuth();
  const role = getUserRole(user);
  const isTrustee = role === 'TRUSTEE';
  const isCEO = role === 'CEO';
  const isDeptHead = isDepartmentHead(user);
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const canApprove = isDeptHead || isCEO || isTrustee || isSuperAdmin;

  // Tabs: 'mine' (My Applications) | 'pending' (Pending Approvals) | 'roster' (Department/All Roster)
  const [activeTab, setActiveTab] = useState<'mine' | 'pending' | 'roster'>('mine');

  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [stats, setStats] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Apply Modal state
  const [showApplyModal, setShowApplyModal] = useState<boolean>(false);
  const [applyLeaveType, setApplyLeaveType] = useState<LeaveType>('CASUAL');
  const [applyStartDate, setApplyStartDate] = useState<string>('');
  const [applyReturnDate, setApplyReturnDate] = useState<string>('');
  const [applyReason, setApplyReason] = useState<string>('');
  const [applyVillage, setApplyVillage] = useState<string>('');
  const [applyPostOffice, setApplyPostOffice] = useState<string>('');
  const [applyThana, setApplyThana] = useState<string>('');
  const [applyUpazila, setApplyUpazila] = useState<string>('');
  const [applyDistrict, setApplyDistrict] = useState<string>('Dhaka');
  const [applyEmergencyContact, setApplyEmergencyContact] = useState<string>(user?.phone || '');
  const [applyReliefUserId, setApplyReliefUserId] = useState<string>('');
  const [applyReliefNote, setApplyReliefNote] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [applyError, setApplyError] = useState<string>('');

  // Review & Details Modal state
  const [selectedLeaveId, setSelectedLeaveId] = useState<string | null>(null);
  const [detailedLeave, setDetailedLeave] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [actionReason, setActionReason] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [actionModalType, setActionModalType] = useState<'APPROVE' | 'REJECT' | 'REFER' | null>(null);

  // Calculate live days count for application modal
  const calculatedDays = useMemo(() => {
    if (!applyStartDate || !applyReturnDate) return 0;
    try {
      const start = new Date(applyStartDate);
      const end = new Date(applyReturnDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
      const diff = end.getTime() - start.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
      return days > 0 ? days : 0;
    } catch {
      return 0;
    }
  }, [applyStartDate, applyReturnDate]);

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      let viewParam = 'mine';
      if (activeTab === 'pending') {
        viewParam = 'pending_approval';
      } else if (activeTab === 'roster') {
        viewParam = isCEO || isTrustee || isSuperAdmin ? 'all' : 'department';
      }

      const params: any = { view: viewParam };
      if (statusFilter !== 'ALL') params.status = statusFilter;

      const [dataRes, statsRes] = await Promise.all([
        api.leaves.list(params),
        api.leaves.getStats()
      ]);

      setLeaves(dataRes || []);
      setStats(statsRes?.myStats || null);
    } catch (err) {
      console.error('Failed to load leaves:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, [activeTab, statusFilter]);

  // Load single leave details + applicant previous leave history
  const openLeaveDetail = async (leaveId: string) => {
    setSelectedLeaveId(leaveId);
    setDetailLoading(true);
    try {
      const res = await api.leaves.get(leaveId);
      setDetailedLeave(res);
    } catch (err) {
      console.error('Failed to load leave detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApplyError('');

    if (!applyStartDate || !applyReturnDate) {
      setApplyError('Please select both the Leave Start Date and the Return Date.');
      return;
    }

    if (calculatedDays <= 0) {
      setApplyError('Return date must be on or after the leave start date.');
      return;
    }

    if (!applyReason.trim()) {
      setApplyError('Please provide the reason for your leave.');
      return;
    }

    if (!applyVillage || !applyPostOffice || !applyThana || !applyUpazila || !applyDistrict || !applyEmergencyContact) {
      setApplyError('Please provide complete staying address details and an emergency contact number.');
      return;
    }

    if (!applyReliefUserId) {
      setApplyError('Please select a colleague who will cover your duties while on leave.');
      return;
    }

    setSubmitting(true);
    try {
      await api.leaves.create({
        startDate: applyStartDate,
        returnDate: applyReturnDate,
        leaveType: applyLeaveType,
        reason: applyReason,
        stayAddress: {
          village: applyVillage,
          postOffice: applyPostOffice,
          thana: applyThana,
          upazila: applyUpazila,
          district: applyDistrict,
          emergencyContact: applyEmergencyContact
        },
        reliefUserId: applyReliefUserId,
        reliefNote: applyReliefNote
      });

      setShowApplyModal(false);
      resetApplyForm();
      fetchLeaves();
    } catch (err: any) {
      setApplyError(err.message || 'Failed to submit leave application.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetApplyForm = () => {
    setApplyLeaveType('CASUAL');
    setApplyStartDate('');
    setApplyReturnDate('');
    setApplyReason('');
    setApplyVillage('');
    setApplyPostOffice('');
    setApplyThana('');
    setApplyUpazila('');
    setApplyDistrict('Dhaka');
    setApplyEmergencyContact(user?.phone || '');
    setApplyReliefUserId('');
    setApplyReliefNote('');
    setApplyError('');
  };

  const handleExecuteAction = async () => {
    if (!detailedLeave || !actionModalType) return;
    setActionLoading(true);
    try {
      if (actionModalType === 'APPROVE') {
        await api.leaves.approve(detailedLeave._id, actionReason);
      } else if (actionModalType === 'REJECT') {
        if (!actionReason.trim()) {
          alert('A reason is required to reject a leave application.');
          setActionLoading(false);
          return;
        }
        await api.leaves.reject(detailedLeave._id, actionReason);
      } else if (actionModalType === 'REFER') {
        await api.leaves.refer(detailedLeave._id, actionReason);
      }

      setActionModalType(null);
      setActionReason('');
      setSelectedLeaveId(null);
      setDetailedLeave(null);
      fetchLeaves();
    } catch (err: any) {
      alert(err.message || 'Action could not be completed.');
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered list
  const filteredLeaves = useMemo(() => {
    return leaves.filter(l => {
      if (typeFilter !== 'ALL' && l.leaveType !== typeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const applicantName = (l.applicant?.name?.en || l.applicant?.name?.bn || '').toLowerCase();
        const code = (l.leaveId || '').toLowerCase();
        const reason = (l.reason || '').toLowerCase();
        const dept = (l.department?.name?.en || l.department?.name?.bn || '').toLowerCase();
        return applicantName.includes(q) || code.includes(q) || reason.includes(q) || dept.includes(q);
      }
      return true;
    });
  }, [leaves, typeFilter, searchQuery]);

  // Routing preview message for application modal
  const routingPreview = useMemo(() => {
    if (isDeptHead || isCEO) {
      return {
        target: 'Director General / CEO',
        desc: 'As a department leader, your leave request will route directly to the Director General / CEO for approval.'
      };
    }
    return {
      target: 'Department Head',
      desc: 'Your request will be submitted to your Department Head for review and decision, who can also refer to the CEO if required.'
    };
  }, [isDeptHead, isCEO]);

  // Helper to get clean English type label
  const getLeaveTypeLabel = (typeKey: LeaveType | string, fallbackName?: string) => {
    const conf = LEAVE_TYPE_CONFIG[typeKey as LeaveType];
    return conf?.name || fallbackName || 'Leave';
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 bg-red-800/10 dark:bg-red-800/20 text-red-800 dark:text-red-400 rounded-xl">
              <CalendarOff className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
                  Leave Management
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300">
                  Staff Leave Portal
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Apply for leaves, track prior service entitlements, and manage departmental approval workflows
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={fetchLeaves}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => {
              resetApplyForm();
              setShowApplyModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold text-white bg-red-800 hover:bg-red-900 active:scale-98 rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Apply for Leave</span>
          </button>
        </div>
      </div>

      {/* Metrics Cards: User Leave Counts & Breakdown */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          {/* Total Leaves */}
          <div className="col-span-1 p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Approved Leaves</span>
            <div className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">
              {stats.totalLeavesTaken} <span className="text-xs font-normal text-slate-400">times</span>
            </div>
            <span className="text-[10px] text-slate-400">Total Approved</span>
          </div>

          {/* Total Days */}
          <div className="col-span-1 p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Leave Days</span>
            <div className="text-xl sm:text-2xl font-extrabold text-red-800 dark:text-red-400 mt-1">
              {stats.totalDaysTaken} <span className="text-xs font-normal text-slate-400">days</span>
            </div>
            <span className="text-[10px] text-slate-400">Days Taken</span>
          </div>

          {/* 5 Leave Type Counts */}
          {(Object.keys(LEAVE_TYPE_CONFIG) as LeaveType[]).map(typeKey => {
            const conf = LEAVE_TYPE_CONFIG[typeKey];
            const data = stats.typeBreakdown?.[typeKey] || { count: 0, days: 0 };
            return (
              <div
                key={typeKey}
                className="col-span-1 p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs flex flex-col justify-between"
              >
                <div>
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate block">
                    {conf.name}
                  </span>
                  <span className="text-[10px] text-slate-400 block truncate">{conf.desc}</span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {data.days} <span className="text-[10px] font-normal text-slate-400">days</span>
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                    {data.count}x
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Main Tabs Navigation */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          {/* Tab 1: My Leaves */}
          <button
            type="button"
            onClick={() => setActiveTab('mine')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'mine'
                ? 'bg-red-800 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>My Applications</span>
          </button>

          {/* Tab 2: Pending Approvals (For Dept Head, CEO, Trustees) */}
          {canApprove && (
            <button
              type="button"
              onClick={() => setActiveTab('pending')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'pending'
                  ? 'bg-red-800 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Pending Approvals</span>
            </button>
          )}

          {/* Tab 3: Department / All Leave Roster */}
          {canApprove && (
            <button
              type="button"
              onClick={() => setActiveTab('roster')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'roster'
                  ? 'bg-red-800 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <History className="w-4 h-4" />
              <span>{isCEO || isTrustee || isSuperAdmin ? 'All Museum Leaves' : 'Department Leave Roster'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters & Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
        {/* Search */}
        <div className="md:col-span-5 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by applicant, leave ID, or reason..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-red-500 text-slate-900 dark:text-slate-100"
          />
        </div>

        {/* Leave Type Filter */}
        <div className="md:col-span-4">
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-red-500"
          >
            <option value="ALL">All Leave Types</option>
            <option value="EARNED">Earned Leave</option>
            <option value="CASUAL">Casual Leave</option>
            <option value="SICK">Medical Leave</option>
            <option value="MATERNITY">Maternity Leave</option>
            <option value="PATERNITY">Paternity Leave</option>
          </select>
        </div>

        {/* Status Filter */}
        <div className="md:col-span-3">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-red-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending Review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="REFERRED_TO_CEO">Referred to CEO</option>
          </select>
        </div>
      </div>

      {/* Leave Requests List */}
      {loading ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <RefreshCw className="w-8 h-8 mx-auto animate-spin text-red-800 dark:text-red-400 mb-2" />
          <p className="text-xs font-semibold text-slate-500">Loading leave applications...</p>
        </div>
      ) : filteredLeaves.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
          <CalendarOff className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">No leave applications found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {activeTab === 'pending'
              ? 'There are currently no leave requests awaiting your review.'
              : 'You have not submitted any leave applications under this filter.'}
          </p>
          {activeTab === 'mine' && (
            <button
              type="button"
              onClick={() => {
                resetApplyForm();
                setShowApplyModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-red-800 hover:bg-red-900 rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Apply for Leave</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLeaves.map(leave => {
            const typeConf = LEAVE_TYPE_CONFIG[leave.leaveType] || LEAVE_TYPE_CONFIG.CASUAL;
            const statusConf = LEAVE_STATUS_CONFIG[leave.status] || LEAVE_STATUS_CONFIG.PENDING;
            const displayTypeName = getLeaveTypeLabel(leave.leaveType, leave.leaveTypeName);

            return (
              <div
                key={leave._id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:border-red-800/40 dark:hover:border-red-800/40 transition-all space-y-4"
              >
                {/* Header row: Applicant + Leave Type + Status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      photo={leave.applicant?.photo}
                      name={leave.applicant?.name?.en || 'Applicant'}
                      size="md"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          {leave.applicant?.name?.en || 'Employee'}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                          {leave.leaveId}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        <span>{leave.applicant?.designation?.en || 'Staff Member'}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          <span>{leave.department?.name?.en || 'Liberation War Museum'}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Leave Type Pill */}
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border ${typeConf.color}`}>
                      <typeConf.icon className="w-3.5 h-3.5" />
                      <span>{displayTypeName}</span>
                    </span>

                    {/* Status Pill */}
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border ${statusConf.bg} ${statusConf.text}`}>
                      <span className={`w-2 h-2 rounded-full ${statusConf.dot}`} />
                      <span>{statusConf.label}</span>
                    </span>
                  </div>
                </div>

                {/* Body Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50/60 dark:bg-slate-800/30 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-800/60 text-xs">
                  {/* Period */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Duration</span>
                    <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-red-800 dark:text-red-400 shrink-0" />
                      <span>{leave.startDate} to {leave.returnDate}</span>
                    </div>
                    <span className="text-[11px] font-bold text-red-800 dark:text-red-400 mt-0.5 inline-block">
                      {leave.daysCount} Calendar Day{leave.daysCount > 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Reliever */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Duty Handover</span>
                    <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{leave.reliefUser?.name?.en || 'Nominated Colleague'}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 truncate block">
                      {leave.reliefUser?.designation?.en || 'Reliever'}
                    </span>
                  </div>

                  {/* Staying Address */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Stay Address</span>
                    <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 flex items-center gap-1 truncate">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">
                        {leave.stayAddress?.village}, {leave.stayAddress?.upazila}, {leave.stayAddress?.district}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 block truncate">
                      Post: {leave.stayAddress?.postOffice}, Thana: {leave.stayAddress?.thana}
                    </span>
                  </div>

                  {/* Emergency Contact */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Emergency Contact</span>
                    <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span className="font-mono">{leave.stayAddress?.emergencyContact}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 block">
                      Submitted: {leave.createdAt?.slice(0, 10)}
                    </span>
                  </div>
                </div>

                {/* Reason & Remarks */}
                <div className="text-xs text-slate-700 dark:text-slate-300">
                  <span className="font-bold text-slate-900 dark:text-slate-100">Reason: </span>
                  <span>{leave.reason}</span>
                </div>

                {leave.decisionReason && (
                  <div className="text-xs p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                    <span className="font-bold">Authority Remarks: </span>
                    <span>{leave.decisionReason}</span>
                  </div>
                )}

                {leave.referralNote && (
                  <div className="text-xs p-2.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-300">
                    <span className="font-bold">Referral Note to CEO: </span>
                    <span>{leave.referralNote}</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="text-[11px] text-slate-400">
                    {leave.status === 'PENDING' && (
                      <span>Awaiting Decision: {leave.currentApproverRole === 'CEO' ? 'Director General (CEO)' : 'Department Head'}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openLeaveDetail(leave._id)}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>{canApprove ? 'Review & History' : 'View Application'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ======================================================= */}
      {/* APPLY FOR LEAVE MODAL (WIDE 4XL LAYOUT - NO SCROLL)     */}
      {/* ======================================================= */}
      {showApplyModal && (
        <Modal
          isOpen={showApplyModal}
          onClose={() => setShowApplyModal(false)}
          title="Apply for Leave"
          subtitle="Submit formal leave application with travel destination and handover plan"
          maxWidth="4xl"
        >
          <form onSubmit={handleApplySubmit} className="space-y-4">
            {applyError && (
              <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{applyError}</span>
              </div>
            )}

            {/* Routing Alert - Compact 1 line */}
            <div className="px-3 py-2 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-blue-800 dark:text-blue-300 text-xs flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0 text-blue-600" />
              <span>
                <span className="font-bold">Approval Routing:</span> {routingPreview.desc}
              </span>
            </div>

            {/* 1. Leave Type (5 options in horizontal 5-column grid) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Leave Type <span className="text-red-600">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {(Object.keys(LEAVE_TYPE_CONFIG) as LeaveType[]).map(typeKey => {
                  const conf = LEAVE_TYPE_CONFIG[typeKey];
                  const isSelected = applyLeaveType === typeKey;
                  return (
                    <button
                      type="button"
                      key={typeKey}
                      onClick={() => setApplyLeaveType(typeKey)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? `${conf.color} ring-2 ring-red-800/40 shadow-xs font-bold`
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <conf.icon className="w-4 h-4 text-red-800 dark:text-red-400" />
                        {isSelected && <Check className="w-3.5 h-3.5 text-red-800 dark:text-red-400" />}
                      </div>
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                        {conf.name}
                      </span>
                      <span className="text-[10px] text-slate-400 line-clamp-1">{conf.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2-Column Split: Left = Schedule & Reason, Right = Stay Address & Reliever */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Left Column: Schedule & Reason */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Leave Start Date <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="date"
                      value={applyStartDate}
                      onChange={e => setApplyStartDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-red-500 text-slate-900 dark:text-slate-100"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Return Date <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="date"
                      value={applyReturnDate}
                      min={applyStartDate}
                      onChange={e => setApplyReturnDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-red-500 text-slate-900 dark:text-slate-100"
                      required
                    />
                  </div>
                </div>

                {calculatedDays > 0 && (
                  <div className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between">
                    <span>Duration:</span>
                    <span>{calculatedDays} Day{calculatedDays > 1 ? 's' : ''} ({applyStartDate} to {applyReturnDate})</span>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Reason for Leave <span className="text-red-600">*</span>
                  </label>
                  <textarea
                    rows={4}
                    value={applyReason}
                    onChange={e => setApplyReason(e.target.value)}
                    placeholder="Specify the reason for taking leave..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-red-500 text-slate-900 dark:text-slate-100 resize-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Emergency Phone <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="tel"
                    value={applyEmergencyContact}
                    onChange={e => setApplyEmergencyContact(e.target.value)}
                    placeholder="+880 17XX-XXXXXX"
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-mono"
                    required
                  />
                </div>
              </div>

              {/* Right Column: Staying Address & Reliever */}
              <div className="space-y-3">
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50/40 dark:bg-slate-800/20 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                    <MapPin className="w-3.5 h-3.5 text-red-800 dark:text-red-400" />
                    <span>Destination / Staying Address</span>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">
                      Village / House / Road <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={applyVillage}
                      onChange={e => setApplyVillage(e.target.value)}
                      placeholder="e.g. House 12, Road 4, Sector 7"
                      className="w-full px-2.5 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">
                        Post Office <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        value={applyPostOffice}
                        onChange={e => setApplyPostOffice(e.target.value)}
                        placeholder="e.g. Uttara"
                        className="w-full px-2.5 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">
                        Thana <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        value={applyThana}
                        onChange={e => setApplyThana(e.target.value)}
                        placeholder="e.g. Uttara East"
                        className="w-full px-2.5 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">
                        Upazila <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        value={applyUpazila}
                        onChange={e => setApplyUpazila(e.target.value)}
                        placeholder="e.g. Dhaka North"
                        className="w-full px-2.5 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">
                        District <span className="text-red-600">*</span>
                      </label>
                      <select
                        value={applyDistrict}
                        onChange={e => setApplyDistrict(e.target.value)}
                        className="w-full px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                        required
                      >
                        {BANGLADESH_DISTRICTS.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Reliever Employee */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    Nominated Duty Reliever <span className="text-red-600">*</span>
                  </label>
                  <EmployeeSelector
                    value={applyReliefUserId}
                    onChange={userId => setApplyReliefUserId(userId)}
                    placeholder="Select colleague who will handle your responsibilities..."
                    excludeUserIds={[user?._id || '']}
                    required
                  />
                  <input
                    type="text"
                    value={applyReliefNote}
                    onChange={e => setApplyReliefNote(e.target.value)}
                    placeholder="Handover instructions or notes (optional)..."
                    className="w-full px-2.5 py-1 text-xs bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>

            {/* Modal Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowApplyModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 text-xs font-bold text-white bg-red-800 hover:bg-red-900 disabled:opacity-50 rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Submit Leave Application</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ======================================================= */}
      {/* REVIEW & HISTORY MODAL (WIDE 5XL SPLIT - NO SCROLL)     */}
      {/* ======================================================= */}
      {selectedLeaveId && (
        <Modal
          isOpen={!!selectedLeaveId}
          onClose={() => {
            setSelectedLeaveId(null);
            setDetailedLeave(null);
            setActionModalType(null);
          }}
          title="Leave Application Review"
          subtitle={detailedLeave ? `${detailedLeave.leaveId} • ${detailedLeave.applicant?.name?.en || 'Applicant'}` : 'Loading...'}
          maxWidth="5xl"
        >
          {detailLoading || !detailedLeave ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-8 h-8 mx-auto animate-spin text-red-800 dark:text-red-400 mb-2" />
              <p className="text-xs font-semibold text-slate-500">Loading leave details and applicant history...</p>
            </div>
          ) : (
            <div className="space-y-4">
              
              {/* Applicant Header Card */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <UserAvatar
                    photo={detailedLeave.applicant?.photo}
                    name={detailedLeave.applicant?.name?.en || 'Applicant'}
                    size="md"
                  />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {detailedLeave.applicant?.name?.en || 'Employee'}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {detailedLeave.applicant?.designation?.en || 'Staff'} • {detailedLeave.department?.name?.en || 'Liberation War Museum'}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                      <span>ID: {detailedLeave.applicant?.employeeId || 'N/A'}</span>
                      <span>•</span>
                      <span>Phone: {detailedLeave.applicant?.phone || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-xl text-xs font-bold border ${LEAVE_TYPE_CONFIG[detailedLeave.leaveType as LeaveType]?.color}`}>
                    {getLeaveTypeLabel(detailedLeave.leaveType, detailedLeave.leaveTypeName)}
                  </span>
                  <span className={`px-3 py-1 rounded-xl text-xs font-bold border ${LEAVE_STATUS_CONFIG[detailedLeave.status]?.bg} ${LEAVE_STATUS_CONFIG[detailedLeave.status]?.text}`}>
                    {LEAVE_STATUS_CONFIG[detailedLeave.status]?.label}
                  </span>
                </div>
              </div>

              {/* Main Content: 2-Column Split (Left = Current Application, Right = Previous History) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                
                {/* Left Column (7 cols): Current Application Details & Actions */}
                <div className="lg:col-span-7 space-y-3">
                  
                  {/* Summary Cards */}
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Duration</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 text-xs mt-0.5 block truncate">
                        {detailedLeave.startDate} to {detailedLeave.returnDate}
                      </span>
                      <span className="text-red-800 dark:text-red-400 font-extrabold text-[11px] mt-0.5 block">
                        {detailedLeave.daysCount} Calendar Day{detailedLeave.daysCount > 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Duty Reliever</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 text-xs mt-0.5 block truncate">
                        {detailedLeave.reliefUser?.name?.en || 'Nominated Reliever'}
                      </span>
                      <span className="text-slate-500 text-[10px] block truncate">
                        {detailedLeave.reliefUser?.designation?.en || 'Staff'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Emergency Contact</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 text-xs font-mono mt-0.5 block truncate">
                        {detailedLeave.stayAddress?.emergencyContact}
                      </span>
                      <span className="text-slate-500 text-[10px] block truncate">
                        {detailedLeave.stayAddress?.district}, {detailedLeave.stayAddress?.upazila}
                      </span>
                    </div>
                  </div>

                  {/* Staying Address */}
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-0.5">
                    <span className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">Stay Address During Leave:</span>
                    <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                      <span className="font-medium text-slate-900 dark:text-slate-100">{detailedLeave.stayAddress?.village}</span>, 
                      Post: <span className="font-medium text-slate-900 dark:text-slate-100">{detailedLeave.stayAddress?.postOffice}</span>, 
                      Thana: <span className="font-medium text-slate-900 dark:text-slate-100">{detailedLeave.stayAddress?.thana}</span>, 
                      Upazila: <span className="font-medium text-slate-900 dark:text-slate-100">{detailedLeave.stayAddress?.upazila}</span>, 
                      District: <span className="font-semibold text-slate-900 dark:text-slate-100">{detailedLeave.stayAddress?.district}</span>
                    </p>
                  </div>

                  {/* Reason for Leave */}
                  <div className="text-xs space-y-1">
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px]">Stated Reason:</span>
                    <p className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs">
                      {detailedLeave.reason}
                    </p>
                  </div>

                  {detailedLeave.reliefNote && (
                    <div className="text-xs space-y-1">
                      <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px]">Reliever Handover Note:</span>
                      <p className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-xs">
                        {detailedLeave.reliefNote}
                      </p>
                    </div>
                  )}

                  {/* Authority Remarks if already reviewed */}
                  {detailedLeave.decisionReason && (
                    <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
                      <span className="font-bold text-slate-900 dark:text-slate-100 block mb-0.5">Authority Decision Remarks:</span>
                      <p className="text-slate-600 dark:text-slate-300">{detailedLeave.decisionReason}</p>
                    </div>
                  )}

                  {detailedLeave.referralNote && (
                    <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-xs text-purple-800 dark:text-purple-300">
                      <span className="font-bold block mb-0.5">Referral Note to CEO:</span>
                      <p>{detailedLeave.referralNote}</p>
                    </div>
                  )}

                  {/* Inline Action Decision Box */}
                  {actionModalType ? (
                    <div className="p-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          {actionModalType === 'APPROVE' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                          {actionModalType === 'REJECT' && <XCircle className="w-4 h-4 text-rose-600" />}
                          {actionModalType === 'REFER' && <ArrowUpRight className="w-4 h-4 text-purple-600" />}
                          <span>
                            {actionModalType === 'APPROVE' && 'Approve Leave Application'}
                            {actionModalType === 'REJECT' && 'Reject Leave Application'}
                            {actionModalType === 'REFER' && 'Refer Request to Director General (CEO)'}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setActionModalType(null)}
                          className="text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          {actionModalType === 'REJECT' ? 'Reason for Rejection (Required):' : 'Remarks or Instructions (Optional):'}
                        </label>
                        <textarea
                          rows={2}
                          value={actionReason}
                          onChange={e => setActionReason(e.target.value)}
                          placeholder={actionModalType === 'REJECT' ? 'State the reason for rejecting this leave request...' : 'Add any remarks or directives...'}
                          className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setActionModalType(null)}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleExecuteAction}
                          disabled={actionLoading}
                          className={`px-4 py-1.5 text-xs font-bold text-white rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                            actionModalType === 'APPROVE'
                              ? 'bg-emerald-600 hover:bg-emerald-700'
                              : actionModalType === 'REJECT'
                              ? 'bg-rose-600 hover:bg-rose-700'
                              : 'bg-purple-600 hover:bg-purple-700'
                          }`}
                        >
                          {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                          <span>
                            {actionModalType === 'APPROVE' && 'Confirm Approval'}
                            {actionModalType === 'REJECT' && 'Confirm Rejection'}
                            {actionModalType === 'REFER' && 'Send to CEO'}
                          </span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Action Buttons Bar if leave is pending and user is authorized */
                    detailedLeave.status === 'PENDING' && canApprove && (
                      <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                        {isDeptHead && (
                          <button
                            type="button"
                            onClick={() => {
                              setActionModalType('REFER');
                              setActionReason('');
                            }}
                            className="px-3.5 py-1.5 text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/40 border border-purple-200 dark:border-purple-800 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                            <span>Refer to CEO</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setActionModalType('REJECT');
                            setActionReason('');
                          }}
                          className="px-3.5 py-1.5 text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 border border-rose-200 dark:border-rose-800 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setActionModalType('APPROVE');
                            setActionReason('Approved as per entitlement.');
                          }}
                          className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-98 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                      </div>
                    )
                  )}
                </div>

                {/* Right Column (5 cols): Applicant Previous Leave History */}
                <div className="lg:col-span-5 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 bg-slate-50/50 dark:bg-slate-800/20 space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <History className="w-4 h-4 text-red-800 dark:text-red-400" />
                        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          Applicant's Leave History
                        </h4>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-300">
                        Total: {detailedLeave.applicantLeaveStats?.totalLeavesTaken || 0} approved ({detailedLeave.applicantLeaveStats?.totalDaysTaken || 0} days)
                      </span>
                    </div>

                    {/* 5 Leave Types Breakdown Summary */}
                    {detailedLeave.applicantLeaveStats?.typeBreakdown && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 my-2.5 text-center text-xs">
                        {(Object.keys(LEAVE_TYPE_CONFIG) as LeaveType[]).map(tKey => {
                          const typeObj = detailedLeave.applicantLeaveStats.typeBreakdown[tKey] || { count: 0, days: 0 };
                          const conf = LEAVE_TYPE_CONFIG[tKey];
                          return (
                            <div
                              key={tKey}
                              className="p-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                            >
                              <span className="text-[10px] font-semibold text-slate-500 block truncate">{conf.name}</span>
                              <div className="font-extrabold text-slate-900 dark:text-slate-100 text-xs mt-0.5">
                                {typeObj.days} <span className="text-[9px] font-normal text-slate-400">days</span>
                              </div>
                              <span className="text-[9px] text-slate-400">({typeObj.count}x)</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Previous Leaves Table / List */}
                    <div className="mt-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                        Prior Applications Log
                      </span>
                      {!detailedLeave.applicantLeaveStats?.previousLeaves || detailedLeave.applicantLeaveStats.previousLeaves.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-4 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                          No previous leave records found for this employee.
                        </p>
                      ) : (
                        <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                          {detailedLeave.applicantLeaveStats.previousLeaves.map((pl: any) => {
                            const stConf = LEAVE_STATUS_CONFIG[pl.status] || LEAVE_STATUS_CONFIG.APPROVED;
                            const plTypeName = getLeaveTypeLabel(pl.leaveType, pl.leaveTypeName);
                            return (
                              <div
                                key={pl._id}
                                className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs"
                              >
                                <div>
                                  <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200 text-[11px]">
                                    <span>{plTypeName}</span>
                                    <span className="text-slate-400 font-normal">({pl.startDate} to {pl.returnDate})</span>
                                    <span className="text-red-800 dark:text-red-400 font-bold">• {pl.daysCount}d</span>
                                  </div>
                                  <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{pl.reason}</p>
                                </div>

                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 ${stConf.bg} ${stConf.text}`}>
                                  {stConf.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-400">
                    <span>Liberation War Museum • Automated Leave Audit & History</span>
                  </div>
                </div>

              </div>
            </div>
          )}
        </Modal>
      )}

    </div>
  );
};
