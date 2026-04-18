'use client';

import React from 'react';
import { Typography, Card, Empty, Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';

const { Title } = Typography;

export default function AppealsPage() {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ marginTop: 0 }}>Обращения</Title>
        <Button type="primary" icon={<PlusOutlined />}>
          Новое обращение
        </Button>
      </div>
      <Card style={{ borderRadius: 12 }}>
        <Empty
          description="У вас пока нет обращений"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </Card>
    </div>
  );
}
