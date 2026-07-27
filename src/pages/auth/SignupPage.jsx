import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usePageTitle } from '../../hooks/usePageTitle';

export default function SignupPage() {
  const { authError, setAuthError, signup } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  usePageTitle('Sign up · Zen Menu Admin');

  async function handleSubmit(event) {
    event.preventDefault();

    if (!email.trim() || !password) {
      setAuthError('Enter an email and password.');
      return;
    }

    if (password.length < 6) {
      setAuthError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setAuthError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    setAuthError('');
    try {
      await signup({
        email: email.trim(),
        password,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-form-view">
      <h2 id="auth-form-title" className="auth-title">
        Create your account
      </h2>
      <p className="auth-subtitle">Start managing Zen Menu Admin</p>

      {authError ? (
        <div className="auth-message auth-message--error" role="alert">
          {authError}
        </div>
      ) : null}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <label className="auth-field">
          <span>Email</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            placeholder="you@restaurant.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label className="auth-field">
          <span>Password</span>
          <input
            type="password"
            name="password"
            autoComplete="new-password"
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </label>

        <label className="auth-field">
          <span>Confirm password</span>
          <input
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            placeholder="Repeat password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
          />
        </label>

        <button type="submit" className="auth-primary-btn" disabled={isSubmitting}>
          {isSubmitting ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <p className="auth-footer">
        Already have an account?{' '}
        <Link to="/" className="auth-switch-link">
          Sign in
        </Link>
      </p>
    </div>
  );
}
