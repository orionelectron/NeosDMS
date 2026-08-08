import type {
  AccountListQuery,
  JournalListQuery,
  PartyListQuery,
} from "@/lib/api/accounting";
import type {
  BrandListQuery,
  CategoryListQuery,
  ItemListQuery,
  UomListQuery,
} from "@/lib/api/trading";

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
};
