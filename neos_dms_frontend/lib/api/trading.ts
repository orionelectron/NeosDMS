import { apiFetch, apiFetchPaginated } from "@/lib/api/http";
import type { TaxCode } from "@/lib/api/accounting";

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

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export const ITEM_TYPES = ["GOODS", "SERVICE", "RAW", "ASSET"] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const VALUATION_METHODS = ["FIFO", "WEIGHTED_AVERAGE"] as const;
export type ValuationMethod = (typeof VALUATION_METHODS)[number];

export const INVENTORY_TRACKINGS = [
  "NONE",
  "QUANTITY",
  "BATCH",
  "SERIAL",
] as const;
export type InventoryTracking = (typeof INVENTORY_TRACKINGS)[number];

export interface Item {
  id: string;
  organizationId: string;
  parentItemId: string | null;
  name: string;
  code: string | null;
  sku: string | null;
  barcode: string | null;
  description: string | null;
  type: ItemType;
  categoryId: string | null;
  category: ItemCategory | null;
  brandId: string | null;
  brand: Brand | null;
  baseUomId: string;
  baseUom: Uom;
  hsnCode: string | null;
  valuationMethod: ValuationMethod;
  taxCodeId: string | null;
  taxCode: TaxCode | null;
  mrp: string;
  salePrice: string;
  standardCost: string;
  reorderLevel: number;
  inventoryTracking: InventoryTracking;
  trackExpiry: boolean;
  allowNegativeStock: boolean;
  isActive: boolean;
  salesAccountId: string | null;
  purchaseAccountId: string | null;
  salesReturnAccountId: string | null;
  purchaseReturnAccountId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateItemDto {
  name: string;
  code?: string | null;
  sku?: string | null;
  barcode?: string | null;
  description?: string | null;
  type?: ItemType;
  categoryId?: string | null;
  brandId?: string | null;
  baseUomId: string;
  hsnCode?: string | null;
  valuationMethod?: ValuationMethod;
  taxCodeId?: string | null;
  mrp?: number;
  salePrice?: number;
  standardCost?: number;
  reorderLevel?: number;
  inventoryTracking?: InventoryTracking;
  trackExpiry?: boolean;
  allowNegativeStock?: boolean;
  salesAccountId?: string | null;
  purchaseAccountId?: string | null;
  salesReturnAccountId?: string | null;
  purchaseReturnAccountId?: string | null;
}

export interface UpdateItemDto {
  name?: string;
  code?: string | null;
  sku?: string | null;
  barcode?: string | null;
  description?: string | null;
  type?: ItemType;
  categoryId?: string | null;
  brandId?: string | null;
  baseUomId?: string;
  hsnCode?: string | null;
  valuationMethod?: ValuationMethod;
  taxCodeId?: string | null;
  mrp?: number;
  salePrice?: number;
  standardCost?: number;
  reorderLevel?: number;
  inventoryTracking?: InventoryTracking;
  trackExpiry?: boolean;
  allowNegativeStock?: boolean;
  salesAccountId?: string | null;
  purchaseAccountId?: string | null;
  salesReturnAccountId?: string | null;
  purchaseReturnAccountId?: string | null;
  isActive?: boolean;
}

export interface ItemListQuery extends ListQuery {
  categoryId?: string;
  brandId?: string;
  isActive?: boolean;
}

export const itemApi = {
  list: (query: ItemListQuery = {}) => {
    const { page, limit, search, categoryId, brandId, isActive } = query;
    return apiFetchPaginated<Item>(
      `/items?${toQuery({
        page,
        limit,
        search,
        categoryId,
        brandId,
        isActive,
      })}`,
    );
  },
  get: (id: string) => apiFetch<Item>(`/items/${id}`),
  create: (dto: CreateItemDto) =>
    apiFetch<Item>("/items", { method: "POST", body: dto }),
  update: (id: string, dto: UpdateItemDto) =>
    apiFetch<Item>(`/items/${id}`, { method: "PATCH", body: dto }),
  remove: (id: string) =>
    apiFetch<{ deleted: boolean }>(`/items/${id}`, { method: "DELETE" }),
};

