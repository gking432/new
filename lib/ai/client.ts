import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
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
  schemaName?: string;
  maxTokens?: number;
}): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AIUnavailableError();
  }

  const client = new OpenAI({ apiKey });
  const model = process.env.AI_MODEL || "gpt-4.1-mini";

  const completion = await client.chat.completions.parse({
    model,
    messages: [
      { role: "system", content: args.system },
      { role: "user", content: args.user },
    ],
    response_format: zodResponseFormat(
      args.schema,
      args.schemaName ?? "northstar_structured_response"
    ),
    max_completion_tokens: args.maxTokens ?? 1500,
    temperature: 0.2,
  });

  const message = completion.choices[0]?.message;
  if (message?.refusal) {
    throw new AIResponseError(`AI refused the structured request: ${message.refusal}`);
  }
  if (!message?.parsed) {
    throw new AIResponseError("AI returned no schema-conforming response");
  }

  // The SDK parser enforces the schema at the provider boundary. Keep the
  // application-side parse as a final defense and to preserve useful errors.
  const result = args.schema.safeParse(message.parsed);
  if (!result.success) {
    throw new AIResponseError(
      `AI output failed validation: ${result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`
    );
  }

  return result.data;
}
