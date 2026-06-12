"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { analyzeAndSaveLead } from "@/lib/ai/analyzeLead";
import { analyzeAndSaveFeedback } from "@/lib/ai/analyzeFeedback";
import { generateAndSaveFollowup } from "@/lib/ai/generateFollowup";
import { runAutomationRules } from "@/lib/automations/runner";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { feedbackFormSchema, type FeedbackFormValues } from "@/lib/validations/feedback";
import { followupRequestSchema, type FollowupRequest } from "@/lib/validations/followup";
import { leadFormSchema, leadStageSchema, type LeadFormValues } from "@/lib/validations/lead";
import type { Lead, TaskPriority, TaskType } from "@/types/app";

type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };

// Simple in-memory rate limit for the public lead endpoint. Good enough for
// a demo deployment; swap for a durable store (e.g. Upstash) in production.
const submissionTimestamps: number[] = [];
function publicRateLimitExceeded() {
  const now = Date.now();
  while (submissionTimestamps.length && submissionTimestamps[0] < now - 60_000) {
    submissionTimestamps.shift();
  }
  if (submissionTimestamps.length >= 20) return true;
  submissionTimestamps.push(now);
  return false;
}

async function requireUser(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

/**
 * Public lead intake. Runs the full lead-creation pipeline:
 * insert → activity log → AI analysis → recommended tasks → automation rules.
 * AI or automation failure never blocks lead creation.
 */
export async function submitLead(
  values: LeadFormValues
): Promise<ActionResult<{ leadId: string }>> {
  const parsed = leadFormSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: "Please check the form for errors and try again." };
  }
  if (publicRateLimitExceeded()) {
    return { success: false, error: "Too many requests right now. Please try again in a minute." };
  }

  let supabase: SupabaseClient;
  try {
    supabase = createAdminClient();
  } catch {
    return {
      success: false,
      error: "The demo backend is not configured yet. See the README for Supabase setup.",
    };
  }

  const { data: lead, error } = await supabase
    .from("leads")
    .insert({ ...parsed.data, stage: "new", ai_status: "pending" })
    .select("*")
    .single();

  if (error || !lead) {
    console.error("Lead insert failed:", error);
    return { success: false, error: "We couldn't submit your request. Please try again." };
  }

  await supabase.from("activities").insert({
    lead_id: lead.id,
    type: "lead_created",
    title: "Lead submitted",
    description: `Submitted through the public request form${
      parsed.data.source ? ` (source: ${parsed.data.source})` : ""
    }.`,
  });

  try {
    await analyzeAndSaveLead(supabase, lead as Lead);
  } catch (err) {
    console.error("Lead analysis pipeline failed:", err);
    await supabase.from("leads").update({ ai_status: "failed" }).eq("id", lead.id);
  }

  try {
    const { data: freshLead } = await supabase
      .from("leads")
      .select("*")
      .eq("id", lead.id)
      .single();
    await runAutomationRules(supabase, "lead_created", { lead: (freshLead ?? lead) as Lead });
  } catch (err) {
    console.error("Automation run failed:", err);
  }

  return { success: true, data: { leadId: lead.id } };
}

export async function updateLeadStage(
  leadId: string,
  stage: string
): Promise<ActionResult> {
  const parsedStage = leadStageSchema.safeParse(stage);
  if (!parsedStage.success) return { success: false, error: "Invalid stage" };

  const supabase = await createClient();
  try {
    const user = await requireUser(supabase);
    const { error } = await supabase
      .from("leads")
      .update({ stage: parsedStage.data, updated_at: new Date().toISOString() })
      .eq("id", leadId);
    if (error) return { success: false, error: error.message };

    await supabase.from("activities").insert({
      lead_id: leadId,
      user_id: user.id,
      type: "stage_change",
      title: `Stage updated to ${parsedStage.data.replace(/_/g, " ")}`,
    });

    if (parsedStage.data === "estimate_sent") {
      const { data: lead } = await supabase.from("leads").select("*").eq("id", leadId).single();
      if (lead) {
        await runAutomationRules(supabase, "stage_changed_to_estimate_sent", {
          lead: lead as Lead,
        });
      }
    }

    revalidatePath("/app", "layout");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Update failed" };
  }
}

export async function assignLead(leadId: string, profileId: string | null): Promise<ActionResult> {
  const supabase = await createClient();
  try {
    const user = await requireUser(supabase);
    const { error } = await supabase
      .from("leads")
      .update({ assigned_to: profileId, updated_at: new Date().toISOString() })
      .eq("id", leadId);
    if (error) return { success: false, error: error.message };

    await supabase.from("activities").insert({
      lead_id: leadId,
      user_id: user.id,
      type: "assignment",
      title: profileId ? "Lead reassigned" : "Lead unassigned",
    });
    revalidatePath("/app", "layout");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Update failed" };
  }
}

export async function addLeadNote(leadId: string, note: string): Promise<ActionResult> {
  const text = note.trim().slice(0, 2000);
  if (!text) return { success: false, error: "Note cannot be empty" };

  const supabase = await createClient();
  try {
    const user = await requireUser(supabase);
    const { error } = await supabase.from("activities").insert({
      lead_id: leadId,
      user_id: user.id,
      type: "note",
      title: "Note added",
      description: text,
    });
    if (error) return { success: false, error: error.message };
    revalidatePath(`/app/leads/${leadId}`);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to add note" };
  }
}

export async function createTask(input: {
  lead_id?: string | null;
  title: string;
  description?: string;
  type: TaskType;
  priority: TaskPriority;
  due_in_hours: number;
  assigned_to?: string | null;
}): Promise<ActionResult> {
  if (!input.title.trim()) return { success: false, error: "Task title is required" };

  const supabase = await createClient();
  try {
    const user = await requireUser(supabase);
    const { error } = await supabase.from("tasks").insert({
      lead_id: input.lead_id ?? null,
      assigned_to: input.assigned_to ?? user.id,
      title: input.title.trim().slice(0, 300),
      description: input.description?.trim().slice(0, 2000) || null,
      type: input.type,
      priority: input.priority,
      status: "open",
      due_at: new Date(Date.now() + input.due_in_hours * 3600_000).toISOString(),
    });
    if (error) return { success: false, error: error.message };

    if (input.lead_id) {
      await supabase.from("activities").insert({
        lead_id: input.lead_id,
        user_id: user.id,
        type: "task_created",
        title: `Task created: ${input.title.trim().slice(0, 120)}`,
      });
    }
    revalidatePath("/app", "layout");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to create task" };
  }
}

export async function updateTaskStatus(
  taskId: string,
  status: "open" | "in_progress" | "complete" | "cancelled"
): Promise<ActionResult> {
  const supabase = await createClient();
  try {
    await requireUser(supabase);
    const { error } = await supabase
      .from("tasks")
      .update({
        status,
        completed_at: status === "complete" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId);
    if (error) return { success: false, error: error.message };
    revalidatePath("/app", "layout");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update task" };
  }
}

export async function snoozeTask(taskId: string, hours: number): Promise<ActionResult> {
  const supabase = await createClient();
  try {
    await requireUser(supabase);
    const { error } = await supabase
      .from("tasks")
      .update({
        due_at: new Date(Date.now() + hours * 3600_000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId);
    if (error) return { success: false, error: error.message };
    revalidatePath("/app", "layout");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to snooze task" };
  }
}

export async function generateFollowup(
  request: FollowupRequest
): Promise<ActionResult<Awaited<ReturnType<typeof generateAndSaveFollowup>>>> {
  const parsed = followupRequestSchema.safeParse(request);
  if (!parsed.success) return { success: false, error: "Invalid follow-up request" };

  const supabase = await createClient();
  try {
    const user = await requireUser(supabase);
    const result = await generateAndSaveFollowup(supabase, parsed.data, user.id);
    revalidatePath(`/app/leads/${parsed.data.lead_id}`);
    return { success: true, data: result };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Follow-up generation failed",
    };
  }
}

export async function rerunLeadAnalysis(leadId: string): Promise<ActionResult> {
  const supabase = await createClient();
  try {
    await requireUser(supabase);
    const { data: lead } = await supabase.from("leads").select("*").eq("id", leadId).single();
    if (!lead) return { success: false, error: "Lead not found" };
    await analyzeAndSaveLead(supabase, lead as Lead);
    revalidatePath(`/app/leads/${leadId}`);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Analysis failed" };
  }
}

export async function analyzeFeedback(
  input: FeedbackFormValues
): Promise<ActionResult<Awaited<ReturnType<typeof analyzeAndSaveFeedback>>>> {
  const parsed = feedbackFormSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Please check the feedback form" };

  const supabase = await createClient();
  try {
    await requireUser(supabase);
    const result = await analyzeAndSaveFeedback(supabase, parsed.data);
    revalidatePath("/app/feedback");
    return { success: true, data: result };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Feedback analysis failed",
    };
  }
}

export async function toggleAutomationRule(
  ruleId: string,
  isActive: boolean
): Promise<ActionResult> {
  const supabase = await createClient();
  try {
    await requireUser(supabase);
    const { error } = await supabase
      .from("automation_rules")
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq("id", ruleId);
    if (error) return { success: false, error: error.message };
    revalidatePath("/app/automations");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update rule" };
  }
}

/**
 * Runs a single rule against the most recent lead (or feedback) as a test.
 * Actions execute for real so the run log shows genuine results.
 */
export async function testAutomationRule(
  ruleId: string
): Promise<ActionResult<{ status: string; actionsTaken: string[] }>> {
  const supabase = await createClient();
  try {
    await requireUser(supabase);
    const { data: rule } = await supabase
      .from("automation_rules")
      .select("*")
      .eq("id", ruleId)
      .single();
    if (!rule) return { success: false, error: "Rule not found" };

    const ctx: { lead?: Lead; feedback?: never } = {};
    if (rule.trigger_event === "feedback_submitted") {
      const { data: feedback } = await supabase
        .from("feedback")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!feedback) return { success: false, error: "No feedback records to test against" };
      const results = await runAutomationRules(supabase, rule.trigger_event, { feedback });
      const match = results.find((r) => r.ruleId === ruleId);
      revalidatePath("/app/automations");
      return {
        success: true,
        data: { status: match?.status ?? "skipped", actionsTaken: match?.actionsTaken ?? [] },
      };
    }

    const { data: lead } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!lead) return { success: false, error: "No leads to test against" };
    ctx.lead = lead as Lead;

    const results = await runAutomationRules(supabase, rule.trigger_event, ctx);
    const match = results.find((r) => r.ruleId === ruleId);
    revalidatePath("/app/automations");
    return {
      success: true,
      data: { status: match?.status ?? "skipped", actionsTaken: match?.actionsTaken ?? [] },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Test run failed" };
  }
}

/**
 * Sends a structured lead event to the configured Make/Zapier webhook.
 * Without a configured URL (or in demo mode) the send is simulated and the
 * payload is returned so it can be inspected in the UI.
 */
export async function sendLeadToWebhook(
  leadId: string
): Promise<ActionResult<{ simulated: boolean; payload: Record<string, unknown> }>> {
  const supabase = await createClient();
  try {
    const user = await requireUser(supabase);
    const { data: lead } = await supabase.from("leads").select("*").eq("id", leadId).single();
    if (!lead) return { success: false, error: "Lead not found" };

    const payload = {
      event: "lead.exported",
      sent_at: new Date().toISOString(),
      lead: {
        id: lead.id,
        name: `${lead.first_name} ${lead.last_name}`,
        service_type: lead.service_type,
        urgency: lead.urgency,
        lead_quality: lead.lead_quality,
        stage: lead.stage,
        phone: lead.phone,
        email: lead.email,
        city: lead.city,
        estimated_value_min: lead.estimated_value_min,
        estimated_value_max: lead.estimated_value_max,
      },
    };

    const webhookUrl = process.env.MAKE_WEBHOOK_URL || process.env.ZAPIER_WEBHOOK_URL;
    const demoMode = process.env.DEMO_MODE !== "false";
    let simulated = true;

    if (webhookUrl && !demoMode) {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.WEBHOOK_SECRET
            ? { "X-Webhook-Secret": process.env.WEBHOOK_SECRET }
            : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        return { success: false, error: `Webhook responded with ${response.status}` };
      }
      simulated = false;
    }

    await supabase.from("activities").insert({
      lead_id: leadId,
      user_id: user.id,
      type: "webhook",
      title: simulated ? "Webhook send simulated (demo mode)" : "Lead sent to webhook",
      metadata: { simulated, payload },
    });

    revalidatePath(`/app/leads/${leadId}`);
    return { success: true, data: { simulated, payload } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Webhook send failed" };
  }
}

export async function updateCompanySettings(input: {
  id: string;
  company_name?: string;
  phone?: string;
  email?: string;
  service_area?: string;
  timezone?: string;
  ai_enabled?: boolean;
  automations_enabled?: boolean;
  default_ai_model?: string;
  default_tone?: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  try {
    await requireUser(supabase);
    const { id, ...updates } = input;
    const { error } = await supabase
      .from("company_settings")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return { success: false, error: error.message };
    revalidatePath("/app/settings");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to save settings" };
  }
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
