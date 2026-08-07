export const LEAVE_REQUEST_STATUS = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
] as const;
export type LeaveRequestStatus = (typeof LEAVE_REQUEST_STATUS)[number];

export const APPROVAL_ACTION = [
  'SUBMIT',
  'APPROVE',
  'REJECT',
  'CANCEL',
  'UPDATE',
] as const;
export type ApprovalAction = (typeof APPROVAL_ACTION)[number];

export const APPROVAL_ENTITY_TYPE = [
  'leave_request',
  'travel_request',
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
