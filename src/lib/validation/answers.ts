import { z } from "zod";
import { questionBodySchema } from "./questions";

export const answerBodySchema = questionBodySchema;

export const createAnswerSchema = z.object({
  body: answerBodySchema,
});

export type CreateAnswerInput = z.input<typeof createAnswerSchema>;

export const updateAnswerSchema = z.object({
  body: answerBodySchema,
});

export type UpdateAnswerInput = z.input<typeof updateAnswerSchema>;
