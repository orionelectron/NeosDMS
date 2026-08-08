import { z } from "zod";
import {
  INVENTORY_DIRECTIONS,
  INVENTORY_LOCATION_TYPES,
} from "@/lib/api/inventory";

// Mirrors backend `CreateInventoryLocationDto` / `UpdateInventoryLocationDto`
// (class-validator) exactly. The form uses "" for nullable strings and
// "none" for nullable UUID selects to mean "unset"; those map to
// undefined/null when building the DTO.
export const locationSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  code: z.string().trim().min(1, "Code is required"),
  locationType: z.enum(INVENTORY_LOCATION_TYPES),
  branchId: z.string(),
  address: z.string().trim(),
  notes: z.string().trim(),
  isDefault: z.boolean(),
});

export type LocationValues = z.infer<typeof locationSchema>;

const quantityOrEmpty = z
  .string()
  .trim()
  .regex(
    /^(?:[0-9]{1,12}(?:\.[0-9]{0,3})?)?$/,
    "Enter a quantity with up to 3 decimals",
  );

const costOrEmpty = z
  .string()
  .trim()
  .regex(/^(?:[0-9]{1,12}(?:\.[0-9]{0,2})?)?$/, "Enter a cost with up to 2 decimals");

const lineSchema = z.object({
  itemId: z.string().min(1, "Item is required"),
  uomId: z.string().min(1, "Unit is required"),
  direction: z.enum(INVENTORY_DIRECTIONS).optional(),
  quantity: quantityOrEmpty.refine(
    (value) => value !== "" && Number(value) > 0,
    "Quantity must be greater than zero",
  ),
  unitCost: costOrEmpty,
});

export { lineSchema };
export type InventoryLineValues = z.infer<typeof lineSchema>;

// Mirrors backend `OpeningStockDto` / `StockAdjustmentDto` (lines, location,
// notes). Direction is only honored for adjustments; it is kept here for the
// shared line editor.
export const movementSchema = z.object({
  locationId: z.string().min(1, "Location is required"),
  lines: z.array(lineSchema).min(1, "Add at least one line"),
  notes: z.string().trim(),
});

export type MovementValues = z.infer<typeof movementSchema>;

// Mirrors backend `StockTransferDto` (from/to locations + lines + notes).
export const transferSchema = z
  .object({
    fromLocationId: z.string().min(1, "Source location is required"),
    toLocationId: z.string().min(1, "Destination location is required"),
    lines: z.array(lineSchema).min(1, "Add at least one line"),
    notes: z.string().trim(),
  })
  .superRefine((data, ctx) => {
    if (
      data.fromLocationId &&
      data.toLocationId &&
      data.fromLocationId === data.toLocationId
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["toLocationId"],
        message: "Choose a different destination location",
      });
    }
  });

export type TransferValues = z.infer<typeof transferSchema>;
