import { z } from "zod";

export const voteTargetTypeSchema = z.enum(["question", "answer"]);

export const voteInputSchema = z.object({
  targetType: voteTargetTypeSchema,
  targetId: z.string().min(1, "targetId is required."),
  value: z.literal(1),
});

export type VoteInput = z.input<typeof voteInputSchema>;
