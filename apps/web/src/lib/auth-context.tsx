'use client';
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { login as apiLogin, getProfile, logout as apiLogout, getToken, getUserPermissions } from './auth';
import type { UserProfile, UserPermissions } from './auth';

interface AuthContextValue {
  user: UserProfile | null;
  permissions: UserPermissions | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  refreshPermissions: () => Promise<void>;
  isSuperAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    const token = getToken();
    if (token) {
      Promise.all([refreshProfile(), refreshPermissions()])
        .catch(() => { })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [refreshProfile, refreshPermissions]);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    const result = await apiLogin(email, password);
    await refreshProfile();
    const perms = await getUserPermissions();
    setPermissions(perms);
  }, [refreshProfile]);

  const logout = useCallback(() => {
    apiLogout();
    setUser(null);
    setPermissions(null);
  }, []);

  const value: AuthContextValue = {
    user,
    permissions,
    loading,
    error,
    login,
    logout,
    refreshProfile,
    refreshPermissions,
    isSuperAdmin: permissions?.isSuperAdmin ?? false,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}


