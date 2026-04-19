import { Button, Card, Form, Input, Typography, message } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { authApi } from '@/api/endpoints';
import { useOpsAuth } from '@/store/auth';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setSession } = useOpsAuth();

  const onFinish = async (values: { username: string; password: string }) => {
    try {
      const resp = await authApi.login(values.username, values.password);
      setSession(resp.accessToken, resp.refreshToken, resp.user);
      message.success('登录成功');
      const from = (location.state as any)?.from?.pathname || '/tenants';
      navigate(from, { replace: true });
    } catch {
      /* interceptor toasted */
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a' }}>
      <Card style={{ width: 400 }} bordered={false}>
        <Typography.Title level={3} style={{ textAlign: 'center', marginBottom: 24 }}>
          运营平台登录
        </Typography.Title>
        <Form layout="vertical" onFinish={onFinish} initialValues={{ username: 'opsadmin', password: 'Admin@123' }}>
          <Form.Item label="账号" name="username" rules={[{ required: true, message: '请输入账号' }]}>
            <Input autoComplete="username" />
          </Form.Item>
          <Form.Item label="密码" name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            登录
          </Button>
        </Form>
      </Card>
    </div>
  );
}
