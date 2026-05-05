import { z } from "zod";

export const questionTitleSchema = z
  .string()
  .trim()
  .min(5, "Title must be at least 5 characters.")
  .max(200, "Title must be at most 200 characters.");

export const questionBodySchema = z
  .string()
  .trim()
  .min(1, "Body is required.")
  .max(20_000, "Body must be at most 20,000 characters.");

export const createQuestionSchema = z.object({
  title: questionTitleSchema,
  body: questionBodySchema,
});

export type CreateQuestionInput = z.input<typeof createQuestionSchema>;

export const updateQuestionSchema = z.object({
  title: questionTitleSchema,
  body: questionBodySchema,
});

export type UpdateQuestionInput = z.input<typeof updateQuestionSchema>;

export const questionListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  per: z.coerce.number().int().min(1).max(50).default(20),
});

export type QuestionListQuery = z.input<typeof questionListQuerySchema>;

export const acceptQuestionSchema = z.object({
  answerId: z.string().min(1).optional().nullable(),
});

export type AcceptQuestionInput = z.input<typeof acceptQuestionSchema>;
