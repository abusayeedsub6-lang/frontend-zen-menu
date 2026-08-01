import { apiRequest, ApiError } from '../lib/api';

const ADMIN_TOKEN_KEY = 'admin_token';
const ADMIN_ID_KEY = 'admin_id';
const ADMIN_EMAIL_KEY = 'admin_email';
const ADMIN_NAME_KEY = 'admin_name';

function storeAdminSession(token, user) {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
  localStorage.setItem(ADMIN_ID_KEY, user.id);
  localStorage.setItem(ADMIN_EMAIL_KEY, user.email || '');
  localStorage.setItem(ADMIN_NAME_KEY, user.name || '');
}

function clearAdminLocalStorage() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_ID_KEY);
  localStorage.removeItem(ADMIN_EMAIL_KEY);
  localStorage.removeItem(ADMIN_NAME_KEY);
}

export function getAdminSession() {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  const id = localStorage.getItem(ADMIN_ID_KEY);
  const email = localStorage.getItem(ADMIN_EMAIL_KEY);
  const name = localStorage.getItem(ADMIN_NAME_KEY);

  if (!token || !id) return null;

  return {
    token,
    user: {
      id,
      email: email || '',
      name: name || '',
      role: 'admin',
    },
  };
}

export function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

export async function adminLogin(email, password) {
  try {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email, password },
    });

    if (!data?.token || !data?.user?.id) {
      return { error: 'Login failed. Please try again.' };
    }

    storeAdminSession(data.token, data.user);
    return { success: true, user: data.user, token: data.token };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401) {
        return { error: error.message || 'Invalid email or password' };
      }
      return { error: error.message || 'Login failed. Please try again.' };
    }
    console.error('Admin login error:', error);
    return { error: 'An error occurred. Please try again.' };
  }
}

export async function adminSignup({ email, password, name }) {
  try {
    const data = await apiRequest('/auth/signup', {
      method: 'POST',
      body: {
        email,
        password,
        ...(name ? { name } : {}),
      },
    });

    if (!data?.token || !data?.user?.id) {
      return { error: 'Signup failed. Please try again.' };
    }

    storeAdminSession(data.token, data.user);
    return { success: true, user: data.user, token: data.token };
  } catch (error) {
    if (error instanceof ApiError) {
      return { error: error.message || 'Signup failed. Please try again.' };
    }
    console.error('Admin signup error:', error);
    return { error: 'An error occurred. Please try again.' };
  }
}

export async function requestAdminPasswordReset(email) {
  try {
    const data = await apiRequest('/auth/forgot-password', {
      method: 'POST',
      body: { email },
    });

    return {
      success: true,
      message:
        data?.message ||
        'If an account exists for that email, a verification code has been sent.',
      expiresInSeconds: data?.expiresInSeconds,
      resendCooldownSeconds: data?.resendCooldownSeconds,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      return {
        error: error.message || 'Could not start password reset. Please try again.',
        retryAfterSeconds: error.details?.retryAfterSeconds,
      };
    }
    console.error('Admin forgot password error:', error);
    return { error: 'An error occurred. Please try again.' };
  }
}

export async function resendAdminPasswordOtp(email) {
  try {
    const data = await apiRequest('/auth/forgot-password/resend', {
      method: 'POST',
      body: { email },
    });

    return {
      success: true,
      message: data?.message || 'A new code was sent.',
      expiresInSeconds: data?.expiresInSeconds,
      resendCooldownSeconds: data?.resendCooldownSeconds,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      return {
        error: error.message || 'Could not resend code. Please try again.',
        retryAfterSeconds: error.details?.retryAfterSeconds,
      };
    }
    console.error('Admin resend OTP error:', error);
    return { error: 'An error occurred. Please try again.' };
  }
}

export async function verifyAdminPasswordOtp(email, otp) {
  try {
    const data = await apiRequest('/auth/forgot-password/verify-otp', {
      method: 'POST',
      body: { email, otp },
    });

    if (!data?.resetToken) {
      return { error: 'Could not verify code. Please try again.' };
    }

    return {
      success: true,
      resetToken: data.resetToken,
      expiresInSeconds: data.expiresInSeconds,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      return { error: error.message || 'Invalid or expired code.' };
    }
    console.error('Admin verify OTP error:', error);
    return { error: 'An error occurred. Please try again.' };
  }
}

export async function resetAdminPassword({ resetToken, password }) {
  try {
    const data = await apiRequest('/auth/forgot-password/reset', {
      method: 'POST',
      body: { resetToken, password },
    });

    if (!data?.token || !data?.user?.id) {
      return { error: 'Could not update password. Please try again.' };
    }

    storeAdminSession(data.token, data.user);
    return { success: true, user: data.user, token: data.token };
  } catch (error) {
    if (error instanceof ApiError) {
      return { error: error.message || 'Could not update password. Please try again.' };
    }
    console.error('Admin reset password error:', error);
    return { error: 'An error occurred. Please try again.' };
  }
}

/** Validate the stored admin JWT with the backend. Clears local session if invalid. */
export async function validateAdminSession() {
  const session = getAdminSession();
  if (!session?.token) {
    clearAdminLocalStorage();
    return null;
  }

  try {
    const data = await apiRequest('/auth/me', { token: session.token });
    if (!data?.ok || !data?.auth?.id) {
      clearAdminLocalStorage();
      return null;
    }

    storeAdminSession(session.token, data.auth);
    return getAdminSession();
  } catch {
    clearAdminLocalStorage();
    return null;
  }
}

export async function clearAdminSession() {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  clearAdminLocalStorage();

  if (token) {
    try {
      await apiRequest('/auth/logout', { method: 'POST', token });
    } catch {
      // Client session is already cleared; ignore network/auth errors.
    }
  }
}
