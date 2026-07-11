import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { isOAuthReturnUrl } from '../../utils/oauth';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  const oauthReturn = isOAuthReturnUrl();

  if (loading || (oauthReturn && !isAuthenticated)) {
    return (
      <div className="admin-loading-screen">
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  return children;
}
