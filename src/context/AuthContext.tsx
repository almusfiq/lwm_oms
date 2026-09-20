import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, DepartmentRef } from '../types';
import { api } from '../api/client';

interface AuthContextType {
  user: User | null;
  department: DepartmentRef | null;
  unreadNotifications: number;
  pendingRequests: number;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => void;
  switchUser: (userId: string) => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [department, setDepartment] = useState<DepartmentRef | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState<number>(0);
  const [pendingRequests, setPendingRequests] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshMe = async () => {
    try {
      const data = await api.auth.me();
      setUser(data.user);
      setDepartment(data.department);
      setUnreadNotifications(data.unreadNotifications || 0);
      setPendingRequests(data.pendingRequests || 0);
    } catch {
      // Token invalid or missing, clear
      sessionStorage.removeItem('lwm_auth_token');
      localStorage.removeItem('lwm_auth_token');
      setUser(null);
      setDepartment(null);
    }
  };

  useEffect(() => {
    // Clear legacy persistent token from browser localStorage so app always starts on Login Page
    localStorage.removeItem('lwm_auth_token');

    const token = sessionStorage.getItem('lwm_auth_token');
    if (token) {
      refreshMe().finally(() => setLoading(false));
    } else {
      setUser(null);
      setDepartment(null);
      setLoading(false);
    }
  }, []);

  const login = async (identifier: string, pass: string) => {
    setLoading(true);
    try {
      const res = await api.auth.login(identifier, pass);
      sessionStorage.setItem('lwm_auth_token', res.token);
      setUser(res.user);
      await refreshMe();
    } finally {
      setLoading(false);
    }
  };

  const switchUser = async (userId: string) => {
    setLoading(true);
    try {
      const res = await api.auth.switchUser(userId);
      sessionStorage.setItem('lwm_auth_token', res.token);
      setUser(res.user);
      await refreshMe();
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    sessionStorage.removeItem('lwm_auth_token');
    localStorage.removeItem('lwm_auth_token');
    setUser(null);
    setDepartment(null);
    setUnreadNotifications(0);
    setPendingRequests(0);
  };

  return (
    <AuthContext.Provider value={{
      user,
      department,
      unreadNotifications,
      pendingRequests,
      loading,
      login,
      logout,
      switchUser,
      refreshMe
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
