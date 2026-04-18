'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Table, Input, Select, Avatar, Space, Typography, Card, Tag } from 'antd';
import { UserOutlined, SearchOutlined } from '@ant-design/icons';
import type { TablePaginationConfig } from 'antd/es/table';
import type { SorterResult } from 'antd/es/table/interface';
import { getEmployees, getDepartments, Employee, PaginatedResult } from '@/lib/api';

const { Text } = Typography;

interface EmployeeTableProps {
  managerId?: string;
}

export default function EmployeeTable({ managerId }: EmployeeTableProps) {
  const [data, setData] = useState<PaginatedResult<Employee> | null>(null);
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState<string>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortField, setSortField] = useState('lastName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getEmployees({
        page,
        limit: pageSize,
        search: search || undefined,
        department: department || undefined,
        managerId,
        sortField,
        sortOrder,
      });
      setData(result);
    } catch (err) {
      setError('Не удалось загрузить данные. Убедитесь, что backend запущен на порту 4000.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, department, managerId, sortField, sortOrder]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    getDepartments()
      .then(setDepartments)
      .catch(() => {});
  }, []);

  const handleTableChange = (
    pagination: TablePaginationConfig,
    _filters: Record<string, unknown>,
    sorter: SorterResult<Employee> | SorterResult<Employee>[],
  ) => {
    setPage(pagination.current || 1);
    setPageSize(pagination.pageSize || 10);

    if (!Array.isArray(sorter) && sorter.field) {
      setSortField(sorter.field as string);
      setSortOrder(sorter.order === 'descend' ? 'desc' : 'asc');
    }
  };

  const columns = [
    {
      title: 'ФИО',
      key: 'fullName',
      sorter: true,
      render: (_: unknown, record: Employee) => (
        <Space>
          <Avatar size={36} icon={<UserOutlined />} style={{ background: '#0078C1' }} />
          <div>
            <Text strong style={{ display: 'block' }}>
              {record.lastName} {record.firstName} {record.middleName}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.personnelNumber}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Должность',
      dataIndex: 'position',
      key: 'position',
      sorter: true,
    },
    {
      title: 'Подразделение',
      dataIndex: 'department',
      key: 'department',
      sorter: true,
      render: (dept: string) => <Tag color="blue">{dept}</Tag>,
    },
    {
      title: 'E-mail',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Дата приёма',
      dataIndex: 'hireDate',
      key: 'hireDate',
      sorter: true,
      render: (date: string) =>
        date ? new Date(date).toLocaleDateString('ru-RU') : '—',
    },
  ];

  if (error) {
    return (
      <Card style={{ borderRadius: 12 }}>
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Text type="danger" style={{ fontSize: 16 }}>
            {error}
          </Text>
          <div style={{ marginTop: 8 }}>
            <Text type="secondary">
              Запустите: cd backend && npm run start:dev
            </Text>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }} size={12}>
        <Input
          placeholder="Поиск по ФИО, должности..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          style={{ width: 280 }}
          allowClear
        />
        <Select
          placeholder="Подразделение"
          value={department || undefined}
          onChange={(value) => {
            setDepartment(value || '');
            setPage(1);
          }}
          style={{ width: 250 }}
          allowClear
          options={departments.map((d) => ({ value: d, label: d }))}
        />
      </Space>

      <Table
        columns={columns}
        dataSource={data?.data || []}
        rowKey="id"
        loading={loading}
        onChange={handleTableChange}
        pagination={{
          current: data?.page || 1,
          pageSize: data?.limit || 10,
          total: data?.total || 0,
          showTotal: (total) => `Всего: ${total}`,
          showSizeChanger: true,
          pageSizeOptions: ['10', '25', '50'],
        }}
        style={{ borderRadius: 12 }}
      />
    </div>
  );
}
