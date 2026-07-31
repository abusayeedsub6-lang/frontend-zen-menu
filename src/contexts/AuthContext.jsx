import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  adminLogin,
  adminSignup,
  clearAdminSession,
  getAdminSession,
  validateAdminSession,
} from '../services/adminAuth';
import { applyAdminHeaderTheme, clearAdminHeaderTheme } from '../utils/adminTheme';
import { ensureDefaultMenuTheme, fetchMenuTheme } from '../services/menu';
import { DEFAULT_PRIMARY_COLOR, resolveThemeColor } from '../utils/menuThemeDefaults';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [session, setSession] = useState(() => getAdminSession());
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  const applyThemeForUser = useCallback(async (userId) => {
    if (!userId) return;
    try {
      await ensureDefaultMenuTheme(userId);
      const data = await fetchMenuTheme(userId);
      applyAdminHeaderTheme(
        resolveThemeColor(data?.admin_side_color, data?.button_color, DEFAULT_PRIMARY_COLOR),
      );
    } catch {
      applyAdminHeaderTheme(DEFAULT_PRIMARY_COLOR);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      const current = await validateAdminSession();
      if (cancelled) return;

      setSession(current);
      if (current?.user?.id) {
        await applyThemeForUser(current.user.id);
      } else {
        clearAdminHeaderTheme();
      }
      if (!cancelled) setLoading(false);
    }

    restore();
    return () => {
      cancelled = true;
    };
  }, [applyThemeForUser]);

  const login = useCallback(
    async (email, password) => {
      setAuthError('');
      const result = await adminLogin(email, password);
      if (result.error) {
        setAuthError(result.error);
        return result;
      }

      const nextSession = getAdminSession();
      setSession(nextSession);
      if (nextSession?.user?.id) {
        await applyThemeForUser(nextSession.user.id);
      }
      navigate('/admin', { replace: true });
      return result;
    },
    [applyThemeForUser, navigate],
  );

  const signup = useCallback(
    async ({ email, password, name }) => {
      setAuthError('');
      const result = await adminSignup({ email, password, name });
      if (result.error) {
        setAuthError(result.error);
        return result;
      }

      const nextSession = getAdminSession();
      setSession(nextSession);
      if (nextSession?.user?.id) {
        await applyThemeForUser(nextSession.user.id);
      }
      navigate('/admin', { replace: true });
      return result;
    },
    [applyThemeForUser, navigate],
  );

  const signOut = useCallback(async () => {
    await clearAdminSession();
    setSession(null);
    clearAdminHeaderTheme();
    setAuthError('');
    navigate('/', { replace: true });
  }, [navigate]);

  const completeAuthSession = useCallback(
    async (result) => {
      if (result?.error || !result?.token) return result;
      const nextSession = getAdminSession();
      setSession(nextSession);
      if (nextSession?.user?.id) {
        await applyThemeForUser(nextSession.user.id);
      }
      navigate('/admin', { replace: true });
      return result;
    },
    [applyThemeForUser, navigate],
  );

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      authError,
      setAuthError,
      isAuthenticated: Boolean(session),
      login,
      signup,
      signOut,
      completeAuthSession,
    }),
    [session, loading, authError, login, signup, signOut, completeAuthSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
