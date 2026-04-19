import { useMemo } from 'react';
import { Layout, Menu, Dropdown, Avatar, Space, Typography, Tag } from 'antd';
import {
  ShopOutlined,
  LineChartOutlined,
  DollarOutlined,
  AuditOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useOpsAuth } from '@/store/auth';

const { Sider, Content, Header } = Layout;

export default function OpsLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, clear } = useOpsAuth();

  const items = useMemo(() => {
    return [
      { key: '/tenants', icon: <ShopOutlined />, label: '租户管理' },
      { key: '/usage', icon: <LineChartOutlined />, label: '用量面板' },
      { key: '/billing', icon: <DollarOutlined />, label: '月度结算' },
      { key: '/audit', icon: <AuditOutlined />, label: '操作日志' },
    ].map((i) => ({ ...i, label: <Link to={i.key}>{i.label}</Link> }));
  }, []);

  const dropdownItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: () => {
        clear();
        navigate('/login');
      },
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={220} theme="dark" breakpoint="lg">
        <div style={{ height: 48, margin: 12, color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          智能客服 · 运营平台
        </div>
        <Menu theme="dark" mode="inline" selectedKeys={[location.pathname]} items={items} />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          <Dropdown menu={{ items: dropdownItems }}>
            <Space style={{ cursor: 'pointer' }}>
              <Avatar>{(user?.displayName || user?.username || 'U').slice(0, 1)}</Avatar>
              <Typography.Text>{user?.displayName || user?.username}</Typography.Text>
              <Tag color={user?.role === 'ops_admin' ? 'red' : 'blue'}>{user?.role}</Tag>
            </Space>
          </Dropdown>
        </Header>
        <Content style={{ margin: 16, background: '#fff', padding: 16 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
