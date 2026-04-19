import { useMemo, useState } from 'react';
import { Button, Card, Col, DatePicker, Form, Progress, Row, Select, Space, Table, Tag, Typography } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useQuery } from '@tanstack/react-query';
import ReactECharts from 'echarts-for-react';
import type { ColumnsType } from 'antd/es/table';
import { billingApi, tenantApi, type TenantUsage } from '@/api/endpoints';

const { RangePicker } = DatePicker;

interface Filters {
  range: [Dayjs, Dayjs];
  tenantId?: number;
}

export default function UsagePage() {
  const startOfMonth = dayjs().startOf('month');
  const now = dayjs();

  const [filters, setFilters] = useState<Filters>({ range: [startOfMonth, now] });

  const { data: tenants = [] } = useQuery({
    queryKey: ['ops-tenants-brief'],
    queryFn: () => tenantApi.list(),
    staleTime: 60_000,
  });

  const from = filters.range[0].toISOString();
  const to = filters.range[1].toISOString();

  const { data = [], isLoading, refetch } = useQuery({
    queryKey: ['ops-usage', from, to, filters.tenantId],
    queryFn: () => billingApi.usage(from, to, filters.tenantId),
  });

  const totals = useMemo(() => {
    return data.reduce(
      (acc, row) => {
        acc.callCount += row.callCount;
        acc.promptTokens += row.promptTokens;
        acc.completionTokens += row.completionTokens;
        acc.totalTokens += row.totalTokens;
        acc.handoffCount += row.handoffCount;
        return acc;
      },
      { callCount: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, handoffCount: 0 },
    );
  }, [data]);

  const tokensByTenantOption = useMemo(
    () => ({
      tooltip: {},
      grid: { left: 50, right: 20, bottom: 60, top: 30 },
      xAxis: {
        type: 'category',
        data: data.map((r) => r.tenantCode),
        axisLabel: { rotate: 30 },
      },
      yAxis: { type: 'value', name: 'Tokens' },
      series: [
        {
          type: 'bar',
          data: data.map((r) => r.totalTokens),
          itemStyle: { color: '#4f46e5' },
          label: { show: data.length <= 10, position: 'top' },
        },
      ],
    }),
    [data],
  );

  const modelAgg = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach((row) => {
      row.byModel?.forEach((m) => {
        map.set(m.model, (map.get(m.model) || 0) + m.tokens);
      });
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [data]);

  const byModelOption = useMemo(
    () => ({
      tooltip: { trigger: 'item' },
      legend: { bottom: 0 },
      series: [
        {
          type: 'pie',
          radius: ['35%', '65%'],
          data: modelAgg.map(([model, tokens]) => ({ name: model, value: tokens })),
          label: { formatter: '{b}\n{d}%' },
        },
      ],
    }),
    [modelAgg],
  );

  const columns: ColumnsType<TenantUsage> = [
    { title: '租户', dataIndex: 'tenantName', render: (v, r) => `${v} (${r.tenantCode})`, width: 220 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (v) => <Tag color={v === 'active' ? 'green' : 'orange'}>{v}</Tag>,
    },
    { title: '套餐', dataIndex: 'plan', width: 100, render: (v) => <Tag color="geekblue">{v}</Tag> },
    { title: '调用次数', dataIndex: 'callCount', align: 'right', width: 100 },
    { title: 'Prompt', dataIndex: 'promptTokens', align: 'right', width: 120, render: (v: number) => v.toLocaleString() },
    {
      title: 'Completion',
      dataIndex: 'completionTokens',
      align: 'right',
      width: 120,
      render: (v: number) => v.toLocaleString(),
    },
    {
      title: 'Total Tokens',
      dataIndex: 'totalTokens',
      align: 'right',
      width: 140,
      render: (v: number) => <Typography.Text strong>{v.toLocaleString()}</Typography.Text>,
    },
    { title: '转人工', dataIndex: 'handoffCount', align: 'right', width: 90 },
    {
      title: '平均延迟',
      dataIndex: 'avgLatencyMs',
      align: 'right',
      width: 110,
      render: (v: number) => `${Math.round(v)} ms`,
    },
    {
      title: '配额使用率',
      dataIndex: 'quotaUtilization',
      width: 180,
      render: (v: number, row) => {
        const pct = Math.min(100, Math.round(v * 100));
        const status = pct >= 100 ? 'exception' : pct >= 80 ? 'active' : 'normal';
        return (
          <Space direction="vertical" size={0} style={{ width: '100%' }}>
            <Progress percent={pct} size="small" status={status} />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {row.totalTokens.toLocaleString()} / {row.quotaMonthlyTokens?.toLocaleString() || '∞'}
            </Typography.Text>
          </Space>
        );
      },
    },
  ];

  return (
    <>
      <Space style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', width: '100%' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          用量面板
        </Typography.Title>
      </Space>
      <Form
        layout="inline"
        style={{ marginBottom: 16 }}
        initialValues={{ range: filters.range, tenantId: filters.tenantId }}
        onFinish={(values) => setFilters({ range: values.range, tenantId: values.tenantId })}
      >
        <Form.Item label="时间范围" name="range">
          <RangePicker showTime />
        </Form.Item>
        <Form.Item label="租户" name="tenantId" style={{ minWidth: 220 }}>
          <Select
            allowClear
            showSearch
            placeholder="全部"
            optionFilterProp="label"
            options={tenants.map((t) => ({ value: t.id, label: `${t.name} (${t.code})` }))}
            style={{ width: 220 }}
          />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit">
              查询
            </Button>
            <Button onClick={() => refetch()}>刷新</Button>
            <Button
              onClick={() => {
                window.open(billingApi.exportUrl(from, to, filters.tenantId), '_blank');
              }}
            >
              导出 CSV
            </Button>
          </Space>
        </Form.Item>
      </Form>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={5}>
          <Card size="small">
            <Typography.Text type="secondary">调用次数</Typography.Text>
            <Typography.Title level={3} style={{ margin: 0 }}>
              {totals.callCount.toLocaleString()}
            </Typography.Title>
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small">
            <Typography.Text type="secondary">总 Tokens</Typography.Text>
            <Typography.Title level={3} style={{ margin: 0 }}>
              {totals.totalTokens.toLocaleString()}
            </Typography.Title>
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small">
            <Typography.Text type="secondary">Prompt / Completion</Typography.Text>
            <Typography.Title level={4} style={{ margin: 0 }}>
              {totals.promptTokens.toLocaleString()} / {totals.completionTokens.toLocaleString()}
            </Typography.Title>
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Typography.Text type="secondary">转人工</Typography.Text>
            <Typography.Title level={3} style={{ margin: 0 }}>
              {totals.handoffCount}
            </Typography.Title>
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small">
            <Typography.Text type="secondary">租户数</Typography.Text>
            <Typography.Title level={3} style={{ margin: 0 }}>
              {data.length}
            </Typography.Title>
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={14}>
          <Card title="各租户 Token 消耗" size="small">
            <ReactECharts option={tokensByTenantOption} style={{ height: 280 }} />
          </Card>
        </Col>
        <Col span={10}>
          <Card title="模型 Token 分布" size="small">
            <ReactECharts option={byModelOption} style={{ height: 280 }} />
          </Card>
        </Col>
      </Row>

      <Table<TenantUsage>
        rowKey="tenantId"
        size="middle"
        loading={isLoading}
        dataSource={data}
        columns={columns}
        scroll={{ x: 1400 }}
        pagination={{ pageSize: 20 }}
      />
    </>
  );
}
