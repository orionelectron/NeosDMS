import { apiFetch } from "@/lib/api/http";

export interface PublicUser {
  id: string;
  organizationId: string;
  branchId: string;
  roleId: string | null;
  roleCode: string | null;
  fullName: string;
  email: string;
  username: string | null;
  isOwner: boolean;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  expiresAt: string;
}

export interface LoginResult {
  user: PublicUser;
  tokens: AuthTokens;
}

export interface MeResult {
  user: PublicUser;
  permissions: string[];
}

export const authApi = {
  login(email: string, password: string) {
    return apiFetch<LoginResult>("/auth/login", {
      method: "POST",
      body: { email, password },
      auth: false,
    });
  },

  me() {
    return apiFetch<MeResult>("/auth/me");
  },

  logout(refreshToken: string) {
    return apiFetch<{ loggedOut: boolean }>("/auth/logout", {
      method: "POST",
      body: { refreshToken },
      auth: false,
    });
  },
};
