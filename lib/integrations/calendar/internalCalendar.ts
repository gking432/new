import type { SupabaseClient } from "@supabase/supabase-js";
import type { Appointment, AvailabilityWindow } from "@/types/app";

export interface AppointmentSlot {
  start: Date;
  end: Date;
  label: string;
}

/**
 * Canonical demo start times offered inside each availability window —
 * including evenings, since most homeowners work 9-to-5 and real home-service
 * companies run after-hours and weekend inspections.
 */
const CANONICAL_STARTS = [
  "09:00",
  "10:30",
  "12:00",
  "13:00",
  "14:30",
  "16:00",
  "17:30",
  "18:00",
  "18:30",
];

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

/**
 * The canonical inspection start times as human-readable labels
 * ("9:00 AM", "10:30 AM", …). These ARE the bookable times, so the voice
 * assistant offers from this set — never an invented time like "11 AM".
 */
export function canonicalStartLabels(): string[] {
  return CANONICAL_STARTS.map((t) => {
    const [h, m] = t.split(":").map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d.toLocaleString("en-US", { hour: "numeric", minute: "2-digit" });
  });
}

export function slotLabel(start: Date) {
  return start.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Computes open inspection slots for the next `days` days from the
 * availability_windows table minus already-booked appointments. Falls back to
 * the default Mon–Fri schedule when no windows are configured.
 */
export async function getAvailableSlots(
  supabase: SupabaseClient,
  days = 7,
  limit = 12
): Promise<AppointmentSlot[]> {
  const now = new Date();
  const horizon = new Date(now.getTime() + days * 86_400_000);

  const [{ data: windows }, { data: appointments }] = await Promise.all([
    supabase.from("availability_windows").select("*").eq("active", true),
    supabase
      .from("appointments")
      .select("start_time, end_time, status")
      .gte("start_time", now.toISOString())
      .lte("start_time", horizon.toISOString()),
  ]);

  // Fallback coverage when no windows are configured: weekday daytime AND
  // evenings, plus weekend daytime — so the assistant can always offer an
  // after-5pm or weekend slot to a 9-to-5 homeowner.
  const activeWindows: Pick<
    AvailabilityWindow,
    "day_of_week" | "start_time" | "end_time" | "slot_minutes"
  >[] =
    windows && windows.length > 0
      ? windows
      : [
          ...[1, 2, 3, 4, 5].map((day) => ({
            day_of_week: day,
            start_time: "09:00",
            end_time: "20:00",
            slot_minutes: 60,
          })),
          ...[0, 6].map((day) => ({
            day_of_week: day,
            start_time: "09:00",
            end_time: "16:00",
            slot_minutes: 60,
          })),
        ];

  const booked = ((appointments ?? []) as Pick<Appointment, "start_time" | "end_time" | "status">[])
    .filter((a) => a.status !== "cancelled")
    .map((a) => ({ start: new Date(a.start_time).getTime(), end: new Date(a.end_time).getTime() }));

  const slots: AppointmentSlot[] = [];
  for (let d = 0; d < days && slots.length < limit; d++) {
    const day = new Date(now);
    day.setDate(day.getDate() + d);
    const dow = day.getDay();
    for (const win of activeWindows.filter((w) => w.day_of_week === dow)) {
      const winStart = timeToMinutes(win.start_time);
      const winEnd = timeToMinutes(win.end_time);
      const slotMinutes = win.slot_minutes || 60;
      for (const startTime of CANONICAL_STARTS) {
        const startMin = timeToMinutes(startTime);
        if (startMin < winStart || startMin + slotMinutes > winEnd) continue;
        const start = new Date(day);
        start.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);
        const end = new Date(start.getTime() + slotMinutes * 60_000);
        // Skip the past and anything within the next hour.
        if (start.getTime() < now.getTime() + 3_600_000) continue;
        const overlaps = booked.some(
          (b) => start.getTime() < b.end && end.getTime() > b.start
        );
        if (overlaps) continue;
        slots.push({ start, end, label: slotLabel(start) });
        if (slots.length >= limit) break;
      }
      if (slots.length >= limit) break;
    }
  }
  return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/**
 * Resolves a spoken/loose appointment time ("tomorrow at 2:30 PM",
 * "2026-06-13T14:30:00") against the available slots. Returns the matching
 * slot, the closest slot on the same day, or null.
 */
export function resolveAppointmentTime(
  requested: string | null,
  slots: AppointmentSlot[]
): AppointmentSlot | null {
  if (!requested || slots.length === 0) return null;

  const parsed = new Date(requested);
  if (!Number.isNaN(parsed.getTime())) {
    const exact = slots.find((s) => Math.abs(s.start.getTime() - parsed.getTime()) < 15 * 60_000);
    if (exact) return exact;
    const sameDay = slots.filter((s) => s.start.toDateString() === parsed.toDateString());
    if (sameDay.length > 0) {
      return sameDay.reduce((best, s) =>
        Math.abs(s.start.getTime() - parsed.getTime()) < Math.abs(best.start.getTime() - parsed.getTime())
          ? s
          : best
      );
    }
  }

  const text = requested.toLowerCase();
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const weekdays: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };
  const weekdayMatch = text.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  let targetDate: Date | null = null;
  if (/\btoday\b/.test(text)) {
    targetDate = today;
  } else if (/\btomorrow\b/.test(text)) {
    targetDate = tomorrow;
  } else if (weekdayMatch) {
    const targetDow = weekdays[weekdayMatch[1]];
    const baseDays = (targetDow - today.getDay() + 7) % 7;
    const explicitlyNext = /\bnext\s+(?:week\s+)?(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/.test(
      text
    );
    const addDays = text.includes("next week")
      ? baseDays + (baseDays === 0 ? 7 : 7)
      : explicitlyNext && baseDays === 0
        ? 7
        : baseDays;
    targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + addDays);
  }

  const candidates = targetDate
    ? slots.filter((s) => s.start.toDateString() === targetDate.toDateString())
    : slots;
  const pool = candidates.length > 0 ? candidates : slots;

  const timeMatch =
    text.match(/\b(?:at|around|about|by|for)\s+(\d{1,4})(?::(\d{2}))?\s*(am|pm)?\b/) ||
    text.match(/\b(\d{1,2})(?::(\d{2}))\s*(am|pm)?\b/) ||
    text.match(/\b(\d{1,2})\s*(am|pm)\b/);
  if (timeMatch) {
    const rawHour = timeMatch[1];
    const ampm = /^(am|pm)$/i.test(timeMatch[2] ?? "")
      ? timeMatch[2]
      : timeMatch[3];
    let hour = Number(rawHour);
    let minute = ampm === timeMatch[2] ? 0 : Number(timeMatch[2] ?? 0);
    if (!timeMatch[2] && rawHour.length >= 3) {
      hour = Number(rawHour.slice(0, -2));
      minute = Number(rawHour.slice(-2));
    }
    if (hour > 23 || minute > 59) return pool[0] ?? null;
    if (ampm === "pm" && hour < 12) hour += 12;
    if (!ampm && hour <= 7) hour += 12; // "after 2" almost always means PM
    const targetMin = hour * 60 + minute;
    const afternoon = /after|afternoon|later/.test(text);
    const eligible = afternoon
      ? pool.filter((s) => s.start.getHours() * 60 + s.start.getMinutes() >= targetMin)
      : pool;
    const search = eligible.length > 0 ? eligible : pool;
    return search.reduce((best, s) => {
      const mins = s.start.getHours() * 60 + s.start.getMinutes();
      const bestMins = best.start.getHours() * 60 + best.start.getMinutes();
      return Math.abs(mins - targetMin) < Math.abs(bestMins - targetMin) ? s : best;
    });
  }
  return pool[0] ?? null;
}
