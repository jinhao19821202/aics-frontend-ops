import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { message } from 'antd';
import { useOpsAuth } from '@/store/auth';

export const http = axios.create({
  baseURL: '/api',
  timeout: 20000,
});

let refreshing: Promise<string | null> | null = null;

async function refreshAccess(): Promise<string | null> {
  const rt = useOpsAuth.getState().refreshToken;
  if (!rt) return null;
  try {
    const resp = await axios.post('/api/ops/auth/refresh', { refreshToken: rt });
    const next = resp.data?.data?.accessToken;
    if (next) {
      useOpsAuth.getState().setAccess(next);
      return next;
    }
  } catch {}
  return null;
}

http.interceptors.request.use((config) => {
  const tk = useOpsAuth.getState().accessToken;
  if (tk) config.headers.Authorization = `Bearer ${tk}`;
  return config;
});

http.interceptors.response.use(
  (resp) => {
    const body = resp.data;
    if (body && typeof body === 'object' && 'code' in body) {
      if (body.code === 0) return body.data;
      message.error(body.message || '请求失败');
      return Promise.reject(body);
    }
    return resp.data;
  },
  async (error: AxiosError) => {
    const status = error.response?.status;
    if (status === 401 && !(error.config as any)?._retry) {
      const cfg = error.config as AxiosRequestConfig & { _retry?: boolean };
      cfg._retry = true;
      if (!refreshing) refreshing = refreshAccess();
      const next = await refreshing;
      refreshing = null;
      if (next) {
        cfg.headers = { ...cfg.headers, Authorization: `Bearer ${next}` };
        return http(cfg);
      }
      useOpsAuth.getState().clear();
      if (window.location.pathname !== '/login') window.location.href = '/login';
    } else if (status === 403) {
      message.error('权限不足');
    } else {
      message.error((error.response?.data as any)?.message || error.message || '网络错误');
    }
    return Promise.reject(error);
  },
);
