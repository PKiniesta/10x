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

// -----------------------------
// Update card (PATCH /api/cards/{cardId})
// -----------------------------

export const UpdateCardSchema = z
  .object({
    front: z
      .string()
      .trim()
      .min(1, "Front must be at least 1 character")
      .max(200, "Front must be at most 200 characters")
      .optional(),
    back: z
      .string()
      .trim()
      .min(1, "Back must be at least 1 character")
      .max(500, "Back must be at most 500 characters")
      .optional(),
  })
  .strict()
  .refine((v) => v.front !== undefined || v.back !== undefined, {
    message: "At least one of 'front' or 'back' must be provided",
    path: [],
  });

export type UpdateCardInput = z.infer<typeof UpdateCardSchema>;
