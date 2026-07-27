import { useState } from 'react';
import { Link } from 'react-router-dom';
import { requestAdminPasswordReset } from '../../services/adminAuth';
import { usePageTitle } from '../../hooks/usePageTitle';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  usePageTitle('Forgot password · Zen Menu Admin');

  async function handleSubmit(event) {
    event.preventDefault();

    if (!email.trim() || !email.includes('@')) {
      setError('Enter a valid email address.');
      setInfo('');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setInfo('');

    try {
      const result = await requestAdminPasswordReset(email.trim());
      if (result.error) {
        setError(result.error);
        return;
      }
      setInfo(
        result.message ||
          'If an account exists for that email, password reset instructions will be sent.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-form-view">
      <h2 id="auth-form-title" className="auth-title">
        Forgot password
      </h2>
      <p className="auth-subtitle">Enter your email and we&apos;ll send reset instructions</p>

      {error ? (
        <div className="auth-message auth-message--error" role="alert">
          {error}
        </div>
      ) : null}

      {info ? (
        <div className="auth-message auth-message--success" role="status">
          {info}
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

        <button type="submit" className="auth-primary-btn" disabled={isSubmitting}>
          {isSubmitting ? 'Sending...' : 'Send reset link'}
        </button>
      </form>

      <p className="auth-footer">
        Remembered it?{' '}
        <Link to="/" className="auth-switch-link">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
