import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { applyAdminHeaderTheme, clearAdminHeaderTheme } from '../utils/adminTheme';
import { ensureDefaultMenuTheme, fetchMenuTheme } from '../services/menu';
import { DEFAULT_PRIMARY_COLOR, resolveThemeColor } from '../utils/menuThemeDefaults';
import {
  adminOAuthRedirectUrl,
  clearOAuthParamsFromUrl,
  isOAuthReturnUrl,
  readOAuthErrorFromUrl,
} from '../utils/oauth';

const AuthContext = createContext(null);

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForSession(retries = 5, initialDelayMs = 1000, retryDelayMs = 500) {
  if (initialDelayMs > 0) {
    await wait(initialDelayMs);
  }

  for (let attempt = 0; attempt < retries; attempt += 1) {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (session) return session;
    if (attempt < retries - 1) {
      await wait(retryDelayMs);
    }
  }

  return null;
}

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const handlingSignInRef = useRef(false);
  const completedSignInRef = useRef(false);

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

  const applySession = useCallback(
    async (nextSession, { withAdminTheme = window.location.pathname.startsWith('/admin') } = {}) => {
      if (!nextSession) return;
      setSession(nextSession);
      if (withAdminTheme) {
        await applyThemeForUser(nextSession.user.id);
      }
    },
    [applyThemeForUser],
  );

  const restoreSession = useCallback(
    async (nextSession) => {
      if (!nextSession || completedSignInRef.current) return;
      completedSignInRef.current = true;
      await applySession(nextSession);
    },
    [applySession],
  );

  const rejectIfNewUser = useCallback(async (nextSession) => {
    const userCreatedAt = new Date(nextSession.user.created_at);
    const timeDiff = (Date.now() - userCreatedAt.getTime()) / 1000;
    if (timeDiff >= 5) return false;

    handlingSignInRef.current = true;
    await supabase.auth.signOut();
    handlingSignInRef.current = false;
    setSession(null);
    setAuthError('Access denied. Only existing users can login. Please contact administrator.');
    return true;
  }, []);

  const completeSignIn = useCallback(
    async (nextSession) => {
      if (!nextSession || handlingSignInRef.current || completedSignInRef.current) return false;
      if (await rejectIfNewUser(nextSession)) return false;

      completedSignInRef.current = true;
      await applySession(nextSession, { withAdminTheme: true });
      setAuthError('');

      const path = window.location.pathname;
      if (path === '/' || isOAuthReturnUrl()) {
        navigate('/admin', { replace: true });
      }
      return true;
    },
    [applySession, navigate, rejectIfNewUser],
  );

  useEffect(() => {
    if (!supabase) {
      setAuthError('Supabase is not configured. Check frontend-zen-menu/.env');
      setLoading(false);
      return undefined;
    }

    let mounted = true;
    const oauthReturn = isOAuthReturnUrl();
    const urlOAuthError = readOAuthErrorFromUrl();

    if (urlOAuthError) {
      setAuthError(`Authentication failed: ${urlOAuthError}`);
      clearOAuthParamsFromUrl();
    }

    async function init() {
      try {
        let currentSession = null;

        if (oauthReturn && !urlOAuthError) {
          currentSession = await waitForSession();
          clearOAuthParamsFromUrl();
        } else {
          const { data: { session: storedSession }, error } = await supabase.auth.getSession();
          if (error) throw error;
          currentSession = storedSession;
        }

        if (!mounted) return;

        if (currentSession) {
          if (oauthReturn && !urlOAuthError) {
            await completeSignIn(currentSession);
          } else {
            await restoreSession(currentSession);
          }
        } else if (oauthReturn && !urlOAuthError) {
          const redirectHint = adminOAuthRedirectUrl();
          setAuthError(
            `Authentication incomplete. Add this exact URL in Supabase → Authentication → URL Configuration → Redirect URLs: ${redirectHint}`,
          );
        }
      } catch (error) {
        if (mounted) {
          setAuthError(error?.message || 'Authentication failed. Please try again.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (!mounted) return;

      if (event === 'SIGNED_IN' && nextSession) {
        await completeSignIn(nextSession);
        if (mounted) setLoading(false);
        return;
      }

      if (event === 'TOKEN_REFRESHED' && nextSession) {
        await applySession(nextSession);
        return;
      }

      if (event === 'SIGNED_OUT') {
        completedSignInRef.current = false;
        setSession(null);
        clearAdminHeaderTheme();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [applySession, completeSignIn, restoreSession]);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) {
      setAuthError('Authentication service not ready. Please refresh the page.');
      return;
    }

    setAuthError('');
    const redirectUrl = adminOAuthRedirectUrl();

    if (window.location.hash) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
        skipBrowserRedirect: false,
      },
    });

    if (error) {
      setAuthError(`Authentication failed: ${error.message}`);
      return;
    }

    if (data?.url) {
      window.location.assign(data.url);
    } else {
      setAuthError('Could not start Google sign-in. Please try again.');
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    navigate('/', { replace: true });
  }, [navigate]);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      authError,
      setAuthError,
      isAuthenticated: Boolean(session),
      signInWithGoogle,
      signOut,
    }),
    [session, loading, authError, signInWithGoogle, signOut],
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
