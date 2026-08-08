import { apiFetch, apiFetchPaginated } from "@/lib/api/http";
import type { ListQuery } from "@/lib/api/trading";
import { toQuery } from "@/lib/api/trading";

// ---------------------------------------------------------------------------
// Shared enums (mirrors backend `accounting.constants.ts`)
// ---------------------------------------------------------------------------

export const COA_TYPES = [
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "INCOME",
  "EXPENSE",
] as const;
export type CoaType = (typeof COA_TYPES)[number];

export const JOURNAL_STATUSES = ["DRAFT", "POSTED", "CANCELLED"] as const;
export type JournalStatus = (typeof JOURNAL_STATUSES)[number];

export const PARTY_KINDS = ["BUSINESS", "INDIVIDUAL"] as const;
export type PartyKind = (typeof PARTY_KINDS)[number];

export const IRD_CATEGORIES = [
  "TAXABLE",
  "EXEMPT",
  "ZERO_RATED",
  "TDS_WITHHOLDING",
] as const;
export type IrdCategory = (typeof IRD_CATEGORIES)[number];

// ---------------------------------------------------------------------------
// Chart of accounts
// ---------------------------------------------------------------------------

export interface Account {
  id: string;
  organizationId: string;
  parentAccountId: string | null;
  name: string;
  code: string;
  coaType: CoaType;
  isGroup: boolean;
  branchId: string | null;
  isSystemAccount: boolean;
  systemPurpose: string | null;
  isLocked: boolean;
  isActive: boolean;
  level: number | null;
  path: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccountDto {
  name: string;
  code: string;
  coaType: CoaType;
  parentAccountId?: string | null;
  branchId?: string | null;
  isGroup?: boolean;
}

export interface UpdateAccountDto {
  name?: string;
  parentAccountId?: string | null;
  isGroup?: boolean;
  isActive?: boolean;
}

export interface AccountListQuery extends ListQuery {
  parentId?: string;
  coaType?: CoaType;
}

export const accountApi = {
  list: (query: AccountListQuery = {}) => {
    const { page, limit, search, parentId, coaType } = query;
    return apiFetchPaginated<Account>(
      `/accounts?${toQuery({ page, limit, search, parentId, coaType })}`,
    );
  },
  get: (id: string) => apiFetch<Account>(`/accounts/${id}`),
  create: (dto: CreateAccountDto) =>
    apiFetch<Account>("/accounts", { method: "POST", body: dto }),
  update: (id: string, dto: UpdateAccountDto) =>
    apiFetch<Account>(`/accounts/${id}`, { method: "PATCH", body: dto }),
  remove: (id: string) =>
    apiFetch<{ deleted: boolean }>(`/accounts/${id}`, { method: "DELETE" }),
};

// ---------------------------------------------------------------------------
// Branches (reference select — `GET /organizations/me/branches`)
// ---------------------------------------------------------------------------

export interface Branch {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  location: string | null;
  isMainBranch: boolean;
  isActive: boolean;
  phone: string | null;
  email: string | null;
}

export const branchApi = {
  list: () => apiFetch<Branch[]>("/organizations/me/branches"),
};

// ---------------------------------------------------------------------------
// Fiscal years + periods
// ---------------------------------------------------------------------------

export interface FiscalPeriod {
  id: string;
  fiscalYearId: string;
  name: string;
  sequence: number;
  startDateBs: string;
  endDateBs: string;
  startDate: string;
  endDate: string;
  isLocked: boolean;
  lockedAt: string | null;
  lockedBy: string | null;
}

export interface FiscalYear {
  id: string;
  organizationId: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isClosed: boolean;
  closedAt: string | null;
  closedBy: string | null;
  periods?: FiscalPeriod[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateFiscalYearDto {
  bsYear: number;
  name?: string;
}

export const fiscalYearApi = {
  list: () => apiFetch<FiscalYear[]>("/fiscal-years"),
  get: (id: string) => apiFetch<FiscalYear>(`/fiscal-years/${id}`),
  getActive: () => apiFetch<FiscalYear>("/fiscal-years/active"),
  create: (dto: CreateFiscalYearDto) =>
    apiFetch<FiscalYear>("/fiscal-years", { method: "POST", body: dto }),
  open: (id: string) =>
    apiFetch<FiscalYear>(`/fiscal-years/${id}/open`, { method: "POST" }),
  close: (id: string) =>
    apiFetch<FiscalYear>(`/fiscal-years/${id}/close`, { method: "POST" }),
  periods: (id: string) =>
    apiFetch<FiscalPeriod[]>(`/fiscal-years/${id}/periods`),
};

export const provisioningApi = {
  provision: () =>
    apiFetch<{ provisioned: boolean }>("/accounting/provision", {
      method: "POST",
    }),
};

// ---------------------------------------------------------------------------
// Parties
// ---------------------------------------------------------------------------

export interface PartyAddress {
  id: string;
  partyId: string;
  addressType: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string | null;
  isDefault: boolean;
}

export interface Party {
  id: string;
  organizationId: string;
  branchId: string | null;
  currencyId: string | null;
  paymentTermId: string | null;
  name: string;
  legalName: string | null;
  partyKind: PartyKind;
  isCustomer: boolean;
  isSupplier: boolean;
  isLead: boolean;
  panNumber: string | null;
  vatNumber: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  creditLimit: string;
  openingBalance: string;
  isActive: boolean;
  addresses?: PartyAddress[];
  createdAt: string;
  updatedAt: string;
}

export interface PartyAddressDto {
  addressType: string;
  addressLine1: string;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  country?: string | null;
  isDefault?: boolean;
}

export interface CreatePartyDto {
  name: string;
  partyKind?: PartyKind;
  isCustomer?: boolean;
  isSupplier?: boolean;
  isLead?: boolean;
  panNumber?: string | null;
  vatNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  creditLimit?: number;
  openingBalance?: number;
  paymentTermId?: string | null;
  branchId?: string | null;
  addresses?: PartyAddressDto[];
}

export interface UpdatePartyDto {
  name?: string;
  partyKind?: PartyKind;
  isCustomer?: boolean;
  isSupplier?: boolean;
  isLead?: boolean;
  panNumber?: string | null;
  vatNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  creditLimit?: number;
  openingBalance?: number;
  paymentTermId?: string | null;
  branchId?: string | null;
  isActive?: boolean;
}

export interface PartyListQuery extends ListQuery {
  role?: string;
}

export const partyApi = {
  list: (query: PartyListQuery = {}) => {
    const { page, limit, search, role } = query;
    return apiFetchPaginated<Party>(
      `/parties?${toQuery({ page, limit, search, role })}`,
    );
  },
  get: (id: string) => apiFetch<Party>(`/parties/${id}`),
  create: (dto: CreatePartyDto) =>
    apiFetch<Party>("/parties", { method: "POST", body: dto }),
  update: (id: string, dto: UpdatePartyDto) =>
    apiFetch<Party>(`/parties/${id}`, { method: "PATCH", body: dto }),
  remove: (id: string) =>
    apiFetch<{ deleted: boolean }>(`/parties/${id}`, { method: "DELETE" }),
};

// ---------------------------------------------------------------------------
// Journal entries
// ---------------------------------------------------------------------------

export interface JournalLine {
  id: string;
  journalEntryId: string;
  accountId: string;
  account: Account;
  partyId: string | null;
  party: Party | null;
  debitAmount: string;
  creditAmount: string;
  description: string | null;
  isReconciled: boolean;
  reconciledDate: string | null;
}

export interface JournalEntry {
  id: string;
  branchId: string;
  fiscalYearId: string;
  fiscalPeriodId: string;
  currencyId: string | null;
  exchangeRate: string;
  entryDate: string;
  entryDateBs: string | null;
  description: string | null;
  referenceNumber: string | null;
  status: JournalStatus;
  sourceType: string | null;
  sourceId: string | null;
  lines: JournalLine[];
  fiscalYear?: { id: string; name: string };
  fiscalPeriod?: { id: string; name: string; status: string };
  createdAt: string;
  updatedAt: string;
}

export interface JournalLineDto {
  accountId: string;
  partyId?: string;
  debit?: number;
  credit?: number;
  description?: string;
}

export interface CreateJournalEntryDto {
  branchId: string;
  entryDate: string;
  description?: string;
  lines: JournalLineDto[];
}

export interface JournalListQuery {
  page?: number;
  limit?: number;
  status?: JournalStatus;
  from?: string;
  to?: string;
  accountId?: string;
}

export const journalApi = {
  list: (query: JournalListQuery = {}) => {
    const { page, limit, status, from, to, accountId } = query;
    return apiFetchPaginated<JournalEntry>(
      `/journal-entries?${toQuery({ page, limit, status, from, to, accountId })}`,
    );
  },
  get: (id: string) => apiFetch<JournalEntry>(`/journal-entries/${id}`),
  create: (dto: CreateJournalEntryDto) =>
    apiFetch<JournalEntry>("/journal-entries", { method: "POST", body: dto }),
  post: (id: string) =>
    apiFetch<JournalEntry>(`/journal-entries/${id}/post`, { method: "POST" }),
  cancel: (id: string) =>
    apiFetch<JournalEntry>(`/journal-entries/${id}/cancel`, {
      method: "POST",
    }),
};

// ---------------------------------------------------------------------------
// Trial balance
// ---------------------------------------------------------------------------

export interface TrialBalanceLine {
  accountId: string;
  code: string;
  name: string;
  coaType: CoaType;
  level: number | null;
  path: string | null;
  openingDebit: number;
  openingCredit: number;
  debit: number;
  credit: number;
  closingDebit: number;
  closingCredit: number;
  netBalance: number;
}

export interface TrialBalance {
  fiscalYearId: string;
  fiscalYearName: string;
  from: string;
  to: string;
  balanced: boolean;
  lines: TrialBalanceLine[];
  totals: {
    openingDebit: number;
    openingCredit: number;
    debit: number;
    credit: number;
    closingDebit: number;
    closingCredit: number;
  };
}

export const trialBalanceApi = {
  get: (query: { fiscalYearId?: string; from?: string; to?: string } = {}) =>
    apiFetch<TrialBalance>(
      `/trial-balance?${toQuery({
        fiscalYearId: query.fiscalYearId,
        from: query.from,
        to: query.to,
      })}`,
    ),
};

// ---------------------------------------------------------------------------
// Tax reference (read-only)
// ---------------------------------------------------------------------------

export interface TaxType {
  id: string;
  code: string;
  name: string;
  mathSign: 1 | -1;
  isActive: boolean;
}

export interface TaxTemplate {
  id: string;
  name: string;
  rate: string;
  irdCategory: IrdCategory;
  isSystem: boolean;
  isActive: boolean;
}

export interface TaxCode {
  id: string;
  name: string;
  rate: string;
  irdCategory: IrdCategory;
  accountId: string;
  account: Account;
  isActive: boolean;
}

export const taxApi = {
  types: () => apiFetch<TaxType[]>("/tax/types"),
  templates: () => apiFetch<TaxTemplate[]>("/tax/templates"),
  codes: () => apiFetch<TaxCode[]>("/tax/codes"),
  code: (id: string) => apiFetch<TaxCode>(`/tax/codes/${id}`),
};

// ---------------------------------------------------------------------------
// Document sequences
// ---------------------------------------------------------------------------

export const DOCUMENT_TYPES = [
  "sales_invoice",
  "sales_return",
  "customer_receipt",
  "purchase_bill",
  "purchase_return",
  "purchase_receipt",
  "supplier_payment",
  "expense",
  "journal_entry",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export interface DocumentSequence {
  id: string;
  organizationId: string;
  branchId: string | null;
  fiscalYearId: string | null;
  documentType: DocumentType;
  prefix: string | null;
  lastNumber: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDocumentSequenceDto {
  documentType: DocumentType;
  branchId?: string;
  fiscalYearId?: string;
  prefix?: string;
  lastNumber?: number;
}

export const documentSequenceApi = {
  list: () => apiFetch<DocumentSequence[]>("/document-sequences"),
  create: (dto: CreateDocumentSequenceDto) =>
    apiFetch<DocumentSequence>("/document-sequences", {
      method: "POST",
      body: dto,
    }),
};
