export const LEAVE_REQUEST_STATUS = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
] as const;
export type LeaveRequestStatus = (typeof LEAVE_REQUEST_STATUS)[number];

export const TRAVEL_REQUEST_STATUS = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
] as const;
export type TravelRequestStatus = (typeof TRAVEL_REQUEST_STATUS)[number];

export const EXPENSE_CLAIM_STATUS = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'PAID',
  'CANCELLED',
] as const;
export type ExpenseClaimStatus = (typeof EXPENSE_CLAIM_STATUS)[number];

export const TRANSPORT_MODE = [
  'AIR',
  'BUS',
  'TAXI',
  'TRAIN',
  'PRIVATE_CAR',
  'OTHER',
] as const;
export type TransportMode = (typeof TRANSPORT_MODE)[number];

export const EXPENSE_CATEGORY = [
  'HOTEL',
  'FOOD',
  'FUEL',
  'TRANSPORT',
  'TOLL',
  'MISC',
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORY)[number];

export const APPROVAL_ACTION = [
  'SUBMIT',
  'APPROVE',
  'REJECT',
  'CANCEL',
  'UPDATE',
  'PAID',
] as const;
export type ApprovalAction = (typeof APPROVAL_ACTION)[number];

export const ATTENDANCE_STATUS = ['OPEN', 'CLOSED'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUS)[number];

export const ATTENDANCE_SOURCE = ['DEVICE', 'MANUAL'] as const;
export type AttendanceSource = (typeof ATTENDANCE_SOURCE)[number];

export const ATTENDANCE_AUDIT_ACTION = [
  'hr.attendance.checkin',
  'hr.attendance.checkout',
  'hr.attendance.manual',
  'hr.attendance.adjust',
] as const;
export type AttendanceAuditAction = (typeof ATTENDANCE_AUDIT_ACTION)[number];

export const APPROVAL_ENTITY_TYPE = [
  'leave_request',
  'travel_request',
  'expense_claim',
] as const;
export type ApprovalEntityType = (typeof APPROVAL_ENTITY_TYPE)[number];

/**
 * Canonical zero-padded BS date key (`YYYY-MM-DD`) — lexicographic comparison
 * is a valid date comparison, used for overlap checks on leave ranges.
 */
export function toBsKey(
  bsYear: number,
  bsMonth: number,
  bsDay: number,
): string {
  return `${String(bsYear).padStart(4, '0')}-${String(bsMonth).padStart(2, '0')}-${String(bsDay).padStart(2, '0')}`;
}
