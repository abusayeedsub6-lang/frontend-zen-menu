import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { clearStaffSession, getStaffSession, staffLogin } from '../services/staffAuth';
import { applyStaffTheme, clearStaffTheme } from '../utils/staffTheme';

const StaffAuthContext = createContext(null);

export function StaffAuthProvider({ children }) {
  const navigate = useNavigate();
  const [session, setSession] = useState(() => getStaffSession());
  const [loading, setLoading] = useState(true);

  const applyThemeForRestaurant = useCallback(async (restaurantId) => {
    if (!restaurantId || !supabase) return;

    try {
      const { data, error } = await supabase
        .from('menu_theme')
        .select('staff_side_color, button_color')
        .eq('user_id', restaurantId)
        .maybeSingle();

      if (error) throw error;

      const colorToUse = data?.staff_side_color || data?.button_color || null;
      if (colorToUse) {
        applyStaffTheme(colorToUse);
      } else {
        clearStaffTheme();
      }
    } catch {
      clearStaffTheme();
    }
  }, []);

  useEffect(() => {
    const current = getStaffSession();
    setSession(current);
    if (current?.restaurantId) {
      applyThemeForRestaurant(current.restaurantId).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
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

  const logout = useCallback(() => {
    clearStaffSession();
    setSession(null);
    clearStaffTheme();
    navigate('/staff', { replace: true });
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
