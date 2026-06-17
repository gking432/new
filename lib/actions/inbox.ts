"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runDueScheduledReminders } from "@/lib/communications/reminders";
import { createClient } from "@/lib/supabase/server";
import type { Communication, Lead, Profile } from "@/types/app";

type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

// No-login demo: there's no authenticated user. Attribute writes to the first
// seeded profile if one exists, otherwise leave the (nullable) user columns
// null. Kept named requireUser so existing call sites are unchanged.
async function requireUser(supabase: SupabaseClient): Promise<{ id: string | null }> {
  const { data } = await supabase.from("profiles").select("id").limit(1).maybeSingle();
  return { id: ((data as { id?: string } | null)?.id as string | null) ?? null };
}

function sameDayLabel(startIso: string) {
  const start = new Date(startIso);
  const now = new Date();
  const day =
    start.toDateString() === now.toDateString()
      ? "today"
      : start.toDateString() === new Date(now.getTime() + 86_400_000).toDateString()
        ? "tomorrow"
        : start.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  return `${day} at ${start.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function roundUpToNextHalfHour(date: Date) {
  const rounded = new Date(date);
  rounded.setSeconds(0, 0);
  const minutes = rounded.getMinutes();
  if (minutes === 0 || minutes === 30) return rounded;
  if (minutes < 30) rounded.setMinutes(30);
  else {
    rounded.setHours(rounded.getHours() + 1, 0, 0, 0);
  }
  return rounded;
}

function pickSoonerInspectionSlot() {
  const now = new Date();
  const dynamicToday = roundUpToNextHalfHour(new Date(now.getTime() + 75 * 60_000));
  const todayStarts = [
    { hour: dynamicToday.getHours(), minute: dynamicToday.getMinutes() },
    { hour: 14, minute: 30 },
    { hour: 16, minute: 0 },
    { hour: 17, minute: 30 },
    { hour: 18, minute: 30 },
    { hour: 19, minute: 30 },
  ];
  for (const option of todayStarts) {
    const start = new Date(now);
    start.setHours(option.hour, option.minute, 0, 0);
    if (start.getTime() > now.getTime() + 45 * 60_000 && start.getHours() < 21) {
      return {
        start,
        end: new Date(start.getTime() + 60 * 60_000),
      };
    }
  }
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  return {
    start: tomorrow,
    end: new Date(tomorrow.getTime() + 60 * 60_000),
  };
}

function hhmm(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

async function getJessAvailability(supabase: SupabaseClient) {
  const { data: jess } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("full_name", "Jess Romero")
    .limit(1)
    .maybeSingle();
  const { data: fallback } = jess
    ? { data: null }
    : await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("role", "sales_rep")
        .limit(1)
        .maybeSingle();
  const estimator = (jess ?? fallback) as Pick<Profile, "id" | "full_name" | "role"> | null;
  const slot = pickSoonerInspectionSlot();

  if (estimator) {
    const startTime = hhmm(slot.start);
    const endTime = hhmm(slot.end);
    const { data: existing } = await supabase
      .from("availability_windows")
      .select("id")
      .eq("user_id", estimator.id)
      .eq("day_of_week", slot.start.getDay())
      .eq("start_time", startTime)
      .eq("end_time", endTime)
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    if (!existing) {
      await supabase.from("availability_windows").insert({
        user_id: estimator.id,
        day_of_week: slot.start.getDay(),
        start_time: startTime,
        end_time: endTime,
        slot_minutes: 60,
        active: true,
      });
    }
  }

  return {
    estimator,
    start: slot.start,
    end: slot.end,
    label: sameDayLabel(slot.start.toISOString()),
  };
}

async function completeTasksByPattern(
  supabase: SupabaseClient,
  leadId: string,
  pattern: RegExp
) {
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, description")
    .eq("lead_id", leadId)
    .in("status", ["open", "in_progress"])
    .limit(100);
  const ids = (tasks ?? [])
    .filter((task) => pattern.test(`${task.title ?? ""} ${task.description ?? ""}`))
    .map((task) => task.id);
  if (ids.length === 0) return 0;
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("tasks")
    .update({ status: "complete", completed_at: now, updated_at: now })
    .in("id", ids);
  return error ? 0 : ids.length;
}

async function completeConfirmationTasks(supabase: SupabaseClient, leadId: string) {
  return completeTasksByPattern(
    supabase,
    leadId,
    /confirm|confirmation|approval queue|sms|secondary contact|update/i
  );
}

async function completeUrgentRescheduleTasks(supabase: SupabaseClient, leadId: string) {
  return completeTasksByPattern(supabase, leadId, /urgent|leak|worse|sooner|reschedule/i);
}

function metadataOf(record: Communication) {
  return (record.metadata ?? {}) as Record<string, unknown>;
}

async function applyJordanRescheduleAcceptance(
  supabase: SupabaseClient,
  record: Communication,
  userId: string | null
) {
  if (!record.lead_id) return;
  const meta = metadataOf(record);
  const startIso = typeof meta.suggested_start_time === "string" ? meta.suggested_start_time : null;
  const endIso = typeof meta.suggested_end_time === "string" ? meta.suggested_end_time : null;
  const estimatorId = typeof meta.estimator_id === "string" ? meta.estimator_id : null;
  const estimatorName =
    typeof meta.estimator_name === "string" ? meta.estimator_name : "Jess Romero";
  if (!startIso || !endIso) return;

  const now = new Date().toISOString();
  const label = sameDayLabel(startIso);

  await supabase.from("communications").insert({
    lead_id: record.lead_id,
    channel: "sms",
    direction: "inbound",
    status: "received",
    from_value: record.to_value,
    to_value: "Northstar Exterior & Home",
    body: "Yes that works. Thank you so much.",
    ai_summary: "Jordan accepted the earlier inspection time.",
    suggested_next_action: "Move the inspection and send the updated confirmation.",
    ai_generated: false,
    metadata: {
      demo_action: "jordan_reschedule_accepted",
      needs_attention: false,
      source_communication_id: record.id,
    },
    created_at: new Date(Date.now() + 1000).toISOString(),
  });

  if (typeof meta.source_communication_id === "string") {
    await supabase
      .from("communications")
      .update({
        metadata: {
          ...meta,
          needs_attention: false,
          handled_at: now,
        },
        updated_at: now,
      })
      .eq("id", meta.source_communication_id);
  }

  const { data: existingAppointment } = await supabase
    .from("appointments")
    .select("id, start_time")
    .eq("lead_id", record.lead_id)
    .in("status", ["scheduled", "confirmed", "rescheduled"])
    .gte("start_time", new Date().toISOString())
    .order("start_time", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingAppointment) {
    await supabase
      .from("appointments")
      .update({
        start_time: startIso,
        end_time: endIso,
        assigned_to: estimatorId,
        status: "rescheduled",
        source: "ai_call",
        updated_at: now,
      })
      .eq("id", existingAppointment.id);
  }

  await supabase.from("activities").insert([
    {
      lead_id: record.lead_id,
      user_id: userId,
      type: "sms",
      title: "Customer accepted earlier inspection time",
      description: "Yes that works. Thank you so much.",
      metadata: { communication_id: record.id },
      created_at: new Date(Date.now() + 1200).toISOString(),
    },
    {
      lead_id: record.lead_id,
      user_id: userId,
      type: "appointment",
      title: `Inspection moved after urgent text: ${label}`,
      description: "Estimator assigned to the earlier inspection window.",
      metadata: {
        appointment_id: existingAppointment?.id ?? null,
        previous_start_time: existingAppointment?.start_time ?? null,
        new_start_time: startIso,
        estimator_id: estimatorId,
      },
      created_at: new Date(Date.now() + 1500).toISOString(),
    },
  ]);

  await completeUrgentRescheduleTasks(supabase, record.lead_id);

  const confirmationBody = `Hi Jordan, your updated inspection is confirmed for ${label}. If anything changes before then, reply to this message.`;
  const confirmationSentAt = new Date(Date.now() + 2000).toISOString();
  const { data: confirmation } = await supabase
    .from("communications")
    .insert({
    lead_id: record.lead_id,
    channel: "sms",
    direction: "outbound",
    status: "simulated_sent",
    from_value: "Northstar Exterior & Home",
    to_value: record.to_value,
    subject: "Updated appointment confirmation",
    body: confirmationBody,
    ai_generated: true,
    human_approved: false,
    created_at: confirmationSentAt,
    updated_at: confirmationSentAt,
    metadata: {
      demo_action: "updated_appointment_confirmation",
      automatic: true,
      suggested_start_time: startIso,
      estimator_id: estimatorId,
      estimator_name: estimatorName,
    },
  })
    .select("id")
    .single();

  await supabase.from("activities").insert({
    lead_id: record.lead_id,
    user_id: userId,
    type: "sms",
    title: "Updated confirmation sent automatically",
    description: confirmationBody,
    metadata: {
      communication_id: confirmation?.id ?? null,
      automatic: true,
      estimator_id: estimatorId,
    },
    created_at: new Date(Date.now() + 2500).toISOString(),
  });
}

/**
 * Demo Center: simulates the most recent customer texting in an update. Matches
 * the phone number to the CRM record, classifies the message, creates an urgent
 * task, adds a scheduling suggestion, and logs the timeline entry.
 */
export interface InboundResult {
  communicationId: string;
  leadId: string | null;
  leadName: string;
  events: string[];
  // AI-assigned importance for the on-screen notification.
  urgency: "urgent" | "high" | "medium" | "low";
  headline: string;
}

export async function simulateInboundText(): Promise<ActionResult<InboundResult>> {
  const supabase = await createClient();
  try {
    await requireUser(supabase);
    const events: string[] = [];

    // The guided tour text follow-up belongs to the first caller, Jordan Avery.
    // Match defensively by phone and name so this never attaches to the user's
    // later web-form lead.
    const { data: recentLeads } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    const lead =
      ((recentLeads ?? []) as Lead[]).find((candidate) => {
        const phone = (candidate.phone ?? "").replace(/\D/g, "");
        const name = `${candidate.first_name ?? ""} ${candidate.last_name ?? ""}`.toLowerCase();
        return phone.endsWith("4145550123") || (name.includes("jordan") && name.includes("avery"));
      }) ?? null;
    if (!lead) {
      return {
        success: false,
        error: "No customers yet — run the first call step so Jordan can text in.",
      };
    }
    const normalizedPhone = (lead.phone ?? "").replace(/\D/g, "");
    if (
      normalizedPhone.endsWith("4145550123") &&
      (lead.first_name !== "Jordan" || lead.last_name !== "Avery")
    ) {
      await supabase
        .from("leads")
        .update({ first_name: "Jordan", last_name: "Avery", updated_at: new Date().toISOString() })
        .eq("id", lead.id);
      lead.first_name = "Jordan";
      lead.last_name = "Avery";
    }

    const phone = lead.phone ?? "(unknown)";
    const firstName = lead.first_name;
    const availability = await getJessAvailability(supabase);
    const body =
      "Hey, the leak is worse. Any way you guys can get out here sooner? Like today if possible?";
    events.push(`Remember Jordan Avery? Matched ${phone} to their CRM record`);

    const { data: savedComm, error: saveError } = await supabase
      .from("communications")
      .insert({
        lead_id: lead.id,
        channel: "sms",
        direction: "inbound",
        status: "received",
        from_value: phone,
        to_value: "Northstar Exterior & Home",
        body,
        ai_summary:
          `Jordan Avery says the leak is getting worse and asks if someone can come sooner. ${availability.estimator?.full_name ?? "Jess Romero"} has an opening ${availability.label}.`,
        suggested_next_action: `Check ${availability.estimator?.full_name ?? "Jess Romero"}'s availability, then ask Jordan if ${availability.label} works.`,
        ai_generated: false,
        metadata: {
          demo_action: "jordan_urgent_reschedule",
          needs_attention: true,
          suggested_estimator_id: availability.estimator?.id ?? null,
          suggested_estimator_name: availability.estimator?.full_name ?? "Jess Romero",
          suggested_start_time: availability.start.toISOString(),
          suggested_end_time: availability.end.toISOString(),
          suggested_label: availability.label,
        },
      })
      .select("id")
      .single();
    if (saveError || !savedComm) return { success: false, error: "Could not save the text" };
    events.push("Inbound text saved and classified as an urgent update");

    await supabase.from("tasks").insert({
      lead_id: lead.id,
      title: `Urgent: ${firstName} texted — leak is worse, check earlier availability`,
      description:
        `${availability.estimator?.full_name ?? "Jess Romero"} appears to have an opening ${availability.label}. Verify availability, ask Jordan if it works, and move the appointment if they approve.`,
      type: "sms",
      priority: "urgent",
      status: "open",
      due_at: new Date(Date.now() + 30 * 60_000).toISOString(),
    });
    events.push("Urgent task created for the assigned rep");

    await supabase.from("activities").insert({
      lead_id: lead.id,
      type: "sms",
      title: "Inbound text received",
      description: body,
      metadata: { communication_id: savedComm.id },
      created_at: new Date().toISOString(),
    });
    events.push("Timeline entry added to the lead");

    events.push(
      `AI found a same-day estimator option: ${availability.estimator?.full_name ?? "Jess Romero"} at ${availability.label}`
    );
    events.push("AI reviewed the message and scored importance: URGENT (active leak worsening)");

    revalidatePath("/app", "layout");
    return {
      success: true,
      data: {
        communicationId: savedComm.id,
        leadId: lead.id,
        leadName: `${lead.first_name} ${lead.last_name}`,
        events,
        urgency: "urgent",
        headline: "AI: Jordan Avery says the leak is getting worse. Wants to reschedule.",
      },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Simulation failed" };
  }
}

/**
 * Demo Center: simulates a new-prospect email, creates the lead, and flags the
 * conversation for a normal reply in the Inbox.
 */
export async function simulateInboundEmail(): Promise<ActionResult<InboundResult>> {
  const supabase = await createClient();
  try {
    await requireUser(supabase);
    const events: string[] = [];

    const fromEmail = "greg.tomlinson@example.com";
    const subject = "Window estimate";
    const body =
      "Hi, we are looking to replace 12 windows before winter. The house was built in 1988 and most of the windows are original. We'd like to understand the process and rough timing.";

    let lead: Lead | null = null;
    const { data: existing } = await supabase
      .from("leads")
      .select("*")
      .eq("email", fromEmail)
      .limit(1)
      .maybeSingle();
    if (existing) {
      lead = existing as Lead;
      events.push(`Matched email to existing lead: ${lead.first_name} ${lead.last_name}`);
    } else {
      const { data: created } = await supabase
        .from("leads")
        .insert({
          first_name: "Greg",
          last_name: "Tomlinson",
          email: fromEmail,
          service_type: "windows",
          description: body,
          timeframe: "1_3_months",
          source: "email",
          stage: "new",
          urgency: "high",
          lead_quality: "hot",
          ai_status: "completed",
        })
        .select("*")
        .single();
      lead = (created as Lead | null) ?? null;
      if (lead) {
        events.push("New lead created: Greg Tomlinson (Windows · Warm)");
        await supabase.from("activities").insert({
          lead_id: lead.id,
          type: "lead_created",
          title: "Lead created from inbound email",
          description: body,
        });
      }
    }

    const { data: comm, error } = await supabase
      .from("communications")
      .insert({
        lead_id: lead?.id ?? null,
        channel: "email",
        direction: "inbound",
        status: "received",
        from_value: fromEmail,
        to_value: "hello@northstar-demo.com",
        subject,
        body,
        ai_summary:
          "New prospect wants 12 original (1988) windows replaced before winter and is asking about process and timing. Classified as Windows / warm / medium urgency.",
        suggested_next_action:
          "Reply with the process overview and offer an in-home measurement appointment.",
        metadata: {
          needs_attention: true,
          demo_action: "inbound_window_email",
          suggested_reply: `Hi Greg,

Thanks for reaching out — replacing original 1988 windows before winter is a very common project for us, and 12 windows is typically a 1–2 day installation.

Here's how it works: we start with a free in-home visit to measure and walk through material and glass options, then you get a written quote with no obligation. Lead times right now support a comfortable before-winter install.

Would a measurement visit this week or next work for you? I'm happy to set that up.

Best,
Northstar Exterior & Home`,
        },
      })
      .select("id")
      .single();
    if (error || !comm) return { success: false, error: "Could not save the email" };
    events.push("Inbound email saved — AI classified service type as Windows");

    events.push("Email is waiting in Conversations for the team to reply");
    events.push("AI reviewed the email and scored importance: URGENT (new hot lead)");

    revalidatePath("/app", "layout");
    return {
      success: true,
      data: {
        communicationId: comm.id,
        leadId: lead?.id ?? null,
        leadName: lead ? `${lead.first_name} ${lead.last_name}` : "Greg Tomlinson",
        events,
        // A brand-new lead is the most urgent kind of inbound — speed to lead wins jobs.
        urgency: "urgent",
        headline: "New email · New lead · 12-window project before winter — urgent inbox item",
      },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Simulation failed" };
  }
}

export async function sendConversationReply({
  replyToId,
  body,
}: {
  replyToId: string;
  body: string;
}): Promise<ActionResult<undefined>> {
  const supabase = await createClient();
  try {
    const user = await requireUser(supabase);
    const trimmed = body.trim().slice(0, 5000);
    if (!trimmed) return { success: false, error: "Reply cannot be empty" };

    const { data: comm } = await supabase
      .from("communications")
      .select("*")
      .eq("id", replyToId)
      .single();
    if (!comm) return { success: false, error: "Message not found" };
    const record = comm as Communication;
    const channel = record.channel === "email" ? "email" : "sms";
    const now = new Date().toISOString();

    const { error } = await supabase.from("communications").insert({
      lead_id: record.lead_id,
      contact_id: record.contact_id,
      channel,
      direction: "outbound",
      status: "simulated_sent",
      from_value: record.to_value ?? "Northstar Exterior & Home",
      to_value: record.from_value,
      subject:
        channel === "email"
          ? record.subject?.toLowerCase().startsWith("re:")
            ? record.subject
            : `Re: ${record.subject ?? "Your request"}`
          : null,
      body: trimmed,
      ai_generated: false,
      human_approved: true,
      metadata: { source_communication_id: record.id, simulated: true },
      created_at: now,
      updated_at: now,
    });
    if (error) return { success: false, error: error.message };

    if (record.lead_id) {
      const recordMeta = metadataOf(record);
      if (channel === "email" && recordMeta.demo_action === "inbound_window_email") {
        await supabase
          .from("leads")
          .update({ stage: "contacted", updated_at: now })
          .eq("id", record.lead_id);
        await supabase.from("activities").insert({
          lead_id: record.lead_id,
          user_id: user.id,
          type: "stage_change",
          title: "Pipeline moved to Contacted",
          description: "AI moved Greg Tomlinson after the team sent the first email reply.",
          metadata: {
            from_stage: "new",
            to_stage: "contacted",
            source: "email",
            automated: true,
          },
          created_at: now,
        });
      }
      await supabase
        .from("communications")
        .update({
          metadata: {
            ...recordMeta,
            needs_attention: false,
            handled_at: now,
          },
          updated_at: now,
        })
        .eq("id", record.id);
      await supabase.from("activities").insert({
        lead_id: record.lead_id,
        user_id: user.id,
        type: channel,
        title: `${channel === "email" ? "Email" : "Text"} reply sent (simulated)`,
        description: trimmed,
        metadata: { communication_id: record.id, simulated: true },
        created_at: now,
      });
    }

    revalidatePath("/app", "layout");
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Reply failed" };
  }
}

export async function approveCommunication(
  id: string,
  editedBody?: string
): Promise<ActionResult<undefined>> {
  const supabase = await createClient();
  try {
    await requireUser(supabase);
    const updates: Record<string, unknown> = {
      status: "approved",
      human_approved: true,
      updated_at: new Date().toISOString(),
    };
    if (editedBody?.trim()) updates.body = editedBody.trim().slice(0, 5000);
    const { error } = await supabase.from("communications").update(updates).eq("id", id);
    if (error) return { success: false, error: error.message };
    revalidatePath("/app/inbox");
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Approval failed" };
  }
}

export async function draftSoonerInspectionSms(
  communicationId: string
): Promise<ActionResult<undefined>> {
  const supabase = await createClient();
  try {
    await requireUser(supabase);
    const { data: comm } = await supabase
      .from("communications")
      .select("*")
      .eq("id", communicationId)
      .single();
    if (!comm) return { success: false, error: "Message not found" };
    const record = comm as Communication;
    const meta = metadataOf(record);
    const startIso = typeof meta.suggested_start_time === "string" ? meta.suggested_start_time : null;
    const endIso = typeof meta.suggested_end_time === "string" ? meta.suggested_end_time : null;
    if (!record.lead_id || !startIso || !endIso) {
      return { success: false, error: "No suggested appointment time found" };
    }
    const estimatorId =
      typeof meta.suggested_estimator_id === "string" ? meta.suggested_estimator_id : null;
    const estimatorName =
      typeof meta.suggested_estimator_name === "string"
        ? meta.suggested_estimator_name
        : "Jess Romero";
    const label =
      typeof meta.suggested_label === "string" ? meta.suggested_label : sameDayLabel(startIso);

    const { data: existing } = await supabase
      .from("communications")
      .select("id")
      .eq("lead_id", record.lead_id)
      .eq("direction", "outbound")
      .eq("status", "draft")
      .contains("metadata", { demo_action: "jordan_reschedule_offer" })
      .limit(1)
      .maybeSingle();
    if (!existing) {
      await supabase.from("communications").insert({
        lead_id: record.lead_id,
        channel: "sms",
        direction: "outbound",
        status: "draft",
        from_value: "Northstar Exterior & Home",
        to_value: record.from_value,
        subject: "Earlier inspection option",
        body: `Hi Jordan, we have an opening ${label}. Would that work for your inspection?`,
        ai_generated: true,
        human_approved: false,
        metadata: {
          demo_action: "jordan_reschedule_offer",
          source_communication_id: record.id,
          suggested_start_time: startIso,
          suggested_end_time: endIso,
          suggested_label: label,
          estimator_id: estimatorId,
          estimator_name: estimatorName,
        },
      });
    }

    await supabase.from("activities").insert({
      lead_id: record.lead_id,
      type: "sms",
      title: "AI drafted same-day inspection offer",
      description: `${estimatorName} has an opening ${label}. Draft is waiting for approval.`,
      metadata: { communication_id: record.id },
    });
    revalidatePath("/app", "layout");
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Draft failed" };
  }
}

/** Demo mode: approve a draft and mark it sent in one transaction-like action. */
export async function approveAndSimulateCommunication(
  id: string,
  editedBody?: string
): Promise<ActionResult<undefined>> {
  const supabase = await createClient();
  try {
    const user = await requireUser(supabase);
    const { data: comm } = await supabase
      .from("communications")
      .select("*")
      .eq("id", id)
      .single();
    if (!comm) return { success: false, error: "Message not found" };
    const record = comm as Communication;
    if (record.status !== "draft") {
      return { success: false, error: "Only drafts can be approved from this panel" };
    }

    const body = editedBody?.trim() ? editedBody.trim().slice(0, 5000) : record.body;
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("communications")
      .update({
        body,
        status: "simulated_sent",
        human_approved: true,
        created_at: now,
        updated_at: now,
      })
      .eq("id", id);
    if (error) return { success: false, error: error.message };

    if (record.lead_id) {
      await supabase.from("activities").insert({
        lead_id: record.lead_id,
        user_id: user.id,
        type: record.channel,
        title: `${record.channel === "email" ? "Email" : "Text"} sent to customer (simulated)`,
        description: body,
        metadata: { communication_id: id, simulated: true },
        created_at: now,
      });

      const meta = metadataOf(record);
      if (meta.demo_action === "jordan_reschedule_offer") {
        await applyJordanRescheduleAcceptance(supabase, record, user.id);
      } else if (
        /appointment confirmation|updated appointment confirmation/i.test(record.subject ?? "") ||
        meta.demo_action === "updated_appointment_confirmation" ||
        meta.demo_action === "secondary_contact_update"
      ) {
        await completeConfirmationTasks(supabase, record.lead_id);
      }
    }
    revalidatePath("/app", "layout");
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Send failed" };
  }
}

/** Demo mode: marks an approved draft as simulated-sent. Nothing real is sent. */
export async function simulateSendCommunication(id: string): Promise<ActionResult<undefined>> {
  const supabase = await createClient();
  try {
    const user = await requireUser(supabase);
    const { data: comm } = await supabase
      .from("communications")
      .select("*")
      .eq("id", id)
      .single();
    if (!comm) return { success: false, error: "Message not found" };
    const record = comm as Communication;
    if (!record.human_approved) {
      return { success: false, error: "Approve the draft before sending" };
    }

    const now = new Date().toISOString();
    const { error } = await supabase
      .from("communications")
      .update({ status: "simulated_sent", created_at: now, updated_at: now })
      .eq("id", id);
    if (error) return { success: false, error: error.message };

    if (record.lead_id) {
      await supabase.from("activities").insert({
        lead_id: record.lead_id,
        user_id: user.id,
        type: record.channel,
        title: `${record.channel === "email" ? "Email" : "Text"} sent to customer (simulated)`,
        description: record.body,
        metadata: { communication_id: id, simulated: true },
        created_at: now,
      });
    }
    revalidatePath("/app", "layout");
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Send failed" };
  }
}

/** Runs due pre-approved appointment reminders. Demo mode marks them simulated-sent. */
export async function runDueReminderAutomations(): Promise<
  ActionResult<{ checked: number; sent: number }>
> {
  const supabase = await createClient();
  try {
    await requireUser(supabase);
    const result = await runDueScheduledReminders(supabase);
    revalidatePath("/app", "layout");
    return { success: true, data: result };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Reminder automation failed",
    };
  }
}

export async function discardCommunication(id: string): Promise<ActionResult<undefined>> {
  const supabase = await createClient();
  try {
    await requireUser(supabase);
    const { error } = await supabase
      .from("communications")
      .update({ status: "discarded", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "draft");
    if (error) return { success: false, error: error.message };
    revalidatePath("/app/inbox");
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Discard failed" };
  }
}
