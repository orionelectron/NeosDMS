import { apiFetch, apiFetchPaginated } from "@/lib/api/http";

export interface ListQuery {
  page?: number;
  limit?: number;
  search?: string;
}

export function toQuery(
  params: Record<string, string | number | boolean | undefined | null>,
): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value));
    }
  }
  return searchParams.toString();
}

// ---------------------------------------------------------------------------
// Units of measure
// ---------------------------------------------------------------------------

export interface Uom {
  id: string;
  organizationId: string;
  name: string;
  shortName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUomDto {
  name: string;
  shortName: string;
}

export interface UpdateUomDto {
  name?: string;
  shortName?: string;
  isActive?: boolean;
}

export type UomListQuery = ListQuery;

export const uomApi = {
  list: (query: UomListQuery = {}) => {
    const { page, limit, search } = query;
    return apiFetchPaginated<Uom>(
      `/uoms?${toQuery({ page, limit, search })}`,
    );
  },
  create: (dto: CreateUomDto) =>
    apiFetch<Uom>("/uoms", { method: "POST", body: dto }),
  update: (id: string, dto: UpdateUomDto) =>
    apiFetch<Uom>(`/uoms/${id}`, { method: "PATCH", body: dto }),
};

