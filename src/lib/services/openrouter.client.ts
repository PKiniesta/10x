import { z } from "zod";

const provider = "openrouter" as const;

const proposalSchema = z.object({
  front: z.string().min(1).max(200),
  back: z.string().min(1).max(500),
});

const proposalsResponseSchema = z.object({
  proposals: z.array(proposalSchema),
});

type OpenRouterChatCompletionResponse = {
  model?: string;
  choices?: {
    message?: {
      content?: string;
    };
  }[];
};

function getApiKey(): string {
  const key = import.meta.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new Error("Missing OPENROUTER_API_KEY env var");
  }
  return key;
}

function extractJson(text: string): string {
  // Try to find content between ```json and ```
  const jsonBlock = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonBlock) return jsonBlock[1].trim();

  // Try to find content between any ``` and ```
  const genericBlock = text.match(/```\s*([\s\S]*?)\s*```/);
  if (genericBlock) return genericBlock[1].trim();

  // If no blocks, try to find the first '{' and last '}'
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return text.substring(start, end + 1);
  }

  return text;
}

function safeJsonParse(text: string): unknown {
  const cleaned = extractJson(text);
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function buildPrompt(inputText: string, requestedCardsCount: number): string {
  return [
    "You generate flashcard proposals from a long source text.",
    'Return EXACTLY a single JSON object with shape: { "proposals": [{"front": string, "back": string}, ...] }',
    `Generate ${requestedCardsCount} proposals.`,
    "Front must be <= 200 chars, back <= 500 chars.",
    "Do not include markdown.",
    "Do not include any extra keys.",
    "Source text:",
    inputText,
  ].join("\n");
}

export async function generateProposalsWithOpenRouter(args: {
  inputText: string;
  requestedCardsCount: number;
  signal: AbortSignal;
}): Promise<{ provider: string; model: string | null; proposals: { front: string; back: string }[] }> {
  const { inputText, requestedCardsCount, signal } = args;

  const apiKey = getApiKey();

  const model = import.meta.env.OPENROUTER_MODEL ?? "arcee-ai/trinity-large-preview:free";

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: buildPrompt(inputText, requestedCardsCount),
        },
      ],
      temperature: 0.2,
      max_tokens: 1200,
    }),
    signal,
  });

  if (!res.ok) {
    throw new Error(`OPENROUTER_UPSTREAM_ERROR:${res.status}`);
  }

  const data = (await res.json()) as OpenRouterChatCompletionResponse;
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("OPENROUTER_BAD_RESPONSE:missing_content");
  }

  const parsedJson = safeJsonParse(content);
  const parsed = proposalsResponseSchema.safeParse(parsedJson);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error("OpenRouter JSON validation failed:", parsed.error.format());
    // eslint-disable-next-line no-console
    console.error("Raw content was:", content);
    throw new Error("OPENROUTER_BAD_RESPONSE:invalid_json_shape");
  }

  // Provider may return fewer proposals than requested.
  const proposals = parsed.data.proposals.slice(0, requestedCardsCount);

  if (proposals.length === 0) {
    throw new Error("OPENROUTER_BAD_RESPONSE:empty_proposals");
  }
  return {
    provider,
    model,
    proposals,
  };
}
