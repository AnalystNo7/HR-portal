'use client';

import React from 'react';
import { Typography, Card, Empty, Tabs } from 'antd';
import EmployeeTable from '@/components/EmployeeTable';

const { Title } = Typography;

export default function HrPage() {
  return (
    <div>
      <Title level={3} style={{ marginTop: 0 }}>Кабинет HR</Title>
      <Tabs
        items={[
          {
            key: 'employees',
            label: 'Все сотрудники',
            children: <EmployeeTable />,
          },
          {
            key: 'appeals',
            label: 'Обращения',
            children: (
              <Card style={{ borderRadius: 12 }}>
                <Empty description="Обращения будут реализованы в следующей итерации" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}
