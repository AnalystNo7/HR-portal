'use client';

import React from 'react';
import { Layout, Avatar, Dropdown, Space, Select, Typography } from 'antd';
import {
  UserOutlined,
  BellOutlined,
  LogoutOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { useAuth, UserRole } from '@/contexts/AuthContext';

const { Header } = Layout;
const { Text } = Typography;

export default function AppHeader() {
  const { user, setRole } = useAuth();

  const fullName = `${user.lastName} ${user.firstName}`;

  const roleLabels: Record<UserRole, string> = {
    employee: 'Сотрудник',
    manager: 'Руководитель',
    hr: 'HR-специалист',
  };

  return (
    <Header
      style={{
        background: '#fff',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #f0f0f0',
        height: 64,
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      <div />

      <Space size={16} align="center">
        <Select
          size="small"
          value={user.role}
          onChange={(value) => setRole(value)}
          options={[
            { value: 'employee', label: '👤 Сотрудник' },
            { value: 'manager', label: '👥 Руководитель' },
            { value: 'hr', label: '⚙️ HR-специалист' },
          ]}
          style={{ width: 170 }}
          variant="borderless"
          prefix={<SwapOutlined />}
        />

        <BellOutlined style={{ fontSize: 18, color: '#595959', cursor: 'pointer' }} />

        <Dropdown
          menu={{
            items: [
              {
                key: 'logout',
                icon: <LogoutOutlined />,
                label: 'Выход',
              },
            ],
          }}
          placement="bottomRight"
        >
          <Space style={{ cursor: 'pointer' }}>
            <Avatar
              size={36}
              icon={<UserOutlined />}
              style={{ background: '#0078C1' }}
            />
            <div style={{ lineHeight: '20px' }}>
              <Text strong style={{ fontSize: 14, display: 'block' }}>
                {fullName}
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {roleLabels[user.role]}
              </Text>
            </div>
          </Space>
        </Dropdown>
      </Space>
    </Header>
  );
}
