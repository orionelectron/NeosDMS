import { z } from "zod";
import {
  OUTLET_CHANNELS,
  OUTLET_STATUSES,
  ROUTE_STATUSES,
  SALES_TARGET_TYPES,
  VISIT_STATUSES,
  VISIT_TYPES,
} from "@/lib/api/field";

// Mirrors backend `CreateOutletDto` / `UpdateOutletDto`. Forms use "" for
// nullable strings to mean "unset"; those map to null when building the DTO.
export const outletSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  ownerName: z.string().trim(),
  email: z.string().trim(),
  phone: z.string().trim(),
  address: z.string().trim(),
  province: z.string().trim(),
  district: z.string().trim(),
  latitude: z.string().trim(),
  longitude: z.string().trim(),
  channel: z.enum(OUTLET_CHANNELS),
  category: z.string().trim(),
  description: z.string().trim(),
  status: z.enum(OUTLET_STATUSES).optional(),
});

export type OutletValues = z.infer<typeof outletSchema>;

// Mirrors backend `CreateRouteDto` / `UpdateRouteDto`.
export const routeSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  code: z.string().trim().min(1, "Code is required"),
  description: z.string().trim(),
  province: z.string().trim(),
  district: z.string().trim(),
  status: z.enum(ROUTE_STATUSES).optional(),
});

export type RouteValues = z.infer<typeof routeSchema>;

// Weekday checkboxes: ISO-8601 day numbers 0 (Sunday) … 6 (Saturday).
export const WEEKDAY_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

// Mirrors backend `CreateRouteAssignmentDto`.
export const routeAssignmentSchema = z.object({
  userId: z.string().min(1, "Select a salesperson"),
  routeId: z.string().min(1, "Select a route"),
  weekdays: z.array(z.number()).max(7),
});

export type RouteAssignmentValues = z.infer<typeof routeAssignmentSchema>;

// Mirrors backend `CreateVisitDto`.
export const createVisitSchema = z.object({
  routeId: z.string().min(1, "Select a route"),
  outletId: z.string().min(1, "Select an outlet"),
  visitType: z.enum(VISIT_TYPES),
});

export type CreateVisitValues = z.infer<typeof createVisitSchema>;

// Check-in / check-out share the same payload shape (GPS + optional remarks).
const coordinateOrEmpty = z
  .string()
  .trim()
  .regex(/^-?\d+(?:\.\d+)?$/, "Enter a valid coordinate");

export const visitCheckSchema = z
  .object({
    latitude: coordinateOrEmpty,
    longitude: coordinateOrEmpty,
    remarks: z.string().trim(),
  })
  .superRefine((data, ctx) => {
    if (data.latitude !== "" && (Number(data.latitude) < -90 || Number(data.latitude) > 90)) {
      ctx.addIssue({
        code: "custom",
        path: ["latitude"],
        message: "Latitude must be between -90 and 90",
      });
    }
    if (
      data.longitude !== "" &&
      (Number(data.longitude) < -180 || Number(data.longitude) > 180)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["longitude"],
        message: "Longitude must be between -180 and 180",
      });
    }
  });

export type VisitCheckValues = z.infer<typeof visitCheckSchema>;

export const VISIT_STATUS_FILTERS = VISIT_STATUSES as readonly string[];

// Mirrors backend `CreateSalesTargetDto`. `amount` is a decimal string in the
// form; "" maps to undefined so zod's refine catches it.
export const salesTargetSchema = z.object({
  userId: z.string().min(1, "Select a salesperson"),
  bsYear: z.string().trim().min(1, "BS year is required"),
  bsMonth: z.string().trim().min(1, "BS month is required"),
  targetType: z.enum(SALES_TARGET_TYPES),
  categoryId: z.string(),
  brandId: z.string(),
  amount: z
    .string()
    .trim()
    .regex(/^\d+(?:\.\d{1,2})?$/, "Enter an amount with up to 2 decimals"),
});

export type SalesTargetValues = z.infer<typeof salesTargetSchema>;
