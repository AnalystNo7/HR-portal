'use client';

import React, { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { RightRail } from './RightRail';
import { ToastProvider } from '@/components/primitives';
import { useAuth } from '@/contexts/AuthContext';

export function AppShell({ children }: { children: ReactNode }) {
  const { sidebarCollapsed } = useAuth();

  return (
    <ToastProvider>
      <div className="app" data-sidebar={sidebarCollapsed ? 'collapsed' : 'expanded'}>
        <Sidebar />
        <Header />
        <main className="main">{children}</main>
        <RightRail />
      </div>
    </ToastProvider>
  );
}
