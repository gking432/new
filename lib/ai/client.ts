import OpenAI from "openai";
import type { z } from "zod";

/**
 * Provider-abstracted AI call. All AI requests in the app go through this
 * function so the provider, model, and validation behavior live in one place.
 *
 * Throws AIUnavailableError when no API key is configured so callers can fall
 * back to deterministic heuristics without breaking the workflow.
 */

export class AIUnavailableError extends Error {
  constructor(message = "AI provider is not configured") {
    super(message);
    this.name = "AIUnavailableError";
  }
}

export class AIResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIResponseError";
  }
}

export function isAIConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function callStructuredAI<T>(args: {
  system: string;
  user: string;
  schema: z.ZodType<T>;
  maxTokens?: number;
}): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AIUnavailableError();
  }

  const client = new OpenAI({ apiKey });
  const model = process.env.AI_MODEL || "gpt-4.1-mini";

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: args.system },
      { role: "user", content: args.user },
    ],
    response_format: { type: "json_object" },
    max_tokens: args.maxTokens ?? 1500,
    temperature: 0.4,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new AIResponseError("AI returned an empty response");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new AIResponseError("AI returned invalid JSON");
  }

  const result = args.schema.safeParse(parsed);
  if (!result.success) {
    throw new AIResponseError(
      `AI output failed validation: ${result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`
    );
  }

  return result.data;
}
