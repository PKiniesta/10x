import { z } from "zod";

export const CreateManualCardSchema = z.object({
  front: z.string().min(1, "Front is required").max(200, "Front must be at most 200 characters"),
  back: z.string().min(1, "Back is required").max(500, "Back must be at most 500 characters"),
});

export type CreateManualCardInput = z.infer<typeof CreateManualCardSchema>;

// -----------------------------
// List cards (GET /api/cards)
// -----------------------------

const SortSchema = z.enum(["createdAt:asc", "createdAt:desc"]);

/**
 * Query parameters for `GET /api/cards`.
 * NOTE: We accept strings (from URLSearchParams) and coerce to typed values.
 */
export const ListCardsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(20).max(50).default(20),
    q: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined)),
    sort: SortSchema.default("createdAt:desc"),
  })
  .strict();

export type ListCardsQueryInput = z.infer<typeof ListCardsQuerySchema>;

// -----------------------------
// Get card by id (GET /api/cards/{cardId})
// -----------------------------

export const CardIdSchema = z.string().uuid("cardId must be a valid UUID");

export type CardIdInput = z.infer<typeof CardIdSchema>;
