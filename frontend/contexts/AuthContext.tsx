'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import Keycloak from 'keycloak-js';
import { getKeycloak, getRolesFromToken, pickHighestRole, UserRole } from '@/lib/keycloak';
import { getMe, Me } from '@/lib/api';

export type { UserRole } from '@/lib/keycloak';

const AUTH_MODE = process.env.NEXT_PUBLIC_AUTH_MODE || 'keycloak';
const STORAGE_KEY = 'gpc-portal-state-v2';

interface AuthState {
  user: Me | null;
  loading: boolean;
  error: string | null;
  role: UserRole;
  authenticated: boolean;
  sidebarCollapsed: boolean;
  density: 'compact' | 'comfortable' | 'spacious';
  feedbackOpen: boolean;
}

interface AuthContextType extends AuthState {
  setRole: (role: UserRole) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setDensity: (density: AuthState['density']) => void;
  setFeedbackOpen: (open: boolean) => void;
  logout: () => void;
  reloadUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type PersistedState = {
  role?: UserRole;
  sidebarCollapsed?: boolean;
  density?: AuthState['density'];
};

function loadPersisted(): PersistedState {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}

function savePersisted(s: PersistedState) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const kcRef = useRef<Keycloak | null>(null);
  const [state, setState] = useState<AuthState>(() => {
    const saved = loadPersisted();
    return {
      user: null,
      loading: true,
      error: null,
      role: saved.role ?? 'hr',
      authenticated: false,
      sidebarCollapsed: saved.sidebarCollapsed ?? false,
      density: saved.density ?? 'comfortable',
      feedbackOpen: false,
    };
  });

  const loadUser = useCallback(async (role: UserRole) => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const me = await getMe(role);
      setState(s => ({ ...s, user: me, role, loading: false }));
    } catch (e) {
      setState(s => ({ ...s, loading: false, error: (e as Error).message }));
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (AUTH_MODE === 'mock') {
      loadUser(state.role);
      setState(s => ({ ...s, authenticated: true }));
      return;
    }

    const kc = getKeycloak();
    kcRef.current = kc;

    kc.init({
      onLoad: 'login-required',
      checkLoginIframe: false,
      enableLogging: true,
    }).then(async (authenticated) => {
      if (!authenticated) {
        setState(s => ({ ...s, loading: false, authenticated: false }));
        return;
      }

      const roles = getRolesFromToken(kc);
      const role = pickHighestRole(roles);

      setState(s => ({ ...s, authenticated: true, role }));

      try {
        const me = await getMe(role);
        setState(s => ({ ...s, user: me, loading: false }));
      } catch (e) {
        setState(s => ({ ...s, loading: false, error: (e as Error).message }));
      }
    }).catch((err) => {
      console.error('Keycloak init failed:', err);
      setState(s => ({
        ...s,
        loading: false,
        error: 'Не удалось подключиться к Keycloak. Проверьте что Keycloak запущен на порту 8080.',
      }));
    });

    kc.onTokenExpired = () => {
      kc.updateToken(30).catch(() => {
        kc.login();
      });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (AUTH_MODE === 'mock' && state.authenticated) {
      loadUser(state.role);
    }
  }, [state.role, state.authenticated, loadUser]);

  useEffect(() => {
    savePersisted({
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

  const setSidebarCollapsed = useCallback((v: boolean) => {
    setState(s => ({ ...s, sidebarCollapsed: v }));
  }, []);

  const setDensity = useCallback((density: AuthState['density']) => {
    setState(s => ({ ...s, density }));
  }, []);

  const setFeedbackOpen = useCallback((feedbackOpen: boolean) => {
    setState(s => ({ ...s, feedbackOpen }));
  }, []);

  const logout = useCallback(() => {
    if (AUTH_MODE === 'mock') {
      setState(s => ({ ...s, authenticated: false, user: null }));
      return;
    }
    kcRef.current?.logout({ redirectUri: window.location.origin });
  }, []);

  const reloadUser = useCallback(() => loadUser(state.role), [loadUser, state.role]);

  return (
    <AuthContext.Provider value={{
      ...state,
      setRole, setSidebarCollapsed, setDensity, setFeedbackOpen, logout, reloadUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function isMockAuth() {
  return AUTH_MODE === 'mock';
}
