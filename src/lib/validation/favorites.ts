import { z } from "zod";

export const favoriteTargetTypeSchema = z.enum(["question", "answer"]);

export const favoriteInputSchema = z.object({
  targetType: favoriteTargetTypeSchema,
  targetId: z.string().min(1, "targetId is required."),
});

export type FavoriteInput = z.input<typeof favoriteInputSchema>;
