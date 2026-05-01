import { z } from "zod";
import { SLUG_RE, SLUG_MAX_LENGTH } from "@/lib/slug";

export const groupNameSchema = z.string().trim().min(2, "Name must be at least 2 characters.").max(80, "Name must be at most 80 characters.");

export const groupDescriptionSchema = z.string().trim().max(2000, "Description must be at most 2000 characters.");

export const groupSlugSchema = z
  .string()
  .min(2, "Slug must be at least 2 characters.")
  .max(SLUG_MAX_LENGTH, `Slug must be at most ${SLUG_MAX_LENGTH} characters.`)
  .regex(SLUG_RE, "Slug must be lowercase letters, numbers, and single dashes between segments.");

export const createGroupSchema = z.object({
  name: groupNameSchema,
  slug: groupSlugSchema,
  description: groupDescriptionSchema.optional(),
  autoApprove: z.boolean().optional().default(false),
});

export type CreateGroupInput = z.input<typeof createGroupSchema>;

export const updateGroupSchema = z
  .object({
    name: groupNameSchema.optional(),
    description: z.union([groupDescriptionSchema, z.null()]).optional(),
    autoApprove: z.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, {
    message: "At least one field must be provided.",
  });

export type UpdateGroupInput = z.input<typeof updateGroupSchema>;
