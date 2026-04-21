'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { getMe, Me } from '@/lib/api';

export type UserRole = 'employee' | 'manager' | 'hr';

interface AuthState {
  user: Me | null;
  loading: boolean;
  error: string | null;
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
  reloadUser: () => Promise<void>;
}

const STORAGE_KEY = 'gpc-portal-state-v2';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type PersistedState = {
  role?: UserRole;
  sidebarCollapsed?: boolean;
  density?: AuthState['density'];
};

function loadState(): PersistedState {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveState(state: PersistedState) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const saved = loadState();
    return {
      user: null,
      loading: true,
      error: null,
      role: saved.role ?? 'hr',
      sidebarCollapsed: saved.sidebarCollapsed ?? false,
      density: saved.density ?? 'comfortable',
      feedbackOpen: false,
    };
  });

  const loadUser = useCallback(async (role: UserRole) => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const me = await getMe(role);
      setState(s => ({ ...s, user: me, loading: false }));
    } catch (e) {
      setState(s => ({ ...s, loading: false, error: (e as Error).message }));
    }
  }, []);

  useEffect(() => {
    loadUser(state.role);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.role]);

  useEffect(() => {
    saveState({
      role: state.role,
      sidebarCollapsed: state.sidebarCollapsed,
      density: state.density,
    });
  }, [state.role, state.sidebarCollapsed, state.density]);

  useEffect(() => {
    document.documentElement.setAttribute('data-density', state.density);
  }, [state.density]);

  const setRole = useCallback((role: UserRole) => {
    setState(s => ({ ...s, role }));
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

  const reloadUser = useCallback(() => loadUser(state.role), [loadUser, state.role]);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        setRole,
        setSidebarCollapsed,
        setDensity,
        setFeedbackOpen,
        reloadUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
