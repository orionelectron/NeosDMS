import { apiFetch, apiFetchPaginated } from "@/lib/api/http";
import { toQuery } from "@/lib/api/trading";

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export interface Role {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const roleApi = {
  list: () => apiFetch<Role[]>("/roles"),
};

// ---------------------------------------------------------------------------
// Permissions (catalog grouped by module)
// ---------------------------------------------------------------------------

export interface PermissionGroup {
  module: string;
  permissions: string[];
}

export const permissionApi = {
  list: () => apiFetch<PermissionGroup[]>("/permissions"),
};

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export interface User {
  id: string;
  organizationId: string;
  branchId: string;
  roleId: string | null;
  role: Role | null;
  fullName: string;
  email: string;
  username: string | null;
  isOwner: boolean;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  managerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserDto {
  fullName: string;
  email: string;
  password: string;
  username?: string | null;
  branchId: string;
  roleId?: string;
  managerId?: string;
  mustChangePassword?: boolean;
}

export interface UpdateUserDto {
  fullName?: string;
  email?: string;
  username?: string | null;
  branchId?: string;
  roleId?: string | null;
  managerId?: string | null;
  mustChangePassword?: boolean;
  isActive?: boolean;
}

export interface UserListQuery {
  page?: number;
  limit?: number;
  search?: string;
}

export const userApi = {
  list: (query: UserListQuery = {}) => {
    const { page, limit, search } = query;
    return apiFetchPaginated<User>(
      `/users?${toQuery({ page, limit, search })}`,
    );
  },
  get: (id: string) => apiFetch<User>(`/users/${id}`),
  create: (dto: CreateUserDto) =>
    apiFetch<User>("/users", { method: "POST", body: dto }),
  update: (id: string, dto: UpdateUserDto) =>
    apiFetch<User>(`/users/${id}`, { method: "PATCH", body: dto }),
  remove: (id: string) =>
    apiFetch<{ deleted: boolean }>(`/users/${id}`, { method: "DELETE" }),
};

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export interface AuditLog {
  id: string;
  organizationId: string;
  branchId: string | null;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  ipAddress: string | null;
  bsDate: string | null;
  occurredAt: string;
}

export interface AuditLogListQuery {
  page?: number;
  limit?: number;
  action?: string;
  entityType?: string;
  userId?: string;
}

export const auditLogApi = {
  list: (query: AuditLogListQuery = {}) => {
    const { page, limit, action, entityType, userId } = query;
    return apiFetchPaginated<AuditLog>(
      `/audit-logs?${toQuery({ page, limit, action, entityType, userId })}`,
    );
  },
};
