import { useState } from 'react';
import { Button, DatePicker, Descriptions, Form, Input, InputNumber, Space, Table, Tag, Typography } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useQuery } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';
import { auditApi, type AuditLog } from '@/api/endpoints';

const { RangePicker } = DatePicker;

interface Filters {
  action?: string;
  actorId?: number;
  range?: [Dayjs, Dayjs];
}

const ACTION_COLOR: Record<string, string> = {
  'tenant.update': 'blue',
  'billing.settle': 'gold',
  'auth.login': 'green',
  'auth.refresh': 'cyan',
};

export default function AuditLogsPage() {
  const [filters, setFilters] = useState<Filters>({});
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['ops-audit', filters, page, size],
    queryFn: () =>
      auditApi.list({
        action: filters.action || undefined,
        actorId: filters.actorId,
        from: filters.range?.[0]?.toISOString(),
        to: filters.range?.[1]?.toISOString(),
        page,
        size,
      }),
  });

  const columns: ColumnsType<AuditLog> = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    {
      title: '时间',
      dataIndex: 'createdAt',
      width: 180,
      render: (v) => dayjs(v).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '动作',
      dataIndex: 'action',
      width: 160,
      render: (v: string) => <Tag color={ACTION_COLOR[v] || 'default'}>{v}</Tag>,
    },
    {
      title: '操作员',
      key: 'actor',
      width: 160,
      render: (_, r) => (r.actorUsername ? `${r.actorUsername} (#${r.actorId})` : '-'),
    },
    { title: '目标类型', dataIndex: 'targetType', width: 120 },
    { title: '目标键', dataIndex: 'targetKey', width: 160, render: (v) => v || '-' },
    { title: 'IP', dataIndex: 'ip', width: 140, render: (v) => v || '-' },
  ];

  return (
    <>
      <Space style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', width: '100%' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          操作日志
        </Typography.Title>
      </Space>
      <Form
        layout="inline"
        style={{ marginBottom: 16 }}
        onFinish={(values) => {
          setFilters({
            action: values.action,
            actorId: values.actorId,
            range: values.range,
          });
          setPage(1);
        }}
      >
        <Form.Item label="动作" name="action">
          <Input placeholder="如 tenant.update" allowClear style={{ width: 180 }} />
        </Form.Item>
        <Form.Item label="操作员 ID" name="actorId">
          <InputNumber min={1} placeholder="actorId" style={{ width: 140 }} />
        </Form.Item>
        <Form.Item label="时间范围" name="range">
          <RangePicker showTime />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit">
              查询
            </Button>
            <Button onClick={() => refetch()}>刷新</Button>
          </Space>
        </Form.Item>
      </Form>

      <Table<AuditLog>
        rowKey="id"
        size="middle"
        loading={isLoading}
        dataSource={data?.items || []}
        columns={columns}
        scroll={{ x: 1000 }}
        pagination={{
          current: page,
          pageSize: size,
          total: data?.total || 0,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, s) => {
            setPage(p);
            setSize(s);
          },
        }}
        expandable={{
          expandedRowRender: (row) => (
            <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label="User-Agent">
                <Typography.Text code copyable>
                  {row.userAgent || '-'}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="变更前">
                <pre style={{ margin: 0, background: '#fafafa', padding: 8, borderRadius: 4 }}>
                  {row.beforeVal ? JSON.stringify(row.beforeVal, null, 2) : '-'}
                </pre>
              </Descriptions.Item>
              <Descriptions.Item label="变更后">
                <pre style={{ margin: 0, background: '#fafafa', padding: 8, borderRadius: 4 }}>
                  {row.afterVal ? JSON.stringify(row.afterVal, null, 2) : '-'}
                </pre>
              </Descriptions.Item>
            </Descriptions>
          ),
        }}
      />
    </>
  );
}
