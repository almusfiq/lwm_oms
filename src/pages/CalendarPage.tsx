import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Filter,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Flame,
  FileText,
  Megaphone,
  Plus,
  RefreshCw,
  User as UserIcon,
  Tag,
  ArrowRight,
  Sparkles,
  Building2
} from 'lucide-react';

interface CalendarPageProps {
  onOpenTaskDetail: (taskId: string) => void;
}

type EventCategory = 'TASK_DUE' | 'TASK_START' | 'TASK_COMPLETED' | 'MUSEUM_EVENT' | 'WORK_REQUEST';

interface CalendarItem {
  id: string;
  type: EventCategory;
  dateStr: string; // YYYY-MM-DD
  title: string;
  subtitle?: string;
  code?: string;
  priority?: string;
  status?: string;
  rawObj: any;
  department?: string;
  time?: string;
}

export const CalendarPage: React.FC<CalendarPageProps> = ({ onOpenTaskDetail }) => {
  const { user } = useAuth();

  const formatYMD = (y: number, m: number, d: number): string => {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  };

  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    const d = new Date();
    return formatYMD(d.getFullYear(), d.getMonth(), d.getDate());
  });

  const [tasks, setTasks] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [taskRequests, setTaskRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<'ALL' | 'TASKS' | 'EVENTS' | 'REQUESTS'>('ALL');
  const [filterPriority, setFilterPriority] = useState<string>('ALL');

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch tasks (role-based visibility handled by backend: staff sees assigned, dept heads see dept, trustees/ceo see museum)
      const tasksRes = await api.tasks.list({ limit: 500 });
      setTasks(Array.isArray(tasksRes?.items) ? tasksRes.items : (Array.isArray(tasksRes) ? tasksRes : (tasksRes as any)?.data || []));

      // Fetch public museum events
      const eventsRes = await api.events.list();
      setEvents(Array.isArray(eventsRes) ? eventsRes : (eventsRes as any)?.data || (eventsRes as any)?.items || []);

      // Fetch cross-department work requests
      const requestsRes = await api.taskRequests.list();
      setTaskRequests(Array.isArray(requestsRes) ? requestsRes : (requestsRes as any)?.data || (requestsRes as any)?.items || []);
    } catch (err) {
      console.error('Failed to fetch calendar data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Format date helper: YYYY-MM-DD (immune to local timezone conversion shifts)
  const toDateStr = (dateInput: any): string | null => {
    if (!dateInput) return null;
    if (typeof dateInput === 'string') {
      const match = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        return `${match[1]}-${match[2]}-${match[3]}`;
      }
    }
    try {
      const d = new Date(dateInput);
      if (isNaN(d.getTime())) return null;
      return formatYMD(d.getFullYear(), d.getMonth(), d.getDate());
    } catch {
      return null;
    }
  };

  // Convert raw data into normalized CalendarItems
  const allCalendarItems = useMemo<CalendarItem[]>(() => {
    const items: CalendarItem[] = [];

    // 1. Process Tasks (Exclude deleted, cancelled, or rejected tasks)
    tasks.forEach(task => {
      if (task.isDeleted || task.deleted || task.status === 'CANCELLED' || task.status === 'REJECTED') {
        return;
      }

      const taskTitle = typeof task.title === 'object' ? (task.title.en || task.title.bn) : task.title;
      const taskCode = task.taskId || task.code || task.customId;
      const deptName = typeof task.department?.name === 'object'
        ? (task.department.name.en || task.department.name.bn)
        : (task.department?.name || task.department?.code);

      // Task Due Date
      const dueStr = toDateStr(task.dueDate);
      if (dueStr) {
        items.push({
          id: `task-due-${task._id}`,
          type: 'TASK_DUE',
          dateStr: dueStr,
          title: taskTitle,
          code: taskCode,
          priority: task.priority || 'MEDIUM',
          status: task.status,
          department: deptName,
          rawObj: task
        });
      }

      // Task Start Date
      const startStr = toDateStr(task.startDate);
      if (startStr && startStr !== dueStr) {
        items.push({
          id: `task-start-${task._id}`,
          type: 'TASK_START',
          dateStr: startStr,
          title: taskTitle,
          code: taskCode,
          priority: task.priority || 'MEDIUM',
          status: task.status,
          department: deptName,
          rawObj: task
        });
      }

      // Task Completed Date
      if (task.status === 'COMPLETED' && (task.completedAt || task.updatedAt)) {
        const completedStr = toDateStr(task.completedAt || task.updatedAt);
        if (completedStr && completedStr !== dueStr) {
          items.push({
            id: `task-comp-${task._id}`,
            type: 'TASK_COMPLETED',
            dateStr: completedStr,
            title: taskTitle,
            code: taskCode,
            priority: task.priority || 'MEDIUM',
            status: task.status,
            department: deptName,
            rawObj: task
          });
        }
      }
    });

    // 2. Process Museum Public Events
    events.forEach(ev => {
      if (ev.isDeleted || ev.deleted) return;

      const eventDateStr = toDateStr(ev.date || ev.startDate);
      if (eventDateStr) {
        items.push({
          id: `event-${ev._id}`,
          type: 'MUSEUM_EVENT',
          dateStr: eventDateStr,
          title: ev.name || ev.title,
          subtitle: ev.location,
          time: ev.startTime ? `${ev.startTime} ${ev.endTime ? `- ${ev.endTime}` : ''}` : undefined,
          rawObj: ev
        });
      }
    });

    // 3. Process Work Requests (Exclude deleted, cancelled, or rejected requests)
    taskRequests.forEach(req => {
      if (req.isDeleted || req.deleted || req.status === 'REJECTED' || req.status === 'CANCELLED') {
        return;
      }

      const reqDateStr = toDateStr(req.dueDate || req.createdAt || req.targetDate);
      if (reqDateStr) {
        const reqDept = typeof req.targetDepartment?.name === 'object'
          ? (req.targetDepartment.name.en || req.targetDepartment.name.bn)
          : (req.targetDepartment?.name || req.targetDepartment?.code || (
              typeof req.requesterDepartment?.name === 'object'
                ? (req.requesterDepartment.name.en || req.requesterDepartment.name.bn)
                : req.requesterDepartment?.name
            ));

        items.push({
          id: `req-${req._id}`,
          type: 'WORK_REQUEST',
          dateStr: reqDateStr,
          title: typeof req.title === 'object' ? req.title.en || req.title.bn : req.title,
          code: req.requestId || req.code,
          priority: req.priority || 'MEDIUM',
          status: req.status,
          department: reqDept,
          rawObj: req
        });
      }
    });

    return items;
  }, [tasks, events, taskRequests]);

  // Filtered Calendar Items
  const filteredItems = useMemo(() => {
    return allCalendarItems.filter(item => {
      // Category filter
      if (filterCategory === 'TASKS' && !['TASK_DUE', 'TASK_START', 'TASK_COMPLETED'].includes(item.type)) {
        return false;
      }
      if (filterCategory === 'EVENTS' && item.type !== 'MUSEUM_EVENT') {
        return false;
      }
      if (filterCategory === 'REQUESTS' && item.type !== 'WORK_REQUEST') {
        return false;
      }

      // Priority filter
      if (filterPriority !== 'ALL' && item.priority && item.priority !== filterPriority) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const titleMatch = item.title.toLowerCase().includes(query);
        const codeMatch = item.code?.toLowerCase().includes(query);
        const deptMatch = item.department?.toLowerCase().includes(query);
        return titleMatch || codeMatch || deptMatch;
      }

      return true;
    });
  }, [allCalendarItems, filterCategory, filterPriority, searchQuery]);

  // Quick lookup dictionary for items by dateStr
  const itemsByDateMap = useMemo(() => {
    const map: Record<string, CalendarItem[]> = {};
    filteredItems.forEach(item => {
      if (!map[item.dateStr]) {
        map[item.dateStr] = [];
      }
      map[item.dateStr].push(item);
    });
    return map;
  }, [filteredItems]);

  // Date Navigation Functions
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDateStr(formatYMD(today.getFullYear(), today.getMonth(), today.getDate()));
  };

  // Generate Month Grid Days
  const gridDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: Array<{
      dateNum: number;
      dateStr: string;
      isCurrentMonth: boolean;
      isToday: boolean;
    }> = [];

    const now = new Date();
    const todayStr = formatYMD(now.getFullYear(), now.getMonth(), now.getDate());

    // Previous month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevDate = new Date(year, month - 1, dayNum);
      const dateStr = formatYMD(prevDate.getFullYear(), prevDate.getMonth(), dayNum);
      days.push({
        dateNum: dayNum,
        dateStr,
        isCurrentMonth: false,
        isToday: dateStr === todayStr
      });
    }

    // Current month days
    for (let dayNum = 1; dayNum <= daysInCurrentMonth; dayNum++) {
      const dateStr = formatYMD(year, month, dayNum);
      days.push({
        dateNum: dayNum,
        dateStr,
        isCurrentMonth: true,
        isToday: dateStr === todayStr
      });
    }

    // Next month padding to reach a complete week (multiple of 7) and at least 35 cells
    let nextMonthDay = 1;
    while (days.length % 7 !== 0 || days.length < 35) {
      const nextDate = new Date(year, month + 1, nextMonthDay);
      const dateStr = formatYMD(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate());
      days.push({
        dateNum: nextDate.getDate(),
        dateStr,
        isCurrentMonth: false,
        isToday: dateStr === todayStr
      });
      nextMonthDay++;
    }

    return days;
  }, [year, month]);

  // Selected Date Items
  const selectedDateItems = useMemo(() => {
    return itemsByDateMap[selectedDateStr] || [];
  }, [itemsByDateMap, selectedDateStr]);

  // Format selected date nicely
  const formattedSelectedDate = useMemo(() => {
    if (!selectedDateStr || !selectedDateStr.includes('-')) return '';
    const [y, m, d] = selectedDateStr.split('-').map(Number);
    if (!y || !m || !d) return '';
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }, [selectedDateStr]);

  // Color helper for badges
  const getItemBadgeStyle = (item: CalendarItem) => {
    switch (item.type) {
      case 'TASK_DUE':
        if (item.priority === 'URGENT') return 'bg-red-500/15 text-red-700 dark:text-red-400 border-l-2 border-red-500';
        if (item.priority === 'HIGH') return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-l-2 border-amber-500';
        return 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-l-2 border-blue-500';
      case 'TASK_COMPLETED':
        return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-l-2 border-emerald-500';
      case 'MUSEUM_EVENT':
        return 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-l-2 border-purple-500';
      case 'WORK_REQUEST':
        return 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-l-2 border-cyan-500';
      default:
        return 'bg-slate-500/15 text-slate-700 dark:text-slate-400 border-l-2 border-slate-500';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 bg-red-800/10 dark:bg-red-800/20 text-red-800 dark:text-red-400 rounded-xl">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
                Task & Activity Calendar
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Schedule view of assigned tasks, due dates, museum events, and work requests
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
        {/* Search */}
        <div className="md:col-span-4 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search tasks, events, codes..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-red-500 text-slate-900 dark:text-slate-100"
          />
        </div>

        {/* Category Filter */}
        <div className="md:col-span-3">
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value as any)}
            className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-red-500"
          >
            <option value="ALL">All Categories</option>
            <option value="TASKS">Tasks Only</option>
            <option value="EVENTS">Museum Events</option>
            <option value="REQUESTS">Work Requests</option>
          </select>
        </div>

        {/* Priority Filter */}
        <div className="md:col-span-3">
          <select
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-red-500"
          >
            <option value="ALL">All Priorities</option>
            <option value="URGENT">Urgent Priority</option>
            <option value="HIGH">High Priority</option>
            <option value="MEDIUM">Medium Priority</option>
            <option value="LOW">Low Priority</option>
          </select>
        </div>

        {/* Today Button */}
        <div className="md:col-span-2 flex justify-end">
          <button
            type="button"
            onClick={goToToday}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-red-800 dark:text-red-400 bg-red-800/10 dark:bg-red-800/20 hover:bg-red-800/20 dark:hover:bg-red-800/30 rounded-xl transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Today</span>
          </button>
        </div>
      </div>

      {/* Main Grid + Side Inspector Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Month Grid (8 Cols on LG) */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col justify-between">
          
          {/* Calendar Month Controls */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-4">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>{monthNames[month]} {year}</span>
            </h2>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={prevMonth}
                className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                title="Previous Month"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={nextMonth}
                className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                title="Next Month"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Color Legend */}
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600 dark:text-slate-400 mb-4 px-1">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> Urgent Task
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> High Priority
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Task Due
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Completed
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span> Event
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500"></span> Request
            </span>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 text-center font-semibold text-xs text-slate-400 dark:text-slate-500 mb-2">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1.5 flex-1 min-h-[420px]">
            {gridDays.map((day, idx) => {
              const dayItems = itemsByDateMap[day.dateStr] || [];
              const isSelected = day.dateStr === selectedDateStr;

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedDateStr(day.dateStr)}
                  className={`min-h-[75px] sm:min-h-[85px] p-1.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'border-red-800 dark:border-red-600 bg-red-50/50 dark:bg-red-950/20 shadow-xs ring-2 ring-red-500/30'
                      : day.isToday
                      ? 'border-red-300 dark:border-red-800/60 bg-red-50/20 dark:bg-slate-800/40'
                      : day.isCurrentMonth
                      ? 'border-slate-200/80 dark:border-slate-800/80 bg-slate-50/30 dark:bg-slate-900/60 hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
                      : 'border-slate-100 dark:border-slate-900 bg-slate-100/30 dark:bg-slate-950/40 text-slate-400 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${
                        day.isToday
                          ? 'bg-red-800 text-white shadow-2xs'
                          : day.isCurrentMonth
                          ? 'text-slate-700 dark:text-slate-300'
                          : 'text-slate-400'
                      }`}
                    >
                      {day.dateNum}
                    </span>

                    {dayItems.length > 0 && (
                      <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {dayItems.length}
                      </span>
                    )}
                  </div>

                  {/* Day Badges Preview (max 2) */}
                  <div className="space-y-1 my-1 overflow-hidden">
                    {dayItems.slice(0, 2).map((item, itemIdx) => (
                      <div
                        key={itemIdx}
                        className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md truncate ${getItemBadgeStyle(
                          item
                        )}`}
                        title={item.title}
                      >
                        {item.code ? `[${item.code}] ` : ''}{item.title}
                      </div>
                    ))}
                    {dayItems.length > 2 && (
                      <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 text-right pr-1">
                        +{dayItems.length - 2} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Day Inspector (4 Cols on LG) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs h-full flex flex-col">
            
            <div className="pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
              <span className="text-[11px] font-bold text-red-800 dark:text-red-400 tracking-wider uppercase">
                Day Inspector
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                {formattedSelectedDate}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {selectedDateItems.length} activity item{selectedDateItems.length === 1 ? '' : 's'} scheduled for this date
              </p>
            </div>

            {/* Items List for Selected Date */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[500px]">
              {selectedDateItems.length === 0 ? (
                <div className="py-12 text-center text-slate-400 dark:text-slate-500 space-y-2">
                  <CalendarIcon className="w-10 h-10 mx-auto opacity-30" />
                  <p className="text-xs font-medium">No tasks or events scheduled for this day.</p>
                </div>
              ) : (
                selectedDateItems.map(item => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:border-red-500/50 dark:hover:border-red-500/50 transition-all space-y-2 group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${getItemBadgeStyle(
                              item
                            )}`}
                          >
                            {item.type.replace('_', ' ')}
                          </span>

                          {item.priority && (
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                                item.priority === 'URGENT'
                                  ? 'bg-red-600 text-white'
                                  : item.priority === 'HIGH'
                                  ? 'bg-amber-600 text-white'
                                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {item.priority}
                            </span>
                          )}

                          {item.code && (
                            <span className="text-[10px] font-mono font-semibold text-slate-500 dark:text-slate-400">
                              {item.code}
                            </span>
                          )}
                        </div>

                        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-red-700 dark:group-hover:text-red-400 transition-colors pt-1">
                          {item.title}
                        </h4>
                      </div>
                    </div>

                    {item.subtitle && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {item.subtitle}
                      </p>
                    )}

                    {item.department && (
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                        <Building2 className="w-3 h-3 text-slate-400" />
                        <span>{item.department}</span>
                      </div>
                    )}

                    {item.time && (
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{item.time}</span>
                      </div>
                    )}

                    {/* Action Button if Task */}
                    {['TASK_DUE', 'TASK_START', 'TASK_COMPLETED'].includes(item.type) && (
                      <button
                        type="button"
                        onClick={() => onOpenTaskDetail(item.rawObj._id || item.rawObj.taskId)}
                        className="w-full mt-2 py-1.5 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-red-800 hover:text-white dark:hover:bg-red-800 hover:border-red-800 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <span>View Task Details</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {item.type === 'WORK_REQUEST' && (item.rawObj.convertedTaskId || item.rawObj.convertedTask?._id) && (
                      <button
                        type="button"
                        onClick={() => onOpenTaskDetail(item.rawObj.convertedTaskId || item.rawObj.convertedTask?._id)}
                        className="w-full mt-2 py-1.5 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-red-800 hover:text-white dark:hover:bg-red-800 hover:border-red-800 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <span>View Associated Task</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
