"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { callStructuredAI, isAIConfigured } from "@/lib/ai/client";
import { scheduleAppointmentReminders } from "@/lib/communications/reminders";
import { getAvailableSlots } from "@/lib/integrations/calendar/internalCalendar";
import { createClient } from "@/lib/supabase/server";
import { customerServiceLabel } from "@/lib/utils/statuses";
import { isLocalDemoMode } from "@/lib/demo/mode";
import { getLocalAvailableSlots } from "@/lib/demo/localData";
import { createLocalAppointment, updateLocalAppointmentStatus } from "@/lib/demo/localWorkflows";
import { demoEstimatorId, demoId, mutateDemoState } from "@/lib/demo/serverStore";

type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

function safeGreetingName(firstName: string | null | undefined) {
  const cleaned = firstName?.trim();
  if (!cleaned || /^(new|unknown|caller|homeowner|customer)$/i.test(cleaned)) return "there";
  return cleaned;
}

// No-login demo: there's no authenticated user. Attribute writes to the first
// seeded profile if one exists, otherwise leave the (nullable) user columns
// null. Kept named requireUser so existing call sites are unchanged.
async function requireUser(supabase: SupabaseClient): Promise<{ id: string | null }> {
  const { data } = await supabase.from("profiles").select("id").limit(1).maybeSingle();
  return { id: ((data as { id?: string } | null)?.id as string | null) ?? null };
}

export async function createAppointment(input: {
  lead_id: string;
  start_time: string;
  end_time: string;
  title?: string;
  location?: string;
}): Promise<ActionResult<{ id: string }>> {
  if (isLocalDemoMode()) {
    try {
      const id = await createLocalAppointment(input);
      return { success: true, data: { id } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Booking failed" };
    }
  }

  const supabase = await createClient();
  try {
    const user = await requireUser(supabase);
    const { data: lead } = await supabase
      .from("leads")
      .select("id, first_name, last_name, phone, service_type, street_address, city, stage")
      .eq("id", input.lead_id)
      .single();
    if (!lead) return { success: false, error: "Lead not found" };
    const serviceLabel = customerServiceLabel(lead.service_type);

    const { data: appt, error } = await supabase
      .from("appointments")
      .insert({
        lead_id: lead.id,
        title:
          input.title ??
          `${serviceLabel} inspection — ${lead.first_name} ${lead.last_name}`,
        appointment_type: "inspection",
        start_time: input.start_time,
        end_time: input.end_time,
        status: "scheduled",
        location:
          input.location ?? [lead.street_address, lead.city].filter(Boolean).join(", ") ?? null,
        assigned_to: user.id,
        source: "manual",
      })
      .select("id, start_time")
      .single();
    if (error || !appt) return { success: false, error: error?.message ?? "Booking failed" };

    if (lead.stage === "new" || lead.stage === "contacted") {
      await supabase
        .from("leads")
        .update({ stage: "appointment_scheduled", updated_at: new Date().toISOString() })
        .eq("id", lead.id);
    }
    await supabase.from("activities").insert({
      lead_id: lead.id,
      user_id: user.id,
      type: "appointment",
      title: `Inspection booked for ${new Date(appt.start_time).toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })}`,
      metadata: { appointment_id: appt.id },
    });

    // Confirmation draft for human approval — nothing is sent automatically.
    await supabase.from("communications").insert({
      lead_id: lead.id,
      channel: "sms",
      direction: "outbound",
      status: "draft",
      from_value: "Northstar Exterior & Home",
      subject: "Appointment confirmation",
      body: `Hi ${safeGreetingName(lead.first_name)}, your ${serviceLabel.toLowerCase()} inspection with Northstar Exterior & Home is set for ${new Date(
        appt.start_time
      ).toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })}. Reply here if anything changes.`,
      ai_generated: true,
      human_approved: false,
    });

    await scheduleAppointmentReminders(supabase, {
      lead,
      appointmentId: appt.id,
      startTime: appt.start_time,
      source: "manual",
    });

    revalidatePath("/app", "layout");
    return { success: true, data: { id: appt.id } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Booking failed" };
  }
}

export async function getDemoInspectionSlots(
  days = 10,
  limit = 12
): Promise<ActionResult<Array<{ start: string; end: string; label: string }>>> {
  if (isLocalDemoMode()) {
    const slots = await getLocalAvailableSlots(days, limit);
    return {
      success: true,
      data: slots.map((slot) => ({
        start: slot.start.toISOString(),
        end: slot.end.toISOString(),
        label: slot.label,
      })),
    };
  }

  const supabase = await createClient();
  try {
    await requireUser(supabase);
    const slots = await getAvailableSlots(supabase, days, limit);
    return {
      success: true,
      data: slots.map((slot) => ({
        start: slot.start.toISOString(),
        end: slot.end.toISOString(),
        label: slot.label,
      })),
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Could not load slots" };
  }
}

export async function blockDemoCalendarSlot(input: {
  start_time: string;
  end_time: string;
}): Promise<ActionResult<undefined>> {
  const start = new Date(input.start_time);
  const end = new Date(input.end_time);
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end.getTime() <= start.getTime()
  ) {
    return { success: false, error: "Invalid calendar time" };
  }
  if (isLocalDemoMode()) {
    await mutateDemoState((state) => {
      if (
        state.appointments.some(
          (appointment) =>
            appointment.status !== "cancelled" &&
            new Date(appointment.start_time).getTime() < end.getTime() &&
            new Date(appointment.end_time).getTime() > start.getTime()
        )
      ) {
        return;
      }
      const now = new Date().toISOString();
      state.appointments.push({
        id: demoId(),
        lead_id: null,
        contact_id: null,
        title: "Internal calendar hold",
        appointment_type: "calendar_hold",
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        status: "confirmed",
        location: null,
        assigned_to: demoEstimatorId(state),
        source: "internal",
        external_calendar_id: null,
        created_at: now,
        updated_at: now,
      });
    });
    revalidatePath("/app", "layout");
    return { success: true, data: undefined };
  }

  const supabase = await createClient();
  try {
    const user = await requireUser(supabase);
    const { data: estimator } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "sales_rep")
      .limit(1)
      .maybeSingle();
    const { error } = await supabase.from("appointments").insert({
      lead_id: null,
      title: "Internal calendar hold",
      appointment_type: "calendar_hold",
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      status: "confirmed",
      assigned_to: estimator?.id ?? user.id,
      source: "internal",
    });
    if (error) return { success: false, error: error.message };
    revalidatePath("/app", "layout");
    return { success: true, data: undefined };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Could not block the calendar time",
    };
  }
}

export async function updateAppointmentStatus(
  id: string,
  status: "confirmed" | "cancelled" | "completed" | "rescheduled"
): Promise<ActionResult<undefined>> {
  if (isLocalDemoMode()) {
    try {
      await updateLocalAppointmentStatus(id, status);
      return { success: true, data: undefined };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Update failed" };
    }
  }

  const supabase = await createClient();
  try {
    await requireUser(supabase);
    const { error } = await supabase
      .from("appointments")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return { success: false, error: error.message };
    revalidatePath("/app/appointments");
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Update failed" };
  }
}

const AvailabilityWindowsSchema = z.object({
  windows: z
    .array(
      z.object({
        day_of_week: z.number().min(0).max(6),
        start_time: z.string().regex(/^\d{2}:\d{2}$/),
        end_time: z.string().regex(/^\d{2}:\d{2}$/),
        slot_minutes: z.number().min(30).max(240),
      })
    )
    .max(21),
});

const DAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

/**
 * Deterministic plain-English availability parser used when AI is off.
 * Handles inputs like "Monday, Wednesday and Friday from 10 to 4, 90 minutes
 * per appointment".
 */
function heuristicParseAvailability(text: string) {
  const lower = text.toLowerCase();
  const excluded = new Set<number>();
  for (const m of lower.matchAll(/(?:not|except|no)\s+(?:on\s+)?(\w+day)s?/g)) {
    const idx = DAY_NAMES.indexOf(m[1]);
    if (idx >= 0) excluded.add(idx);
  }
  let days = DAY_NAMES.map((name, idx) => (lower.includes(name) ? idx : -1)).filter(
    (idx) => idx >= 0 && !excluded.has(idx)
  );
  if (lower.includes("weekday") || lower.includes("every day") || days.length === 0) {
    days = [1, 2, 3, 4, 5].filter((d) => !excluded.has(d));
  }

  const range = lower.match(/(?:from\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:to|–|-|until)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  let start = "09:00";
  let end = "17:00";
  if (range) {
    let sh = Number(range[1]);
    let eh = Number(range[4]);
    if (range[3] === "pm" && sh < 12) sh += 12;
    if (range[6] === "pm" && eh < 12) eh += 12;
    if (!range[6] && eh <= 8) eh += 12; // "10 to 4" means 4 PM
    if (eh <= sh) eh = Math.min(sh + 8, 20);
    start = `${String(sh).padStart(2, "0")}:${range[2] ?? "00"}`;
    end = `${String(eh).padStart(2, "0")}:${range[5] ?? "00"}`;
  }

  const slotMatch = lower.match(/(\d{2,3})\s*(?:minutes?|mins?)/);
  const slotMinutes = slotMatch ? Math.min(240, Math.max(30, Number(slotMatch[1]))) : 60;

  return {
    windows: days.map((day) => ({
      day_of_week: day,
      start_time: start,
      end_time: end,
      slot_minutes: slotMinutes,
    })),
  };
}

/** Manually adds a weekly availability window for an estimator. */
export async function addAvailabilityWindow(input: {
  estimator_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_minutes: number;
}): Promise<ActionResult<undefined>> {
  const parsed = z
    .object({
      estimator_id: z.string().uuid().nullable(),
      day_of_week: z.number().min(0).max(6),
      start_time: z.string().regex(/^\d{2}:\d{2}$/),
      end_time: z.string().regex(/^\d{2}:\d{2}$/),
      slot_minutes: z.number().min(30).max(240),
    })
    .safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid availability window" };
  if (parsed.data.end_time <= parsed.data.start_time) {
    return { success: false, error: "End time must be after start time" };
  }

  const supabase = await createClient();
  try {
    await requireUser(supabase);
    const { error } = await supabase.from("availability_windows").insert({
      user_id: parsed.data.estimator_id,
      day_of_week: parsed.data.day_of_week,
      start_time: parsed.data.start_time,
      end_time: parsed.data.end_time,
      slot_minutes: parsed.data.slot_minutes,
      appointment_type: "inspection",
      active: true,
    });
    if (error) return { success: false, error: error.message };
    revalidatePath("/app/appointments");
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Could not add window" };
  }
}

/**
 * Optional shortcut: converts a plain-English availability description into
 * windows for one estimator (AI when configured, deterministic parser
 * otherwise) and replaces that estimator's schedule.
 */
export async function setAvailabilityFromText(
  text: string,
  estimatorId: string | null
): Promise<ActionResult<{ windows: z.infer<typeof AvailabilityWindowsSchema>["windows"]; usedAI: boolean }>> {
  const trimmed = text.trim().slice(0, 600);
  if (!trimmed) return { success: false, error: "Describe the availability first" };

  const supabase = await createClient();
  try {
    await requireUser(supabase);

    let parsed: z.infer<typeof AvailabilityWindowsSchema> | null = null;
    let usedAI = false;
    if (isAIConfigured()) {
      try {
        parsed = await callStructuredAI({
          system: `You convert a contractor's plain-English appointment availability into structured weekly windows. day_of_week uses 0=Sunday … 6=Saturday. Times are 24-hour "HH:MM". slot_minutes is the appointment length (default 60). Only include days the person can work. Respond with JSON: {"windows": [{"day_of_week", "start_time", "end_time", "slot_minutes"}]}.`,
          user: trimmed,
          schema: AvailabilityWindowsSchema,
          maxTokens: 500,
        });
        usedAI = true;
      } catch (err) {
        console.error("AI availability parse failed, using heuristic:", err);
      }
    }
    if (!parsed) parsed = heuristicParseAvailability(trimmed);
    if (parsed.windows.length === 0) {
      return { success: false, error: "Couldn't find any working days in that description" };
    }

    // Replace only this estimator's windows.
    let deleteQuery = supabase.from("availability_windows").delete();
    deleteQuery = estimatorId
      ? deleteQuery.eq("user_id", estimatorId)
      : deleteQuery.is("user_id", null);
    await deleteQuery;

    const { error } = await supabase.from("availability_windows").insert(
      parsed.windows.map((w) => ({
        ...w,
        user_id: estimatorId,
        appointment_type: "inspection",
        active: true,
      }))
    );
    if (error) return { success: false, error: error.message };

    revalidatePath("/app/appointments");
    return { success: true, data: { windows: parsed.windows, usedAI } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Could not save availability" };
  }
}

export async function deleteAvailabilityWindow(id: string): Promise<ActionResult<undefined>> {
  const supabase = await createClient();
  try {
    await requireUser(supabase);
    const { error } = await supabase.from("availability_windows").delete().eq("id", id);
    if (error) return { success: false, error: error.message };
    revalidatePath("/app/appointments");
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Delete failed" };
  }
}
