import type { SupabaseClient } from "@supabase/supabase-js";
import type { Lead } from "@/types/app";
import { customerServiceLabel } from "@/lib/utils/statuses";

type ReminderKind = "24h" | "1h";

function formatService(serviceType: string) {
  return customerServiceLabel(serviceType).toLowerCase();
}

function formatAppointment(startIso: string) {
  return new Date(startIso).toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function safeGreetingName(firstName: string | null | undefined) {
  const cleaned = firstName?.trim();
  if (!cleaned || /^(new|unknown|caller|homeowner|customer)$/i.test(cleaned)) return "there";
  return cleaned;
}

function reminderSendAt(startIso: string, kind: ReminderKind) {
  const start = new Date(startIso).getTime();
  const offset = kind === "24h" ? 24 * 3600_000 : 3600_000;
  return new Date(start - offset).toISOString();
}

function reminderBody(lead: Pick<Lead, "first_name" | "service_type">, startIso: string, kind: ReminderKind) {
  const when = formatAppointment(startIso);
  const service = formatService(lead.service_type);
  const firstName = safeGreetingName(lead.first_name);
  if (kind === "24h") {
    return `Hi ${firstName}, remember your ${service} inspection with Northstar Exterior & Home is scheduled for ${when}. Reply here if anything changes.`;
  }
  return `Hi ${firstName}, quick reminder: your ${service} inspection with Northstar Exterior & Home starts at ${when}.`;
}

export async function scheduleAppointmentReminders(
  supabase: SupabaseClient,
  args: {
    lead: Pick<Lead, "id" | "first_name" | "phone" | "service_type">;
    appointmentId: string;
    startTime: string;
    source: "ai_call" | "manual" | "reschedule";
  }
) {
  const now = Date.now();
  for (const kind of ["24h", "1h"] as ReminderKind[]) {
    const scheduledSendAt = reminderSendAt(args.startTime, kind);
    if (new Date(scheduledSendAt).getTime() <= now) {
      continue;
    }
    const key = `appointment:${args.appointmentId}:reminder:${kind}`;
    const payload = {
      lead_id: args.lead.id,
      channel: "sms",
      direction: "outbound",
      status: "approved",
      from_value: "Northstar Exterior & Home",
      to_value: args.lead.phone,
      subject: kind === "24h" ? "Appointment reminder — tomorrow" : "Appointment reminder — 1 hour",
      body: reminderBody(args.lead, args.startTime, kind),
      ai_summary:
        kind === "24h"
          ? "Automated 24-hour appointment reminder, pre-approved for simulated send."
          : "Automated 1-hour appointment reminder, pre-approved for simulated send.",
      suggested_next_action: "Auto-send at the scheduled reminder time unless the appointment changes.",
      ai_generated: true,
      human_approved: true,
      scheduled_send_at: scheduledSendAt,
      automation_key: key,
      metadata: {
        automation: "appointment_reminder",
        appointment_id: args.appointmentId,
        reminder_kind: kind,
        source: args.source,
      },
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from("communications")
      .select("id, status")
      .eq("automation_key", key)
      .maybeSingle();

    if (existing) {
      if (existing.status === "simulated_sent" || existing.status === "sent") continue;
      await supabase.from("communications").update(payload).eq("id", existing.id);
    } else {
      await supabase.from("communications").insert(payload);
    }
  }
}

export async function runDueScheduledReminders(supabase: SupabaseClient) {
  const { data: due } = await supabase
    .from("communications")
    .select("*, lead:leads(id, first_name, last_name)")
    .eq("direction", "outbound")
    .eq("status", "approved")
    .eq("human_approved", true)
    .not("scheduled_send_at", "is", null)
    .lte("scheduled_send_at", new Date().toISOString())
    .order("scheduled_send_at", { ascending: true })
    .limit(25);

  let sent = 0;
  for (const comm of due ?? []) {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("communications")
      .update({ status: "simulated_sent", created_at: now, updated_at: now })
      .eq("id", comm.id);
    if (error) continue;
    sent += 1;
    if (comm.lead_id) {
      await supabase.from("activities").insert({
        lead_id: comm.lead_id,
        type: "sms",
        title: "Appointment reminder sent automatically (simulated)",
        description: comm.body,
        metadata: {
          communication_id: comm.id,
          automation_key: comm.automation_key,
          simulated: true,
        },
      });
    }
  }

  return { checked: due?.length ?? 0, sent };
}
