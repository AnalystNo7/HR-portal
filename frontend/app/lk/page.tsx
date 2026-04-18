'use client';

import React from 'react';
import { Row, Col, Card, Typography, Avatar } from 'antd';
import {
  UserOutlined,
  MessageOutlined,
  BookOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const { Title, Text } = Typography;

const sections = [
  { key: '/profile', title: 'Профиль', icon: <UserOutlined />, active: true },
  { key: '/appeals', title: 'Мои обращения', icon: <MessageOutlined />, active: true },
  { key: '#', title: 'Заявки на обучение', icon: <BookOutlined />, active: false },
  { key: '#', title: 'ИПР', icon: <FileTextOutlined />, active: false },
];

export default function LkPage() {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <div>
      <Title level={3} style={{ marginTop: 0 }}>Личный кабинет</Title>

      <Card style={{ borderRadius: 12, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Avatar size={64} icon={<UserOutlined />} style={{ background: '#0078C1' }} />
          <div>
            <Text strong style={{ fontSize: 18, display: 'block' }}>
              {user.lastName} {user.firstName} {user.middleName}
            </Text>
            <Text type="secondary">{user.position}</Text>
            <br />
            <Text type="secondary">{user.department}</Text>
          </div>
        </div>
      </Card>

      <Row gutter={[16, 16]}>
        {sections.map((section, index) => (
          <Col xs={12} md={6} key={index}>
            <Card
              hoverable={section.active}
              onClick={() => section.active && router.push(section.key)}
              style={{
                textAlign: 'center',
                borderRadius: 12,
                cursor: section.active ? 'pointer' : 'default',
                opacity: section.active ? 1 : 0.6,
              }}
              styles={{ body: { padding: '32px 16px' } }}
            >
              <div
                style={{
                  fontSize: 32,
                  color: '#0078C1',
                  marginBottom: 12,
                }}
              >
                {section.icon}
              </div>
              <Text strong>{section.title}</Text>
              {!section.active && (
                <div>
                  <Text type="secondary" style={{ fontSize: 11 }}>В разработке</Text>
                </div>
              )}
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
