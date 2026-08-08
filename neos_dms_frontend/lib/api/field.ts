import {
  apiFetch,
  apiFetchBlob,
  apiFetchPaginated,
} from "@/lib/api/http";
import { toQuery } from "@/lib/api/trading";

// ---------------------------------------------------------------------------
// Shared field constants (mirror backend `field.constants.ts`)
// ---------------------------------------------------------------------------

export const OUTLET_CHANNELS = [
  "GENERAL_TRADE",
  "MODERN_TRADE",
  "HORECA",
  "INSTITUTION",
] as const;
export type OutletChannel = (typeof OUTLET_CHANNELS)[number];

export const OUTLET_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type OutletStatus = (typeof OUTLET_STATUSES)[number];

export const ROUTE_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type RouteStatus = (typeof ROUTE_STATUSES)[number];

export const VISIT_TYPES = ["PLANNED", "UNPLANNED"] as const;
export type VisitType = (typeof VISIT_TYPES)[number];

export const VISIT_STATUSES = [
  "SCHEDULED",
  "CHECKED_IN",
  "CHECKED_OUT",
  "COMPLETED",
  "CANCELLED",
] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];

export const SALES_TARGET_TYPES = ["PERSONAL", "CATEGORY", "BRAND"] as const;
export type SalesTargetType = (typeof SALES_TARGET_TYPES)[number];

// ---------------------------------------------------------------------------
// Outlets
// ---------------------------------------------------------------------------

export interface Outlet {
  id: string;
  organizationId: string;
  partyId: string | null;
  name: string;
  ownerName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  province: string | null;
  district: string | null;
  latitude: string | null;
  longitude: string | null;
  photoKey: string | null;
  description: string | null;
  channel: OutletChannel;
  category: string | null;
  status: OutletStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOutletDto {
  name: string;
  partyId?: string;
  ownerName?: string;
  email?: string;
  phone?: string;
  address?: string;
  province?: string;
  district?: string;
  latitude?: number;
  longitude?: number;
  photoKey?: string;
  description?: string;
  channel?: OutletChannel;
  category?: string;
}

export interface UpdateOutletDto {
  name?: string;
  partyId?: string | null;
  ownerName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  province?: string | null;
  district?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  photoKey?: string | null;
  description?: string | null;
  channel?: OutletChannel;
  category?: string | null;
  status?: OutletStatus;
}

export interface OutletListQuery {
  page?: number;
  limit?: number;
  search?: string;
  routeId?: string;
  status?: OutletStatus;
}

export type ImportMode = "skip" | "update";
export type DuplicateReason = "DUPLICATE_IN_FILE" | "ALREADY_EXISTS";

export interface ImportRowError {
  row: number;
  name?: string;
  errors: string[];
}

export interface ImportDuplicate {
  row: number;
  name: string;
  reason: DuplicateReason;
}

export interface ImportUpdate {
  row: number;
  name: string;
}

export interface ImportReport {
  fileName: string;
  totalRows: number;
  imported: number;
  updated: number;
  duplicateCount: number;
  errorCount: number;
  dryRun: boolean;
  mode: ImportMode;
  duplicates: ImportDuplicate[];
  updates: ImportUpdate[];
  errors: ImportRowError[];
  errorsCsv: string;
  routesCreated?: number;
}

export interface ImportOptions {
  mode?: ImportMode;
  dryRun?: boolean;
}

export const outletApi = {
  list: (query: OutletListQuery = {}) => {
    const { page, limit, search, routeId, status } = query;
    return apiFetchPaginated<Outlet>(
      `/outlets?${toQuery({ page, limit, search, routeId, status })}`,
    );
  },
  listMine: (query: OutletListQuery = {}) => {
    const { page, limit, search, status } = query;
    return apiFetchPaginated<Outlet>(
      `/outlets/mine?${toQuery({ page, limit, search, status })}`,
    );
  },
  get: (id: string) => apiFetch<Outlet>(`/outlets/${id}`),
  create: (dto: CreateOutletDto) =>
    apiFetch<Outlet>("/outlets", { method: "POST", body: dto }),
  update: (id: string, dto: UpdateOutletDto) =>
    apiFetch<Outlet>(`/outlets/${id}`, { method: "PATCH", body: dto }),
  remove: (id: string) =>
    apiFetch<{ deleted: boolean }>(`/outlets/${id}`, { method: "DELETE" }),
  linkRoute: (outletId: string, routeId: string) =>
    apiFetch<Outlet>(`/outlets/${outletId}/routes/${routeId}`, {
      method: "POST",
    }),
  unlinkRoute: (outletId: string, routeId: string) =>
    apiFetch<{ unlinked: boolean }>(`/outlets/${outletId}/routes/${routeId}`, {
      method: "DELETE",
    }),
  import: (file: File, options: ImportOptions = {}) => {
    const formData = new FormData();
    formData.append("file", file);
    const query = {
      ...(options.mode ? { mode: options.mode } : {}),
      ...(options.dryRun !== undefined
        ? { dryRun: String(options.dryRun) }
        : {}),
    };
    return apiFetch<ImportReport>(
      `/outlets/import?${toQuery(query)}`,
      { method: "POST", body: formData },
    );
  },
  importTemplate: () => apiFetchBlob("/outlets/import/template"),
};

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export interface Route {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  description: string | null;
  province: string | null;
  district: string | null;
  status: RouteStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRouteDto {
  name: string;
  code: string;
  description?: string;
  province?: string;
  district?: string;
}

export interface UpdateRouteDto {
  name?: string;
  code?: string;
  description?: string | null;
  province?: string | null;
  district?: string | null;
  status?: RouteStatus;
}

export interface RouteListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: RouteStatus;
}

export const routeApi = {
  list: (query: RouteListQuery = {}) => {
    const { page, limit, search, status } = query;
    return apiFetchPaginated<Route>(
      `/routes?${toQuery({ page, limit, search, status })}`,
    );
  },
  listMine: (query: RouteListQuery = {}) => {
    const { page, limit, search, status } = query;
    return apiFetchPaginated<Route>(
      `/routes/mine?${toQuery({ page, limit, search, status })}`,
    );
  },
  get: (id: string) => apiFetch<Route>(`/routes/${id}`),
  listOutlets: (id: string) =>
    apiFetch<Outlet[]>(`/routes/${id}/outlets`),
  create: (dto: CreateRouteDto) =>
    apiFetch<Route>("/routes", { method: "POST", body: dto }),
  update: (id: string, dto: UpdateRouteDto) =>
    apiFetch<Route>(`/routes/${id}`, { method: "PATCH", body: dto }),
  remove: (id: string) =>
    apiFetch<{ deleted: boolean }>(`/routes/${id}`, { method: "DELETE" }),
  import: (file: File, options: ImportOptions = {}) => {
    const formData = new FormData();
    formData.append("file", file);
    const query = {
      ...(options.mode ? { mode: options.mode } : {}),
      ...(options.dryRun !== undefined
        ? { dryRun: String(options.dryRun) }
        : {}),
    };
    return apiFetch<ImportReport>(
      `/routes/import?${toQuery(query)}`,
      { method: "POST", body: formData },
    );
  },
  importTemplate: () => apiFetchBlob("/routes/import/template"),
};

// ---------------------------------------------------------------------------
// Route planner (map-based route clustering)
// ---------------------------------------------------------------------------

export interface PlannerOutlet {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  routeId: string | null;
}

export interface CreatePlannedRouteDto {
  name: string;
  outletIds: string[];
}

export interface CreatePlannedRoutesDto {
  routes: CreatePlannedRouteDto[];
  dryRun?: boolean;
}

export interface PlannedRouteResult {
  routeId: string;
  name: string;
  code: string;
  created: boolean;
  outlets: number;
  linked: number;
  skipped: number;
}

export interface PlannedRoutesReport {
  dryRun: boolean;
  routesCreated: number;
  linksInserted: number;
  linksSkipped: number;
  routes: PlannedRouteResult[];
}

export const routePlannerApi = {
  listOutlets: () => apiFetch<PlannerOutlet[]>("/route-planner/outlets"),
  createRoutes: (dto: CreatePlannedRoutesDto) =>
    apiFetch<PlannedRoutesReport>("/route-planner/routes", {
      method: "POST",
      body: dto,
    }),
};

// ---------------------------------------------------------------------------
// Route assignments
// ---------------------------------------------------------------------------

export interface RouteAssignment {
  id: string;
  organizationId: string;
  userId: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    isActive: boolean;
  };
  routeId: string;
  route: Route;
  weekdays: number[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateRouteAssignmentDto {
  userId: string;
  routeId: string;
  weekdays?: number[];
}

export interface UpdateRouteAssignmentDto {
  weekdays?: number[];
}

export interface RouteAssignmentListQuery {
  page?: number;
  limit?: number;
  routeId?: string;
  userId?: string;
}

export const routeAssignmentApi = {
  list: (query: RouteAssignmentListQuery = {}) => {
    const { page, limit, routeId, userId } = query;
    return apiFetchPaginated<RouteAssignment>(
      `/route-assignments?${toQuery({ page, limit, routeId, userId })}`,
    );
  },
  create: (dto: CreateRouteAssignmentDto) =>
    apiFetch<RouteAssignment>("/route-assignments", {
      method: "POST",
      body: dto,
    }),
  update: (id: string, dto: UpdateRouteAssignmentDto) =>
    apiFetch<RouteAssignment>(`/route-assignments/${id}`, {
      method: "PATCH",
      body: dto,
    }),
  remove: (id: string) =>
    apiFetch<{ deleted: boolean }>(`/route-assignments/${id}`, {
      method: "DELETE",
    }),
};

// ---------------------------------------------------------------------------
// Visits
// ---------------------------------------------------------------------------

export interface Visit {
  id: string;
  organizationId: string;
  userId: string;
  user: {
    id: string;
    fullName: string;
    email: string;
  };
  routeId: string;
  route: Route;
  outletId: string;
  outlet: Outlet;
  visitType: VisitType;
  status: VisitStatus;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  checkInLatitude: string | null;
  checkInLongitude: string | null;
  checkOutLatitude: string | null;
  checkOutLongitude: string | null;
  distanceFromOutletMeters: string | null;
  isOffRoute: boolean | null;
  remarks: string | null;
  photoKey: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVisitDto {
  routeId: string;
  outletId: string;
  visitType?: VisitType;
}

export interface CheckInVisitDto {
  latitude: number;
  longitude: number;
  photoKey?: string;
  remarks?: string;
}

export type CheckOutVisitDto = CheckInVisitDto;

export interface VisitListQuery {
  page?: number;
  limit?: number;
  routeId?: string;
  outletId?: string;
  userId?: string;
  status?: VisitStatus;
}

export const visitApi = {
  list: (query: VisitListQuery = {}) => {
    const { page, limit, routeId, outletId, userId, status } = query;
    return apiFetchPaginated<Visit>(
      `/visits?${toQuery({ page, limit, routeId, outletId, userId, status })}`,
    );
  },
  get: (id: string) => apiFetch<Visit>(`/visits/${id}`),
  create: (dto: CreateVisitDto) =>
    apiFetch<Visit>("/visits", { method: "POST", body: dto }),
  checkIn: (id: string, dto: CheckInVisitDto) =>
    apiFetch<Visit>(`/visits/${id}/check-in`, { method: "POST", body: dto }),
  checkOut: (id: string, dto: CheckOutVisitDto) =>
    apiFetch<Visit>(`/visits/${id}/check-out`, { method: "POST", body: dto }),
  cancel: (id: string) =>
    apiFetch<Visit>(`/visits/${id}/cancel`, { method: "POST" }),
};

// ---------------------------------------------------------------------------
// Sales targets
// ---------------------------------------------------------------------------

export interface SalesTarget {
  id: string;
  organizationId: string;
  userId: string;
  user: {
    id: string;
    fullName: string;
    email: string;
  };
  bsYear: number;
  bsMonth: number;
  targetType: SalesTargetType;
  categoryId: string | null;
  category: { id: string; name: string } | null;
  brandId: string | null;
  brand: { id: string; name: string } | null;
  amount: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSalesTargetDto {
  userId: string;
  bsYear: number;
  bsMonth: number;
  targetType: SalesTargetType;
  categoryId?: string;
  brandId?: string;
  amount: number;
}

export interface UpdateSalesTargetDto {
  amount?: number;
  isActive?: boolean;
}

export interface SalesTargetListQuery {
  page?: number;
  limit?: number;
  userId?: string;
  targetType?: SalesTargetType;
  bsYear?: number;
  bsMonth?: number;
}

export interface SalesTargetMonthlyReport {
  bsYear: number;
  bsMonth: number;
  rows: Array<{
    userId: string;
    fullName: string;
    personal: string | null;
    categories: Array<{ categoryId: string; name: string; amount: string }>;
    brands: Array<{ brandId: string; name: string; amount: string }>;
  }>;
}

export const salesTargetApi = {
  create: (dto: CreateSalesTargetDto) =>
    apiFetch<SalesTarget>("/sales-targets", { method: "POST", body: dto }),
  listMine: (query: SalesTargetListQuery = {}) =>
    apiFetch<SalesTarget[]>(
      `/sales-targets/mine?${toQuery({ ...query })}`,
    ),
  listTeam: (query: SalesTargetListQuery = {}) =>
    apiFetch<SalesTarget[]>(
      `/sales-targets/team?${toQuery({ ...query })}`,
    ),
  listAll: (query: SalesTargetListQuery = {}) =>
    apiFetch<SalesTarget[]>(
      `/sales-targets/all?${toQuery({ ...query })}`,
    ),
  update: (id: string, dto: UpdateSalesTargetDto) =>
    apiFetch<SalesTarget>(`/sales-targets/${id}`, {
      method: "PATCH",
      body: dto,
    }),
  remove: (id: string) =>
    apiFetch<{ deleted: boolean }>(`/sales-targets/${id}`, {
      method: "DELETE",
    }),
  monthlyReport: (query: {
    scope?: "mine" | "team" | "all";
    bsYear?: number;
    bsMonth?: number;
  }) => apiFetch<SalesTargetMonthlyReport>(`/sales-targets/report/monthly?${toQuery(query)}`),
};
