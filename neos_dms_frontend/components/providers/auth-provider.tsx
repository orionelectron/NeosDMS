"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authApi, type PublicUser } from "@/lib/api/auth";
import { tokenStore } from "@/lib/auth/token-store";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: PublicUser | null;
  permissions: string[];
  isAuthenticated: boolean;
  can: (permission: string) => boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = React.useState<AuthStatus>("loading");
  const [user, setUser] = React.useState<PublicUser | null>(null);
  const [permissions, setPermissions] = React.useState<string[]>([]);

  React.useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      try {
        const me = await authApi.me();
        if (!active) return;
        setUser(me.user);
        setPermissions(me.permissions);
        setStatus("authenticated");
      } catch {
        if (!active) return;
        setUser(null);
        setPermissions([]);
        setStatus("unauthenticated");
      }
    };

    const unsubscribe = tokenStore.onClear(() => {
      if (!active) return;
      setUser(null);
      setPermissions([]);
      setStatus("unauthenticated");
    });

    void bootstrap();

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const login = React.useCallback(async (email: string, password: string) => {
    const result = await authApi.login(email, password);
    tokenStore.setTokens(result.tokens.accessToken, result.tokens.refreshToken);
    const me = await authApi.me();
    setUser(me.user);
    setPermissions(me.permissions);
    setStatus("authenticated");
  }, []);

  const logout = React.useCallback(async () => {
    try {
      const refreshToken = tokenStore.getRefreshToken();
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    } catch {
      void 0;
    } finally {
      tokenStore.clear();
      queryClient.clear();
      setUser(null);
      setPermissions([]);
      setStatus("unauthenticated");
    }
  }, [queryClient]);

  const can = React.useCallback(
    (permission: string) => permissions.includes(permission),
    [permissions],
  );

  const value = React.useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      permissions,
      isAuthenticated: status === "authenticated",
      can,
      login,
      logout,
    }),
    [status, user, permissions, can, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
