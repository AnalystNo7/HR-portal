'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export type UserRole = 'employee' | 'manager' | 'hr';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string;
  email: string;
  position: string;
  department: string;
  role: UserRole;
}

interface AuthState {
  user: User;
  role: UserRole;
  sidebarCollapsed: boolean;
  density: 'compact' | 'comfortable' | 'spacious';
  feedbackOpen: boolean;
}

interface AuthContextType extends AuthState {
  setRole: (role: UserRole) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setDensity: (density: AuthState['density']) => void;
  setFeedbackOpen: (open: boolean) => void;
}

const STORAGE_KEY = 'gpc-portal-state-v2';

const mockUsers: Record<UserRole, User> = {
  employee: {
    id: '1',
    firstName: 'Александр',
    lastName: 'Морозов',
    middleName: 'Викторович',
    email: 'morozov.av@gazpromcps.ru',
    position: 'Ведущий инженер',
    department: 'Блок ИТ / Разработка',
    role: 'employee',
  },
  manager: {
    id: '2',
    firstName: 'Александр',
    lastName: 'Морозов',
    middleName: 'Викторович',
    email: 'morozov.av@gazpromcps.ru',
    position: 'Ведущий инженер',
    department: 'Блок ИТ / Разработка',
    role: 'manager',
  },
  hr: {
    id: '3',
    firstName: 'Александр',
    lastName: 'Морозов',
    middleName: 'Викторович',
    email: 'morozov.av@gazpromcps.ru',
    position: 'Ведущий инженер',
    department: 'Блок ИТ / Разработка',
    role: 'hr',
  },
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function loadState(): Partial<AuthState> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveState(state: Partial<AuthState>) {
  if (typeof window === 'undefined') return;
  const { feedbackOpen, ...persist } = state as AuthState;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(persist));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const saved = loadState();
    const role = (saved.role as UserRole) || 'hr';
    return {
      user: mockUsers[role],
      role,
      sidebarCollapsed: saved.sidebarCollapsed ?? false,
      density: saved.density ?? 'comfortable',
      feedbackOpen: false,
    };
  });

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    document.documentElement.setAttribute('data-density', state.density);
  }, [state.density]);

  const setRole = useCallback((role: UserRole) => {
    setState(s => ({ ...s, role, user: mockUsers[role] }));
  }, []);

  const setSidebarCollapsed = useCallback((sidebarCollapsed: boolean) => {
    setState(s => ({ ...s, sidebarCollapsed }));
  }, []);

  const setDensity = useCallback((density: AuthState['density']) => {
    setState(s => ({ ...s, density }));
  }, []);

  const setFeedbackOpen = useCallback((feedbackOpen: boolean) => {
    setState(s => ({ ...s, feedbackOpen }));
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, setRole, setSidebarCollapsed, setDensity, setFeedbackOpen }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
