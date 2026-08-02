import "server-only";

import { revalidatePath } from "next/cache";
import { heuristicCallSummary, summarizeCall } from "@/lib/ai/summarizeCall";
import type { CallSummaryOutput } from "@/lib/ai/callSchemas";
import type { CompleteCallInput, CompleteCallResult } from "@/lib/calls/completeCall";
import { getScriptedScenario } from "@/lib/calls/scriptedScenarios";
import { resolveAppointmentTime, slotLabel } from "@/lib/integrations/calendar/internalCalendar";
import { customerServiceLabel } from "@/lib/utils/statuses";
import type { LeadInput } from "@/lib/actions/leads";
import type {
  Activity,
  Appointment,
  Call,
  Contact,
  Lead,
  LeadAnalysis,
  Task,
  TranscriptTurn,
} from "@/types/app";
import { getLocalAvailableSlots } from "@/lib/demo/localData";
import {
  demoAdminId,
  demoEstimatorId,
  demoId,
  mutateDemoState,
  readDemoState,
  type DemoState,
} from "@/lib/demo/serverStore";

type LocalLeadInput = Omit<Partial<LeadInput>, "first_name" | "source"> & {
  first_name: string;
  last_name?: string;
  service_type?: Lead["service_type"];
  description?: string;
  source?: string | null;
  best_time_to_contact?: string | null;
  homeowner_status?: string | null;
  project_reason?: string | null;
  budget_range?: string | null;
};

function nowIso(offsetMs = 0) {
  return new Date(Date.now() + offsetMs).toISOString();
}

function safeName(value: string | null | undefined, fallback: string) {
  const cleaned = value?.trim();
  if (!cleaned || /^(new|unknown|caller|homeowner|customer|names?)$/i.test(cleaned)) return fallback;
  return cleaned;
}

function valuesForService(service: Lead["service_type"]) {
  const values: Record<Lead["service_type"], [number, number]> = {
    roofing: [9_000, 24_000],
    siding: [12_000, 32_000],
    windows: [8_000, 28_000],
    doors: [2_000, 9_000],
    bath: [14_000, 35_000],
    gutters: [2_000, 8_000],
    leaf_protection: [1_500, 5_000],
    storm_damage: [10_000, 30_000],
    not_sure: [5_000, 20_000],
  };
  return values[service];
}

function urgencyFor(input: LocalLeadInput): Lead["urgency"] {
  if (input.active_leak === "yes" || input.timeframe === "emergency") return "emergency";
  if (input.timeframe === "this_week") return "high";
  if (input.timeframe === "researching" || input.timeframe === "1_3_months") return "low";
  return "medium";
}

function analysisFor(lead: Lead, appointment?: Appointment | null): LeadAnalysis {
  const scheduled = appointment ? slotLabel(new Date(appointment.start_time)) : null;
  const urgent = lead.active_leak === "yes";
  return {
    id: demoId(),
    lead_id: lead.id,
    summary: appointment
      ? `${lead.first_name} contacted Northstar about ${customerServiceLabel(lead.service_type).toLowerCase()}. The conversation captured the project details and confirmed an inspection for ${scheduled}.`
      : `${lead.first_name} submitted a ${customerServiceLabel(lead.service_type).toLowerCase()} request. The AI organized the request and prepared it for phone follow-up.`,
    urgency: lead.urgency,
    urgency_reasoning: urgent
      ? "The customer reported active water intrusion, so the job should remain visible to the team."
      : "The timing and project details determine the current priority.",
    lead_quality: lead.lead_quality,
    lead_quality_reasoning: appointment
      ? "The customer provided contact details and committed to an inspection time."
      : "The customer provided enough information for the AI assistant to continue qualification.",
    recommended_next_action: appointment
      ? `Inspection is scheduled for ${scheduled}. Review and send the confirmation SMS, then give the estimator the call notes.`
      : "Have the AI phone assistant qualify the project and offer a real inspection opening.",
    recommended_contact_window: appointment ? "Appointment confirmed" : "As soon as practical",
    recommended_service_angle: urgent
      ? "Focus on protecting the home and documenting the damage during the inspection."
      : "Use the inspection to confirm scope, measurements, and the homeowner's priorities.",
    sales_questions: appointment
      ? ["Are there any access notes the estimator should know?", "Will every decision-maker be available?"]
      : ["What outcome matters most?", "When would the homeowner like the work completed?"],
    potential_objections: ["May want to compare options before deciding"],
    tags: [lead.service_type, appointment ? "inspection_scheduled" : "ai_qualified"],
    raw_output: { source: "self_contained_demo" },
    created_at: nowIso(500),
  };
}

function makeActivity(leadId: string, type: string, title: string, description?: string | null, offset = 0): Activity {
  return {
    id: demoId(),
    lead_id: leadId,
    user_id: null,
    type,
    title,
    description: description ?? null,
    metadata: {},
    created_at: nowIso(offset),
  };
}

function confirmationBody(lead: Lead, startTime: string) {
  return `Hi ${safeName(lead.first_name, "there")}, your appointment is confirmed for ${slotLabel(
    new Date(startTime)
  )}. If you need to reschedule, reply to this message.`;
}

function addAppointmentWorkflow(
  state: DemoState,
  lead: Lead,
  startTime: string,
  source: Appointment["source"],
  callId?: string | null
) {
  const start = new Date(startTime);
  const end = new Date(start.getTime() + 60 * 60_000);
  const estimatorId = demoEstimatorId(state);
  const appointment: Appointment = {
    id: demoId(),
    lead_id: lead.id,
    contact_id: null,
    title: `${customerServiceLabel(lead.service_type)} inspection - ${lead.first_name} ${lead.last_name}`,
    appointment_type: "inspection",
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    status: "scheduled",
    location: [lead.street_address, lead.city, lead.state, lead.zip_code].filter(Boolean).join(", ") || null,
    assigned_to: estimatorId,
    source,
    external_calendar_id: null,
    created_at: nowIso(100),
    updated_at: nowIso(100),
  };
  state.appointments.push(appointment);
  lead.stage = "appointment_scheduled";
  lead.updated_at = nowIso(100);
  const label = slotLabel(start);
  state.activities.push(
    makeActivity(
      lead.id,
      "appointment",
      source === "ai_call"
        ? `Inspection booked by AI scheduling assistant: ${label}`
        : `Inspection booked from rep-assisted call: ${label}`,
      "The agreed time was checked against real estimator availability before it was saved.",
      200
    )
  );

  const task: Task = {
    id: demoId(),
    lead_id: lead.id,
    assigned_to: demoAdminId(state),
    title: "Review and send appointment confirmation",
    description: `Review the AI-drafted SMS confirming ${lead.first_name}'s inspection for ${label}, then send it from the Approval Queue.`,
    type: "sms",
    priority: lead.active_leak === "yes" ? "high" : "medium",
    status: "open",
    due_at: nowIso(5 * 60_000),
    completed_at: null,
    created_at: nowIso(250),
    updated_at: nowIso(250),
  };
  state.tasks.push(task);
  state.communications.push({
    id: demoId(),
    lead_id: lead.id,
    contact_id: null,
    call_id: callId ?? null,
    channel: lead.phone ? "sms" : "email",
    direction: "outbound",
    status: "draft",
    from_value: "Northstar Exterior & Home",
    to_value: lead.phone ?? lead.email,
    subject: "Appointment confirmation",
    body: confirmationBody(lead, appointment.start_time),
    ai_summary: "AI-written appointment confirmation awaiting approval.",
    suggested_next_action: "Review and send the confirmation.",
    ai_generated: true,
    human_approved: false,
    scheduled_send_at: null,
    automation_key: null,
    metadata: { demo_action: "appointment_confirmation", task_id: task.id },
    created_at: nowIso(300),
    updated_at: nowIso(300),
  });

  const reminderSpecs = [
    { kind: "24h", offset: 24 * 60 * 60_000, body: `Hi ${lead.first_name}, remember your ${customerServiceLabel(lead.service_type).toLowerCase()} inspection with Northstar Exterior & Home is scheduled for ${label}. Reply here if anything changes.` },
    { kind: "1h", offset: 60 * 60_000, body: `Hi ${lead.first_name}, quick reminder: your ${customerServiceLabel(lead.service_type).toLowerCase()} inspection with Northstar Exterior & Home starts in about an hour, at ${label}.` },
  ];
  for (const reminder of reminderSpecs) {
    const sendAt = start.getTime() - reminder.offset;
    if (sendAt <= Date.now()) continue;
    state.communications.push({
      id: demoId(),
      lead_id: lead.id,
      contact_id: null,
      call_id: callId ?? null,
      channel: "sms",
      direction: "outbound",
      status: "approved",
      from_value: "Northstar Exterior & Home",
      to_value: lead.phone,
      subject: "Appointment reminder",
      body: reminder.body,
      ai_summary: "Automatic appointment reminder.",
      suggested_next_action: "Auto-send at the scheduled time unless the appointment changes.",
      ai_generated: true,
      human_approved: true,
      scheduled_send_at: new Date(sendAt).toISOString(),
      automation_key: `appointment:${appointment.id}:${reminder.kind}`,
      metadata: { automation: "appointment_reminder", appointment_id: appointment.id },
      created_at: nowIso(350),
      updated_at: nowIso(350),
    });
  }
  return appointment;
}

function baseLead(input: LocalLeadInput): Lead {
  const service = input.service_type ?? "not_sure";
  const urgency = urgencyFor(input);
  const [estimatedMin, estimatedMax] = valuesForService(service);
  const createdAt = nowIso();
  return {
    id: demoId(),
    first_name: safeName(input.first_name, "New"),
    last_name: safeName(input.last_name, "Caller"),
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    preferred_contact_method: input.preferred_contact_method ?? "phone",
    best_time_to_contact: input.best_time_to_contact ?? null,
    street_address: input.street_address?.trim() || null,
    city: input.city?.trim() || null,
    state: input.state?.trim() || "WI",
    zip_code: input.zip_code?.trim() || null,
    homeowner_status: input.homeowner_status ?? null,
    service_type: service,
    project_reason: input.project_reason ?? null,
    timeframe: input.timeframe ?? null,
    budget_range: input.budget_range ?? null,
    description: input.description?.trim() || "Project details captured during intake.",
    insurance_started: input.insurance_started ?? null,
    active_leak: input.active_leak ?? null,
    source: input.source ?? "manual",
    stage: "new",
    urgency,
    lead_quality: urgency === "emergency" || urgency === "high" ? "hot" : urgency === "low" ? "cold" : "warm",
    estimated_value_min: estimatedMin,
    estimated_value_max: estimatedMax,
    assigned_to: null,
    ai_status: "completed",
    created_at: createdAt,
    updated_at: createdAt,
  };
}

export async function createLocalLead(input: LocalLeadInput, appointmentStartTime?: string | null, sourceCallId?: string | null) {
  const leadId = await mutateDemoState((state) => {
    const lead = baseLead(input);
    lead.assigned_to = demoAdminId(state);
    state.leads.push(lead);

    if (sourceCallId) {
      let call = state.calls.find((item) => item.id === sourceCallId);
      if (!call) {
        const completedAt = nowIso();
        call = {
          id: sourceCallId,
          lead_id: lead.id,
          contact_id: null,
          scenario: "new_inbound_call",
          direction: "inbound",
          caller_name: `${lead.first_name} ${lead.last_name}`.trim(),
          caller_phone: lead.phone,
          callee_name: "Northstar sales rep",
          callee_phone: null,
          status: "scripted_fallback",
          started_at: nowIso(-58_000),
          ended_at: completedAt,
          duration_seconds: 58,
          ai_model: "demo-simulation",
          ai_status: "completed",
          created_at: nowIso(-58_000),
          updated_at: completedAt,
        };
        state.calls.push(call);
        const appointmentLabel = appointmentStartTime
          ? slotLabel(new Date(appointmentStartTime))
          : null;
        state.callSummaries.push({
          id: demoId(),
          call_id: sourceCallId,
          lead_id: lead.id,
          summary: input.description ?? `${lead.first_name} called about ${customerServiceLabel(lead.service_type).toLowerCase()}.`,
          crm_note: input.description ?? "The AI captured the project details during the rep-assisted call.",
          customer_intent: "Discuss the project and schedule an inspection.",
          service_type: lead.service_type,
          urgency: lead.urgency,
          lead_quality: lead.lead_quality,
          next_action: appointmentLabel
            ? `Inspection is scheduled for ${appointmentLabel}. Review and send the confirmation SMS.`
            : "Review the AI-captured call details and choose the next action.",
          appointment_requested: Boolean(appointmentStartTime),
          appointment_time: appointmentStartTime ?? null,
          objections: [],
          extracted_fields: {
            first_name: lead.first_name,
            last_name: lead.last_name,
            phone: lead.phone,
            email: lead.email,
            address: lead.street_address,
            city: lead.city,
            state: lead.state,
            zip_code: lead.zip_code,
          },
          recommended_tasks: [],
          raw_output: { source: "simulated_rep_assisted_call" },
          created_at: completedAt,
        });
      }
      if (call) {
        call.lead_id = lead.id;
        call.caller_name = `${lead.first_name} ${lead.last_name}`.trim();
        call.caller_phone = lead.phone;
        call.updated_at = nowIso();
      }
      state.callSummaries.forEach((summary) => {
        if (summary.call_id === sourceCallId) summary.lead_id = lead.id;
      });
    }

    const secondaryName = input.secondary_contact_name?.trim();
    if (secondaryName || input.secondary_contact_phone || input.secondary_contact_email) {
      const [firstName = "", ...lastName] = (secondaryName ?? "").split(/\s+/);
      const contact: Contact = {
        id: demoId(),
        first_name: firstName || null,
        last_name: lastName.join(" ") || null,
        email: input.secondary_contact_email?.trim() || null,
        phone: input.secondary_contact_phone?.trim() || null,
        street_address: null,
        city: null,
        state: null,
        zip_code: null,
        external_crm_id: lead.id,
        external_crm_provider: "northstar_secondary_contact",
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      state.contacts.push(contact);
      state.activities.push(makeActivity(lead.id, "note", "Secondary contact added", secondaryName));
    }

    state.activities.push(
      makeActivity(
        lead.id,
        "lead_created",
        sourceCallId || input.source === "phone_call"
          ? "Lead saved from rep-assisted phone call"
          : "Lead created manually",
        sourceCallId || input.source === "phone_call"
          ? "The sales rep reviewed the AI-filled intake form and saved it to the CRM."
          : "Entered directly in the CRM."
      )
    );
    const appointment = appointmentStartTime
      ? addAppointmentWorkflow(state, lead, appointmentStartTime, sourceCallId ? "manual" : "manual", sourceCallId)
      : null;
    state.analyses.push(analysisFor(lead, appointment));
    return lead.id;
  });
  revalidatePath("/app", "layout");
  return leadId;
}

export async function submitLocalWebLead(input: LocalLeadInput) {
  const leadId = await mutateDemoState((state) => {
    const lead = baseLead({ ...input, source: input.source ?? "other" });
    lead.assigned_to = demoAdminId(state);
    state.leads.push(lead);
    state.activities.push(
      makeActivity(
        lead.id,
        "lead_created",
        "Lead submitted",
        `Submitted through the public request form${lead.source ? ` (source: ${lead.source})` : ""}.`
      )
    );
    state.analyses.push(analysisFor(lead, null));
    return lead.id;
  });
  revalidatePath("/app", "layout");
  return leadId;
}

export async function createLocalCallSession(args: {
  scenario: Call["scenario"];
  leadId?: string;
  callerName?: string;
  callerPhone?: string | null;
}) {
  return mutateDemoState((state) => {
    const lead = args.leadId ? state.leads.find((item) => item.id === args.leadId) ?? null : null;
    const direction = args.scenario === "speed_to_lead_outbound" ? "outbound" : "inbound";
    const call: Call = {
      id: demoId(),
      lead_id: lead?.id ?? null,
      contact_id: null,
      scenario: args.scenario,
      direction,
      caller_name: direction === "inbound" ? args.callerName ?? "Unknown Caller" : "Northstar AI Assistant",
      caller_phone: direction === "inbound" ? args.callerPhone ?? lead?.phone ?? null : null,
      callee_name: direction === "outbound" ? `${lead?.first_name ?? ""} ${lead?.last_name ?? ""}`.trim() || "Homeowner" : "Northstar AI Assistant",
      callee_phone: direction === "outbound" ? lead?.phone ?? args.callerPhone ?? null : null,
      status: "ringing",
      started_at: nowIso(),
      ended_at: null,
      duration_seconds: null,
      ai_model: null,
      ai_status: "pending",
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    state.calls.push(call);
    return { call, lead, scripted: getScriptedScenario(args.scenario, lead) };
  });
}

function transcriptText(turns: TranscriptTurn[], aiRole: "agent" | "customer" = "agent") {
  return turns
    .filter((turn) => turn.speaker !== "system")
    .map((turn) => {
      const customer = aiRole === "customer" ? turn.speaker === "ai" : turn.speaker === "customer";
      return `${customer ? "Customer" : "Agent"}: ${turn.text}`;
    })
    .join("\n");
}

async function localSummary(call: Call, input: CompleteCallInput, lead: Lead | null) {
  const transcript = transcriptText(input.transcriptTurns, input.aiRole);
  if (input.mode === "scripted_fallback") {
    return { summary: heuristicCallSummary({ scenario: call.scenario, transcript, lead, seedFields: input.seedFields }), aiStatus: "fallback" as const, transcript };
  }
  const result = await summarizeCall({
    scenario: call.scenario,
    transcript,
    transcriptTurns: input.transcriptTurns,
    lead,
  });
  return { ...result, transcript };
}

function summaryRow(callId: string, leadId: string | null, summary: CallSummaryOutput) {
  return {
    id: demoId(),
    call_id: callId,
    lead_id: leadId,
    summary: summary.summary,
    crm_note: summary.crm_note,
    customer_intent: summary.customer_intent,
    service_type: summary.service_type,
    urgency: summary.urgency,
    lead_quality: summary.lead_quality,
    next_action: summary.next_action,
    appointment_requested: summary.appointment_requested,
    appointment_time: summary.appointment_time,
    objections: summary.objections,
    extracted_fields: summary.extracted_fields,
    recommended_tasks: summary.recommended_tasks,
    raw_output: summary,
    created_at: nowIso(),
  };
}

export async function finishLocalCall(input: CompleteCallInput): Promise<CompleteCallResult> {
  const state = await readDemoState();
  const call = state.calls.find((item) => item.id === input.callId);
  if (!call) throw new Error("Call session expired. Restart this demo call.");
  const lead = call.lead_id ? state.leads.find((item) => item.id === call.lead_id) ?? null : null;
  const { summary, aiStatus, transcript } = await localSummary(call, input, lead);
  const slots = await getLocalAvailableSlots(21, 160);
  const resolved = summary.appointment_time ? resolveAppointmentTime(summary.appointment_time, slots) : null;
  const pending = resolved ?? (summary.appointment_requested ? slots[0] ?? null : null);

  await mutateDemoState((next) => {
    const savedCall = next.calls.find((item) => item.id === input.callId);
    if (savedCall) {
      savedCall.status = input.mode === "scripted_fallback" ? "scripted_fallback" : "completed";
      savedCall.ended_at = nowIso();
      savedCall.duration_seconds = Math.max(1, Math.round(input.durationSeconds));
      savedCall.ai_status = aiStatus === "completed" ? "completed" : "fallback";
      savedCall.updated_at = nowIso();
    }
    next.callTranscripts.push({
      id: demoId(),
      call_id: input.callId,
      transcript_text: transcript,
      transcript_json: input.transcriptTurns,
      storage_visibility: "hidden",
      created_at: nowIso(),
    });
    next.callSummaries.push(summaryRow(input.callId, lead?.id ?? null, summary));
  });

  if (input.deferLeadCreation) {
    return {
      callId: input.callId,
      leadId: null,
      leadCreated: false,
      failedContact: false,
      summary,
      aiStatus,
      appointment: null,
      deferredLeadCreation: true,
      pendingAppointmentStartTime: pending?.start.toISOString() ?? null,
      pendingAppointmentLabel: pending?.label ?? null,
      tasksCreated: 0,
      confirmationDraftId: null,
    };
  }

  if (!lead) throw new Error("The demo lead was not found for this call");
  await mutateDemoState((next) => {
    const savedLead = next.leads.find((item) => item.id === lead.id);
    if (!savedLead) return;
    savedLead.service_type = summary.service_type;
    savedLead.description = summary.summary;
    savedLead.urgency = summary.urgency;
    savedLead.lead_quality = summary.lead_quality;
    savedLead.ai_status = "completed";
    savedLead.updated_at = nowIso();
    next.activities.push(
      makeActivity(
        savedLead.id,
        "ai_call",
        "AI call placed (speed to lead outbound)",
        summary.crm_note
      )
    );
    const booked = pending
      ? addAppointmentWorkflow(next, savedLead, pending.start.toISOString(), "ai_call", input.callId)
      : null;
    next.analyses = next.analyses.filter((analysis) => analysis.lead_id !== savedLead.id);
    next.analyses.push(analysisFor(savedLead, booked));
  });
  revalidatePath("/app", "layout");
  const savedState = await readDemoState();
  const appointment = savedState.appointments
    .filter((item) => item.lead_id === lead.id && item.status !== "cancelled")
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
  return {
    callId: input.callId,
    leadId: lead.id,
    leadCreated: false,
    failedContact: false,
    summary,
    aiStatus,
    appointment: appointment
      ? { id: appointment.id, start_time: appointment.start_time, label: slotLabel(new Date(appointment.start_time)) }
      : null,
    tasksCreated: appointment ? 1 : 0,
    confirmationDraftId:
      (await readDemoState()).communications.find(
        (communication) => communication.lead_id === lead.id && communication.status === "draft"
      )?.id ?? null,
  };
}
