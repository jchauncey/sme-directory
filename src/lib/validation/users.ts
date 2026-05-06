import { z } from "zod";

export const userNameSchema = z
  .string()
  .trim()
  .min(1, "Name is required.")
  .max(100, "Name must be at most 100 characters.");

export const userBioSchema = z
  .string()
  .trim()
  .max(1000, "Bio must be at most 1000 characters.")
  .transform((v) => (v.length === 0 ? undefined : v))
  .optional();

export const updateMeSchema = z.object({
  name: userNameSchema,
  bio: userBioSchema,
});

export type UpdateMeInput = z.infer<typeof updateMeSchema>;
