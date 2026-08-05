import "server-only";

import { revalidatePath } from "next/cache";
import {
  demoDatePlusDays,
  demoDayOfWeek,
  demoWallClockParts,
  formatDemoDate,
  formatDemoTime,
  sameDemoDay,
} from "@/lib/utils/demoTime";
import { customerServiceLabel } from "@/lib/utils/statuses";
import { getLocalAvailableSlots } from "@/lib/demo/localData";
import { submitLocalWebLead } from "@/lib/demo/localWorkflows";
import { demoAdminId, demoEstimatorId, demoId, mutateDemoState, readDemoState } from "@/lib/demo/serverStore";
import type { Communication } from "@/types/app";

function nowIso(offset = 0) {
  return new Date(Date.now() + offset).toISOString();
}

function sameDayLabel(startIso: string) {
  const start = new Date(startIso);
  const now = new Date();
  const day = sameDemoDay(start, now)
    ? "today"
    : sameDemoDay(start, demoDatePlusDays(1, 12, 0))
      ? "tomorrow"
      : formatDemoDate(start, { weekday: "long", month: "short", day: "numeric" });
  return `${day} at ${formatDemoTime(start)}`;
}

function activity(leadId: string, type: string, title: string, description: string | null, offset = 0) {
  return {
    id: demoId(),
    lead_id: leadId,
    user_id: null,
    type,
    title,
    description,
    metadata: {},
    created_at: nowIso(offset),
  };
}

export async function simulateLocalInboundText() {
  const state = await readDemoState();
  const lead = state.leads.find((candidate) => {
    const phone = (candidate.phone ?? "").replace(/\D/g, "");
    const name = `${candidate.first_name} ${candidate.last_name}`.toLowerCase();
    return phone.endsWith("4145550123") || (name.includes("jordan") && name.includes("avery"));
  });
  if (!lead) throw new Error("No customers yet - run the first call step so Jordan can text in.");

  const slots = await getLocalAvailableSlots(4, 40);
  const current = state.appointments
    .filter((appointment) => appointment.lead_id === lead.id && appointment.status !== "cancelled")
    .sort((a, b) => a.start_time.localeCompare(b.start_time))[0];
  const suggested =
    slots.find((slot) => !current || slot.start.getTime() < new Date(current.start_time).getTime()) ??
    slots[0];
  if (!suggested) throw new Error("No estimator opening is available for the reschedule demo.");

  const communicationId = await mutateDemoState((next) => {
    const savedLead = next.leads.find((candidate) => candidate.id === lead.id)!;
    savedLead.first_name = "Jordan";
    savedLead.last_name = "Avery";
    const estimatorId = demoEstimatorId(next);
    const estimatorName = next.profiles.find((profile) => profile.id === estimatorId)?.full_name ?? "Jess Romero";
    const label = sameDayLabel(suggested.start.toISOString());
    const body = "Hey, the leak is worse. Any way you guys can get out here sooner? Like today if possible?";
    const communication: Communication = {
      id: demoId(),
      lead_id: savedLead.id,
      contact_id: null,
      call_id: null,
      channel: "sms",
      direction: "inbound",
      status: "received",
      from_value: savedLead.phone,
      to_value: "Northstar Exterior & Home",
      subject: null,
      body,
      ai_summary: `Jordan Avery says the leak is getting worse and asks if someone can come sooner. ${estimatorName} has an opening ${label}.`,
      suggested_next_action: `Check ${estimatorName}'s availability, then ask Jordan if ${label} works.`,
      ai_generated: false,
      human_approved: false,
      scheduled_send_at: null,
      automation_key: null,
      metadata: {
        demo_action: "jordan_urgent_reschedule",
        needs_attention: true,
        suggested_estimator_id: estimatorId,
        suggested_estimator_name: estimatorName,
        suggested_start_time: suggested.start.toISOString(),
        suggested_end_time: suggested.end.toISOString(),
        suggested_label: label,
      },
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    next.communications.push(communication);
    next.tasks.push({
      id: demoId(),
      lead_id: savedLead.id,
      assigned_to: demoAdminId(next),
      title: "Urgent: Jordan texted - leak is worse, check earlier availability",
      description: `${estimatorName} appears to have an opening ${label}. Verify it, ask Jordan if it works, and move the appointment if they approve.`,
      type: "sms",
      priority: "urgent",
      status: "open",
      due_at: nowIso(30 * 60_000),
      completed_at: null,
      created_at: nowIso(),
      updated_at: nowIso(),
    });
    next.activities.push(activity(savedLead.id, "sms", "Inbound text received", body));
    return communication.id;
  });
  revalidatePath("/app", "layout");
  return {
    communicationId,
    leadId: lead.id,
    leadName: "Jordan Avery",
    events: [
      "Matched Jordan's phone number to the existing CRM record",
      "Inbound text saved and classified as urgent",
      "AI found an earlier estimator opening",
    ],
    urgency: "urgent" as const,
    headline: "AI: Jordan Avery says the leak is getting worse. Wants to reschedule.",
  };
}

export async function simulateLocalInboundEmail(options?: { executiveScheduling?: boolean }) {
  const state = await readDemoState();
  const availableSlots = options?.executiveScheduling
    ? await getLocalAvailableSlots(21, 160)
    : [];
  const nextMondayOffset = ((8 - demoDayOfWeek(new Date())) % 7) || 7;
  const nextWeekStart = demoDatePlusDays(nextMondayOffset, 0, 0).getTime();
  const schedulingSlots = availableSlots
    .filter(
      (slot) =>
        slot.start.getTime() >= nextWeekStart && demoWallClockParts(slot.start).hour >= 15
    )
    .slice(0, 3);
  if (options?.executiveScheduling && schedulingSlots.length < 3) {
    throw new Error("Could not find three afternoon openings for the executive demo");
  }
  let lead = state.leads.find((candidate) => candidate.email === "greg.tomlinson@example.com");
  if (!lead) {
    const leadId = await submitLocalWebLead({
      first_name: "Greg",
      last_name: "Tomlinson",
      email: "greg.tomlinson@example.com",
      phone: "(262) 555-0198",
      service_type: "windows",
      description: options?.executiveScheduling
        ? "We are looking to replace 12 original windows before winter. Weekdays after 3 PM work best, and we want to know what is open next week."
        : "We are looking to replace 12 original windows before winter and want to understand the process and timing.",
      timeframe: "1_3_months",
      source: "email",
    });
    lead = (await readDemoState()).leads.find((candidate) => candidate.id === leadId);
  }
  if (!lead) throw new Error("Could not create the email lead");

  const communicationId = await mutateDemoState((next) => {
    const savedLead = next.leads.find((candidate) => candidate.id === lead!.id)!;
    savedLead.urgency = "high";
    savedLead.lead_quality = "hot";
    savedLead.ai_status = "completed";
    const communication: Communication = {
      id: demoId(),
      lead_id: savedLead.id,
      contact_id: null,
      call_id: null,
      channel: "email",
      direction: "inbound",
      status: "received",
      from_value: "greg.tomlinson@example.com",
      to_value: "hello@northstar-demo.com",
      subject: "Window estimate",
      body: options?.executiveScheduling
        ? "Hi, we are looking to replace 12 windows before winter. Most are original to our 1988 home. Weekdays after 3 PM work best for us. Do you have any openings next week for a measurement visit?"
        : "Hi, we are looking to replace 12 windows before winter. The house was built in 1988 and most of the windows are original. We'd like to understand the process and rough timing.",
      ai_summary: options?.executiveScheduling
        ? "New prospect wants 12 original windows replaced before winter. Scheduling constraints extracted: next week, weekdays, after 3 PM."
        : "New prospect wants 12 original windows replaced before winter and is asking about process and timing.",
      suggested_next_action: options?.executiveScheduling
        ? "Offer the calendar-verified afternoon openings and book the selected measurement visit."
        : "Reply with the process overview and offer an in-home measurement appointment.",
      ai_generated: false,
      human_approved: false,
      scheduled_send_at: null,
      automation_key: null,
      metadata: {
        needs_attention: true,
        demo_action: options?.executiveScheduling
          ? "executive_inbound_window_email"
          : "inbound_window_email",
        executive_scheduling_demo: Boolean(options?.executiveScheduling),
        scheduling_constraints: options?.executiveScheduling
          ? ["Next week", "Weekdays", "After 3:00 PM"]
          : undefined,
        suggested_slots: options?.executiveScheduling
          ? schedulingSlots.map((slot) => ({
              start: slot.start.toISOString(),
              end: slot.end.toISOString(),
              label: slot.label,
            }))
          : undefined,
        suggested_reply: options?.executiveScheduling
          ? `Hi Greg,\n\nThanks for reaching out. We can start with a free in-home measurement visit for the 12 windows. I checked our estimator calendar for next week after 3 PM, and these times are open:\n\n${schedulingSlots.map((slot) => `- ${slot.label}`).join("\n")}\n\nWould one of those work for you?\n\nBest,\nNorthstar Exterior & Home`
          : "Hi Greg,\n\nThanks for reaching out. We can start with a free in-home visit to measure the 12 windows, review options, and provide a written quote. Would a measurement visit this week or next work for you?\n\nBest,\nNorthstar Exterior & Home",
      },
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    next.communications.push(communication);
    next.activities.push(activity(savedLead.id, "email", "Lead created from inbound email", communication.body));
    return communication.id;
  });
  revalidatePath("/app", "layout");
  return {
    communicationId,
    leadId: lead.id,
    leadName: "Greg Tomlinson",
    events: ["New lead created from inbound email", "AI classified the service as Windows", "Email is waiting in Conversations"],
    urgency: "urgent" as const,
    headline: "New email - New lead - 12-window project before winter",
  };
}

export async function sendLocalConversationReply(replyToId: string, body: string) {
  const trimmed = body.trim().slice(0, 5000);
  if (!trimmed) throw new Error("Reply cannot be empty");
  await mutateDemoState((state) => {
    const source = state.communications.find((communication) => communication.id === replyToId);
    if (!source) throw new Error("Message not found");
    const channel = source.channel === "email" ? "email" : "sms";
    state.communications.push({
      ...source,
      id: demoId(),
      direction: "outbound",
      status: "simulated_sent",
      from_value: source.to_value,
      to_value: source.from_value,
      subject: channel === "email" ? (source.subject?.toLowerCase().startsWith("re:") ? source.subject : `Re: ${source.subject ?? "Your request"}`) : null,
      body: trimmed,
      ai_generated: false,
      human_approved: true,
      metadata: { source_communication_id: source.id, simulated: true },
      created_at: nowIso(),
      updated_at: nowIso(),
    });
    source.metadata = { ...source.metadata, needs_attention: false, handled_at: nowIso() };
    source.updated_at = nowIso();
    if (source.lead_id) {
      const lead = state.leads.find((candidate) => candidate.id === source.lead_id);
      const executiveScheduling = source.metadata.demo_action === "executive_inbound_window_email";
      if (lead && source.metadata.demo_action === "inbound_window_email") lead.stage = "contacted";
      state.activities.push(activity(source.lead_id, channel, `${channel === "email" ? "Email" : "Text"} reply sent (simulated)`, trimmed));
      if (lead && executiveScheduling) {
        const rawSlots = Array.isArray(source.metadata.suggested_slots)
          ? source.metadata.suggested_slots
          : [];
        const selected = rawSlots.find(
          (slot): slot is { start: string; end: string; label: string } =>
            Boolean(
              slot &&
                typeof slot === "object" &&
                "start" in slot &&
                "end" in slot &&
                "label" in slot &&
                typeof slot.start === "string" &&
                typeof slot.end === "string" &&
                typeof slot.label === "string"
            )
        );
        if (!selected) throw new Error("The scheduling email has no verified opening");

        state.communications.push({
          ...source,
          id: demoId(),
          direction: "inbound",
          status: "received",
          from_value: source.from_value,
          to_value: source.to_value,
          subject: source.subject?.toLowerCase().startsWith("re:")
            ? source.subject
            : `Re: ${source.subject ?? "Window estimate"}`,
          body: `The first option, ${selected.label}, works for us. Thank you.`,
          ai_summary: "Customer selected the first calendar-verified measurement appointment.",
          suggested_next_action: "Appointment booked automatically; estimator calendar and CRM updated.",
          ai_generated: false,
          human_approved: false,
          metadata: {
            demo_action: "executive_email_slot_selected",
            selected_start: selected.start,
            selected_end: selected.end,
          },
          created_at: nowIso(800),
          updated_at: nowIso(800),
        });
        state.appointments.push({
          id: demoId(),
          lead_id: lead.id,
          contact_id: null,
          title: "Window measurement visit",
          appointment_type: "inspection",
          start_time: selected.start,
          end_time: selected.end,
          status: "confirmed",
          location: lead.street_address,
          assigned_to: demoEstimatorId(state),
          source: "internal",
          external_calendar_id: null,
          created_at: nowIso(900),
          updated_at: nowIso(900),
        });
        lead.stage = "appointment_scheduled";
        lead.updated_at = nowIso(900);
        const analysis = state.analyses
          .filter((candidate) => candidate.lead_id === lead.id)
          .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
        if (analysis) {
          analysis.summary = `Greg requested a 12-window replacement before winter. The AI extracted his weekday-after-3 PM constraint and booked a measurement visit for ${selected.label}.`;
          analysis.recommended_next_action =
            "Prepare the estimator with the email summary and measurement-visit details.";
          analysis.recommended_contact_window = "Appointment confirmed";
          analysis.lead_quality_reasoning =
            "The customer provided clear scope, scheduling constraints, and committed to a measurement visit.";
          analysis.tags = ["windows", "email_scheduling", "appointment_scheduled"];
        }
        state.activities.push(
          activity(
            lead.id,
            "appointment",
            `Measurement visit booked from AI email workflow: ${selected.label}`,
            "AI extracted the scheduling rules, offered only open times, recorded the customer's selection, and blocked the estimator calendar.",
            900
          )
        );
      }
    }
  });
  revalidatePath("/app", "layout");
}

export async function draftLocalSoonerInspectionSms(communicationId: string) {
  await mutateDemoState((state) => {
    const source = state.communications.find((communication) => communication.id === communicationId);
    if (!source?.lead_id) throw new Error("Message not found");
    const meta = source.metadata;
    const startIso = typeof meta.suggested_start_time === "string" ? meta.suggested_start_time : null;
    const endIso = typeof meta.suggested_end_time === "string" ? meta.suggested_end_time : null;
    if (!startIso || !endIso) throw new Error("No suggested appointment time found");
    if (state.communications.some((communication) => communication.metadata.demo_action === "jordan_reschedule_offer" && communication.status === "draft")) return;
    const label = typeof meta.suggested_label === "string" ? meta.suggested_label : sameDayLabel(startIso);
    state.communications.push({
      id: demoId(),
      lead_id: source.lead_id,
      contact_id: null,
      call_id: null,
      channel: "sms",
      direction: "outbound",
      status: "draft",
      from_value: "Northstar Exterior & Home",
      to_value: source.from_value,
      subject: "Earlier inspection option",
      body: `Hi Jordan, we have an opening ${label}. Would that work for your inspection?`,
      ai_summary: "AI-written earlier-time offer.",
      suggested_next_action: "Review and send the offer.",
      ai_generated: true,
      human_approved: false,
      scheduled_send_at: null,
      automation_key: null,
      metadata: {
        demo_action: "jordan_reschedule_offer",
        source_communication_id: source.id,
        suggested_start_time: startIso,
        suggested_end_time: endIso,
        suggested_label: label,
        estimator_id: meta.suggested_estimator_id,
        estimator_name: meta.suggested_estimator_name,
      },
      created_at: nowIso(),
      updated_at: nowIso(),
    });
    state.activities.push(activity(source.lead_id, "sms", "AI drafted earlier inspection offer", `Drafted an offer for ${label}.`));
  });
  revalidatePath("/app", "layout");
}

function completeConfirmationTasks(state: Awaited<ReturnType<typeof readDemoState>>, leadId: string) {
  const now = nowIso();
  state.tasks.forEach((task) => {
    if (
      task.lead_id === leadId &&
      ["open", "in_progress"].includes(task.status) &&
      /confirm|confirmation|approval queue|sms|update/i.test(`${task.title} ${task.description ?? ""}`)
    ) {
      task.status = "complete";
      task.completed_at = now;
      task.updated_at = now;
    }
  });
}

function applyLocalRescheduleAcceptance(state: Awaited<ReturnType<typeof readDemoState>>, record: Communication) {
  if (!record.lead_id) return;
  const startIso = typeof record.metadata.suggested_start_time === "string" ? record.metadata.suggested_start_time : null;
  const endIso = typeof record.metadata.suggested_end_time === "string" ? record.metadata.suggested_end_time : null;
  if (!startIso || !endIso) return;
  const label = sameDayLabel(startIso);
  state.communications.push({
    id: demoId(), lead_id: record.lead_id, contact_id: null, call_id: null, channel: "sms", direction: "inbound", status: "received",
    from_value: record.to_value, to_value: "Northstar Exterior & Home", subject: null, body: "Yes that works. Thank you so much.",
    ai_summary: "Jordan accepted the earlier inspection time.", suggested_next_action: "Appointment moved automatically.", ai_generated: false,
    human_approved: false, scheduled_send_at: null, automation_key: null, metadata: { demo_action: "jordan_reschedule_accepted", needs_attention: false },
    created_at: nowIso(1000), updated_at: nowIso(1000),
  });
  const appointment = state.appointments
    .filter((candidate) => candidate.lead_id === record.lead_id && candidate.status !== "cancelled")
    .sort((a, b) => a.start_time.localeCompare(b.start_time))[0];
  if (appointment) {
    appointment.start_time = startIso;
    appointment.end_time = endIso;
    appointment.assigned_to = typeof record.metadata.estimator_id === "string" ? record.metadata.estimator_id : demoEstimatorId(state);
    appointment.status = "rescheduled";
    appointment.updated_at = nowIso(1200);
  }
  const lead = state.leads.find((candidate) => candidate.id === record.lead_id);
  if (lead) {
    lead.updated_at = nowIso(1200);
    const analysis = state.analyses
      .filter((candidate) => candidate.lead_id === record.lead_id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    if (analysis) {
      analysis.summary = `${lead.first_name}'s inspection was moved to ${label} after the customer reported that the issue was getting worse.`;
      analysis.recommended_next_action = `Inspection is rescheduled for ${label}. Jess Romero has been notified and the estimator calendar is blocked.`;
      analysis.recommended_contact_window = "Appointment confirmed";
    }
    const callSummary = state.callSummaries
      .filter((candidate) => candidate.lead_id === record.lead_id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    if (callSummary) {
      callSummary.next_action = `Inspection is rescheduled for ${label}. Jess Romero has been notified and the estimator calendar is blocked.`;
    }
  }
  if (appointment && lead) {
    state.communications = state.communications.filter(
      (communication) =>
        communication.metadata.appointment_id !== appointment.id ||
        communication.metadata.automation !== "appointment_reminder"
    );
    const start = new Date(startIso);
    const service = customerServiceLabel(lead.service_type).toLowerCase();
    const reminders = [
      {
        kind: "24h",
        offset: 24 * 60 * 60_000,
        body: `Hi ${lead.first_name}, remember your ${service} inspection with Northstar Exterior & Home is scheduled for ${label}. Reply here if anything changes.`,
      },
      {
        kind: "1h",
        offset: 60 * 60_000,
        body: `Hi ${lead.first_name}, quick reminder: your ${service} inspection with Northstar Exterior & Home starts in about an hour, at ${label}.`,
      },
    ];
    reminders.forEach((reminder) => {
      const sendAt = start.getTime() - reminder.offset;
      if (sendAt <= Date.now()) return;
      state.communications.push({
        id: demoId(), lead_id: lead.id, contact_id: null, call_id: record.call_id, channel: "sms", direction: "outbound", status: "approved",
        from_value: "Northstar Exterior & Home", to_value: lead.phone, subject: "Appointment reminder", body: reminder.body,
        ai_summary: "Automatic appointment reminder.", suggested_next_action: "Auto-send at the scheduled time unless the appointment changes.",
        ai_generated: true, human_approved: true, scheduled_send_at: new Date(sendAt).toISOString(),
        automation_key: `appointment:${appointment.id}:${reminder.kind}`,
        metadata: { automation: "appointment_reminder", appointment_id: appointment.id }, created_at: nowIso(1500), updated_at: nowIso(1500),
      });
    });
  }
  state.activities.push(activity(record.lead_id, "appointment", `Inspection moved after urgent text: ${label}`, "The AI updated the estimator calendar and customer timeline.", 1300));
  state.tasks.forEach((task) => {
    if (task.lead_id === record.lead_id && /urgent|leak|worse|sooner|reschedule/i.test(`${task.title} ${task.description ?? ""}`)) {
      task.status = "complete";
      task.completed_at = nowIso(1400);
      task.updated_at = nowIso(1400);
    }
  });
  const confirmation = `Hi Jordan, your updated inspection is confirmed for ${label}. If anything changes before then, reply to this message.`;
  state.communications.push({
    id: demoId(), lead_id: record.lead_id, contact_id: null, call_id: null, channel: "sms", direction: "outbound", status: "simulated_sent",
    from_value: "Northstar Exterior & Home", to_value: record.to_value, subject: "Updated appointment confirmation", body: confirmation,
    ai_summary: "Updated confirmation sent automatically.", suggested_next_action: null, ai_generated: true, human_approved: false,
    scheduled_send_at: null, automation_key: null, metadata: { demo_action: "updated_appointment_confirmation", automatic: true },
    created_at: nowIso(2000), updated_at: nowIso(2000),
  });
}

export async function approveAndSendLocalCommunication(id: string, editedBody?: string) {
  await mutateDemoState((state) => {
    const record = state.communications.find((communication) => communication.id === id);
    if (!record) throw new Error("Message not found");
    if (record.status !== "draft") throw new Error("Only drafts can be approved from this panel");
    record.body = editedBody?.trim() ? editedBody.trim().slice(0, 5000) : record.body;
    record.status = "simulated_sent";
    record.human_approved = true;
    record.created_at = nowIso();
    record.updated_at = nowIso();
    if (record.lead_id) {
      state.activities.push(activity(record.lead_id, record.channel, `${record.channel === "email" ? "Email" : "Text"} sent to customer (simulated)`, record.body));
      if (record.metadata.demo_action === "jordan_reschedule_offer") applyLocalRescheduleAcceptance(state, record);
      else completeConfirmationTasks(state, record.lead_id);
    }
  });
  revalidatePath("/app", "layout");
}

export async function discardLocalCommunication(id: string) {
  await mutateDemoState((state) => {
    const record = state.communications.find((communication) => communication.id === id);
    if (record?.status === "draft") {
      record.status = "discarded";
      record.updated_at = nowIso();
    }
  });
  revalidatePath("/app/inbox");
}
