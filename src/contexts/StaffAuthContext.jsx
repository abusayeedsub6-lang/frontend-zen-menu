import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  clearStaffSession,
  getStaffSession,
  staffLogin,
  validateStaffSession,
} from '../services/staffAuth';
import { fetchMenuTheme } from '../services/menu';
import { applyStaffTheme, clearStaffTheme } from '../utils/staffTheme';
import { DEFAULT_PRIMARY_COLOR, resolveThemeColor } from '../utils/menuThemeDefaults';

const StaffAuthContext = createContext(null);

export function StaffAuthProvider({ children }) {
  const navigate = useNavigate();
  const [session, setSession] = useState(() => getStaffSession());
  const [loading, setLoading] = useState(true);

  const applyThemeForRestaurant = useCallback(async (restaurantId) => {
    if (!restaurantId) return;

    try {
      const data = await fetchMenuTheme(restaurantId);
      applyStaffTheme(
        resolveThemeColor(data?.staff_side_color, data?.button_color, DEFAULT_PRIMARY_COLOR),
      );
    } catch {
      clearStaffTheme();
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      const current = await validateStaffSession();
      if (cancelled) return;

      setSession(current);
      if (current?.restaurantId) {
        await applyThemeForRestaurant(current.restaurantId);
      } else {
        clearStaffTheme();
      }
      if (!cancelled) setLoading(false);
    }

    restore();
    return () => {
      cancelled = true;
    };
  }, [applyThemeForRestaurant]);

  const login = useCallback(
    async (staffName, pin) => {
      const result = await staffLogin(staffName, pin);
      if (result.error) {
        return result;
      }

      const nextSession = getStaffSession();
      setSession(nextSession);
      if (nextSession?.restaurantId) {
        await applyThemeForRestaurant(nextSession.restaurantId);
      }
      navigate('/staff/dashboard', { replace: true });
      return result;
    },
    [applyThemeForRestaurant, navigate],
  );

  const logout = useCallback(async () => {
    setSession(null);
    clearStaffTheme();
    navigate('/staff', { replace: true });
    await clearStaffSession();
  }, [navigate]);

  const value = useMemo(
    () => ({
      session,
      staffName: session?.staffName ?? '',
      staffId: session?.staffId ?? null,
      restaurantId: session?.restaurantId ?? null,
      loading,
      isAuthenticated: Boolean(session),
      login,
      logout,
    }),
    [session, loading, login, logout],
  );

  return <StaffAuthContext.Provider value={value}>{children}</StaffAuthContext.Provider>;
}

export function useStaffAuth() {
  const context = useContext(StaffAuthContext);
  if (!context) {
    throw new Error('useStaffAuth must be used within StaffAuthProvider');
  }
  return context;
}
