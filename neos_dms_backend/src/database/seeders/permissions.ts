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
  { module: 'trading', resource: 'uom', actions: CRUD_ACTIONS },
  {
    module: 'sales',
    resource: 'invoice',
    actions: ['create', 'read', 'update', 'void'],
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
    ],
  },
  {
    code: 'salesman',
    name: 'Salesman',
    permissions: [
      'sales.invoice.*',
      'trading.item.read',
      'accounting.party.read',
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
    permissions: ['inventory.*', 'trading.item.*', 'dispatch.dispatch.read'],
  },
];
