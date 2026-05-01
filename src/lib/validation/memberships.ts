import { z } from "zod";

export const updateMembershipStatusSchema = z.object({
  status: z.enum(["approved", "rejected"]),
});

export type UpdateMembershipStatusInput = z.infer<typeof updateMembershipStatusSchema>;
