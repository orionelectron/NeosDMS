import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Boxes,
  Building2,
  CreditCard,
  LayoutDashboard,
  PackagePlus,
  ShoppingCart,
  Tags,
  Truck,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";

export type AppScope = "org" | "platform";

/**
 * Central module registry — the single source of truth for every feature
 * module in the app: route prefix, nav metadata and the backend permission
 * prefix that gates access.
 *
 * Access model: a user can open a module when they hold at least one
 * permission matching the module's prefix (`<module>.<resource>.<action>`).
 * An org admin holds the full catalog, so every module is accessible.
 * Adding a new backend resource under an existing module automatically
 * grants access to it. Modules with `module: null` are always accessible
 * (e.g. dashboards).
 *
 * Route convention: org routes live under flat prefixes (`/sales`, …) via the
 * `(org)` route group; platform routes are prefixed with `/platform` so the two
 * scopes never collide in the URL space.
 */
export interface NavChild {
  /** Stable, unique key (used for command-palette ids). */
  key: string;
  /** Nav label. */
  label: string;
  /** Route. Must map to a real page. */
  href: string;
}

export interface ModuleConfig {
  /** Stable, unique key. Never change once shipped (used for nav/persistence). */
  key: string;
  /** Nav label. */
  label: string;
  /** Short description, used for accessible tooltips and empty states. */
  description: string;
  /** Route prefix. Child routes live under it (`/sales/invoices`). */
  href: string;
  /** Backend permission-module prefix, e.g. "sales" gates `sales.*`. */
  module: string | null;
  /** Nav icon. */
  icon: LucideIcon;
  /** Sort order in navigation. */
  order: number;
  /** Optional sub-pages rendered as a collapsible group in the sidebar. */
  children?: NavChild[];
}

export const ORG_MODULES: ModuleConfig[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    description: "Overview and KPIs",
    href: "/dashboard",
    module: null,
    icon: LayoutDashboard,
    order: 0,
  },
  {
    key: "sales",
    label: "Sales",
    description: "Invoices, orders, returns, receipts, outlets and routes",
    href: "/sales",
    module: "sales",
    icon: ShoppingCart,
    order: 10,
  },
  {
    key: "purchase",
    label: "Purchase",
    description: "Vendor orders, grns and purchase returns",
    href: "/purchase",
    module: "purchase",
    icon: PackagePlus,
    order: 20,
  },
  {
    key: "inventory",
    label: "Inventory",
    description: "Stock balances, locations and adjustments",
    href: "/inventory",
    module: "inventory",
    icon: Boxes,
    order: 30,
    children: [
      {
        key: "balances",
        label: "Stock balances",
        href: "/inventory/balances",
      },
      {
        key: "locations",
        label: "Locations",
        href: "/inventory/locations",
      },
      {
        key: "movements",
        label: "Movements",
        href: "/inventory/transactions",
      },
      {
        key: "low-stock",
        label: "Low stock",
        href: "/inventory/low-stock",
      },
    ],
  },
  {
    key: "dispatch",
    label: "Dispatch",
    description: "Loadings, deliveries and vehicle management",
    href: "/dispatch",
    module: "dispatch",
    icon: Truck,
    order: 40,
  },
  {
    key: "trading",
    label: "Trading",
    description: "Items, categories, brands and units of measure",
    href: "/trading",
    module: "trading",
    icon: Tags,
    order: 50,
    children: [
      {
        key: "items",
        label: "Items",
        href: "/trading/items",
      },
      {
        key: "categories",
        label: "Categories",
        href: "/trading/categories",
      },
      {
        key: "brands",
        label: "Brands",
        href: "/trading/brands",
      },
      {
        key: "uoms",
        label: "Units of measure",
        href: "/trading/uoms",
      },
      {
        key: "conversions",
        label: "UOM conversions",
        href: "/trading/conversions",
      },
    ],
  },
  {
    key: "accounting",
    label: "Accounting",
    description: "Chart of accounts, journals, parties and taxes",
    href: "/accounting",
    module: "accounting",
    icon: Wallet,
    order: 60,
    children: [
      {
        key: "accounts",
        label: "Chart of accounts",
        href: "/accounting/accounts",
      },
      {
        key: "journal-entries",
        label: "Journal entries",
        href: "/accounting/journal-entries",
      },
      {
        key: "parties",
        label: "Parties",
        href: "/accounting/parties",
      },
      {
        key: "fiscal-years",
        label: "Fiscal years",
        href: "/accounting/fiscal-years",
      },
      {
        key: "document-sequences",
        label: "Document sequences",
        href: "/accounting/document-sequences",
      },
      {
        key: "tax",
        label: "Tax",
        href: "/accounting/tax",
      },
      {
        key: "trial-balance",
        label: "Trial balance",
        href: "/accounting/trial-balance",
      },
    ],
  },
  {
    key: "iam",
    label: "Access",
    description: "Users, roles, permissions and audit logs",
    href: "/iam",
    module: "iam",
    icon: Users,
    order: 70,
  },
  {
    key: "hr",
    label: "HR",
    description: "Employees, attendance, leave and payroll",
    href: "/hr",
    module: "hr",
    icon: UserCog,
    order: 80,
  },
  {
    key: "reports",
    label: "Reports",
    description: "Sales, stock and accounting reports",
    href: "/reports",
    module: "reports",
    icon: BarChart3,
    order: 90,
  },
];

export const PLATFORM_MODULES: ModuleConfig[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    description: "Platform overview",
    href: "/platform/dashboard",
    module: null,
    icon: LayoutDashboard,
    order: 0,
  },
  {
    key: "organizations",
    label: "Organizations",
    description: "Tenants, branches and configuration",
    href: "/platform/organizations",
    module: "tenant",
    icon: Building2,
    order: 10,
  },
  {
    key: "subscriptions",
    label: "Subscriptions",
    description: "Plans, billing and usage",
    href: "/platform/subscriptions",
    module: "subscription",
    icon: CreditCard,
    order: 20,
  },
  {
    key: "platform-users",
    label: "Platform users",
    description: "Administrators and audit",
    href: "/platform/users",
    module: "iam",
    icon: UserCog,
    order: 30,
  },
];

export function getModules(scope: AppScope): ModuleConfig[] {
  return scope === "platform" ? PLATFORM_MODULES : ORG_MODULES;
}

export function isModuleAccessible(
  module: ModuleConfig,
  permissions: string[],
): boolean {
  if (!module.module) return true;
  return permissions.some((permission) =>
    permission.startsWith(`${module.module}.`),
  );
}

export function getAuthorizedModules(
  scope: AppScope,
  permissions: string[],
): ModuleConfig[] {
  return getModules(scope)
    .filter((module) => isModuleAccessible(module, permissions))
    .sort((a, b) => a.order - b.order);
}

export function getModuleByPath(
  scope: AppScope,
  pathname: string,
): ModuleConfig | null {
  return (
    getModules(scope).find(
      (module) =>
        pathname === module.href || pathname.startsWith(`${module.href}/`),
    ) ?? null
  );
}

export function resolveHomePath(
  scope: AppScope,
  permissions: string[],
): string {
  return getAuthorizedModules(scope, permissions)[0]?.href ?? "/login";
}
