import { Navigate, useLocation } from 'react-router-dom';
import { useStaffAuth } from '../../contexts/StaffAuthContext';

export default function ProtectedStaffRoute({ children }) {
  const { isAuthenticated, loading } = useStaffAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="staff-loading-screen">
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/staff" replace state={{ from: location }} />;
  }

  return children;
}
