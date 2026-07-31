import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  requestAdminPasswordReset,
  resendAdminPasswordOtp,
  resetAdminPassword,
  verifyAdminPasswordOtp,
} from '../../services/adminAuth';
import { useAuth } from '../../contexts/AuthContext';
import { usePageTitle } from '../../hooks/usePageTitle';

const OTP_LENGTH = 4;

function OtpInputs({ value, onChange, disabled }) {
  const inputsRef = useRef([]);

  function setDigit(index, digit) {
    const next = value.split('');
    while (next.length < OTP_LENGTH) next.push('');
    next[index] = digit;
    onChange(next.join('').slice(0, OTP_LENGTH));
  }

  function handleChange(index, event) {
    const raw = event.target.value.replace(/\D/g, '');
    if (!raw) {
      setDigit(index, '');
      return;
    }

    if (raw.length > 1) {
      const chars = raw.slice(0, OTP_LENGTH).split('');
      const next = value.split('');
      while (next.length < OTP_LENGTH) next.push('');
      chars.forEach((char, offset) => {
        if (index + offset < OTP_LENGTH) next[index + offset] = char;
      });
      onChange(next.join('').slice(0, OTP_LENGTH));
      const focusAt = Math.min(index + chars.length, OTP_LENGTH - 1);
      inputsRef.current[focusAt]?.focus();
      return;
    }

    setDigit(index, raw);
    if (index < OTP_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index, event) {
    if (event.key === 'Backspace' && !value[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  }

  function handlePaste(event) {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    onChange(pasted);
    const focusAt = Math.min(pasted.length, OTP_LENGTH) - 1;
    inputsRef.current[Math.max(focusAt, 0)]?.focus();
  }

  return (
    <div className="auth-otp-row" role="group" aria-label="One-time password">
      {Array.from({ length: OTP_LENGTH }, (_, index) => (
        <input
          key={index}
          ref={(el) => {
            inputsRef.current[index] = el;
          }}
          className="auth-otp-input"
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={value[index] || ''}
          onChange={(e) => handleChange(index, e)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          disabled={disabled}
          aria-label={`Digit ${index + 1}`}
        />
      ))}
    </div>
  );
}

export default function ForgotPasswordPage() {
  const { completeAuthSession } = useAuth();
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  usePageTitle(
    step === 'otp'
      ? 'Enter code · Zen Menu Admin'
      : step === 'password'
        ? 'New password · Zen Menu Admin'
        : 'Forgot password · Zen Menu Admin',
  );

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const timer = setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  async function sendOtp(nextEmail) {
    const result = await requestAdminPasswordReset(nextEmail);
    if (result.error) return result;
    setResendIn(result.resendCooldownSeconds || 60);
    setInfo('We sent a 4-digit code to your email.');
    return result;
  }

  async function handleEmailSubmit(event) {
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
      const result = await sendOtp(email.trim());
      if (result.error) {
        setError(result.error);
        return;
      }
      setEmail(email.trim());
      setOtp('');
      setStep('otp');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleOtpSubmit(event) {
    event.preventDefault();
    if (!/^\d{4}$/.test(otp)) {
      setError('Enter the 4-digit code from your email.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setInfo('');
    try {
      const result = await verifyAdminPasswordOtp(email, otp);
      if (result.error) {
        setError(result.error);
        return;
      }
      setResetToken(result.resetToken);
      setPassword('');
      setConfirmPassword('');
      setStep('password');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    if (resendIn > 0 || isSubmitting) return;
    setIsSubmitting(true);
    setError('');
    try {
      const result = await resendAdminPasswordOtp(email);
      if (result.error) {
        setError(result.error);
        if (result.retryAfterSeconds) setResendIn(result.retryAfterSeconds);
        return;
      }
      setOtp('');
      setResendIn(result.resendCooldownSeconds || 60);
      setInfo('A new code was sent to your email.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setInfo('');
    try {
      const result = await resetAdminPassword({ resetToken, password });
      if (result.error) {
        setError(result.error);
        return;
      }
      if (typeof completeAuthSession === 'function') {
        await completeAuthSession(result);
      } else {
        window.location.assign('/admin');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (step === 'otp') {
    return (
      <div className="auth-form-view">
        <h2 id="auth-form-title" className="auth-title">
          Enter verification code
        </h2>
        <div className="auth-sent-to">
          We sent a 4-digit code to
          <span className="auth-sent-to-row">
            <span className="auth-sent-to-email">{email}</span>
            <button
              type="button"
              className="auth-text-btn auth-email-edit"
              onClick={() => {
                setError('');
                setInfo('');
                setOtp('');
                setStep('email');
              }}
            >
              Edit
            </button>
          </span>
        </div>

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

        <form className="auth-form" onSubmit={handleOtpSubmit} noValidate>
          <OtpInputs value={otp} onChange={setOtp} disabled={isSubmitting} />

          <button
            type="submit"
            className="auth-primary-btn"
            disabled={isSubmitting || otp.length !== OTP_LENGTH}
          >
            {isSubmitting ? 'Verifying...' : 'Verify code'}
          </button>
        </form>

        <p className="auth-footer">
          <button
            type="button"
            className="auth-text-btn"
            onClick={handleResend}
            disabled={isSubmitting || resendIn > 0}
          >
            {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
          </button>
        </p>

        <p className="auth-footer">
          <Link to="/" className="auth-switch-link">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  if (step === 'password') {
    return (
      <div className="auth-form-view">
        <h2 id="auth-form-title" className="auth-title">
          Set new password
        </h2>
        <p className="auth-subtitle">Choose a new password for your account</p>

        {error ? (
          <div className="auth-message auth-message--error" role="alert">
            {error}
          </div>
        ) : null}

        <form className="auth-form" onSubmit={handlePasswordSubmit} noValidate>
          <label className="auth-field">
            <span>New password</span>
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
            {isSubmitting ? 'Saving...' : 'Save password'}
          </button>
        </form>

        <p className="auth-footer">
          <Link to="/" className="auth-switch-link">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="auth-form-view">
      <h2 id="auth-form-title" className="auth-title">
        Forgot password
      </h2>
      <p className="auth-subtitle">Enter your email and we&apos;ll send a 4-digit code</p>

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

      <form className="auth-form" onSubmit={handleEmailSubmit} noValidate>
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
          {isSubmitting ? 'Sending...' : 'Send OTP'}
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
