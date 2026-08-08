import { z } from "zod";

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
