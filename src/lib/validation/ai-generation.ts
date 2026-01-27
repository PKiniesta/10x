import { z } from "zod";

export const startAiGenerationCommandSchema = z.object({
  inputText: z
    .string({ required_error: "inputText is required" })
    .min(100, "inputText must be at least 100 characters")
    .max(1000, "inputText must be at most 1000 characters"),
  requestedCardsCount: z
    .number({ required_error: "requestedCardsCount is required" })
    .int("requestedCardsCount must be an integer")
    .min(3, "requestedCardsCount must be at least 3")
    .max(12, "requestedCardsCount must be at most 12"),
});
