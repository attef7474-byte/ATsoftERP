'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  getOperationalContexts,
  clearLocalSession,
  getProfile,
  getToken,
  getUserPermissions,
  login as apiLogin,
  logout as apiLogout,
  validateOperationalContext,
} from './auth';
import type { UserPermissions, UserProfile } from './auth';
import {
  clearStoredOperationalContext,
  findMatchingOperationalContext,
  getOperationalContextIdentity,
  getOperationalContextKey,
  getStoredOperationalContext,
  OPERATIONAL_CONTEXT_CHANGED_EVENT,
  setStoredOperationalContext,
} from './operational-context';
import type { OperationalContext } from './operational-context';

export interface SelectOperationalContextOptions {
  reload?: boolean;
}

export interface AuthContextValue {
  user: UserProfile | null;
  permissions: UserPermissions | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshPermissions: () => Promise<void>;
  isSuperAdmin: boolean;
  allowedContexts: OperationalContext[];
  defaultContext: OperationalContext | null;
  activeContext: OperationalContext | null;
  contextLoading: boolean;
  contextError: string | null;
  contextReady: boolean;
  contextSelectionRequired: boolean;
  contextVersion: number;
  selectContext: (
    context: OperationalContext,
    options?: SelectOperationalContextOptions,
  ) => Promise<void>;
  refreshContexts: () => Promise<void>;
}

export interface OperationalContextHookValue {
  allowedContexts: OperationalContext[];
  defaultContext: OperationalContext | null;
  activeContext: OperationalContext | null;
  contextLoading: boolean;
  contextError: string | null;
  contextReady: boolean;
  contextSelectionRequired: boolean;
  contextVersion: number;
  selectContext: AuthContextValue['selectContext'];
  refreshContexts: AuthContextValue['refreshContexts'];
}

const AuthContext = createContext<AuthContextValue | null>(null);

function emptyContextError(code: string): Error {
  const error = new Error('');
  Object.assign(error, { code });
  return error;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allowedContexts, setAllowedContexts] = useState<OperationalContext[]>([]);
  const [defaultContext, setDefaultContext] = useState<OperationalContext | null>(null);
  const [activeContext, setActiveContext] = useState<OperationalContext | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);
  const [contextVersion, setContextVersion] = useState(0);

  const persistActiveContext = useCallback((
    profile: UserProfile,
    context: OperationalContext,
  ) => {
    setStoredOperationalContext(profile.id, context);
    setActiveContext(context);
    setContextVersion((previous) => previous + 1);
  }, []);

  const loadContextsForUser = useCallback(async (profile: UserProfile) => {
    setContextLoading(true);
    setContextError(null);
    try {
      const result = await getOperationalContexts();
      setAllowedContexts(result.contexts);
      setDefaultContext(result.defaultContext);

      const stored = findMatchingOperationalContext(
        result.contexts,
        getStoredOperationalContext(profile.id),
      );
      const configuredDefault = findMatchingOperationalContext(
        result.contexts,
        result.defaultContext,
      );
      const candidates = [
        stored,
        result.contexts.length === 1 ? result.contexts[0] : null,
        configuredDefault,
      ].filter((candidate): candidate is OperationalContext => candidate !== null);
      const uniqueCandidates = candidates.filter((candidate, index) => (
        candidates.findIndex(
          (other) => getOperationalContextKey(other) === getOperationalContextKey(candidate),
        ) === index
      ));

      let resolvedContext: OperationalContext | null = null;
      for (const candidate of uniqueCandidates) {
        try {
          const validated = await validateOperationalContext(
            getOperationalContextIdentity(candidate),
          );
          resolvedContext = findMatchingOperationalContext(result.contexts, validated);
          if (resolvedContext) break;
        } catch {
          if (stored && getOperationalContextKey(stored) === getOperationalContextKey(candidate)) {
            clearStoredOperationalContext(profile.id);
          }
        }
      }

      if (resolvedContext) {
        persistActiveContext(profile, resolvedContext);
      } else {
        clearStoredOperationalContext(profile.id);
        setActiveContext(null);
      }
    } catch (contextLoadError) {
      clearStoredOperationalContext(profile.id);
      setAllowedContexts([]);
      setDefaultContext(null);
      setActiveContext(null);
      setContextError(
        contextLoadError instanceof Error && contextLoadError.message
          ? contextLoadError.message
          : 'OPERATIONAL_CONTEXT_LOAD_FAILED',
      );
    } finally {
      setContextLoading(false);
    }
  }, [persistActiveContext]);

  const refreshProfile = useCallback(async () => {
    try {
      const profile = await getProfile();
      setUser(profile);
    } catch {
      setUser(null);
    }
  }, []);

  const refreshPermissions = useCallback(async () => {
    try {
      const perms = await getUserPermissions();
      setPermissions(perms);
    } catch {
      setPermissions(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      const token = getToken();
      if (!token) {
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const [profile, perms] = await Promise.all([getProfile(), getUserPermissions()]);
        if (cancelled) return;
        setUser(profile);
        setPermissions(perms);
        await loadContextsForUser(profile);
      } catch (bootstrapError) {
        if (cancelled) return;
        if ((bootstrapError as { status?: number })?.status === 401) {
          clearLocalSession();
        }
        setUser(null);
        setPermissions(null);
        setError(
          bootstrapError instanceof Error && bootstrapError.message
            ? bootstrapError.message
            : null,
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [loadContextsForUser]);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    await apiLogin(email, password);
    const [profile, perms] = await Promise.all([getProfile(), getUserPermissions()]);
    setUser(profile);
    setPermissions(perms);
    await loadContextsForUser(profile);
  }, [loadContextsForUser]);

  const logout = useCallback(async () => {
    const userId = user?.id;
    try {
      await apiLogout(userId);
    } finally {
      setUser(null);
      setPermissions(null);
      setAllowedContexts([]);
      setDefaultContext(null);
      setActiveContext(null);
      setContextError(null);
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  }, [user?.id]);

  const selectContext = useCallback(async (
    context: OperationalContext,
    options: SelectOperationalContextOptions = {},
  ) => {
    if (!user) throw emptyContextError('AUTHENTICATION_REQUIRED');
    const allowedContext = findMatchingOperationalContext(allowedContexts, context);
    if (!allowedContext) throw emptyContextError('OPERATIONAL_CONTEXT_NOT_ALLOWED');

    setContextLoading(true);
    setContextError(null);
    try {
      const validated = await validateOperationalContext(
        getOperationalContextIdentity(allowedContext),
      );
      const resolvedContext = findMatchingOperationalContext(allowedContexts, validated);
      if (!resolvedContext) throw emptyContextError('OPERATIONAL_CONTEXT_NOT_ALLOWED');

      const changed = !activeContext
        || getOperationalContextKey(activeContext) !== getOperationalContextKey(resolvedContext);
      persistActiveContext(user, resolvedContext);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(OPERATIONAL_CONTEXT_CHANGED_EVENT, {
          detail: {
            context: getOperationalContextIdentity(resolvedContext),
            changed,
          },
        }));
        if (changed && options.reload) {
          window.setTimeout(() => window.location.reload(), 0);
        }
      }
    } catch (selectionError) {
      setContextError(
        selectionError instanceof Error && selectionError.message
          ? selectionError.message
          : 'OPERATIONAL_CONTEXT_VALIDATION_FAILED',
      );
      throw selectionError;
    } finally {
      setContextLoading(false);
    }
  }, [activeContext, allowedContexts, persistActiveContext, user]);

  const refreshContexts = useCallback(async () => {
    if (user) await loadContextsForUser(user);
  }, [loadContextsForUser, user]);

  const contextReady = !!user && !contextLoading && !!activeContext;
  const contextSelectionRequired = (
    !!user
    && !contextLoading
    && !activeContext
    && allowedContexts.length > 0
  );

  const value = useMemo<AuthContextValue>(() => ({
    user,
    permissions,
    loading,
    error,
    login,
    logout,
    refreshProfile,
    refreshPermissions,
    isSuperAdmin: permissions?.isSuperAdmin ?? false,
    allowedContexts,
    defaultContext,
    activeContext,
    contextLoading,
    contextError,
    contextReady,
    contextSelectionRequired,
    contextVersion,
    selectContext,
    refreshContexts,
  }), [
    activeContext,
    allowedContexts,
    contextError,
    contextLoading,
    contextReady,
    contextSelectionRequired,
    contextVersion,
    defaultContext,
    error,
    loading,
    login,
    logout,
    permissions,
    refreshContexts,
    refreshPermissions,
    refreshProfile,
    selectContext,
    user,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useOperationalContext(): OperationalContextHookValue {
  const {
    allowedContexts,
    defaultContext,
    activeContext,
    contextLoading,
    contextError,
    contextReady,
    contextSelectionRequired,
    contextVersion,
    selectContext,
    refreshContexts,
  } = useAuth();

  return {
    allowedContexts,
    defaultContext,
    activeContext,
    contextLoading,
    contextError,
    contextReady,
    contextSelectionRequired,
    contextVersion,
    selectContext,
    refreshContexts,
  };
}

export const useActiveContext = useOperationalContext;
