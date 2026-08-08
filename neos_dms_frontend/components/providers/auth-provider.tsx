"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authApi, type PublicUser, type RegisterDto } from "@/lib/api/auth";
import { tokenStore } from "@/lib/auth/token-store";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: PublicUser | null;
  permissions: string[];
  isAuthenticated: boolean;
  can: (permission: string) => boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (dto: RegisterDto) => Promise<void>;
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

  const establishSession = React.useCallback(async (dto: {
    accessToken: string;
    refreshToken: string;
  }) => {
    tokenStore.setTokens(dto.accessToken, dto.refreshToken);
    const me = await authApi.me();
    setUser(me.user);
    setPermissions(me.permissions);
    setStatus("authenticated");
  }, []);

  const login = React.useCallback(
    async (email: string, password: string) => {
      const result = await authApi.login(email, password);
      await establishSession(result.tokens);
    },
    [establishSession],
  );

  const register = React.useCallback(
    async (dto: RegisterDto) => {
      const result = await authApi.register(dto);
      await establishSession(result.tokens);
    },
    [establishSession],
  );

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
      register,
      logout,
    }),
    [status, user, permissions, can, login, register, logout],
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
