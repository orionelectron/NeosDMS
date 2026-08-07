export const OUTLET_CHANNEL = [
  'GENERAL_TRADE',
  'MODERN_TRADE',
  'HORECA',
  'INSTITUTION',
] as const;
export type OutletChannel = (typeof OUTLET_CHANNEL)[number];

export const OUTLET_STATUS = ['ACTIVE', 'INACTIVE'] as const;
export type OutletStatus = (typeof OUTLET_STATUS)[number];

export const ROUTE_STATUS = ['ACTIVE', 'INACTIVE'] as const;
export type RouteStatus = (typeof ROUTE_STATUS)[number];

export const VISIT_TYPE = ['PLANNED', 'UNPLANNED'] as const;
export type VisitType = (typeof VISIT_TYPE)[number];

export const VISIT_STATUS = [
  'SCHEDULED',
  'CHECKED_IN',
  'CHECKED_OUT',
  'COMPLETED',
  'CANCELLED',
] as const;
export type VisitStatus = (typeof VISIT_STATUS)[number];

/**
 * A check-in farther than this many meters from the outlet's recorded
 * position is flagged `is_off_route = true`. Configurable; default 200 m.
 */
export const OFF_ROUTE_TOLERANCE_METERS = 200;

export const EARTH_RADIUS_METERS = 6371000;

export const SALES_TARGET_TYPE = ['PERSONAL', 'CATEGORY', 'BRAND'] as const;
export type SalesTargetType = (typeof SALES_TARGET_TYPE)[number];

export const SALES_TARGET_AUDIT_ACTION = [
  'sales.target.create',
  'sales.target.update',
  'sales.target.delete',
] as const;
export type SalesTargetAuditAction = (typeof SALES_TARGET_AUDIT_ACTION)[number];
