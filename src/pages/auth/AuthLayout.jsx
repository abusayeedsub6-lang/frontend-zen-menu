import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import AuthShell from '../../components/auth/AuthShell';
import { useAuth } from '../../contexts/AuthContext';
import '../../styles/auth.css';

export default function AuthLayout() {
  const { isAuthenticated, loading, setAuthError } = useAuth();
  const location = useLocation();

  useEffect(() => {
    setAuthError('');
  }, [location.pathname, setAuthError]);

  if (loading) {
    return (
      <div className="auth-page auth-page--loading">
        <p className="auth-loading-text">Loading...</p>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <AuthShell>
      <Outlet />
    </AuthShell>
  );
}
