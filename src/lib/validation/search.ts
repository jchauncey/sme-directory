import { z } from "zod";

export const searchQuerySchema = z
  .object({
    q: z
      .string()
      .trim()
      .min(1, "Query is required.")
      .max(200, "Query must be at most 200 characters."),
    scope: z.enum(["current", "selected", "all"]).default("all"),
    groupIds: z
      .string()
      .optional()
      .transform((v) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []))
      .pipe(z.array(z.string().min(1)).max(50, "At most 50 groupIds.")),
    page: z.coerce.number().int().min(1).default(1),
    per: z.coerce.number().int().min(1).max(50).default(20),
    status: z.enum(["all", "answered", "unanswered"]).default("all"),
    range: z.enum(["all", "week", "month", "year"]).default("all"),
    authorId: z.string().min(1).max(64).optional(),
    sort: z.enum(["relevance", "newest"]).default("relevance"),
  })
  .superRefine((val, ctx) => {
    if ((val.scope === "current" || val.scope === "selected") && val.groupIds.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["groupIds"],
        message: "groupIds is required for this scope.",
      });
    }
    if (val.scope === "current" && val.groupIds.length > 1) {
      ctx.addIssue({
        code: "custom",
        path: ["groupIds"],
        message: "scope=current accepts exactly one groupId.",
      });
    }
  });

export type SearchQueryInput = z.input<typeof searchQuerySchema>;
export type SearchQuery = z.output<typeof searchQuerySchema>;
