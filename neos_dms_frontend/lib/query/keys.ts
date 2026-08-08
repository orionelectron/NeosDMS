import type { UomListQuery } from "@/lib/api/trading";

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
  },
};
