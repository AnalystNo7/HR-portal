'use client';

import React from 'react';
import { Typography, Card, Empty, Tabs } from 'antd';

const { Title } = Typography;

export default function ManagerPage() {
  return (
    <div>
      <Title level={3} style={{ marginTop: 0 }}>Кабинет руководителя</Title>
      <Tabs
        items={[
          {
            key: 'employees',
            label: 'Сотрудники',
            children: (
              <Card style={{ borderRadius: 12 }}>
                <Empty description="Таблица сотрудников будет реализована в следующей итерации" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}
