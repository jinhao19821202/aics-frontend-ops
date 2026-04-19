import { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Descriptions,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';
import {
  tenantApi,
  type TenantCreateRequest,
  type TenantCreateResponse,
  type TenantPatch,
  type TenantView,
} from '@/api/endpoints';
import { useOpsAuth } from '@/store/auth';

const PLAN_OPTIONS = ['free', 'basic', 'standard', 'pro', 'enterprise'];
const STATUS_OPTIONS = ['active', 'suspended', 'trial', 'closed'];
const CREATE_STATUS_OPTIONS: Array<'trial' | 'active'> = ['trial', 'active'];

interface CreateFormValues {
  code: string;
  name: string;
  status: 'trial' | 'active';
  plan: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  quotaKbDocs?: number;
  quotaMonthlyTokens?: number;
  adminUsername: string;
  adminDisplayName?: string;
  adminPassword?: string;
  llmMode: 'managed' | 'self';
  chatProvider?: string;
  chatModel?: string;
  chatApiKey?: string;
  chatBaseUrl?: string;
  embeddingProvider?: string;
  embeddingModel?: string;
  embeddingApiKey?: string;
  embeddingBaseUrl?: string;
  embeddingDim?: number;
}

export default function TenantsPage() {
  const qc = useQueryClient();
  const { isAdmin } = useOpsAuth();
  const admin = isAdmin();

  const [editing, setEditing] = useState<TenantView | null>(null);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<TenantCreateResponse | null>(null);
  const [resetFor, setResetFor] = useState<TenantView | null>(null);
  const [resetResult, setResetResult] = useState<{ tenantCode: string; password: string } | null>(null);

  const [patchForm] = Form.useForm<TenantPatch>();
  const [createForm] = Form.useForm<CreateFormValues>();
  const [resetForm] = Form.useForm<{ userId: number }>();

  const llmMode = Form.useWatch('llmMode', createForm);

  const { data = [], isLoading } = useQuery({
    queryKey: ['ops-tenants'],
    queryFn: () => tenantApi.list(),
  });

  const updateMutation = useMutation({
    mutationFn: (args: { id: number; patch: TenantPatch }) => tenantApi.update(args.id, args.patch),
    onSuccess: () => {
      message.success('已更新');
      setEditing(null);
      qc.invalidateQueries({ queryKey: ['ops-tenants'] });
    },
  });

  const createMutation = useMutation({
    mutationFn: (body: TenantCreateRequest) => tenantApi.create(body),
    onSuccess: (resp) => {
      message.success('租户已创建');
      setCreating(false);
      createForm.resetFields();
      setCreated(resp);
      qc.invalidateQueries({ queryKey: ['ops-tenants'] });
    },
  });

  const resetMutation = useMutation({
    mutationFn: (args: { tenantId: number; userId: number }) =>
      tenantApi.resetAdminPassword(args.tenantId, args.userId),
    onSuccess: (resp, vars) => {
      const tenant = data.find((t) => t.id === vars.tenantId);
      setResetFor(null);
      resetForm.resetFields();
      setResetResult({ tenantCode: tenant?.code || String(vars.tenantId), password: resp.password });
    },
  });

  const openEdit = (row: TenantView) => {
    setEditing(row);
    patchForm.setFieldsValue({
      plan: row.plan,
      status: row.status,
      quotaKbDocs: row.quotaKbDocs,
      quotaMonthlyTokens: row.quotaMonthlyTokens,
      contactName: row.contactName,
      contactPhone: row.contactPhone,
    });
  };

  const openCreate = () => {
    createForm.resetFields();
    createForm.setFieldsValue({
      status: 'trial',
      plan: 'basic',
      llmMode: 'managed',
    });
    setCreating(true);
  };

  const submitCreate = (values: CreateFormValues) => {
    const body: TenantCreateRequest = {
      code: values.code.trim().toLowerCase(),
      name: values.name.trim(),
      status: values.status,
      plan: values.plan,
      contactName: values.contactName,
      contactPhone: values.contactPhone,
      contactEmail: values.contactEmail,
      quotaKbDocs: values.quotaKbDocs,
      quotaMonthlyTokens: values.quotaMonthlyTokens,
      admin: {
        username: values.adminUsername.trim(),
        displayName: values.adminDisplayName,
        password: values.adminPassword?.trim() || undefined,
      },
    };
    if (values.llmMode === 'self') {
      const llm: TenantCreateRequest['llm'] = { mode: 'self' };
      if (values.chatApiKey && values.chatModel) {
        llm.chat = {
          provider: values.chatProvider || 'dashscope',
          model: values.chatModel,
          apiKey: values.chatApiKey,
          baseUrl: values.chatBaseUrl,
        };
      }
      if (values.embeddingApiKey && values.embeddingModel) {
        llm.embedding = {
          provider: values.embeddingProvider || 'dashscope',
          model: values.embeddingModel,
          apiKey: values.embeddingApiKey,
          baseUrl: values.embeddingBaseUrl,
          embeddingDim: values.embeddingDim,
        };
      }
      if (llm.chat || llm.embedding) body.llm = llm;
    }
    createMutation.mutate(body);
  };

  const columns = useMemo<ColumnsType<TenantView>>(
    () => [
      { title: 'ID', dataIndex: 'id', width: 70 },
      { title: '租户编码', dataIndex: 'code', width: 140 },
      { title: '名称', dataIndex: 'name' },
      {
        title: '状态',
        dataIndex: 'status',
        width: 100,
        render: (v: string) => (
          <Tag color={v === 'active' ? 'green' : v === 'suspended' ? 'orange' : v === 'closed' ? 'red' : 'blue'}>{v}</Tag>
        ),
      },
      { title: '套餐', dataIndex: 'plan', width: 110, render: (v: string) => <Tag color="geekblue">{v}</Tag> },
      { title: 'KB 文档配额', dataIndex: 'quotaKbDocs', width: 120, align: 'right' },
      {
        title: '月度 Token 配额',
        dataIndex: 'quotaMonthlyTokens',
        width: 160,
        align: 'right',
        render: (v: number) => v?.toLocaleString(),
      },
      { title: '联系人', dataIndex: 'contactName', width: 120 },
      { title: '联系电话', dataIndex: 'contactPhone', width: 140 },
      {
        title: '向量集合',
        dataIndex: 'milvusCollection',
        width: 200,
        render: (v?: string, row?: TenantView) => (
          <Space direction="vertical" size={0}>
            <Typography.Text code>{v || '-'}</Typography.Text>
            {row?.reindexStatus && row.reindexStatus !== 'idle' && (
              <Tag color={row.reindexStatus === 'failed' ? 'red' : 'processing'}>{row.reindexStatus}</Tag>
            )}
          </Space>
        ),
      },
      {
        title: '操作',
        key: 'ops',
        width: 180,
        fixed: 'right',
        render: (_, row) =>
          admin ? (
            <Space size="small">
              <Button type="link" size="small" onClick={() => openEdit(row)}>
                编辑
              </Button>
              <Button
                type="link"
                size="small"
                onClick={() => {
                  resetForm.resetFields();
                  setResetFor(row);
                }}
              >
                重置管理员密码
              </Button>
            </Space>
          ) : (
            <Typography.Text type="secondary">只读</Typography.Text>
          ),
      },
    ],
    [admin, resetForm],
  );

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      message.success('已复制');
    } catch {
      message.error('复制失败，请手动选择');
    }
  };

  const buildCreatedSummary = (r: TenantCreateResponse): string => {
    const lines = [
      `租户编码：${r.tenant.code}`,
      `租户名称：${r.tenant.name}`,
      `管理员账号：${r.admin.username}`,
    ];
    if (r.admin.generatedPassword) lines.push(`初始密码：${r.admin.generatedPassword}`);
    lines.push(`登录地址：${r.loginUrl}`);
    if (r.llm.length > 0) {
      lines.push('LLM 配置：');
      r.llm.forEach((c) => lines.push(`  · ${c.purpose} ${c.provider}/${c.model}`));
    }
    lines.push(`向量库初始化：${r.milvusProvisioned ? '成功' : '未执行/失败'}`);
    return lines.join('\n');
  };

  return (
    <>
      <Space style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          租户管理
        </Typography.Title>
        <Space>
          {admin && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              新建租户
            </Button>
          )}
          <Button onClick={() => qc.invalidateQueries({ queryKey: ['ops-tenants'] })}>刷新</Button>
        </Space>
      </Space>
      <Table<TenantView>
        rowKey="id"
        size="middle"
        loading={isLoading}
        dataSource={data}
        columns={columns}
        scroll={{ x: 1480 }}
        pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 个租户` }}
      />

      <Modal
        title={editing ? `编辑租户 · ${editing.code}` : ''}
        open={!!editing}
        onCancel={() => setEditing(null)}
        onOk={() => patchForm.submit()}
        okText="保存"
        cancelText="取消"
        confirmLoading={updateMutation.isPending}
        destroyOnClose
      >
        <Form
          form={patchForm}
          layout="vertical"
          onFinish={(values) => {
            if (!editing) return;
            updateMutation.mutate({ id: editing.id, patch: values });
          }}
        >
          <Form.Item label="套餐" name="plan">
            <Select options={PLAN_OPTIONS.map((v) => ({ value: v, label: v }))} allowClear />
          </Form.Item>
          <Form.Item label="状态" name="status">
            <Select options={STATUS_OPTIONS.map((v) => ({ value: v, label: v }))} allowClear />
          </Form.Item>
          <Form.Item label="KB 文档配额" name="quotaKbDocs" rules={[{ type: 'number', min: 0, message: '必须 ≥ 0' }]}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item
            label="月度 Token 配额"
            name="quotaMonthlyTokens"
            rules={[{ type: 'number', min: 0, message: '必须 ≥ 0' }]}
          >
            <InputNumber style={{ width: '100%' }} min={0} step={10000} />
          </Form.Item>
          <Form.Item label="联系人" name="contactName">
            <Input />
          </Form.Item>
          <Form.Item label="联系电话" name="contactPhone">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="新建租户"
        open={creating}
        onCancel={() => setCreating(false)}
        onOk={() => createForm.submit()}
        okText="创建"
        cancelText="取消"
        confirmLoading={createMutation.isPending}
        width={720}
        destroyOnClose
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="创建后将生成一次性初始密码，请立即交付给租户。若选择『自管 LLM』并填写 Embedding，将尝试初始化向量集合。"
        />
        <Form form={createForm} layout="vertical" onFinish={submitCreate} preserve={false}>
          <Divider orientation="left" plain>
            基本信息
          </Divider>
          <Form.Item
            label="租户编码 (code)"
            name="code"
            rules={[
              { required: true, message: '必填' },
              { pattern: /^[a-z0-9][a-z0-9-]{2,31}$/, message: '3-32 位小写字母/数字/-，不能以 - 开头' },
            ]}
            extra="用于子域名 / URL 识别，创建后不可修改"
          >
            <Input placeholder="例如 acme" />
          </Form.Item>
          <Form.Item label="租户名称" name="name" rules={[{ required: true, message: '必填' }]}>
            <Input placeholder="Acme Inc." />
          </Form.Item>
          <Form.Item label="状态" name="status" rules={[{ required: true }]}>
            <Radio.Group
              options={CREATE_STATUS_OPTIONS.map((v) => ({
                label: v === 'trial' ? 'trial（14 天试用）' : 'active',
                value: v,
              }))}
              optionType="button"
            />
          </Form.Item>
          <Form.Item label="联系人" name="contactName">
            <Input />
          </Form.Item>
          <Form.Item label="联系电话" name="contactPhone">
            <Input />
          </Form.Item>
          <Form.Item label="联系邮箱" name="contactEmail" rules={[{ type: 'email', message: '邮箱格式不正确' }]}>
            <Input />
          </Form.Item>

          <Divider orientation="left" plain>
            套餐与配额
          </Divider>
          <Form.Item label="套餐" name="plan" rules={[{ required: true }]}>
            <Select options={PLAN_OPTIONS.map((v) => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item
            label="KB 文档配额（留空使用套餐默认）"
            name="quotaKbDocs"
            rules={[{ type: 'number', min: 0, message: '必须 ≥ 0' }]}
          >
            <InputNumber style={{ width: '100%' }} min={0} placeholder="留空使用套餐默认" />
          </Form.Item>
          <Form.Item
            label="月度 Token 配额（留空使用套餐默认）"
            name="quotaMonthlyTokens"
            rules={[{ type: 'number', min: 0, message: '必须 ≥ 0' }]}
          >
            <InputNumber style={{ width: '100%' }} min={0} step={10000} placeholder="留空使用套餐默认" />
          </Form.Item>

          <Divider orientation="left" plain>
            初始管理员
          </Divider>
          <Form.Item
            label="账号"
            name="adminUsername"
            rules={[
              { required: true, message: '必填' },
              { pattern: /^[a-zA-Z0-9_.-]{3,32}$/, message: '3-32 位字母/数字/._-' },
            ]}
            extra="账号 admin 仅保留给默认租户"
          >
            <Input placeholder="例如 owner" />
          </Form.Item>
          <Form.Item label="显示名" name="adminDisplayName">
            <Input placeholder="可选" />
          </Form.Item>
          <Form.Item
            label="初始密码"
            name="adminPassword"
            rules={[
              {
                validator: (_, val) => {
                  if (!val) return Promise.resolve();
                  if (val.length < 8) return Promise.reject(new Error('≥ 8 位'));
                  if (!/[A-Za-z]/.test(val) || !/\d/.test(val))
                    return Promise.reject(new Error('需包含字母和数字'));
                  return Promise.resolve();
                },
              },
            ]}
            extra="留空则系统生成 8 位随机密码，并要求首次登录修改"
          >
            <Input.Password placeholder="留空自动生成" />
          </Form.Item>

          <Divider orientation="left" plain>
            LLM 初始配置（可选）
          </Divider>
          <Form.Item label="模式" name="llmMode" rules={[{ required: true }]}>
            <Radio.Group
              options={[
                { label: '平台托管（共享默认 Key）', value: 'managed' },
                { label: '租户自管（单独 Key）', value: 'self' },
              ]}
              optionType="button"
            />
          </Form.Item>

          {llmMode === 'self' && (
            <>
              <Typography.Text type="secondary">Chat 模型（至少提供 apiKey + model 才会保存）</Typography.Text>
              <Form.Item label="Provider" name="chatProvider" style={{ marginTop: 8 }}>
                <Input placeholder="dashscope" />
              </Form.Item>
              <Form.Item label="Model" name="chatModel">
                <Input placeholder="qwen-plus" />
              </Form.Item>
              <Form.Item label="API Key" name="chatApiKey">
                <Input.Password placeholder="sk-..." />
              </Form.Item>
              <Form.Item label="Base URL" name="chatBaseUrl">
                <Input placeholder="可选" />
              </Form.Item>

              <Typography.Text type="secondary">Embedding 模型（含 dim 将初始化向量集合）</Typography.Text>
              <Form.Item label="Provider" name="embeddingProvider" style={{ marginTop: 8 }}>
                <Input placeholder="dashscope" />
              </Form.Item>
              <Form.Item label="Model" name="embeddingModel">
                <Input placeholder="text-embedding-v3" />
              </Form.Item>
              <Form.Item label="API Key" name="embeddingApiKey">
                <Input.Password placeholder="sk-..." />
              </Form.Item>
              <Form.Item label="Base URL" name="embeddingBaseUrl">
                <Input placeholder="可选" />
              </Form.Item>
              <Form.Item label="向量维度" name="embeddingDim" rules={[{ type: 'number', min: 1 }]}>
                <InputNumber style={{ width: '100%' }} min={1} placeholder="例如 1024" />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>

      <Modal
        title="租户创建成功"
        open={!!created}
        onCancel={() => setCreated(null)}
        footer={[
          <Button
            key="copy"
            onClick={() => created && copyToClipboard(buildCreatedSummary(created))}
          >
            复制全部
          </Button>,
          <Button key="close" type="primary" onClick={() => setCreated(null)}>
            我已记录，关闭
          </Button>,
        ]}
        width={600}
        maskClosable={false}
      >
        {created && (
          <>
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
              message="初始密码仅显示一次，请立即复制并交付给租户管理员。"
            />
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="租户编码">
                <Typography.Text code copyable>
                  {created.tenant.code}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="租户名称">{created.tenant.name}</Descriptions.Item>
              <Descriptions.Item label="管理员账号">
                <Typography.Text code copyable>
                  {created.admin.username}
                </Typography.Text>
              </Descriptions.Item>
              {created.admin.generatedPassword && (
                <Descriptions.Item label="初始密码">
                  <Typography.Text code copyable>
                    {created.admin.generatedPassword}
                  </Typography.Text>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="登录地址">
                <Typography.Text copyable={{ text: created.loginUrl }}>{created.loginUrl}</Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="向量库初始化">
                {created.milvusProvisioned ? (
                  <Tag color="green">成功</Tag>
                ) : (
                  <Tag color="orange">未执行 / 失败（可稍后在租户设置中补建）</Tag>
                )}
              </Descriptions.Item>
              {created.llm.length > 0 && (
                <Descriptions.Item label="LLM 配置">
                  <Space direction="vertical" size={0}>
                    {created.llm.map((c) => (
                      <span key={c.id}>
                        <Tag>{c.purpose}</Tag>
                        {c.provider} / {c.model}
                      </span>
                    ))}
                  </Space>
                </Descriptions.Item>
              )}
            </Descriptions>
          </>
        )}
      </Modal>

      <Modal
        title={resetFor ? `重置管理员密码 · ${resetFor.code}` : ''}
        open={!!resetFor}
        onCancel={() => setResetFor(null)}
        onOk={() => resetForm.submit()}
        okText="重置"
        cancelText="取消"
        confirmLoading={resetMutation.isPending}
        destroyOnClose
      >
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="重置后将生成新的一次性密码，原密码立即失效。"
        />
        <Form
          form={resetForm}
          layout="vertical"
          onFinish={(values) => {
            if (!resetFor) return;
            resetMutation.mutate({ tenantId: resetFor.id, userId: values.userId });
          }}
        >
          <Form.Item
            label="管理员用户 ID"
            name="userId"
            rules={[{ required: true, type: 'number', min: 1, message: '请输入有效用户 ID' }]}
            extra="在 admin_user 表中按 tenant_id 查询该租户的管理员 ID"
          >
            <InputNumber style={{ width: '100%' }} min={1} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="密码已重置"
        open={!!resetResult}
        onCancel={() => setResetResult(null)}
        footer={[
          <Button
            key="copy"
            onClick={() => resetResult && copyToClipboard(resetResult.password)}
          >
            复制密码
          </Button>,
          <Button key="close" type="primary" onClick={() => setResetResult(null)}>
            关闭
          </Button>,
        ]}
        maskClosable={false}
      >
        {resetResult && (
          <>
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
              message="新密码仅显示一次，请立即复制。下次登录时用户将被要求修改。"
            />
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="租户">{resetResult.tenantCode}</Descriptions.Item>
              <Descriptions.Item label="新密码">
                <Typography.Text code copyable>
                  {resetResult.password}
                </Typography.Text>
              </Descriptions.Item>
            </Descriptions>
          </>
        )}
      </Modal>
    </>
  );
}
