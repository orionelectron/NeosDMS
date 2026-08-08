export const VEHICLE_TYPES = ['van', 'truck', 'pickup', 'motorbike'] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const DISPATCH_STATUSES = [
  'ALLOCATED',
  'LOADED',
  'IN_TRANSIT',
  'DELIVERED',
  'CANCELLED',
] as const;
export type DispatchStatus = (typeof DISPATCH_STATUSES)[number];

export const DISPATCH_STOP_STATUSES = [
  'PENDING',
  'DELIVERED',
  'PARTIAL',
  'FAILED',
] as const;
export type DispatchStopStatus = (typeof DISPATCH_STOP_STATUSES)[number];

export const FAILURE_REASONS = [
  'CUSTOMER_UNAVAILABLE',
  'ROAD_BLOCKED',
  'REJECTED',
  'WRONG_ADDRESS',
  'DAMAGED',
] as const;
export type FailureReason = (typeof FAILURE_REASONS)[number];

/** document_sequences documentType used for dispatch numbering. */
export const DISPATCH_DOCUMENT_TYPE = 'dispatch';

/** Dispatch number prefix — reserved at create, `DSP-…`. */
export const DISPATCH_NUMBER_PREFIX = 'DSP-';

/** The base role code whose driver-scoping rules apply to dispatches. */
export const DRIVER_ROLE_CODE = 'driver';

export const DISPATCH_AUDIT_ACTIONS = {
  CREATE: 'dispatch.create',
  UPDATE: 'dispatch.update',
  LOAD: 'dispatch.load',
  DEPART: 'dispatch.depart',
  DELIVER: 'dispatch.stop.deliver',
  FAIL: 'dispatch.stop.fail',
  COMPLETE: 'dispatch.complete',
  CANCEL: 'dispatch.cancel',
} as const;

export const VEHICLE_AUDIT_ACTIONS = {
  CREATE: 'dispatch.vehicle.create',
  UPDATE: 'dispatch.vehicle.update',
  DELETE: 'dispatch.vehicle.delete',
} as const;
