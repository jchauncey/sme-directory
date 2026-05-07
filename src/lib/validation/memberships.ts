import { z } from "zod";

export const updateMembershipStatusSchema = z
  .object({
    status: z.enum(["approved", "rejected"]),
  })
  .strict();

export type UpdateMembershipStatusInput = z.infer<typeof updateMembershipStatusSchema>;

export const updateMembershipRoleSchema = z
  .object({
    role: z.enum(["member", "moderator"]),
  })
  .strict();

export type UpdateMembershipRoleInput = z.infer<typeof updateMembershipRoleSchema>;

export const updateMembershipSchema = z.union([
  updateMembershipStatusSchema,
  updateMembershipRoleSchema,
]);

export type UpdateMembershipInput = z.infer<typeof updateMembershipSchema>;
