import { useState } from 'react';
import { Button, Card, DatePicker, Form, InputNumber, Popconfirm, Select, Space, Table, Tag, Typography, message } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';
import { billingApi, tenantApi, type BillingPeriod } from '@/api/endpoints';
import { useOpsAuth } from '@/store/auth';

export default function BillingPeriodsPage() {
  const qc = useQueryClient();
  const { isAdmin } = useOpsAuth();
  const admin = isAdmin();

  const [period, setPeriod] = useState<Dayjs>(dayjs().subtract(1, 'month'));
  const [tenantId, setTenantId] = useState<number | undefined>(undefined);

  const { data: tenants = [] } = useQuery({
    queryKey: ['ops-tenants-brief'],
    queryFn: () => tenantApi.list(),
    staleTime: 60_000,
  });

  const year = period.year();
  const month = period.month() + 1;

  const { data = [], isLoading } = useQuery({
    queryKey: ['ops-billing-periods', year, month, tenantId],
    queryFn: () => billingApi.periods({ year, month, tenantId }),
  });

  const settleMutation = useMutation({
    mutationFn: (args: { year: number; month: number }) => billingApi.settle(args.year, args.month),
    onSuccess: (rows) => {
      message.success(`已结算 ${rows.length} 个租户`);
      qc.invalidateQueries({ queryKey: ['ops-billing-periods'] });
    },
    onError: () => {
      /* http interceptor handles toast */
    },
  });

  const fmtAmount = (v: number | string) => {
    const n = typeof v === 'string' ? Number(v) : v;
    return new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(n);
  };

  const columns: ColumnsType<BillingPeriod> = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    {
      title: '租户',
      dataIndex: 'tenantId',
      width: 220,
      render: (id: number) => {
        const t = tenants.find((x) => x.id === id);
        return t ? `${t.name} (${t.code})` : `#${id}`;
      },
    },
    {
      title: '账期',
      key: 'period',
      width: 110,
      render: (_, r) => `${r.periodYear}-${String(r.periodMonth).padStart(2, '0')}`,
    },
    { title: '调用次数', dataIndex: 'totalCalls', align: 'right', width: 110 },
    { title: 'Prompt', dataIndex: 'promptTokens', align: 'right', width: 130, render: (v: number) => v.toLocaleString() },
    {
      title: 'Completion',
      dataIndex: 'completionTokens',
      align: 'right',
      width: 130,
      render: (v: number) => v.toLocaleString(),
    },
    {
      title: 'Total Tokens',
      dataIndex: 'totalTokens',
      align: 'right',
      width: 140,
      render: (v: number) => <Typography.Text strong>{v.toLocaleString()}</Typography.Text>,
    },
    {
      title: '金额',
      dataIndex: 'amount',
      align: 'right',
      width: 150,
      render: (v, r) => (
        <Typography.Text strong>
          {fmtAmount(v)} <Tag color="gold">{r.currency}</Tag>
        </Typography.Text>
      ),
    },
    {
      title: '生成时间',
      dataIndex: 'generatedAt',
      width: 180,
      render: (v) => dayjs(v).format('YYYY-MM-DD HH:mm:ss'),
    },
  ];

  return (
    <>
      <Space style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', width: '100%' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          月度结算
        </Typography.Title>
      </Space>
      <Form layout="inline" style={{ marginBottom: 16 }}>
        <Form.Item label="账期">
          <DatePicker picker="month" value={period} onChange={(v) => v && setPeriod(v)} allowClear={false} />
        </Form.Item>
        <Form.Item label="租户">
          <Select
            allowClear
            showSearch
            placeholder="全部"
            optionFilterProp="label"
            value={tenantId}
            onChange={(v) => setTenantId(v)}
            options={tenants.map((t) => ({ value: t.id, label: `${t.name} (${t.code})` }))}
            style={{ width: 220 }}
          />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button onClick={() => qc.invalidateQueries({ queryKey: ['ops-billing-periods'] })}>刷新</Button>
            {admin && (
              <Popconfirm
                title={`结算 ${year}-${String(month).padStart(2, '0')}？`}
                description="将按价目 × 用量重新生成该月账单，已有记录将被覆盖。"
                onConfirm={() => settleMutation.mutate({ year, month })}
                okText="结算"
                cancelText="取消"
              >
                <Button type="primary" loading={settleMutation.isPending}>
                  手动结算当前账期
                </Button>
              </Popconfirm>
            )}
          </Space>
        </Form.Item>
      </Form>

      <Table<BillingPeriod>
        rowKey="id"
        size="middle"
        loading={isLoading}
        dataSource={data}
        columns={columns}
        scroll={{ x: 1300 }}
        pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条` }}
        expandable={{
          expandedRowRender: (row) => (
            <Card size="small" title="模型明细" bordered={false}>
              {!row.modelBreakdown || row.modelBreakdown.length === 0 ? (
                <Typography.Text type="secondary">无模型明细</Typography.Text>
              ) : (
                <Table
                  size="small"
                  rowKey={(r: any) => r.model}
                  pagination={false}
                  dataSource={row.modelBreakdown}
                  columns={[
                    { title: '模型', dataIndex: 'model' },
                    { title: '调用', dataIndex: 'calls', align: 'right' },
                    { title: 'Tokens', dataIndex: 'tokens', align: 'right', render: (v: number) => v.toLocaleString() },
                    { title: '单价/千', dataIndex: 'pricePer1k', align: 'right', render: (v) => fmtAmount(v as number) },
                    { title: '金额', dataIndex: 'amount', align: 'right', render: (v) => fmtAmount(v as number) },
                  ]}
                />
              )}
              {row.note && (
                <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                  备注：{row.note}
                </Typography.Paragraph>
              )}
            </Card>
          ),
        }}
      />
    </>
  );
}
