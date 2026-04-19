import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import OpsLayout from './layouts/OpsLayout';
import LoginPage from './pages/Login';
import TenantsPage from './pages/Tenants';
import UsagePage from './pages/Usage';
import BillingPeriodsPage from './pages/BillingPeriods';
import AuditLogsPage from './pages/AuditLogs';
import { useOpsAuth } from './store/auth';

const RequireAuth = ({ children }: { children: JSX.Element }) => {
  const { accessToken } = useOpsAuth();
  const location = useLocation();
  if (!accessToken) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
};

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <OpsLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/tenants" replace />} />
        <Route path="tenants" element={<TenantsPage />} />
        <Route path="usage" element={<UsagePage />} />
        <Route path="billing" element={<BillingPeriodsPage />} />
        <Route path="audit" element={<AuditLogsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
