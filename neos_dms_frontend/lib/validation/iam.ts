import { z } from "zod";

// Mirrors backend `CreateUserDto` / `UpdateUserDto` (class-validator). One
// schema backs both create and edit: `password` is only collected on create
// (validated manually in the form, mirroring MinLength(8)), and `isActive` is
// only sent on update. The form uses "none" for the nullable roleId select to
// mean "unset"; that maps to undefined/null when building the DTO.
export const userFormSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required"),
  email: z.string().trim().email("Enter a valid email address"),
  username: z.string().trim(),
  password: z.string(),
  branchId: z.string().min(1, "Branch is required"),
  roleId: z.string(),
  mustChangePassword: z.boolean(),
  isActive: z.boolean(),
});

export type UserFormValues = z.infer<typeof userFormSchema>;
