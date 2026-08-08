import type { BrandListQuery, UomListQuery } from "@/lib/api/trading";

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
  },
};
