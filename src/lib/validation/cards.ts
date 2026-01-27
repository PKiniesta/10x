import { z } from "zod";

export const CreateManualCardSchema = z.object({
  front: z.string().min(1, "Front is required").max(200, "Front must be at most 200 characters"),
  back: z.string().min(1, "Back is required").max(500, "Back must be at most 500 characters"),
});

export type CreateManualCardInput = z.infer<typeof CreateManualCardSchema>;
