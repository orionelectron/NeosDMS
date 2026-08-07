export const MODULES = [
  'tenant',
  'subscription',
  'iam',
  'accounting',
  'trading',
  'sales',
  'purchase',
  'inventory',
  'dispatch',
  'hr',
  'reports',
] as const;

export type ModuleCode = (typeof MODULES)[number];

export const CRUD_ACTIONS = ['create', 'read', 'update', 'delete'] as const;

interface PermissionDef {
  module: ModuleCode;
  resource: string;
  actions: readonly string[];
}

const PERMISSION_DEFS: readonly PermissionDef[] = [
  { module: 'tenant', resource: 'organization', actions: CRUD_ACTIONS },
  { module: 'tenant', resource: 'branch', actions: CRUD_ACTIONS },
  { module: 'subscription', resource: 'plan', actions: ['read'] },
  {
    module: 'subscription',
    resource: 'subscription',
    actions: ['read', 'update', 'cancel'],
  },
  { module: 'subscription', resource: 'usage', actions: ['read'] },
  { module: 'iam', resource: 'user', actions: CRUD_ACTIONS },
  { module: 'iam', resource: 'role', actions: CRUD_ACTIONS },
  { module: 'iam', resource: 'permission', actions: ['read'] },
  { module: 'iam', resource: 'audit-log', actions: ['read'] },
  {
    module: 'accounting',
    resource: 'fiscal-year',
    actions: ['create', 'read', 'update', 'close'],
  },
  { module: 'accounting', resource: 'account', actions: CRUD_ACTIONS },
  {
    module: 'accounting',
    resource: 'journal-entry',
    actions: ['create', 'read', 'post', 'delete'],
  },
  { module: 'accounting', resource: 'party', actions: CRUD_ACTIONS },
  { module: 'accounting', resource: 'tax', actions: CRUD_ACTIONS },
  {
    module: 'accounting',
    resource: 'document-sequence',
    actions: ['create', 'read', 'update'],
  },
  { module: 'trading', resource: 'item', actions: CRUD_ACTIONS },
  { module: 'trading', resource: 'item-category', actions: CRUD_ACTIONS },
  { module: 'trading', resource: 'brand', actions: CRUD_ACTIONS },
  { module: 'trading', resource: 'uom', actions: CRUD_ACTIONS },
  { module: 'trading', resource: 'uom-conversion', actions: CRUD_ACTIONS },
  {
    module: 'sales',
    resource: 'invoice',
    actions: ['create', 'read', 'update', 'void'],
  },
  { module: 'sales', resource: 'outlet', actions: CRUD_ACTIONS },
  { module: 'sales', resource: 'route', actions: CRUD_ACTIONS },
  {
    module: 'sales',
    resource: 'route_assignment',
    actions: CRUD_ACTIONS,
  },
  {
    module: 'sales',
    resource: 'visit',
    actions: ['create', 'read', 'update'],
  },
  {
    module: 'purchase',
    resource: 'bill',
    actions: ['create', 'read', 'update', 'void'],
  },
  {
    module: 'inventory',
    resource: 'transaction',
    actions: ['create', 'read', 'adjust'],
  },
  {
    module: 'dispatch',
    resource: 'dispatch',
    actions: ['create', 'read', 'update', 'complete'],
  },
  {
    module: 'hr',
    resource: 'leave_type',
    actions: CRUD_ACTIONS,
  },
  {
    module: 'hr',
    resource: 'leave',
    actions: ['create', 'read', 'update', 'delete', 'approve'],
  },
  {
    module: 'hr',
    resource: 'leave_balance',
    actions: ['read', 'update'],
  },
  {
    module: 'hr',
    resource: 'approval',
    actions: ['read'],
  },
  {
    module: 'hr',
    resource: 'travel_request',
    actions: ['create', 'read', 'update', 'approve'],
  },
  {
    module: 'hr',
    resource: 'expense',
    actions: ['create', 'read', 'update', 'approve', 'pay'],
  },
  {
    module: 'hr',
    resource: 'attendance',
    actions: ['create', 'read', 'update', 'adjust'],
  },
  { module: 'reports', resource: 'report', actions: ['read'] },
];

export const PERMISSIONS: readonly string[] = PERMISSION_DEFS.flatMap((def) =>
  def.actions.map((action) => `${def.module}.${def.resource}.${action}`),
);

export interface RoleDefinition {
  code: string;
  name: string;
  /** Permission codes or globs (e.g. `accounting.*`, `iam.user.*`). */
  permissions: readonly string[];
}

export const BASE_ROLES: readonly RoleDefinition[] = [
  {
    code: 'admin',
    name: 'Admin',
    permissions: ['*'],
  },
  {
    code: 'accountant',
    name: 'Accountant',
    permissions: [
      'accounting.*',
      'reports.*',
      'iam.user.read',
      'iam.audit-log.read',
      'sales.invoice.read',
      'purchase.bill.read',
      'hr.expense.read',
      'hr.expense.pay',
      'hr.travel_request.read',
    ],
  },
  {
    code: 'salesman',
    name: 'Salesman',
    permissions: [
      'sales.invoice.*',
      'sales.outlet.*',
      'sales.route.*',
      'sales.visit.*',
      'trading.item.read',
      'accounting.party.read',
      'hr.leave.*',
      'hr.leave_balance.read',
      'hr.approval.read',
      'hr.travel_request.*',
      'hr.expense.create',
      'hr.expense.read',
      'hr.expense.update',
      'hr.attendance.create',
      'hr.attendance.read',
      'hr.attendance.update',
      'reports.report.read',
    ],
  },
  {
    code: 'driver',
    name: 'Driver',
    permissions: ['dispatch.dispatch.read', 'dispatch.dispatch.update'],
  },
  {
    code: 'warehouse_manager',
    name: 'Warehouse Manager',
    permissions: [
      'inventory.*',
      'trading.*',
      'sales.outlet.read',
      'sales.route.read',
      'sales.route_assignment.*',
      'sales.visit.read',
      'dispatch.dispatch.read',
    ],
  },
  {
    code: 'manager',
    name: 'Manager',
    permissions: [
      'hr.*',
      'reports.report.read',
      'iam.user.read',
      'sales.*',
      'purchase.bill.read',
    ],
  },
];

/**
 * Expand `*` and `module.*` globs against the permission catalog into the
 * concrete `module.resource.action` codes stored in `permissions`.
 */
export function expandGlobs(
  patterns: readonly string[],
  catalog: readonly string[] = PERMISSIONS,
): string[] {
  const codes = new Set<string>();
  for (const pattern of patterns) {
    if (pattern === '*') {
      catalog.forEach((code) => codes.add(code));
    } else if (pattern.endsWith('.*')) {
      const prefix = pattern.slice(0, -1);
      catalog
        .filter((code) => code.startsWith(prefix))
        .forEach((code) => codes.add(code));
    } else if (catalog.includes(pattern)) {
      codes.add(pattern);
    }
  }
  return [...codes];
}
