import type { SupabaseClient } from "@supabase/supabase-js";
import type { Lead, LeadAnalysis } from "@/types/app";
import type { FollowupRequest } from "@/lib/validations/followup";
import { callStructuredAI, isAIConfigured } from "./client";
import { heuristicFollowup } from "./fallbacks";
import { FOLLOWUP_SYSTEM_PROMPT, buildFollowupUserPrompt } from "./prompts";
import { FollowupSchema, type FollowupOutput } from "./schemas";

export interface GenerateFollowupResult {
  followup: FollowupOutput;
  followupId: string | null;
  aiUsed: boolean;
}

/**
 * Generates a follow-up draft for a lead, saves it to the followups table,
 * and logs the action on the lead's activity timeline. Falls back to a
 * template draft when AI is unavailable so the workflow always produces
 * something editable.
 */
export async function generateAndSaveFollowup(
  supabase: SupabaseClient,
  request: FollowupRequest,
  createdBy: string | null
): Promise<GenerateFollowupResult> {
  const { data: lead } = await supabase
    .from("leads")
    .select("*")
    .eq("id", request.lead_id)
    .single();

  if (!lead) {
    throw new Error("Lead not found");
  }

  const { data: analysis } = await supabase
    .from("lead_ai_analyses")
    .select("*")
    .eq("lead_id", request.lead_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let followup: FollowupOutput;
  let aiUsed = false;

  if (isAIConfigured()) {
    try {
      followup = await callStructuredAI({
        system: FOLLOWUP_SYSTEM_PROMPT,
        user: buildFollowupUserPrompt({
          communicationType: request.type,
          tone: request.tone,
          goal: request.goal,
          notes: request.notes ?? "",
          leadJson: JSON.stringify(
            {
              first_name: lead.first_name,
              last_name: lead.last_name,
              service_type: lead.service_type,
              project_reason: lead.project_reason,
              timeframe: lead.timeframe,
              description: lead.description,
              stage: lead.stage,
              city: lead.city,
              state: lead.state,
            },
            null,
            2
          ),
          analysisJson: analysis
            ? JSON.stringify(
                {
                  summary: (analysis as LeadAnalysis).summary,
                  urgency: (analysis as LeadAnalysis).urgency,
                  recommended_next_action: (analysis as LeadAnalysis).recommended_next_action,
                  recommended_service_angle: (analysis as LeadAnalysis).recommended_service_angle,
                },
                null,
                2
              )
            : "No analysis available.",
        }),
        schema: FollowupSchema,
        schemaName: "followup_draft",
      });
      aiUsed = true;
    } catch (error) {
      console.error("AI follow-up generation failed, using template:", error);
      followup = heuristicFollowup(lead as Lead, request);
    }
  } else {
    followup = heuristicFollowup(lead as Lead, request);
  }

  const { data: saved } = await supabase
    .from("followups")
    .insert({
      lead_id: request.lead_id,
      created_by: createdBy,
      type: followup.type,
      tone: request.tone,
      goal: request.goal,
      subject: followup.subject,
      body: followup.body,
      call_opening: followup.call_opening,
      discovery_questions: followup.discovery_questions,
      talking_points: followup.talking_points,
      closing_line: followup.closing_line,
      internal_note: followup.internal_note,
      raw_output: followup,
    })
    .select("id")
    .single();

  await supabase.from("activities").insert({
    lead_id: request.lead_id,
    user_id: createdBy,
    type: "followup_generated",
    title: `Follow-up draft generated (${request.type.replace(/_/g, " ")})`,
    description: followup.subject ?? followup.body.slice(0, 140),
    metadata: { type: request.type, tone: request.tone, goal: request.goal, ai_used: aiUsed },
  });

  return { followup, followupId: saved?.id ?? null, aiUsed };
}
