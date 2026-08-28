import type { SupabaseClient } from "@supabase/supabase-js";
import type { Feedback } from "@/types/app";
import type { FeedbackFormValues } from "@/lib/validations/feedback";
import { runAutomationRules } from "@/lib/automations/runner";
import { callStructuredAI, isAIConfigured } from "./client";
import { heuristicFeedbackAnalysis } from "./fallbacks";
import { FEEDBACK_SYSTEM_PROMPT, buildFeedbackUserPrompt } from "./prompts";
import { FeedbackAnalysisSchema, type FeedbackAnalysisOutput } from "./schemas";

export interface AnalyzeFeedbackResult {
  feedback: Feedback;
  analysis: FeedbackAnalysisOutput;
  aiUsed: boolean;
}

function applyFeedbackBusinessRules(
  input: FeedbackFormValues,
  analysis: FeedbackAnalysisOutput
): FeedbackAnalysisOutput {
  const text = input.feedback_text.toLowerCase();
  const asksForManager = /\bmanager|supervisor|owner\b/.test(text);
  const repeatedContactFailure = /\b(?:three|3|multiple|several)\b.*\b(?:call|message)|no(?:body)? called|no callbacks?|had to (?:call|leave)/.test(
    text
  );
  const needsRecoveryEscalation =
    input.rating != null && input.rating <= 2 && (asksForManager || repeatedContactFailure);

  if (!needsRecoveryEscalation || analysis.risk_level === "urgent") return analysis;
  return {
    ...analysis,
    risk_level: "high",
    tags: Array.from(new Set([...analysis.tags, "manager_review", "service_recovery"])),
  };
}

export async function analyzeFeedbackContent(input: FeedbackFormValues) {
  let analysis: FeedbackAnalysisOutput;
  let aiUsed = false;

  if (isAIConfigured()) {
    try {
      analysis = await callStructuredAI({
        system: FEEDBACK_SYSTEM_PROMPT,
        user: buildFeedbackUserPrompt(
          JSON.stringify(
            {
              source: input.source,
              customer_name: input.customer_name || null,
              rating: input.rating ?? null,
              feedback_text: input.feedback_text,
            },
            null,
            2
          )
        ),
        schema: FeedbackAnalysisSchema,
        schemaName: "feedback_analysis",
      });
      aiUsed = true;
    } catch (error) {
      console.error("AI feedback analysis failed, using fallback:", error);
      analysis = heuristicFeedbackAnalysis(input);
    }
  } else {
    analysis = heuristicFeedbackAnalysis(input);
  }

  // Model judgment supplies the nuance; deterministic business policy decides
  // when a service-recovery request must become trackable manager work.
  analysis = applyFeedbackBusinessRules(input, analysis);

  return { analysis, aiUsed };
}

/**
 * Analyzes customer feedback, saves the record with its analysis, optionally
 * creates manager work, and runs configured feedback automations.
 */
export async function analyzeAndSaveFeedback(
  supabase: SupabaseClient,
  input: FeedbackFormValues,
  options: { createManagerTask?: boolean } = {}
): Promise<AnalyzeFeedbackResult> {
  const { analysis, aiUsed } = await analyzeFeedbackContent(input);

  const { data: saved, error } = await supabase
    .from("feedback")
    .insert({
      customer_name: input.customer_name || null,
      source: input.source,
      rating: input.rating ?? null,
      feedback_text: input.feedback_text,
      sentiment: analysis.sentiment,
      risk_level: analysis.risk_level,
      summary: analysis.summary,
      key_praise: analysis.key_praise,
      key_complaints: analysis.key_complaints,
      operational_category: analysis.operational_category,
      suggested_internal_action: analysis.suggested_internal_action,
      suggested_customer_response: analysis.suggested_customer_response,
      marketing_quote_opportunity: analysis.marketing_quote_opportunity,
      tags: analysis.tags,
      raw_output: analysis,
    })
    .select("*")
    .single();

  if (error || !saved) {
    throw new Error(error?.message ?? "Failed to save feedback");
  }

  const feedback = saved as Feedback;

  if (
    options.createManagerTask !== false &&
    (analysis.risk_level === "high" || analysis.risk_level === "urgent")
  ) {
    await supabase.from("tasks").insert({
      title: `Review ${analysis.risk_level}-risk customer feedback${
        input.customer_name ? ` from ${input.customer_name}` : ""
      }`,
      description: `${analysis.summary}\n\nSuggested action: ${analysis.suggested_internal_action}\n\nFeedback record: ${feedback.id}`,
      type: "manager_review",
      priority: analysis.risk_level === "urgent" ? "urgent" : "high",
      status: "open",
      due_at: new Date().toISOString(),
    });
  }

  await runAutomationRules(supabase, "feedback_submitted", { feedback });

  return { feedback, analysis, aiUsed };
}
