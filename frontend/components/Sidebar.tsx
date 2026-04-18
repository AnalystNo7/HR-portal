'use client';

import React from 'react';
import { Layout, Menu } from 'antd';
import {
  HomeOutlined,
  UserOutlined,
  TeamOutlined,
  MessageOutlined,
  ReadOutlined,
  RocketOutlined,
  SolutionOutlined,
  BarChartOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import type { MenuProps } from 'antd';

const { Sider } = Layout;

type MenuItem = Required<MenuProps>['items'][number];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();

  const menuItems: MenuItem[] = [
    {
      key: '/',
      icon: <HomeOutlined />,
      label: 'Главная',
    },
    {
      key: '/lk',
      icon: <UserOutlined />,
      label: 'Личный кабинет',
    },
    {
      key: '/culture',
      icon: <ReadOutlined />,
      label: 'Корп. культура',
    },
    {
      key: '/career',
      icon: <RocketOutlined />,
      label: 'Карьера',
    },
    {
      key: '/adaptation',
      icon: <SolutionOutlined />,
      label: 'Адаптация',
    },
    {
      key: '/appeals',
      icon: <MessageOutlined />,
      label: 'Обращения',
    },
    {
      key: '/surveys',
      icon: <BarChartOutlined />,
      label: 'Опросы',
    },
    ...(user.role === 'manager' || user.role === 'hr'
      ? [
          {
            key: '/manager',
            icon: <TeamOutlined />,
            label: 'Кабинет руководителя',
          },
        ]
      : []),
    ...(user.role === 'hr'
      ? [
          {
            key: '/hr',
            icon: <SettingOutlined />,
            label: 'Кабинет HR',
          },
        ]
      : []),
  ];

  const selectedKey = menuItems
    .filter((item): item is MenuItem & { key: string } => !!item?.key)
    .map((item) => item.key)
    .filter((key) => key !== '/')
    .find((key) => pathname.startsWith(key as string)) || (pathname === '/' ? '/' : '');

  return (
    <Sider
      width={220}
      style={{
        overflow: 'auto',
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        background: '#002B5C',
      }}
    >
      <div
        style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          cursor: 'pointer',
        }}
        onClick={() => router.push('/')}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #0078C1 0%, #00A3E0 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            ГП
          </div>
          <div style={{ color: '#fff' }}>
            <div style={{ fontWeight: 700, fontSize: 14, lineHeight: '18px' }}>
              ГАЗПРОМ
            </div>
            <div style={{ fontSize: 10, opacity: 0.7, lineHeight: '12px' }}>
              ЦПС
            </div>
          </div>
        </div>
      </div>

      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[selectedKey]}
        items={menuItems}
        onClick={({ key }) => router.push(key)}
        style={{
          background: 'transparent',
          borderRight: 'none',
          marginTop: 8,
        }}
      />
    </Sider>
  );
}
