import type {
  AccountListQuery,
  JournalListQuery,
  PartyListQuery,
} from "@/lib/api/accounting";
import type {
  BalanceListQuery,
  LocationListQuery,
  LowStockQuery,
  TransactionListQuery,
} from "@/lib/api/inventory";
import type { UserListQuery } from "@/lib/api/iam";
import type { AuditLogListQuery } from "@/lib/api/iam";
import type {
  BrandListQuery,
  CategoryListQuery,
  ItemListQuery,
  UomConversionListQuery,
  UomListQuery,
} from "@/lib/api/trading";
import type {
  OutletListQuery,
  RouteAssignmentListQuery,
  RouteListQuery,
  SalesTargetListQuery,
  VisitListQuery,
} from "@/lib/api/field";

export const queryKeys = {
  auth: {
    me: ["auth", "me"] as const,
  },
  plans: {
    all: ["plans"] as const,
  },
  trading: {
    uomList: (query: UomListQuery) =>
      ["trading", "uoms", "list", query] as const,
    brandList: (query: BrandListQuery) =>
      ["trading", "brands", "list", query] as const,
    categoryList: (query: CategoryListQuery) =>
      ["trading", "categories", "list", query] as const,
    itemList: (query: ItemListQuery) =>
      ["trading", "items", "list", query] as const,
    itemDetail: (id: string) => ["trading", "items", "detail", id] as const,
    conversionList: (query: UomConversionListQuery) =>
      ["trading", "conversions", "list", query] as const,
  },
  accounting: {
    accountList: (query: AccountListQuery) =>
      ["accounting", "accounts", "list", query] as const,
    fiscalYearList: ["accounting", "fiscal-years", "list"] as const,
    fiscalYearDetail: (id: string) =>
      ["accounting", "fiscal-years", "detail", id] as const,
    partyList: (query: PartyListQuery) =>
      ["accounting", "parties", "list", query] as const,
    journalList: (query: JournalListQuery) =>
      ["accounting", "journal-entries", "list", query] as const,
    journalDetail: (id: string) =>
      ["accounting", "journal-entries", "detail", id] as const,
    trialBalance: (query: {
      fiscalYearId?: string;
      from?: string;
      to?: string;
    }) => ["accounting", "trial-balance", query] as const,
    taxReference: ["accounting", "tax"] as const,
    documentSequenceList: ["accounting", "document-sequences"] as const,
  },
  inventory: {
    locationList: (query: LocationListQuery) =>
      ["inventory", "locations", "list", query] as const,
    balanceList: (query: BalanceListQuery) =>
      ["inventory", "balances", "list", query] as const,
    lowStockList: (query: LowStockQuery) =>
      ["inventory", "low-stock", "list", query] as const,
    transactionList: (query: TransactionListQuery) =>
      ["inventory", "transactions", "list", query] as const,
    transactionDetail: (id: string) =>
      ["inventory", "transactions", "detail", id] as const,
  },
  iam: {
    userList: (query: UserListQuery) =>
      ["iam", "users", "list", query] as const,
    roleList: ["iam", "roles", "list"] as const,
    permissionCatalog: ["iam", "permissions", "catalog"] as const,
    auditLogList: (query: AuditLogListQuery) =>
      ["iam", "audit-logs", "list", query] as const,
  },
  field: {
    outletList: (query: OutletListQuery) =>
      ["field", "outlets", "list", query] as const,
    outletDetail: (id: string) =>
      ["field", "outlets", "detail", id] as const,
    routeList: (query: RouteListQuery) =>
      ["field", "routes", "list", query] as const,
    routeOutlets: (id: string) =>
      ["field", "routes", "outlets", id] as const,
    routePlannerOutlets: ["field", "route-planner", "outlets"] as const,
    assignmentList: (query: RouteAssignmentListQuery) =>
      ["field", "assignments", "list", query] as const,
    visitList: (query: VisitListQuery) =>
      ["field", "visits", "list", query] as const,
    salesTargetList: (query: SalesTargetListQuery) =>
      ["field", "sales-targets", "list", query] as const,
    salesTargetReport: (query: {
      scope?: "mine" | "team" | "all";
      bsYear?: number;
      bsMonth?: number;
    }) => ["field", "sales-targets", "report", query] as const,
  },
};
