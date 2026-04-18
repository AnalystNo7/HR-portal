'use client';

import React, { ReactNode } from 'react';
import { ConfigProvider, App } from 'antd';
import ruRU from 'antd/locale/ru_RU';
import theme from '@/theme/config';
import { AuthProvider } from '@/contexts/AuthContext';
import MainLayout from '@/components/MainLayout';

export default function AntdProvider({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider theme={theme} locale={ruRU}>
      <App>
        <AuthProvider>
          <MainLayout>{children}</MainLayout>
        </AuthProvider>
      </App>
    </ConfigProvider>
  );
}
