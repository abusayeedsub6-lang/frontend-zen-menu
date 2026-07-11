import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useStaffAuth } from '../../contexts/StaffAuthContext';
import { usePageTitle } from '../../hooks/usePageTitle';

export default function StaffLoginPage() {
  const { isAuthenticated, loading, login } = useStaffAuth();
  const [staffName, setStaffName] = useState('');
  const [staffPin, setStaffPin] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  usePageTitle('Staff Login');

  if (!loading && isAuthenticated) {
    return <Navigate to="/staff/dashboard" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const name = staffName.trim();
    const pin = staffPin;

    if (!name) {
      setError('Please enter your staff name');
      return;
    }

    if (pin.length !== 4) {
      setError('PIN must be exactly 4 digits');
      return;
    }

    setIsSubmitting(true);
    setError('');

    const result = await login(name, pin);
    if (result.error) {
      setError(result.error);
      setStaffPin('');
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="staff-login-page">
        <div className="login-container">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="staff-login-page">
      <div className="login-container">
        <div className="login-header">
          <h1>👥 Staff Login</h1>
          <p>Enter your credentials to access</p>
        </div>

        <div className={`error-message${error ? ' show' : ''}`}>{error}</div>

        <form id="loginForm" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="staffName">Staff Name</label>
            <input
              type="text"
              id="staffName"
              name="staffName"
              placeholder="Enter your name"
              required
              autoComplete="off"
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && staffName.trim()) {
                  e.preventDefault();
                  document.getElementById('staffPin')?.focus();
                }
              }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="staffPin">PIN (4 digits)</label>
            <input
              type="password"
              id="staffPin"
              name="staffPin"
              placeholder="0000"
              maxLength={4}
              pattern="[0-9]{4}"
              className="pin-input"
              required
              autoComplete="off"
              value={staffPin}
              onChange={(e) => setStaffPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            />
          </div>

          <button type="submit" className="login-btn" id="loginBtn" disabled={isSubmitting}>
            {isSubmitting ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="help-text">
          Having trouble?
          <br />
          Contact your restaurant admin
        </div>
      </div>
    </div>
  );
}
