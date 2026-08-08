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

export interface RegisterOrganizationDto {
  name: string;
  legalName?: string;
  email: string;
  phoneNumber: string;
  panNumber: string;
  vatNumber?: string;
  address?: string;
  branchName?: string;
  planCode?: string;
  periodName?: string;
}

export interface RegisterDto extends RegisterOrganizationDto {
  owner: {
    fullName: string;
    email: string;
    password: string;
  };
}

export interface RegisterResult {
  organization: {
    id: string;
    name: string;
  };
  branch: {
    id: string;
    name: string;
  };
  subscription: {
    id: string;
    status: string;
    plan: { code: string; name: string };
  } | null;
  user: PublicUser;
  tokens: AuthTokens;
}

export const authApi = {
  login(email: string, password: string) {
    return apiFetch<LoginResult>("/auth/login", {
      method: "POST",
      body: { email, password },
      auth: false,
    });
  },

  register(dto: RegisterDto) {
    return apiFetch<RegisterResult>("/auth/register", {
      method: "POST",
      body: dto,
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
