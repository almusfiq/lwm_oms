import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { UserAvatar } from '../common/UserAvatar';
import { 
  X, Camera, Lock, KeyRound, CheckCircle2, AlertCircle, 
  Loader2, Phone, Mail, User as UserIcon, Shield, Building2,
  LogOut, Eye, EyeOff
} from 'lucide-react';

interface ProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileDrawer: React.FC<ProfileDrawerProps> = ({ isOpen, onClose }) => {
  const { user, department, refreshMe, logout } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Picture upload state
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [photoSuccess, setPhotoSuccess] = useState('');

  // Contact info state
  const [phone, setPhone] = useState(user?.phone || '');
  const [updatingInfo, setUpdatingInfo] = useState(false);
  const [infoSuccess, setInfoSuccess] = useState('');

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [updatingPass, setUpdatingPass] = useState(false);
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState('');

  if (!isOpen || !user) return null;

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) {
      setPhotoError('Please select a valid image file (JPG, PNG, WEBP).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setPhotoError('Image size should be less than 10MB.');
      return;
    }

    setPhotoError('');
    setPhotoSuccess('');
    setUploadingPhoto(true);

    try {
      const uploaded = await api.upload.files([file]);
      if (uploaded && uploaded[0]?.url) {
        const photoUrl = uploaded[0].url;
        await api.users.update(user._id, { photo: photoUrl });
        await refreshMe();
        setPhotoSuccess('Profile picture updated successfully!');
        setTimeout(() => setPhotoSuccess(''), 3000);
      }
    } catch (err: any) {
      setPhotoError(err.message || 'Failed to upload profile picture.');
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const handleUpdateContactInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingInfo(true);
    setInfoSuccess('');
    try {
      await api.users.update(user._id, { phone: phone.trim() });
      await refreshMe();
      setInfoSuccess('Contact information updated.');
      setTimeout(() => setInfoSuccess(''), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to update contact info');
    } finally {
      setUpdatingInfo(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess('');

    if (!currentPassword) {
      setPassError('Please enter your current password.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setPassError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassError('New password and confirm password do not match.');
      return;
    }

    setUpdatingPass(true);
    try {
      await api.users.changePassword({ currentPassword, newPassword });
      setPassSuccess('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPassSuccess(''), 4000);
    } catch (err: any) {
      setPassError(err.message || 'Failed to change password. Please check your current password.');
    } finally {
      setUpdatingPass(false);
    }
  };

  const handleLoadDemoUsers = async () => {
    if (demoUsers.length > 0) return;
    setLoadingDemo(true);
    try {
      const list = await api.auth.getDemoUsers();
      setDemoUsers(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDemo(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      {/* Slide-over Sidebar Panel */}
      <aside 
        className="fixed inset-y-0 right-0 w-full max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col z-50 animate-in slide-in-from-right duration-200"
        role="dialog"
      >
        {/* Drawer Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-800/40">
          <div className="flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-red-700" />
            <h2 className="font-bold text-base text-slate-900 dark:text-slate-100">
              Profile & Account Settings
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">

          {/* ===== 1. PROFILE PICTURE AVATAR ===== */}
          <div className="flex flex-col items-center text-center p-5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <UserAvatar name={user.name} photo={user.photo} role={user.role} size="xl" />
              <div className="absolute inset-0 rounded-full bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                <Camera className="w-6 h-6" />
              </div>
              {uploadingPhoto && (
                <div className="absolute inset-0 rounded-full bg-slate-900/60 flex items-center justify-center text-white">
                  <Loader2 className="w-6 h-6 animate-spin text-white" />
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoSelect}
              className="hidden"
            />

            <button
              type="button"
              disabled={uploadingPhoto}
              onClick={() => fileInputRef.current?.click()}
              className="mt-3 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Camera className="w-3.5 h-3.5 text-red-700" />
              <span>{uploadingPhoto ? 'Uploading...' : 'Change Profile Picture'}</span>
            </button>

            {photoSuccess && (
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-2 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> {photoSuccess}
              </span>
            )}
            {photoError && (
              <span className="text-xs font-medium text-red-600 dark:text-red-400 mt-2">
                {photoError}
              </span>
            )}

            {/* Employee Details Card */}
            <div className="mt-4 pt-4 border-t border-slate-200/80 dark:border-slate-700/80 w-full text-left space-y-2">
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 text-center">
                {user.name.en} <span className="text-xs font-normal text-slate-500 font-sans">({user.name.bn})</span>
              </h3>
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                  {user.employeeId}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-900 dark:bg-red-950/60 dark:text-red-300">
                  {user.role}
                </span>
                {department && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-900 dark:bg-blue-950/60 dark:text-blue-300">
                    {department.code}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 text-center">
                {user.designation.en} {department ? `• ${department.name.en}` : ''}
              </p>
            </div>
          </div>

          {/* ===== 2. CONTACT INFORMATION ===== */}
          <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              Contact Details
            </h3>

            <div className="space-y-2 text-xs">
              <div>
                <label className="text-slate-500 font-medium">Email Address</label>
                <div className="font-mono text-slate-800 dark:text-slate-200 font-semibold p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg mt-0.5">
                  {user.email}
                </div>
              </div>

              <form onSubmit={handleUpdateContactInfo} className="space-y-2 pt-1">
                <div>
                  <label className="text-slate-500 font-medium flex items-center justify-between">
                    <span>Phone Number</span>
                    {infoSuccess && <span className="text-emerald-600 text-[10px]">Saved!</span>}
                  </label>
                  <div className="flex gap-2 mt-0.5">
                    <input
                      type="text"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="+8801700000000"
                      className="flex-1 px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={updatingInfo}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>

          {/* ===== 3. UPDATE PASSWORD ===== */}
          <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-red-700" />
              Update Password
            </h3>

            {passError && (
              <div className="p-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{passError}</span>
              </div>
            )}

            {passSuccess && (
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{passSuccess}</span>
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="space-y-3">
              {/* Current Password */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Current Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    required
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    placeholder="Enter existing password"
                    className="w-full pl-3 pr-9 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showCurrentPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  New Password <span className="text-red-500">*</span> <span className="text-slate-400 font-normal">(min 6 chars)</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full pl-3 pr-9 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showNewPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Confirm New Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-type new password"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={updatingPass}
                className="w-full py-2 rounded-xl text-xs font-semibold bg-red-800 hover:bg-red-900 text-white shadow-xs disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5 mt-2"
              >
                {updatingPass ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>Update Password</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* ===== 4. LOGOUT SESSION ===== */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                logout();
              }}
              className="w-full py-3 rounded-2xl text-xs sm:text-sm font-bold bg-red-50 text-red-800 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/40 border border-red-200 flex items-center justify-center gap-2 transition-all shadow-xs transform hover:-translate-y-0.5"
            >
              <LogOut className="w-4 h-4 text-red-700 dark:text-red-400" />
              <span>Log Out of Session</span>
            </button>
          </div>

        </div>
      </aside>
    </div>
  );
};
