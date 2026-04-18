'use client';

import React from 'react';
import { Row, Col, Card, Typography, Progress, Button, Space } from 'antd';
import {
  UserOutlined,
  ReadOutlined,
  RocketOutlined,
  SolutionOutlined,
  MessageOutlined,
  BarChartOutlined,
  TeamOutlined,
  SettingOutlined,
  MailOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const { Title, Text, Paragraph } = Typography;

const tiles = [
  { key: '/lk', title: 'Личный кабинет', icon: <UserOutlined />, color: '#0078C1', active: true },
  { key: '/culture', title: 'Корп. культура', icon: <ReadOutlined />, color: '#0078C1', active: false },
  { key: '/career', title: 'Карьера', icon: <RocketOutlined />, color: '#0078C1', active: false },
  { key: '/adaptation', title: 'Адаптация', icon: <SolutionOutlined />, color: '#0078C1', active: false },
  { key: '/appeals', title: 'Обращения', icon: <MessageOutlined />, color: '#0078C1', active: true },
  { key: '/surveys', title: 'Опросы', icon: <BarChartOutlined />, color: '#0078C1', active: false },
  { key: '/manager', title: 'Кабинет руководителя', icon: <TeamOutlined />, color: '#0078C1', active: true, roles: ['manager', 'hr'] },
  { key: '/hr', title: 'Кабинет HR', icon: <SettingOutlined />, color: '#0078C1', active: true, roles: ['hr'] },
];

const values = [
  { title: 'Профессионализм и результат', color: '#E8F4FD' },
  { title: 'Работа в команде', color: '#FFF3E0' },
  { title: 'Командная работа', color: '#E8F4FD' },
  { title: 'Забота о людях', color: '#FFF3E0' },
];

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuth();

  const visibleTiles = tiles.filter((tile) => {
    if (tile.roles) {
      return tile.roles.includes(user.role);
    }
    return true;
  });

  const handleTileClick = (tile: typeof tiles[0]) => {
    if (tile.active) {
      router.push(tile.key);
    }
  };

  return (
    <div>
      <Row gutter={[24, 24]} align="top">
        <Col flex="1">
          <Title level={2} style={{ marginBottom: 4, marginTop: 0 }}>
            HR-портал
          </Title>
          <Title level={4} style={{ fontWeight: 400, marginTop: 0, color: '#0078C1' }}>
            Привет, {user.firstName}!
          </Title>
          <Paragraph type="secondary" style={{ maxWidth: 600, fontSize: 14 }}>
            Добро пожаловать в раздел HR-сервисов. Здесь можно найти полезную информацию на&nbsp;тему
            кадровых вопросов, подать заявления, получить справки и&nbsp;узнать больше о&nbsp;ценностях компании
            и&nbsp;корпоративной культуре.
          </Paragraph>
        </Col>
        <Col>
          <Card
            size="small"
            style={{
              textAlign: 'center',
              width: 200,
              borderRadius: 12,
            }}
          >
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
              Вовлечённость персонала
            </Text>
            <Progress
              type="circle"
              percent={60}
              size={100}
              strokeColor="#0078C1"
              format={(percent) => (
                <span style={{ fontSize: 24, fontWeight: 700, color: '#002B5C' }}>
                  {percent}%
                </span>
              )}
            />
          </Card>
        </Col>
        <Col>
          <Button
            type="primary"
            icon={<MailOutlined />}
            size="large"
            style={{ background: '#002B5C', borderColor: '#002B5C' }}
            onClick={() => router.push('/appeals')}
          >
            Написать письмо в редакцию
          </Button>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 32 }}>
        {visibleTiles.map((tile) => (
          <Col xs={12} sm={8} md={6} key={tile.key}>
            <Card
              hoverable={tile.active}
              onClick={() => handleTileClick(tile)}
              style={{
                textAlign: 'center',
                borderRadius: 12,
                cursor: tile.active ? 'pointer' : 'default',
                opacity: tile.active ? 1 : 0.6,
                height: '100%',
              }}
              styles={{
                body: {
                  padding: '24px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 12,
                },
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: '#E8F4FD',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24,
                  color: tile.color,
                }}
              >
                {tile.icon}
              </div>
              <Text strong style={{ fontSize: 13 }}>
                {tile.title}
              </Text>
              {!tile.active && (
                <Text type="secondary" style={{ fontSize: 11 }}>
                  В разработке
                </Text>
              )}
            </Card>
          </Col>
        ))}
      </Row>

      <div style={{ marginTop: 48 }}>
        <Title level={4}>Ценности компании</Title>
        <Row gutter={[16, 16]}>
          {values.map((value, index) => (
            <Col xs={12} md={6} key={index}>
              <Card
                style={{
                  borderRadius: 12,
                  background: value.color,
                  height: 200,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
                styles={{ body: { padding: 20, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
              >
                <div
                  style={{
                    width: '100%',
                    height: 110,
                    borderRadius: 8,
                    background: 'rgba(255,255,255,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#999',
                    fontSize: 12,
                  }}
                >
                  Иллюстрация
                </div>
                <Text strong style={{ fontSize: 13, marginTop: 12 }}>
                  {value.title}
                </Text>
              </Card>
            </Col>
          ))}
        </Row>
      </div>

      <div style={{ marginTop: 48 }}>
        <Title level={4}>Вопросы и пожелания</Title>
        <Card style={{ borderRadius: 12 }}>
          <Paragraph>
            Какие идеи вы хотели реализовать?
          </Paragraph>
          <Space direction="vertical" size={4}>
            <Text type="secondary">На нашем HR-портале можно оставить свои идеи</Text>
            <Text type="secondary">Воспользоваться инструментами — заявления из Социального пакета</Text>
            <Text type="secondary">Записаться на ТМ-Пикник</Text>
          </Space>
          <div style={{ marginTop: 16 }}>
            <Button
              type="primary"
              onClick={() => router.push('/appeals')}
            >
              Оставить обращение
            </Button>
          </div>
        </Card>
      </div>

      <div
        style={{
          marginTop: 48,
          paddingTop: 16,
          borderTop: '1px solid #f0f0f0',
          display: 'flex',
          justifyContent: 'center',
          gap: 24,
        }}
      >
        <Text type="secondary" style={{ fontSize: 12 }}>© Газпром ЦПС</Text>
        <Text type="secondary" style={{ fontSize: 12 }}>Поддержка</Text>
        <Text type="secondary" style={{ fontSize: 12 }}>Конфиденциальность</Text>
      </div>
    </div>
  );
}
