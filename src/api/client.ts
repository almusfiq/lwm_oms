const API_BASE = '/api';

function getAuthHeader(): HeadersInit {
  const token = sessionStorage.getItem('lwm_auth_token') || localStorage.getItem('lwm_auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMsg = `HTTP Error ${res.status}`;
    try {
      const errJson = await res.json();
      errorMsg = errJson.message || errorMsg;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }
  const json = await res.json();
  return json.data !== undefined ? json.data : json;
}

export const api = {
  // Auth
  auth: {
    login: async (identifier: string, password: string) => {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Send both fields: `identifier` for new server code, `email` as fallback for old
        body: JSON.stringify({ identifier, email: identifier, password })
      });
      return handleResponse<{ token: string; user: any }>(res);
    },
    me: async () => {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: getAuthHeader()
      });
      return handleResponse<{ user: any; department: any; unreadNotifications: number; pendingRequests: number }>(res);
    },
    switchUser: async (userId: string) => {
      const res = await fetch(`${API_BASE}/auth/switch-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      return handleResponse<{ token: string; user: any }>(res);
    },
    getDemoUsers: async () => {
      const res = await fetch(`${API_BASE}/auth/demo-users`);
      return handleResponse<any[]>(res);
    }
  },

  // Tasks
  tasks: {
    list: async (params?: Record<string, any>) => {
      const query = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== '') {
            query.append(k, String(v));
          }
        });
      }
      const res = await fetch(`${API_BASE}/tasks?${query.toString()}`, {
        headers: getAuthHeader()
      });
      return handleResponse<{ items: any[]; total: number; page: number; limit: number; totalPages: number }>(res);
    },
    get: async (id: string) => {
      const res = await fetch(`${API_BASE}/tasks/${id}`, {
        headers: getAuthHeader()
      });
      return handleResponse<{ task: any; comments: any[]; activities: any[]; subtasks: any[] }>(res);
    },
    create: async (data: any) => {
      const res = await fetch(`${API_BASE}/tasks`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(data)
      });
      return handleResponse<any>(res);
    },
    updateStatus: async (id: string, status: string) => {
      const res = await fetch(`${API_BASE}/tasks/${id}/status`, {
        method: 'PATCH',
        headers: getAuthHeader(),
        body: JSON.stringify({ status })
      });
      return handleResponse<any>(res);
    },
    updateProgress: async (id: string, progress: number) => {
      const res = await fetch(`${API_BASE}/tasks/${id}/progress`, {
        method: 'PATCH',
        headers: getAuthHeader(),
        body: JSON.stringify({ progress })
      });
      return handleResponse<any>(res);
    },
    checklistAction: async (id: string, action: 'ADD' | 'TOGGLE', data: any) => {
      const res = await fetch(`${API_BASE}/tasks/${id}/checklist`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify({ action, ...data })
      });
      return handleResponse<any>(res);
    },
    reassign: async (id: string, assignedTo: string[]) => {
      const res = await fetch(`${API_BASE}/tasks/${id}/assign`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify({ assignedTo })
      });
      return handleResponse<any>(res);
    },
    addComment: async (id: string, content: string, mentions?: string[]) => {
      const res = await fetch(`${API_BASE}/tasks/${id}/comments`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify({ content, mentions })
      });
      return handleResponse<any>(res);
    },
    addAttachment: async (id: string, attachment: any) => {
      const res = await fetch(`${API_BASE}/tasks/${id}/attachments`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(attachment)
      });
      return handleResponse<any>(res);
    },
    submit: async (id: string, data: { note?: string; attachments?: any[]; markChecklistComplete?: boolean }) => {
      const res = await fetch(`${API_BASE}/tasks/${id}/submit`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(data)
      });
      return handleResponse<any>(res);
    },
    delete: async (id: string) => {
      const res = await fetch(`${API_BASE}/tasks/${id}`, {
        method: 'DELETE',
        headers: getAuthHeader()
      });
      return handleResponse<any>(res);
    }
  },

  // File Upload (multipart/form-data)
  upload: {
    files: async (files: File[]): Promise<any[]> => {
      const token = sessionStorage.getItem('lwm_auth_token') || localStorage.getItem('lwm_auth_token');
      const formData = new FormData();
      files.forEach(f => formData.append('files', f));
      const res = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData
      });
      return handleResponse<any[]>(res);
    }
  },

  // Task Requests (Cross-Department Work)
  taskRequests: {
    list: async (params?: { status?: string; type?: string; departmentId?: string }) => {
      const query = new URLSearchParams();
      if (params?.status) query.append('status', params.status);
      if (params?.type) query.append('type', params.type);
      if (params?.departmentId) query.append('departmentId', params.departmentId);

      const res = await fetch(`${API_BASE}/task-requests?${query.toString()}`, {
        headers: getAuthHeader()
      });
      return handleResponse<any[]>(res);
    },
    get: async (id: string) => {
      const res = await fetch(`${API_BASE}/task-requests/${id}`, {
        headers: getAuthHeader()
      });
      return handleResponse<any>(res);
    },
    create: async (data: any) => {
      const res = await fetch(`${API_BASE}/task-requests`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(data)
      });
      return handleResponse<any>(res);
    },
    accept: async (id: string, options?: string | { responseMessage?: string; assignedToId?: string }) => {
      const body = typeof options === 'string' ? { responseMessage: options } : (options || {});
      const res = await fetch(`${API_BASE}/task-requests/${id}/accept`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(body)
      });
      return handleResponse<{ request: any; task: any }>(res);
    },
    reject: async (id: string, reason: string) => {
      const res = await fetch(`${API_BASE}/task-requests/${id}/reject`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify({ reason })
      });
      return handleResponse<any>(res);
    },
    clarify: async (id: string, message: string) => {
      const res = await fetch(`${API_BASE}/task-requests/${id}/clarify`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify({ message })
      });
      return handleResponse<any>(res);
    }
  },

  // Projects
  projects: {
    list: async (params?: { status?: string; departmentId?: string }) => {
      const query = new URLSearchParams();
      if (params?.status) query.append('status', params.status);
      if (params?.departmentId) query.append('departmentId', params.departmentId);

      const res = await fetch(`${API_BASE}/projects?${query.toString()}`, {
        headers: getAuthHeader()
      });
      return handleResponse<any[]>(res);
    },
    get: async (id: string) => {
      const res = await fetch(`${API_BASE}/projects/${id}`, {
        headers: getAuthHeader()
      });
      return handleResponse<{ project: any; tasks: any[] }>(res);
    },
    create: async (data: any) => {
      const res = await fetch(`${API_BASE}/projects`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(data)
      });
      return handleResponse<any>(res);
    }
  },

  // Users & Employees
  users: {
    list: async (params?: { departmentId?: string; role?: string; search?: string; activeOnly?: boolean }) => {
      const query = new URLSearchParams();
      if (params?.departmentId) query.append('departmentId', params.departmentId);
      if (params?.role) query.append('role', params.role);
      if (params?.search) query.append('search', params.search);
      if (params?.activeOnly !== undefined) query.append('activeOnly', String(params.activeOnly));

      const res = await fetch(`${API_BASE}/users?${query.toString()}`, {
        headers: getAuthHeader()
      });
      return handleResponse<any[]>(res);
    },
    get: async (id: string) => {
      const res = await fetch(`${API_BASE}/users/${id}`, {
        headers: getAuthHeader()
      });
      return handleResponse<any>(res);
    },
    create: async (data: any) => {
      const res = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(data)
      });
      return handleResponse<any>(res);
    },
    update: async (id: string, data: any) => {
      const res = await fetch(`${API_BASE}/users/${id}`, {
        method: 'PATCH',
        headers: getAuthHeader(),
        body: JSON.stringify(data)
      });
      return handleResponse<any>(res);
    },
    delete: async (id: string) => {
      const res = await fetch(`${API_BASE}/users/${id}`, {
        method: 'DELETE',
        headers: getAuthHeader()
      });
      return handleResponse<any>(res);
    },
    changePassword: async (data: { currentPassword: string; newPassword: string }) => {
      const res = await fetch(`${API_BASE}/users/change-password`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(data)
      });
      return handleResponse<any>(res);
    },
    getPerformance: async (params?: { departmentId?: string }) => {
      const query = new URLSearchParams();
      if (params?.departmentId) query.append('departmentId', params.departmentId);
      const res = await fetch(`${API_BASE}/users/performance/all?${query}`, {
        headers: getAuthHeader()
      });
      return handleResponse<any[]>(res);
    }
  },

  // Departments
  departments: {
    list: async () => {
      const res = await fetch(`${API_BASE}/departments`, {
        headers: getAuthHeader()
      });
      return handleResponse<any[]>(res);
    },
    get: async (id: string) => {
      const res = await fetch(`${API_BASE}/departments/${id}`, {
        headers: getAuthHeader()
      });
      return handleResponse<any>(res);
    },
    create: async (data: any) => {
      const res = await fetch(`${API_BASE}/departments`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(data)
      });
      return handleResponse<any>(res);
    },
    update: async (id: string, data: any) => {
      const res = await fetch(`${API_BASE}/departments/${id}`, {
        method: 'PATCH',
        headers: getAuthHeader(),
        body: JSON.stringify(data)
      });
      return handleResponse<any>(res);
    },
    delete: async (id: string) => {
      const res = await fetch(`${API_BASE}/departments/${id}`, {
        method: 'DELETE',
        headers: getAuthHeader()
      });
      return handleResponse<any>(res);
    }
  },

  // Organogram
  organogram: {
    get: async () => {
      const res = await fetch(`${API_BASE}/organogram`, {
        headers: getAuthHeader()
      });
      return handleResponse<{ trustees: any[]; ceo: any; departments: any[] }>(res);
    }
  },

  // Notifications
  notifications: {
    list: async (unreadOnly = false) => {
      const res = await fetch(`${API_BASE}/notifications?unreadOnly=${unreadOnly}`, {
        headers: getAuthHeader()
      });
      return handleResponse<{ items: any[]; unreadCount: number }>(res);
    },
    markRead: async (id: string) => {
      const res = await fetch(`${API_BASE}/notifications/${id}/read`, {
        method: 'PATCH',
        headers: getAuthHeader()
      });
      return handleResponse<any>(res);
    },
    markAllRead: async () => {
      const res = await fetch(`${API_BASE}/notifications/read-all`, {
        method: 'POST',
        headers: getAuthHeader()
      });
      return handleResponse<any>(res);
    }
  },

  // Approvals
  approvals: {
    list: async (params?: { status?: string; type?: string }) => {
      const query = new URLSearchParams();
      if (params?.status) query.append('status', params.status);
      if (params?.type) query.append('type', params.type);

      const res = await fetch(`${API_BASE}/approvals?${query.toString()}`, {
        headers: getAuthHeader()
      });
      return handleResponse<any[]>(res);
    },
    create: async (data: any) => {
      const res = await fetch(`${API_BASE}/approvals`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(data)
      });
      return handleResponse<any>(res);
    },
    approve: async (id: string, reason?: string) => {
      const res = await fetch(`${API_BASE}/approvals/${id}/approve`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify({ reason })
      });
      return handleResponse<any>(res);
    },
    reject: async (id: string, reason: string) => {
      const res = await fetch(`${API_BASE}/approvals/${id}/reject`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify({ reason })
      });
      return handleResponse<any>(res);
    },
    refer: async (id: string, note?: string) => {
      const res = await fetch(`${API_BASE}/approvals/${id}/refer`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify({ note })
      });
      return handleResponse<any>(res);
    }
  },

  // Analytics & Reports
  analytics: {
    getOverview: async () => {
      const res = await fetch(`${API_BASE}/analytics/overview`, {
        headers: getAuthHeader()
      });
      return handleResponse<any>(res);
    },
    getCollaborationMatrix: async () => {
      const res = await fetch(`${API_BASE}/analytics/collaboration`, {
        headers: getAuthHeader()
      });
      return handleResponse<{ departments: any[]; matrix: any[] }>(res);
    }
  },

  reports: {
    getSummary: async () => {
      const res = await fetch(`${API_BASE}/reports/tasks`, { headers: getAuthHeader() });
      return handleResponse<any>(res);
    },
    getCollaborationMatrix: async () => {
      const res = await fetch(`${API_BASE}/analytics/collaboration`, { headers: getAuthHeader() });
      return handleResponse<any>(res);
    },
    getTaskReport: async () => {
      const res = await fetch(`${API_BASE}/reports/tasks`, { headers: getAuthHeader() });
      return handleResponse<any>(res);
    },
    getEmployeeReport: async () => {
      const res = await fetch(`${API_BASE}/reports/employees`, { headers: getAuthHeader() });
      return handleResponse<any[]>(res);
    },
    getDepartmentReport: async () => {
      const res = await fetch(`${API_BASE}/reports/departments`, { headers: getAuthHeader() });
      return handleResponse<any[]>(res);
    },
    getCrossDeptReport: async () => {
      const res = await fetch(`${API_BASE}/reports/cross-department`, { headers: getAuthHeader() });
      return handleResponse<any>(res);
    }
  },

  // Events & Announcements & Documents
  events: {
    list: async () => {
      const res = await fetch(`${API_BASE}/events`, { headers: getAuthHeader() });
      return handleResponse<any[]>(res);
    },
    create: async (data: any) => {
      const res = await fetch(`${API_BASE}/events`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(data)
      });
      return handleResponse<any>(res);
    }
  },

  announcements: {
    list: async () => {
      const res = await fetch(`${API_BASE}/announcements`, { headers: getAuthHeader() });
      return handleResponse<any[]>(res);
    },
    create: async (data: any) => {
      const res = await fetch(`${API_BASE}/announcements`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(data)
      });
      return handleResponse<any>(res);
    }
  },

  documents: {
    list: async (params?: { departmentId?: string; resourceType?: string; category?: string }) => {
      const query = new URLSearchParams();
      if (params?.departmentId) query.append('departmentId', params.departmentId);
      if (params?.resourceType) query.append('resourceType', params.resourceType);
      if (params?.category) query.append('category', params.category);

      const res = await fetch(`${API_BASE}/documents?${query.toString()}`, {
        headers: getAuthHeader()
      });
      return handleResponse<any[]>(res);
    },
    upload: async (data: any) => {
      const res = await fetch(`${API_BASE}/documents`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(data)
      });
      return handleResponse<any>(res);
    },
    create: async (data: any) => {
      const res = await fetch(`${API_BASE}/documents`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(data)
      });
      return handleResponse<any>(res);
    }
  },

  activityLogs: {
    list: async (params?: { 
      search?: string; 
      module?: string; 
      action?: string; 
      userId?: string; 
      startDate?: string; 
      endDate?: string; 
      page?: number; 
      limit?: number 
    }) => {
      const query = new URLSearchParams();
      if (params?.search) query.append('search', params.search);
      if (params?.module) query.append('module', params.module);
      if (params?.action) query.append('action', params.action);
      if (params?.userId) query.append('userId', params.userId);
      if (params?.startDate) query.append('startDate', params.startDate);
      if (params?.endDate) query.append('endDate', params.endDate);
      if (params?.page) query.append('page', String(params.page));
      if (params?.limit) query.append('limit', String(params.limit));

      const res = await fetch(`${API_BASE}/activity-logs?${query.toString()}`, { headers: getAuthHeader() });
      return handleResponse<{ items: any[]; total: number; page: number; limit: number; totalPages: number }>(res);
    },
    getStats: async () => {
      const res = await fetch(`${API_BASE}/activity-logs/stats`, { headers: getAuthHeader() });
      return handleResponse<{
        totalLogs: number;
        failedLoginsCount: number;
        activeUsersTodayCount: number;
        todayTotalEvents: number;
        moduleCounts: Record<string, number>;
      }>(res);
    },
    clear: async () => {
      const res = await fetch(`${API_BASE}/activity-logs/clear`, {
        method: 'POST',
        headers: getAuthHeader()
      });
      return handleResponse<any>(res);
    }
  },

  seed: {
    reset: async () => {
      const res = await fetch(`${API_BASE}/seed/reset`, { method: 'POST' });
      return handleResponse<any>(res);
    }
  }
};


