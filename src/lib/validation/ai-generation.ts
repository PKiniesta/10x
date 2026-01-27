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

export const acceptAiProposalCommandSchema = z.object({
  front: z
    .string({ required_error: "front is required" })
    .min(1, "front cannot be empty")
    .max(200, "front must be at most 200 characters"),
  back: z
    .string({ required_error: "back is required" })
    .min(1, "back cannot be empty")
    .max(500, "back must be at most 500 characters"),
  reviewToken: z.string({ required_error: "reviewToken is required" }),
});

export const acceptAiProposalParamsSchema = z.object({
  generationId: z.string().uuid("generationId must be a valid UUID"),
  proposalIndex: z.preprocess(
    (val) => Number.parseInt(val as string, 10),
    z.number().int().min(0, "proposalIndex must be at least 0")
  ),
});

export const rejectAiProposalCommandSchema = z.object({
  reviewToken: z.string({ required_error: "reviewToken is required" }),
});

export const rejectAiProposalParamsSchema = acceptAiProposalParamsSchema;
