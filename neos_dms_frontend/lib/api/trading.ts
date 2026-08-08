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
  remove: (id: string) =>
    apiFetch<{ deleted: boolean }>(`/uoms/${id}`, { method: "DELETE" }),
};

// ---------------------------------------------------------------------------
// Brands
// ---------------------------------------------------------------------------

export interface Brand {
  id: string;
  organizationId: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBrandDto {
  name: string;
}

export interface UpdateBrandDto {
  name?: string;
  isActive?: boolean;
}

export type BrandListQuery = ListQuery;

export const brandApi = {
  list: (query: BrandListQuery = {}) => {
    const { page, limit, search } = query;
    return apiFetchPaginated<Brand>(
      `/brands?${toQuery({ page, limit, search })}`,
    );
  },
  create: (dto: CreateBrandDto) =>
    apiFetch<Brand>("/brands", { method: "POST", body: dto }),
  update: (id: string, dto: UpdateBrandDto) =>
    apiFetch<Brand>(`/brands/${id}`, { method: "PATCH", body: dto }),
  remove: (id: string) =>
    apiFetch<{ deleted: boolean }>(`/brands/${id}`, { method: "DELETE" }),
};

// ---------------------------------------------------------------------------
// Item categories
// ---------------------------------------------------------------------------

export interface ItemCategory {
  id: string;
  organizationId: string;
  parentCategoryId: string | null;
  parentCategory?: ItemCategory | null;
  name: string;
  code: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateItemCategoryDto {
  name: string;
  code?: string | null;
  parentCategoryId?: string | null;
}

export interface UpdateItemCategoryDto {
  name?: string;
  code?: string | null;
  parentCategoryId?: string | null;
  isActive?: boolean;
}

export type CategoryListQuery = ListQuery;

export const categoryApi = {
  list: (query: CategoryListQuery = {}) => {
    const { page, limit, search } = query;
    return apiFetchPaginated<ItemCategory>(
      `/item-categories?${toQuery({ page, limit, search })}`,
    );
  },
  create: (dto: CreateItemCategoryDto) =>
    apiFetch<ItemCategory>("/item-categories", { method: "POST", body: dto }),
  update: (id: string, dto: UpdateItemCategoryDto) =>
    apiFetch<ItemCategory>(`/item-categories/${id}`, {
      method: "PATCH",
      body: dto,
    }),
  remove: (id: string) =>
    apiFetch<{ deleted: boolean }>(`/item-categories/${id}`, {
      method: "DELETE",
    }),
};

