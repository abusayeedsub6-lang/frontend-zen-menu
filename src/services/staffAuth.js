import { apiRequest, ApiError } from '../lib/api';

const STAFF_TOKEN_KEY = 'staff_token';

export async function staffLogin(staffName, pin) {
  try {
    const data = await apiRequest('/staff/login', {
      method: 'POST',
      body: { staffName, pin },
    });

    const staff = data.staff;
    if (!staff?.id || !staff?.restaurantId) {
      return { error: 'Login failed. Please try again.' };
    }

    localStorage.setItem(STAFF_TOKEN_KEY, data.token);
    localStorage.setItem('staff_id', staff.id);
    localStorage.setItem('staff_user_id', staff.restaurantId);
    localStorage.setItem('staff_name', staff.staffName || '');
    localStorage.setItem('staff_restaurant_id', staff.restaurantId);

    return {
      success: true,
      staff: {
        id: staff.id,
        staff_name: staff.staffName,
        user_id: staff.restaurantId,
        last_login: staff.lastLogin,
      },
      token: data.token,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401) {
        return { error: error.message || 'Invalid name or PIN' };
      }
      return { error: error.message || 'Login failed. Please try again.' };
    }
    console.error('Login error:', error);
    return { error: 'An error occurred. Please try again.' };
  }
}

export function getStaffSession() {
  const staffId = localStorage.getItem('staff_id');
  const staffUserId = localStorage.getItem('staff_user_id');
  const staffName = localStorage.getItem('staff_name');
  const token = localStorage.getItem(STAFF_TOKEN_KEY);

  // Phase 2: staff auth requires the API-issued JWT, not just localStorage ids.
  if (!staffId || !staffUserId || !token) {
    return null;
  }

  return {
    staffId,
    staffUserId,
    staffName: staffName || '',
    restaurantId: staffUserId,
    token,
  };
}

export function getStaffToken() {
  return localStorage.getItem(STAFF_TOKEN_KEY);
}

function clearStaffLocalStorage() {
  localStorage.removeItem(STAFF_TOKEN_KEY);
  localStorage.removeItem('staff_id');
  localStorage.removeItem('staff_user_id');
  localStorage.removeItem('staff_name');
  localStorage.removeItem('staff_restaurant_id');

  const sessionKeys = Object.keys(localStorage).filter((key) => key.startsWith('staff_session_'));
  sessionKeys.forEach((key) => localStorage.removeItem(key));
  localStorage.removeItem('activeStaffSession');
}

/** Validate the stored staff JWT with the backend. Clears local session if invalid. */
export async function validateStaffSession() {
  const session = getStaffSession();
  if (!session?.token) {
    clearStaffLocalStorage();
    return null;
  }

  try {
    const data = await apiRequest('/staff/me', { token: session.token });
    if (!data?.ok || !data?.auth?.staffId) {
      clearStaffLocalStorage();
      return null;
    }

    localStorage.setItem('staff_id', data.auth.staffId);
    localStorage.setItem('staff_user_id', data.auth.restaurantId);
    localStorage.setItem('staff_restaurant_id', data.auth.restaurantId);
    localStorage.setItem('staff_name', data.auth.staffName || '');

    return getStaffSession();
  } catch {
    clearStaffLocalStorage();
    return null;
  }
}

export async function clearStaffSession() {
  const token = localStorage.getItem(STAFF_TOKEN_KEY);
  clearStaffLocalStorage();

  if (token) {
    try {
      await apiRequest('/staff/logout', { method: 'POST', token });
    } catch {
      // Client session is already cleared; ignore network/auth errors.
    }
  }
}
