'use client';

import React from 'react';
import { Card, Typography, Avatar, Descriptions, Empty, Tabs } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';

const { Title, Text } = Typography;

export default function ProfilePage() {
  const { user } = useAuth();

  return (
    <div>
      <Title level={3} style={{ marginTop: 0 }}>Профиль</Title>

      <Card style={{ borderRadius: 12, marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 24 }}>
          <Avatar size={100} icon={<UserOutlined />} style={{ background: '#0078C1', flexShrink: 0 }} />
          <div>
            <Title level={4} style={{ marginTop: 0, marginBottom: 4 }}>
              {user.lastName} {user.firstName} {user.middleName}
            </Title>
            <Text type="secondary" style={{ display: 'block' }}>{user.position}</Text>
            <Text type="secondary">{user.department}</Text>
          </div>
        </div>
      </Card>

      <Tabs
        items={[
          {
            key: 'info',
            label: 'Основная информация',
            children: (
              <Card style={{ borderRadius: 12 }}>
                <Descriptions column={2} layout="vertical">
                  <Descriptions.Item label="ФИО">
                    {user.lastName} {user.firstName} {user.middleName}
                  </Descriptions.Item>
                  <Descriptions.Item label="E-mail">{user.email}</Descriptions.Item>
                  <Descriptions.Item label="Должность">{user.position}</Descriptions.Item>
                  <Descriptions.Item label="Подразделение">{user.department}</Descriptions.Item>
                </Descriptions>
              </Card>
            ),
          },
          {
            key: 'experience',
            label: 'Опыт работы',
            children: (
              <Card style={{ borderRadius: 12 }}>
                <Empty description="Нет данных об опыте работы" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              </Card>
            ),
          },
          {
            key: 'education',
            label: 'Образование',
            children: (
              <Card style={{ borderRadius: 12 }}>
                <Empty description="Нет данных об образовании" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              </Card>
            ),
          },
          {
            key: 'competencies',
            label: 'Компетенции',
            children: (
              <Card style={{ borderRadius: 12 }}>
                <Empty description="Раздел «Компетенции» в разработке" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}
