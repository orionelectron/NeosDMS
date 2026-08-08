import { z } from "zod";
import {
  INVENTORY_TRACKINGS,
  ITEM_TYPES,
  VALUATION_METHODS,
} from "@/lib/api/trading";

// Mirrors backend `CreateUomDto` / `UpdateUomDto` (class-validator) exactly.
export const uomSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  shortName: z.string().trim().min(1, "Short name is required"),
});

export type UomValues = z.infer<typeof uomSchema>;

// Mirrors backend `CreateBrandDto` / `UpdateBrandDto` exactly.
export const brandSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
});

export type BrandValues = z.infer<typeof brandSchema>;

// Mirrors backend `CreateItemCategoryDto`. The form uses "" (code) and "none"
// (parentCategoryId sentinel) to mean "unset"; the form maps those to
// undefined/null when building the DTO.
export const categorySchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  code: z.string().trim(),
  parentCategoryId: z.string(),
});

export type CategoryValues = z.infer<typeof categorySchema>;

const moneyOrEmpty = z
  .string()
  .trim()
  .regex(/^(?:[0-9]{1,12}(?:\.[0-9]{0,2})?)?$/, "Enter a valid amount (2dp)");

const wholeOrEmpty = z
  .string()
  .trim()
  .regex(/^(?:[0-9]{1,9})?$/, "Enter a whole number");

// Mirrors backend `CreateItemDto` / `UpdateItemDto` (class-validator). The form
// uses "" for nullable strings and "none" for nullable UUID selects to mean
// "unset"; those map to null/undefined when building the DTO. Money is kept as
// strings in the form (2dp) and converted to numbers on submit.
export const itemSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  code: z.string().trim(),
  sku: z.string().trim(),
  barcode: z.string().trim(),
  description: z.string().trim(),
  type: z.enum(ITEM_TYPES),
  categoryId: z.string(),
  brandId: z.string(),
  baseUomId: z.string().min(1, "Base unit is required"),
  hsnCode: z.string().trim(),
  valuationMethod: z.enum(VALUATION_METHODS),
  taxCodeId: z.string(),
  mrp: moneyOrEmpty,
  salePrice: moneyOrEmpty,
  standardCost: moneyOrEmpty,
  reorderLevel: wholeOrEmpty,
  inventoryTracking: z.enum(INVENTORY_TRACKINGS),
  trackExpiry: z.boolean(),
  allowNegativeStock: z.boolean(),
  salesAccountId: z.string(),
  purchaseAccountId: z.string(),
  salesReturnAccountId: z.string(),
  purchaseReturnAccountId: z.string(),
  isActive: z.boolean(),
});

export type ItemValues = z.infer<typeof itemSchema>;
