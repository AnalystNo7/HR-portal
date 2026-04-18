'use client';

import React, { ReactNode } from 'react';
import { Typography, Card, Empty } from 'antd';

const { Title } = Typography;

interface PlaceholderPageProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}

export default function PlaceholderPage({ title, subtitle, children }: PlaceholderPageProps) {
  return (
    <div>
      <Title level={3} style={{ marginTop: 0 }}>
        {title}
      </Title>
      {children || (
        <Card style={{ borderRadius: 12 }}>
          <Empty
            description={subtitle || 'Раздел в разработке'}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      )}
    </div>
  );
}
