'use client';

import React from 'react';
import { Typography, Tabs } from 'antd';
import EmployeeTable from '@/components/EmployeeTable';

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
            children: <EmployeeTable managerId="1" />,
          },
        ]}
      />
    </div>
  );
}
