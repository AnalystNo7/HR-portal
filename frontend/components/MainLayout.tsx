'use client';

import React, { ReactNode } from 'react';
import { Layout } from 'antd';
import Sidebar from './Sidebar';
import AppHeader from './AppHeader';

const { Content } = Layout;

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar />
      <Layout style={{ marginLeft: 220 }}>
        <AppHeader />
        <Content
          style={{
            padding: 24,
            background: '#F5F7FA',
            minHeight: 'calc(100vh - 64px)',
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
