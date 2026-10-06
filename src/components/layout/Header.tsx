import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { UserAvatar } from '../common/UserAvatar';
import { Notification } from '../../types';
import { 
  Bell, Search, RefreshCw, UserCheck, Check, 
  Menu, Building2, ShieldCheck, LogOut, Plus 
} from 'lucide-react';

interface HeaderProps {
  onToggleMobileMenu?: () => void;
  onOpenTaskDetail?: (taskId: string) => void;
  onOpenRequestDetail?: (requestId: string) => void;
  onSearchSubmit?: (query: string) => void;
  onOpenCreateTask?: () => void;
  onOpenTaskRequest?: () => void;
  onOpenProfileDrawer?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleMobileMenu,
  onOpenTaskDetail,
  onOpenRequestDetail,
  onSearchSubmit,
  onOpenCreateTask,
  onOpenTaskRequest,
  onOpenProfileDrawer
}) => {
  const { user, department, unreadNotifications, switchUser, logout, refreshMe } = useAuth();

  const [demoUsers, setDemoUsers] = useState<any[]>([]);
  const [showUserSwitcher, setShowUserSwitcher] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    api.auth.getDemoUsers().then(setDemoUsers).catch(console.error);
  }, []);

  const loadNotifications = async () => {
    setLoadingNotifs(true);
    try {
      const res = await api.notifications.list();
      setNotifications(res.items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingNotifs(false);
    }
  };

  const handleOpenNotifDropdown = () => {
    if (!showNotifications) {
      loadNotifications();
    }
    setShowNotifications(!showNotifications);
  };

  const handleMarkAllRead = async () => {
    await api.notifications.markAllRead();
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    refreshMe();
  };

  const handleNotificationClick = async (notif: Notification) => {
    if (!notif.isRead) {
      await api.notifications.markRead(notif._id);
      refreshMe();
    }
    setShowNotifications(false);
    if (notif.resourceType === 'TASK' && onOpenTaskDetail) {
      onOpenTaskDetail(notif.resourceId);
    } else if (notif.resourceType === 'TASK_REQUEST' && onOpenRequestDetail) {
      onOpenRequestDetail(notif.resourceId);
    }
  };

  const handleResetData = async () => {
    if (window.confirm('Reset all tasks, requests, and activity logs to pristine seed data?')) {
      setIsResetting(true);
      try {
        await api.seed.reset();
        await refreshMe();
        window.location.reload();
      } finally {
        setIsResetting(false);
      }
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      onSearchSubmit?.(searchQuery.trim());
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 shrink-0">
      <div className="px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        
        {/* Left: Mobile Toggle & Brand Indicator */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="md:hidden p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Toggle menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="hidden sm:flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl overflow-hidden bg-white dark:bg-slate-900 flex items-center justify-center shadow-xs shrink-0 border border-slate-200 dark:border-slate-800">
              <img src="/logo.jpeg" alt="Liberation War Museum Logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                Liberation War Museum
                <span className="text-xs font-normal text-slate-500 font-sans">| মুক্তিযুদ্ধ জাদুঘর</span>
              </div>
              <div className="text-[11px] text-slate-500 tracking-wide">
                Enterprise Office & Task Management System
              </div>
            </div>
          </div>
        </div>

        {/* Center: Global Search */}
        <div className="flex-1 max-w-md mx-2 hidden lg:block">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search tasks (TASK-00001), projects, employees, or tags..."
              className="w-full pl-9 pr-4 py-1.5 text-xs sm:text-sm bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-xl placeholder-slate-400 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:bg-white dark:focus:bg-slate-900"
            />
          </div>
        </div>

        {/* Right: Actions, Persona Switcher & User Profile */}
        <div className="flex items-center gap-2.5">

          {/* Quick Assign Task Button — hidden for Super Admin (system manager, not task participant) */}
          {onOpenCreateTask && user?.role !== 'SUPER_ADMIN' && (
            <button
              type="button"
              onClick={onOpenCreateTask}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-red-800 hover:bg-red-900 text-white shadow-xs flex items-center gap-1.5 transition-colors shrink-0"
              title="Assign or create a new directive"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Assign Task</span>
            </button>
          )}

          {/* Reset Demo Data Button */}
          <button
            type="button"
            onClick={handleResetData}
            disabled={isResetting}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Reset database to fresh LWM seed records"
          >
            <RefreshCw className={`w-4 h-4 ${isResetting ? 'animate-spin text-red-600' : ''}`} />
          </button>

          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={handleOpenNotifDropdown}
              className="relative p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadNotifications > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </span>
              )}
            </button>

            {showNotifications && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                <div className="absolute right-0 top-full mt-2 z-50 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in">
                  <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-slate-100">
                      Notifications ({unreadNotifications} unread)
                    </div>
                    {unreadNotifications > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className="text-xs text-red-700 dark:text-red-400 hover:underline font-medium"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {loadingNotifs ? (
                      <div className="p-6 text-center text-xs text-slate-400">Loading notifications...</div>
                    ) : notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400">No new notifications</div>
                    ) : (
                      notifications.map(n => (
                        <div
                          key={n._id}
                          onClick={() => handleNotificationClick(n)}
                          className={`p-3 text-left cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
                            !n.isRead ? 'bg-red-50/40 dark:bg-red-950/20' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">{n.title}</span>
                            {!n.isRead && <span className="w-2 h-2 rounded-full bg-red-600 shrink-0 mt-1" />}
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 line-clamp-2">{n.message}</p>
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* User Profile Capsule */}
          {user && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={onOpenProfileDrawer}
                className="flex items-center gap-2.5 text-left p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
                title="Click to open Profile & Account Settings"
              >
                <UserAvatar name={user.name} photo={user.photo} role={user.role} size="md" />
                <div className="hidden sm:block min-w-0">
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 group-hover:text-red-700 dark:group-hover:text-red-400 truncate flex items-center gap-1.5 transition-colors">
                    {user.name.en}
                    <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {user.role}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {user.designation.en} {department && `• ${department.code}`}
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={logout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}

        </div>

      </div>
    </header>
  );
};
