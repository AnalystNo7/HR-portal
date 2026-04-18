'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

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
  avatarUrl?: string;
}

interface AuthContextType {
  user: User;
  setRole: (role: UserRole) => void;
}

const mockUsers: Record<UserRole, User> = {
  employee: {
    id: '1',
    firstName: 'Александр',
    lastName: 'Петров',
    middleName: 'Иванович',
    email: 'employee1@gazprom-cps.ru',
    position: 'Инженер-программист',
    department: 'Управление ИТ',
    role: 'employee',
  },
  manager: {
    id: '2',
    firstName: 'Сергей',
    lastName: 'Козлов',
    middleName: 'Владимирович',
    email: 'manager1@gazprom-cps.ru',
    position: 'Начальник отдела',
    department: 'Управление ИТ',
    role: 'manager',
  },
  hr: {
    id: '3',
    firstName: 'Александр',
    lastName: 'Сидоров',
    middleName: 'Петрович',
    email: 'hr1@gazprom-cps.ru',
    position: 'HR-специалист',
    department: 'Управление персоналом',
    role: 'hr',
  },
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole>('hr');
  const user = mockUsers[role];

  return (
    <AuthContext.Provider value={{ user, setRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
