import type { SupabaseClient } from "@supabase/supabase-js";
import type { Lead } from "@/types/app";
import { callStructuredAI, isAIConfigured } from "./client";
import { heuristicLeadAnalysis } from "./fallbacks";
import { LEAD_ANALYSIS_SYSTEM_PROMPT, buildLeadAnalysisUserPrompt } from "./prompts";
import { LeadAnalysisSchema, type LeadAnalysisOutput } from "./schemas";

export interface AnalyzeLeadResult {
  analysis: LeadAnalysisOutput;
  aiStatus: "completed" | "failed";
  tasksCreated: number;
}

function leadPromptPayload(lead: Lead) {
  return {
    stage: lead.stage,
    service_type: lead.service_type,
    project_reason: lead.project_reason,
    timeframe: lead.timeframe,
    budget_range: lead.budget_range,
    description: lead.description,
    active_leak: lead.active_leak,
    insurance_started: lead.insurance_started,
    source: lead.source,
    city: lead.city,
    state: lead.state,
    zip_code: lead.zip_code,
    preferred_contact_method: lead.preferred_contact_method,
    best_time_to_contact: lead.best_time_to_contact,
  };
}

/**
 * Runs AI analysis for a lead, persists the result, updates the lead's
 * urgency/quality/value, and creates the AI-recommended tasks.
 *
 * AI failure never throws: the heuristic fallback is saved instead and the
 * lead is marked ai_status = "failed" so staff can re-run analysis later.
 */
export async function analyzeAndSaveLead(
  supabase: SupabaseClient,
  lead: Lead,
  options: {
    createTasks?: boolean;
    forceHeuristic?: boolean;
    statusOverride?: "completed" | "failed";
  } = {}
): Promise<AnalyzeLeadResult> {
  let analysis: LeadAnalysisOutput;
  let aiStatus: "completed" | "failed" = "completed";

  const { data: settings } = await supabase
    .from("company_settings")
    .select("ai_enabled")
    .limit(1)
    .maybeSingle();
  const aiEnabled = settings?.ai_enabled !== false;

  if (options.forceHeuristic) {
    analysis = heuristicLeadAnalysis(lead);
    aiStatus = options.statusOverride ?? "failed";
  } else if (aiEnabled && isAIConfigured()) {
    try {
      analysis = await callStructuredAI({
        system: LEAD_ANALYSIS_SYSTEM_PROMPT,
        user: buildLeadAnalysisUserPrompt(JSON.stringify(leadPromptPayload(lead), null, 2)),
        schema: LeadAnalysisSchema,
        schemaName: "lead_analysis",
      });
    } catch (error) {
      console.error("AI lead analysis failed, using fallback:", error);
      analysis = heuristicLeadAnalysis(lead);
      aiStatus = "failed";
    }
  } else {
    analysis = heuristicLeadAnalysis(lead);
    aiStatus = "failed";
  }

  await supabase.from("lead_ai_analyses").insert({
    lead_id: lead.id,
    summary: analysis.summary,
    urgency: analysis.urgency,
    urgency_reasoning: analysis.urgency_reasoning,
    lead_quality: analysis.lead_quality,
    lead_quality_reasoning: analysis.lead_quality_reasoning,
    recommended_next_action: analysis.recommended_next_action,
    recommended_contact_window: analysis.recommended_contact_window,
    recommended_service_angle: analysis.recommended_service_angle,
    sales_questions: analysis.sales_questions,
    potential_objections: analysis.potential_objections,
    tags: analysis.tags,
    raw_output: analysis,
  });

  await supabase
    .from("leads")
    .update({
      urgency: analysis.urgency,
      lead_quality: analysis.lead_quality,
      estimated_value_min: analysis.estimated_value_min,
      estimated_value_max: analysis.estimated_value_max,
      ai_status: aiStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", lead.id);

  let tasksCreated = 0;
  if (options.createTasks !== false) {
    for (const task of analysis.task_recommendations) {
      const dueAt = new Date(Date.now() + task.due_in_minutes * 60_000).toISOString();
      const { error } = await supabase.from("tasks").insert({
        lead_id: lead.id,
        title: task.title,
        description: task.description,
        type: task.priority === "urgent" ? "call" : "call",
        priority: task.priority,
        status: "open",
        due_at: dueAt,
      });
      if (!error) tasksCreated += 1;
    }
  }

  await supabase.from("activities").insert({
    lead_id: lead.id,
    type: "ai_analysis",
    title: aiStatus === "completed" ? "AI analysis completed" : "Lead analysis saved",
    description: analysis.recommended_next_action,
    metadata: {
      urgency: analysis.urgency,
      lead_quality: analysis.lead_quality,
      ai_status: aiStatus,
      tasks_created: tasksCreated,
    },
  });

  return { analysis, aiStatus, tasksCreated };
}
