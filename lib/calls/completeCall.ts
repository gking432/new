import type { SupabaseClient } from "@supabase/supabase-js";
import { summarizeCall } from "@/lib/ai/summarizeCall";
import type { CallSummaryOutput } from "@/lib/ai/callSchemas";
import {
  getAvailableSlots,
  resolveAppointmentTime,
  slotLabel,
} from "@/lib/integrations/calendar/internalCalendar";
import type { Call, Lead, TranscriptTurn } from "@/types/app";

export interface CompleteCallInput {
  callId: string;
  transcriptTurns: TranscriptTurn[];
  durationSeconds: number;
  mode: "realtime" | "scripted_fallback";
  /** Ground-truth facts from a scripted scenario, if any. */
  seedFields?: Record<string, string | null>;
}

export interface CompleteCallResult {
  callId: string;
  leadId: string | null;
  leadCreated: boolean;
  summary: CallSummaryOutput;
  aiStatus: "completed" | "fallback";
  appointment: { id: string; start_time: string; label: string } | null;
  tasksCreated: number;
  confirmationDraftId: string | null;
}

function turnsToText(turns: TranscriptTurn[]) {
  return turns
    .filter((t) => t.speaker !== "system")
    .map((t) => `${t.speaker === "ai" ? "AI" : "Customer"}: ${t.text}`)
    .join("\n");
}

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 7 ? digits.slice(-10) : null;
}

/**
 * Dedupe guard: matches a caller to an existing lead by phone (normalized) or
 * email so repeat contacts attach to the same CRM record instead of creating
 * duplicates.
 */
export async function findExistingLead(
  supabase: SupabaseClient,
  phone: string | null | undefined,
  email?: string | null
): Promise<Lead | null> {
  if (email) {
    const { data } = await supabase
      .from("leads")
      .select("*")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data as Lead;
  }
  const target = normalizePhone(phone);
  if (!target) return null;
  const { data: candidates } = await supabase
    .from("leads")
    .select("*")
    .not("phone", "is", null)
    .order("created_at", { ascending: false })
    .limit(300);
  const match = (candidates ?? []).find((l) => normalizePhone(l.phone) === target);
  return (match as Lead | undefined) ?? null;
}

/**
 * Finishes a call: persists the transcript (hidden by default), generates the
 * AI summary, writes the CRM-ready note to the lead timeline, creates or
 * updates the lead, books the appointment, creates follow-up tasks, and
 * drafts the confirmation message for human approval.
 */
export async function completeCall(
  supabase: SupabaseClient,
  input: CompleteCallInput
): Promise<CompleteCallResult> {
  const { data: callRow } = await supabase
    .from("calls")
    .select("*")
    .eq("id", input.callId)
    .single();
  if (!callRow) throw new Error("Call not found");
  const call = callRow as Call;

  let lead: Lead | null = null;
  if (call.lead_id) {
    const { data } = await supabase.from("leads").select("*").eq("id", call.lead_id).maybeSingle();
    lead = (data as Lead | null) ?? null;
  }

  const transcriptText = turnsToText(input.transcriptTurns);
  const endedAt = new Date().toISOString();

  await supabase
    .from("calls")
    .update({
      status: input.mode === "scripted_fallback" ? "scripted_fallback" : "completed",
      ended_at: endedAt,
      duration_seconds: Math.max(1, Math.round(input.durationSeconds)),
      updated_at: endedAt,
    })
    .eq("id", input.callId);

  await supabase.from("call_transcripts").insert({
    call_id: input.callId,
    transcript_text: transcriptText || "(no transcript captured)",
    transcript_json: input.transcriptTurns,
    storage_visibility: "hidden",
  });

  // For scripted calls the script's facts are ground truth — skip the AI and
  // use the deterministic summary so the demo is free and instant.
  const { summary, aiStatus } =
    input.mode === "scripted_fallback"
      ? await summarizeWithFallbackOnly(call, transcriptText, input, lead)
      : await summarizeCall({
          scenario: call.scenario,
          transcript: transcriptText,
          transcriptTurns: input.transcriptTurns,
          lead,
          seedFields: input.seedFields,
        });

  await supabase
    .from("calls")
    .update({ ai_status: aiStatus === "completed" ? "completed" : "fallback" })
    .eq("id", input.callId);

  // ── Create or update the lead ──────────────────────────────────────────────
  let leadCreated = false;
  const fields = summary.extracted_fields;

  // Resolve the caller's name from the best source available: extracted
  // fields → the call's caller_name (minus our own placeholders) → the first
  // self-introduction in the transcript. This prevents "Unknown Caller" when
  // the caller gave their name but the structured extraction missed it.
  const PLACEHOLDER_NAMES = new Set([
    "unknown caller",
    "northstar ai assistant",
    "homeowner",
    "",
  ]);
  function resolveCallerName(): { first: string; last: string } {
    if (fields.first_name) {
      return { first: fields.first_name, last: fields.last_name ?? "" };
    }
    const raw = call.caller_name?.trim() ?? "";
    if (raw && !PLACEHOLDER_NAMES.has(raw.toLowerCase())) {
      const [first, ...rest] = raw.split(/\s+/);
      return { first, last: rest.join(" ") };
    }
    // Last resort: scan the transcript for "this is <Name>" / "I'm <Name>".
    const intro = transcriptText.match(
      /(?:this is|i'?m|my name is|it'?s)\s+([A-Z][a-z]+)(?:\s+([A-Z][a-z]+))?/
    );
    if (intro) return { first: intro[1], last: intro[2] ?? "" };
    return { first: "New", last: "Caller" };
  }
  const resolvedName = resolveCallerName();

  // Dedupe: before creating a lead from an inbound call, check whether this
  // caller already exists by phone or email — repeat contacts attach to the
  // existing record instead of duplicating it.
  if (!lead && call.scenario === "new_inbound_call") {
    const existing = await findExistingLead(
      supabase,
      fields.phone ?? call.caller_phone,
      fields.email
    );
    if (existing) {
      lead = existing;
      await supabase.from("calls").update({ lead_id: existing.id }).eq("id", input.callId);
      await supabase.from("activities").insert({
        lead_id: existing.id,
        type: "ai_call",
        title: "Inbound caller matched to this existing CRM record by phone number",
        metadata: { call_id: input.callId },
      });
    }
  }

  if (!lead && call.scenario === "new_inbound_call") {
    const { data: contact } = await supabase
      .from("contacts")
      .insert({
        first_name: resolvedName.first,
        last_name: resolvedName.last,
        email: fields.email,
        phone: fields.phone ?? call.caller_phone,
        street_address: fields.address,
        city: fields.city,
      })
      .select("id")
      .single();

    const { data: newLead } = await supabase
      .from("leads")
      .insert({
        first_name: resolvedName.first,
        last_name: resolvedName.last,
        email: fields.email,
        phone: fields.phone ?? call.caller_phone,
        preferred_contact_method:
          fields.preferred_contact_method === "text" || fields.preferred_contact_method === "email"
            ? fields.preferred_contact_method
            : "phone",
        street_address: fields.address,
        city: fields.city,
        service_type: summary.service_type,
        description: summary.summary,
        active_leak: fields.active_leak,
        insurance_started: fields.insurance_started,
        source: "phone_call",
        stage: "contacted",
        urgency: summary.urgency,
        lead_quality: summary.lead_quality,
        ai_status: "completed",
      })
      .select("*")
      .single();

    if (newLead) {
      lead = newLead as Lead;
      leadCreated = true;
      await supabase
        .from("calls")
        .update({
          lead_id: lead.id,
          contact_id: contact?.id ?? null,
          // Replace the "Unknown Caller" placeholder now that we know who it is.
          caller_name: `${resolvedName.first} ${resolvedName.last}`.trim(),
        })
        .eq("id", input.callId);
      await supabase.from("activities").insert({
        lead_id: lead.id,
        type: "lead_created",
        title: "Lead created from AI-handled phone call",
        description: `Created automatically from an inbound call answered by the AI intake assistant.`,
        metadata: { call_id: input.callId },
      });
    }
  } else if (lead) {
    const updates: Record<string, unknown> = { updated_at: endedAt };
    if (fields.active_leak && lead.active_leak !== "yes") updates.active_leak = fields.active_leak;
    if (fields.insurance_started && !lead.insurance_started)
      updates.insurance_started = fields.insurance_started;
    if (summary.urgency === "emergency" && lead.urgency !== "emergency")
      updates.urgency = "emergency";
    if (lead.stage === "new") updates.stage = "contacted";
    await supabase.from("leads").update(updates).eq("id", lead.id);
  }

  // ── Appointment ────────────────────────────────────────────────────────────
  let appointment: CompleteCallResult["appointment"] = null;
  if (summary.appointment_requested && lead) {
    const slots = await getAvailableSlots(supabase, 7, 12);
    const slot = resolveAppointmentTime(summary.appointment_time, slots);
    if (slot) {
      const { data: appt } = await supabase
        .from("appointments")
        .insert({
          lead_id: lead.id,
          title: `${summary.service_type.replace(/_/g, " ")} inspection — ${lead.first_name} ${lead.last_name}`,
          appointment_type: "inspection",
          start_time: slot.start.toISOString(),
          end_time: slot.end.toISOString(),
          status: "scheduled",
          location: [lead.street_address, lead.city].filter(Boolean).join(", ") || null,
          source: "ai_call",
        })
        .select("id, start_time")
        .single();
      if (appt) {
        appointment = { id: appt.id, start_time: appt.start_time, label: slotLabel(slot.start) };
        await supabase
          .from("leads")
          .update({ stage: "appointment_scheduled", updated_at: endedAt })
          .eq("id", lead.id);
        await supabase.from("activities").insert({
          lead_id: lead.id,
          type: "appointment",
          title: `Inspection booked by AI call assistant: ${slotLabel(slot.start)}`,
          metadata: { call_id: input.callId, appointment_id: appt.id },
        });
      }
    }
  }

  // ── Summary record + CRM note on the timeline ─────────────────────────────
  await supabase.from("call_summaries").insert({
    call_id: input.callId,
    lead_id: lead?.id ?? null,
    summary: summary.summary,
    crm_note: summary.crm_note,
    customer_intent: summary.customer_intent,
    service_type: summary.service_type,
    urgency: summary.urgency,
    lead_quality: summary.lead_quality,
    next_action: summary.next_action,
    appointment_requested: summary.appointment_requested,
    appointment_time: appointment?.start_time ?? null,
    objections: summary.objections,
    extracted_fields: summary.extracted_fields,
    recommended_tasks: summary.recommended_tasks,
    raw_output: summary,
  });

  if (lead) {
    await supabase.from("activities").insert({
      lead_id: lead.id,
      type: "ai_call",
      title: `AI call ${call.direction === "outbound" ? "placed" : "handled"} (${call.scenario.replace(/_/g, " ")})`,
      description: summary.crm_note,
      metadata: { call_id: input.callId, ai_status: aiStatus, mode: input.mode },
    });
  }

  // ── Tasks ──────────────────────────────────────────────────────────────────
  let tasksCreated = 0;
  for (const task of summary.recommended_tasks.slice(0, 3)) {
    const { error } = await supabase.from("tasks").insert({
      lead_id: lead?.id ?? null,
      title: task.title.slice(0, 300),
      description: task.description.slice(0, 2000),
      type: "call",
      priority: task.priority,
      status: "open",
      due_at: new Date(Date.now() + task.due_in_minutes * 60_000).toISOString(),
    });
    if (!error) tasksCreated += 1;
  }

  // The call lives in the Calls tab and on the lead timeline — it is NOT an
  // inbox conversation. Only the outbound confirmation draft (SMS) goes to the
  // inbox for human approval.
  let confirmationDraftId: string | null = null;
  if (summary.confirmation_message_draft) {
    const { data: draft } = await supabase
      .from("communications")
      .insert({
        lead_id: lead?.id ?? null,
        call_id: input.callId,
        channel: "sms",
        direction: "outbound",
        status: "draft",
        from_value: "Northstar Exterior & Home",
        to_value: lead?.phone ?? fields.phone ?? null,
        subject: "Appointment confirmation",
        body: summary.confirmation_message_draft,
        ai_generated: true,
        human_approved: false,
      })
      .select("id")
      .single();
    confirmationDraftId = draft?.id ?? null;
  }

  return {
    callId: input.callId,
    leadId: lead?.id ?? null,
    leadCreated,
    summary,
    aiStatus,
    appointment,
    tasksCreated,
    confirmationDraftId,
  };
}

async function summarizeWithFallbackOnly(
  call: Call,
  transcriptText: string,
  input: CompleteCallInput,
  lead: Lead | null
) {
  const { heuristicCallSummary } = await import("@/lib/ai/summarizeCall");
  return {
    summary: heuristicCallSummary({
      scenario: call.scenario,
      transcript: transcriptText,
      lead,
      seedFields: input.seedFields,
    }),
    aiStatus: "fallback" as const,
  };
}
