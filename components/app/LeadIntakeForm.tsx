"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, CalendarClock, Check, Loader2, PhoneCall, Save, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useLiveCall } from "@/components/calls/CallProvider";
import { createLead, type LeadInput } from "@/lib/actions/leads";
import { sanitizeCustomerName } from "@/lib/calls/nameExtraction";
import { cn } from "@/lib/utils";
import {
  demoDatePlusDays,
  demoDateKey,
  demoDayOfWeek,
  demoWallClockParts,
  dateFromDemoWallClock,
  formatDemoDate,
  formatDemoDateTime,
  formatDemoTime,
} from "@/lib/utils/demoTime";
import type { TranscriptTurn } from "@/types/app";

type Fields = {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  street_address: string;
  city: string;
  state: string;
  zip_code: string;
  service_type: LeadInput["service_type"] | "";
  active_leak: string;
  insurance_started: string;
  description: string;
  secondary_contact_name: string;
  secondary_contact_relationship: string;
  secondary_contact_phone: string;
  secondary_contact_email: string;
};

const EMPTY: Fields = {
  first_name: "",
  last_name: "",
  phone: "",
  email: "",
  street_address: "",
  city: "",
  state: "WI",
  zip_code: "",
  service_type: "",
  active_leak: "",
  insurance_started: "",
  description: "",
  secondary_contact_name: "",
  secondary_contact_relationship: "",
  secondary_contact_phone: "",
  secondary_contact_email: "",
};

const SERVICES: [LeadInput["service_type"], string][] = [
  ["roofing", "Roofing"],
  ["siding", "Siding"],
  ["windows", "Windows"],
  ["doors", "Doors"],
  ["bath", "Bath"],
  ["gutters", "Gutters"],
  ["leaf_protection", "Leaf Protection"],
  ["storm_damage", "Storm Damage"],
  ["not_sure", "Not Sure"],
];

const LIVE_INTAKE_FIELDS = new Set<keyof Fields>([
  "first_name",
  "last_name",
  "phone",
  "email",
  "street_address",
  "city",
  "zip_code",
  "service_type",
  "description",
]);

function mapService(s?: string): Fields["service_type"] {
  if (!s) return "";
  const t = s.toLowerCase();
  if (t.includes("storm") || t.includes("hail")) return "storm_damage";
  if (t.includes("roof")) return "roofing";
  if (t.includes("window")) return "windows";
  if (t.includes("siding")) return "siding";
  if (t.includes("door")) return "doors";
  if (t.includes("bath") || t.includes("shower")) return "bath";
  if (t.includes("gutter")) return "gutters";
  if (t.includes("leaf")) return "leaf_protection";
  return "";
}

function draftNotesFromCall(
  live: ReturnType<typeof useLiveCall>,
  extractedFields: Record<string, string>
) {
  if (!live) return "";
  const customerSpeaker = live.persona === "customer" ? "ai" : "customer";
  const customerLines = live.turns
    .filter((turn) => turn.speaker === customerSpeaker && turn.text.trim().length > 8)
    .map((turn) => turn.text.trim());
  const repLines = live.turns
    .filter((turn) => turn.speaker !== customerSpeaker && turn.speaker !== "system")
    .map((turn) => turn.text.trim())
    .filter(Boolean);
  if (customerLines.length === 0) return "";

  const notes: string[] = [];
  const combined = [...customerLines, ...repLines].join(" ");
  const customerCombined = customerLines.join(" ");
  const customerName = extractedFields["Name"] || live.callerName || "Customer";

  notes.push(`Live CRM note draft for ${customerName}:`);
  if (/leak|water|drip|ceiling|stain/i.test(combined)) {
    notes.push("- Reported possible active water intrusion or ceiling staining.");
  }
  if (/storm|hail|wind|two nights|last night|yesterday/i.test(combined)) {
    notes.push("- Connected the issue to recent storm or wind activity.");
  }
  if (/missing|shingle|roof|glass|window|broken/i.test(combined)) {
    notes.push("- Described visible exterior damage that should be inspected.");
  }
  if (extractedFields["Address"] || extractedFields["City"]) {
    notes.push(
      `- Property location captured: ${[extractedFields["Address"], extractedFields["City"]]
        .filter(Boolean)
        .join(", ")}.`
    );
  }
  const confirmedAppointment =
    live.result?.pendingAppointmentLabel ?? live.result?.appointment?.label ?? null;
  if (confirmedAppointment) {
    notes.push(`- Appointment confirmed for ${confirmedAppointment}.`);
  }
  if (repLines.some((line) => /phone|email|address|name|spell|number/i.test(line))) {
    notes.push("- Rep gathered contact details during the call.");
  }
  if (/insurance/i.test(combined)) {
    notes.push(
      /not yet|haven'?t|no insurance/i.test(customerCombined)
        ? "- Customer has not started an insurance claim yet."
        : "- Insurance was discussed during the call."
    );
  }
  return notes.join("\n");
}

type SchedulingPreference = "morning" | "afternoon" | "evening" | "after_5" | null;
type SlotStatus = "open" | "booked";
type CalendarSlot = {
  start: Date;
  label: string;
  status: SlotStatus;
};
type ParsedAppointmentRequest = {
  start: Date;
  turnIndex: number;
  speaker: TranscriptTurn["speaker"];
  text: string;
};

function humanSlotLabel(date: Date) {
  return `${formatDemoDate(date, {
    weekday: "long",
    month: "short",
    day: "numeric",
  })} at ${formatDemoTime(date)}`;
}

function crmSlotLabel(date: Date) {
  return formatDemoDateTime(date, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function sameMinute(a: Date, b: Date) {
  return Math.abs(a.getTime() - b.getTime()) < 60_000;
}

function demoDayOffset(date: Date) {
  const today = demoDatePlusDays(0, 12, 0);
  const startOfToday = new Date(today);
  startOfToday.setUTCHours(0, 0, 0, 0);
  const startOfDate = new Date(date);
  startOfDate.setUTCHours(0, 0, 0, 0);
  return Math.round((startOfDate.getTime() - startOfToday.getTime()) / 86_400_000);
}

function appointmentDateFromText(text: string) {
  const lower = text.toLowerCase();
  if (/\bday after tomorrow\b/.test(lower)) return demoDatePlusDays(2, 12, 0);
  if (/\btomorrow\b/.test(lower)) return demoDatePlusDays(1, 12, 0);
  if (/\btoday\b/.test(lower)) return demoDatePlusDays(0, 12, 0);

  const monthDate = lower.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/
  );
  if (monthDate) {
    const months: Record<string, number> = {
      jan: 1,
      january: 1,
      feb: 2,
      february: 2,
      mar: 3,
      march: 3,
      apr: 4,
      april: 4,
      may: 5,
      jun: 6,
      june: 6,
      jul: 7,
      july: 7,
      aug: 8,
      august: 8,
      sep: 9,
      sept: 9,
      september: 9,
      oct: 10,
      october: 10,
      nov: 11,
      november: 11,
      dec: 12,
      december: 12,
    };
    const now = demoWallClockParts();
    const month = months[monthDate[1].replace(/\.$/, "")] ?? now.month;
    const day = Number(monthDate[2]);
    const candidate = dateFromDemoWallClock(now.year, month, day, 12, 0);
    const today = demoDatePlusDays(0, 0, 0);
    return candidate < today
      ? dateFromDemoWallClock(now.year + 1, month, day, 12, 0)
      : candidate;
  }

  const weekdays: Record<string, number> = {
    sun: 0,
    sunday: 0,
    mon: 1,
    monday: 1,
    tue: 2,
    tues: 2,
    tuesday: 2,
    wed: 3,
    wednesday: 3,
    thu: 4,
    thur: 4,
    thurs: 4,
    thursday: 4,
    fri: 5,
    friday: 5,
    sat: 6,
    saturday: 6,
  };
  const weekday = lower.match(
    /\b(?:next\s+)?(sun(?:day)?|mon(?:day)?|tue(?:sday)?|tues|wed(?:nesday)?|thu(?:rsday)?|thur(?:sday)?|thurs|fri(?:day)?|sat(?:urday)?)\b/
  );
  if (!weekday) return null;
  const today = demoDatePlusDays(0, 12, 0);
  const todayDow = demoDayOfWeek(today);
  const targetDow = weekdays[weekday[1]];
  const base = (targetDow - todayDow + 7) % 7;
  const daysAhead = lower.includes("next ") || base === 0 ? base || 7 : base;
  return demoDatePlusDays(daysAhead, 12, 0);
}

function appointmentTimeFromText(text: string) {
  const lower = text.toLowerCase();
  if (/\bnoon\b/.test(lower)) return { hour: 12, minute: 0 };
  const wordTime = lower.match(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(?:[\s-]+(fifteen|thirty|forty five))?\s*(a\.?m\.?|p\.?m\.?)?\b/
  );
  const numericTime =
    lower.match(/\b(\d{1,2})(?::?(\d{2}))\s*(a\.?m\.?|p\.?m\.?)\b/) ||
    lower.match(/\b(\d{1,2}):(\d{2})\b/);

  let hour: number | null = null;
  let minute = 0;
  let meridiem: string | undefined;

  if (numericTime) {
    hour = Number(numericTime[1]);
    minute = numericTime[2] ? Number(numericTime[2]) : 0;
    meridiem = numericTime[3];
  } else if (wordTime) {
    const words: Record<string, number> = {
      one: 1,
      two: 2,
      three: 3,
      four: 4,
      five: 5,
      six: 6,
      seven: 7,
      eight: 8,
      nine: 9,
      ten: 10,
      eleven: 11,
      twelve: 12,
    };
    hour = words[wordTime[1]];
    minute = wordTime[2] === "thirty" ? 30 : wordTime[2] === "fifteen" ? 15 : wordTime[2] ? 45 : 0;
    meridiem = wordTime[3];
  }

  if (!hour) return null;
  const hasPm = meridiem?.startsWith("p");
  const hasAm = meridiem?.startsWith("a");
  if (hasPm && hour < 12) hour += 12;
  if (hasAm && hour === 12) hour = 0;
  // In a sales call, bare "4" or "5:30" almost always means afternoon/evening.
  if (!hasPm && !hasAm && hour >= 1 && hour <= 7) hour += 12;
  return { hour, minute };
}

function parseAppointmentRequest(text: string, turnIndex: number, speaker: TranscriptTurn["speaker"]) {
  const date = appointmentDateFromText(text);
  const time = appointmentTimeFromText(text);
  if (!date || !time) return null;
  const dayOffset = demoDayOffset(date);
  return {
    start: demoDatePlusDays(dayOffset, time.hour, time.minute),
    turnIndex,
    speaker,
    text,
  };
}

function extractLatestAppointmentRequest(turns: TranscriptTurn[]) {
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index];
    if (turn.speaker === "system") continue;
    const parsed = parseAppointmentRequest(turn.text, index, turn.speaker);
    if (parsed) return parsed;
  }
  return null;
}

function customerPreferences(turns: TranscriptTurn[]): Exclude<SchedulingPreference, null>[] {
  const customerText = turns
    .filter((turn) => turn.speaker === "ai")
    .map((turn) => turn.text)
    .join(" ")
    .toLowerCase();
  const preferences: Exclude<SchedulingPreference, null>[] = [];
  if (/work(?:ing)?\s+(?:until|til|till)\s+5|after\s+5|after\s+five|not\s+(?:free|available)\s+(?:until|before)\s+5/.test(customerText)) {
    preferences.push("after_5");
  }
  if (/morning|before noon|early in the day/.test(customerText)) preferences.push("morning");
  if (/afternoon/.test(customerText)) preferences.push("afternoon");
  if (/evening|after work|after 5|after five/.test(customerText)) preferences.push("evening");
  return Array.from(new Set(preferences));
}

function slotFitsPreferences(slot: Date, preferences: SchedulingPreference[]) {
  const hour = Number(formatDemoTime(slot, { hour: "numeric", hour12: false }).split(":")[0]);
  if (preferences.includes("after_5") || preferences.includes("evening")) return hour >= 17;
  if (preferences.includes("morning")) return hour < 12;
  if (preferences.includes("afternoon")) return hour >= 12 && hour < 17;
  return true;
}

function buildDemoCalendarSlots(request: ParsedAppointmentRequest | null) {
  const baseSlots: CalendarSlot[] = [
    { start: demoDatePlusDays(1, 9, 0), status: "booked", label: "Crew sync" },
    { start: demoDatePlusDays(1, 12, 0), status: "booked", label: "Booked" },
    { start: demoDatePlusDays(1, 16, 0), status: "open", label: "Open" },
    { start: demoDatePlusDays(1, 17, 30), status: "booked", label: "Booked" },
    { start: demoDatePlusDays(2, 9, 0), status: "open", label: "Open" },
    { start: demoDatePlusDays(2, 10, 30), status: "open", label: "Open" },
    { start: demoDatePlusDays(2, 14, 30), status: "open", label: "Open" },
    { start: demoDatePlusDays(2, 17, 30), status: "open", label: "Open" },
    { start: demoDatePlusDays(3, 9, 0), status: "open", label: "Open" },
    { start: demoDatePlusDays(3, 13, 0), status: "open", label: "Open" },
    { start: demoDatePlusDays(3, 16, 0), status: "open", label: "Open" },
    { start: demoDatePlusDays(3, 18, 0), status: "open", label: "Open" },
  ];
  if (request && !baseSlots.some((slot) => sameMinute(slot.start, request.start))) {
    baseSlots.push({ start: request.start, status: "booked", label: "Unavailable" });
  }
  return baseSlots.sort((a, b) => a.start.getTime() - b.start.getTime());
}

function customerAcceptedAfterRequest(turns: TranscriptTurn[], request: ParsedAppointmentRequest | null) {
  if (!request) return false;
  return turns.slice(request.turnIndex + 1).some(
    (turn) =>
      turn.speaker === "ai" &&
      /\b(yes|yeah|yep|that works|works for me|let'?s do|sounds good|perfect|that'?s fine)\b/i.test(
        turn.text
      )
  );
}

function buildRepSchedulingAssist(turns: TranscriptTurn[]) {
  const request = extractLatestAppointmentRequest(turns);
  const preferences = customerPreferences(turns);
  const slots = buildDemoCalendarSlots(request);
  const requestedSlot = request
    ? slots.find((slot) => sameMinute(slot.start, request.start)) ?? null
    : null;
  const accepted = customerAcceptedAfterRequest(turns, request);
  const suggestion =
    request &&
    slots.find(
      (slot) =>
        slot.status === "open" &&
        slot.start.getTime() > request.start.getTime() &&
        slotFitsPreferences(slot.start, preferences)
    );
  const selected =
    request && requestedSlot?.status === "open" && accepted
      ? {
          start: request.start.toISOString(),
          label: crmSlotLabel(request.start),
        }
      : null;

  if (!request) {
    return {
      status: "listening" as const,
      title: "Listening for scheduling details",
      body: "Waiting for the customer or rep to mention a date and time.",
      cue: "No appointment time detected yet.",
      request,
      requestedSlot,
      suggestion: null,
      preferences,
      slots,
      selected,
    };
  }

  if (selected) {
    return {
      status: "ready" as const,
      title: "Booking ready",
      body: `${humanSlotLabel(request.start)} is open and the customer agreed. This exact slot will save to the CRM.`,
      cue: "Customer agreed to the available slot.",
      request,
      requestedSlot,
      suggestion: null,
      preferences,
      slots,
      selected,
    };
  }

  if (requestedSlot?.status === "open" && !slotFitsPreferences(request.start, preferences)) {
    return {
      status: "coach" as const,
      title: "Open slot, bad fit",
      body: `${humanSlotLabel(request.start)} is open, but it conflicts with what the customer said. Try ${suggestion ? humanSlotLabel(suggestion.start) : "a different slot"} instead.`,
      cue: "Customer constraint detected.",
      request,
      requestedSlot,
      suggestion: suggestion ?? null,
      preferences,
      slots,
      selected,
    };
  }

  if (requestedSlot?.status === "open") {
    return {
      status: "open" as const,
      title: "Slot is open",
      body: `${humanSlotLabel(request.start)} is available. Ask the customer if that works.`,
      cue: "Waiting for customer agreement.",
      request,
      requestedSlot,
      suggestion: null,
      preferences,
      slots,
      selected,
    };
  }

  return {
    status: "conflict" as const,
    title: "Slot unavailable",
    body: `We're fully booked at ${humanSlotLabel(request.start)}. Try asking about ${
      suggestion ? humanSlotLabel(suggestion.start) : "the next open slot"
    }.`,
    cue: "Calendar conflict detected.",
    request,
    requestedSlot,
    suggestion: suggestion ?? null,
    preferences,
    slots,
    selected,
  };
}

/**
 * The CRM lead form — a blank lead detail that can be filled MANUALLY (walk-ins,
 * phone notes, or if the AI is ever down) AND fills itself in real time when an
 * AI call is happening, so you literally watch the AI populate the record.
 */
export function LeadIntakeForm() {
  const router = useRouter();
  const live = useLiveCall();
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<{
    start: string;
    label: string;
  } | null>(null);
  const [schedulerOpen, setSchedulerOpen] = useState(true);
  const touched = useRef<Set<keyof Fields>>(new Set());
  const liveFillTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [aiFilled, setAiFilled] = useState<Set<keyof Fields>>(new Set());

  const callActive =
    live && ["incoming", "dialing", "connecting", "connected", "processing"].includes(live.phase);
  const repAssistedCall = live?.persona === "customer";
  const schedulingAssist = useMemo(
    () => buildRepSchedulingAssist(live?.turns ?? []),
    [live?.turns]
  );
  const appointmentWasDiscussed = Boolean(
    repAssistedCall &&
      (schedulingAssist.request ||
        live?.result?.summary?.appointment_requested ||
        live?.result?.pendingAppointmentStartTime ||
        live?.extracted?.["Requested appointment"])
  );
  const resultAppointment = useMemo(() => {
    const start =
      live?.result?.pendingAppointmentStartTime ?? live?.result?.appointment?.start_time ?? null;
    if (!start || Number.isNaN(new Date(start).getTime())) return null;
    return {
      start,
      label:
        live?.result?.pendingAppointmentLabel ??
        live?.result?.appointment?.label ??
        crmSlotLabel(new Date(start)),
    };
  }, [
    live?.result?.appointment?.label,
    live?.result?.appointment?.start_time,
    live?.result?.pendingAppointmentLabel,
    live?.result?.pendingAppointmentStartTime,
  ]);
  const bookingAppointment =
    selectedAppointment ?? schedulingAssist.selected ?? (repAssistedCall ? resultAppointment : null);

  // Caller ID is known as soon as the phone rings. Everything else waits for
  // the conversation and merges with a short delay so it reads like live notes.
  useEffect(() => {
    if (!live?.callerPhone || touched.current.has("phone")) return;
    setFields((prev) => (prev.phone ? prev : { ...prev, phone: live.callerPhone ?? "" }));
  }, [live?.callerPhone]);

  useEffect(() => {
    if (repAssistedCall) setSchedulerOpen(true);
  }, [repAssistedCall, live?.callerPhone, live?.scenario]);

  // Merge live-extracted info into any field the human hasn't manually edited.
  // This is the "watch the AI fill the form and draft the notes" moment.
  const extracted = live?.extracted;
  const extractedKey = JSON.stringify(extracted ?? {});
  useEffect(() => {
    if (!extracted && !live) return;
    const summaryFields = live?.result?.summary?.extracted_fields;
    const summaryName = [summaryFields?.first_name, summaryFields?.last_name]
      .filter(Boolean)
      .join(" ");
    const safeSummaryName = sanitizeCustomerName(summaryName) ?? "";
    const extractedFields: Record<string, string> = {
      ...(safeSummaryName ? { Name: safeSummaryName } : {}),
      ...(summaryFields?.phone ? { Phone: summaryFields.phone } : {}),
      ...(summaryFields?.email ? { Email: summaryFields.email } : {}),
      ...(summaryFields?.address ? { Address: summaryFields.address } : {}),
      ...(summaryFields?.city ? { City: summaryFields.city } : {}),
      ...(summaryFields?.state ? { State: summaryFields.state } : {}),
      ...(summaryFields?.zip_code ? { ZIP: summaryFields.zip_code } : {}),
      ...(summaryFields?.active_leak ? { "Active leak": summaryFields.active_leak } : {}),
      ...(live?.result?.summary?.service_type ? { Service: live.result.summary.service_type } : {}),
      ...((live?.result?.appointment?.label ?? live?.result?.pendingAppointmentLabel)
        ? {
            "Requested appointment":
              live?.result?.appointment?.label ?? live?.result?.pendingAppointmentLabel ?? "",
          }
        : {}),
      ...(extracted ?? {}),
    };
    if (liveFillTimer.current) clearTimeout(liveFillTimer.current);
    liveFillTimer.current = setTimeout(() => {
      setFields((prev) => {
        const next = { ...prev };
        const filled = new Set(aiFilled);
        const set = (key: keyof Fields, value: string) => {
          if (!value || touched.current.has(key) || next[key]) return;
          (next as Record<string, string>)[key] = value;
          filled.add(key);
        };
        const credibleName = sanitizeCustomerName(extractedFields["Name"]);
        if (credibleName) {
          const [f, ...r] = credibleName.split(/\s+/);
          set("first_name", f);
          if (r.length) set("last_name", r.join(" "));
        }
        set("phone", extractedFields["Phone"] ?? "");
        set("email", extractedFields["Email"] ?? "");
        set("street_address", extractedFields["Address"] ?? "");
        set("city", extractedFields["City"] ?? "");
        set("state", extractedFields["State"] ?? "");
        set("zip_code", extractedFields["ZIP"] ?? "");
        const svc = mapService(extractedFields["Service"]);
        if (svc && !touched.current.has("service_type") && !next.service_type) {
          next.service_type = svc;
          filled.add("service_type");
        }
        if (extractedFields["Active leak"]) set("active_leak", "yes");
        if (extractedFields["Insurance"]) {
          set(
            "insurance_started",
            extractedFields["Insurance"].includes("Not") ? "no" : "yes"
          );
        }
        const draftedNotes = draftNotesFromCall(live, extractedFields);
        if (
          draftedNotes &&
          !touched.current.has("description") &&
          draftedNotes !== next.description
        ) {
          next.description = draftedNotes;
          filled.add("description");
        }
        setAiFilled(filled);
        return next;
      });
    }, 4700);
    return () => {
      if (liveFillTimer.current) clearTimeout(liveFillTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    extractedKey,
    live?.turns.length,
    live?.phase,
    live?.result?.leadId,
    live?.result?.pendingAppointmentLabel,
  ]);

  useEffect(() => {
    if (!repAssistedCall) {
      if (selectedAppointment) setSelectedAppointment(null);
      return;
    }
    const nextAppointment = schedulingAssist.selected ?? resultAppointment;
    if (
      nextAppointment &&
      selectedAppointment?.start !== nextAppointment.start
    ) {
      setSelectedAppointment(nextAppointment);
    }
  }, [repAssistedCall, schedulingAssist.selected, resultAppointment, selectedAppointment]);

  function update(key: keyof Fields, value: string) {
    touched.current.add(key);
    setFields((p) => ({ ...p, [key]: value }) as Fields);
  }

  const missingRequired = useMemo(() => {
    const req: (keyof Fields)[] = ["first_name", "phone"];
    return req.filter((k) => !fields[k]);
  }, [fields]);
  const missingDuringCall = useMemo(
    () =>
      callActive
        ? Array.from(LIVE_INTAKE_FIELDS).filter((key) => !String(fields[key] ?? "").trim())
        : [],
    [callActive, fields]
  );

  function save() {
    if (live?.phase === "done" && live.result?.leadId) {
      router.push(`/app/leads/${live.result.leadId}`);
      return;
    }
    if (!fields.first_name) {
      toast.error("At least a name is required");
      return;
    }
    if (appointmentWasDiscussed && !bookingAppointment) {
      toast.error("Let the AI scheduling assist select a real slot before saving this call.");
      return;
    }
    setSaving(true);
    void createLead({
      first_name: fields.first_name,
      last_name: fields.last_name,
      phone: fields.phone || null,
      email: fields.email || null,
      street_address: fields.street_address || null,
      city: fields.city || null,
      state: fields.state || null,
      zip_code: fields.zip_code || null,
      service_type: (fields.service_type || "not_sure") as LeadInput["service_type"],
      description: fields.description,
      active_leak: fields.active_leak || null,
      insurance_started: fields.insurance_started || null,
      secondary_contact_name: fields.secondary_contact_name || null,
      secondary_contact_relationship: fields.secondary_contact_relationship || null,
      secondary_contact_phone: fields.secondary_contact_phone || null,
      secondary_contact_email: fields.secondary_contact_email || null,
      source: live?.phase === "done" && live.result?.deferredLeadCreation ? "phone_call" : "manual",
      source_call_id:
        live?.phase === "done" && live.result?.callId
          ? (live.result?.callId ?? null)
          : null,
      appointment_start_time:
        live?.phase === "done"
          ? (bookingAppointment?.start ??
            (repAssistedCall
              ? null
              : live.result?.pendingAppointmentStartTime ??
                live.result?.appointment?.start_time ??
                live.result?.summary?.appointment_time ??
                null))
          : null,
    }).then((res) => {
      setSaving(false);
      if (res.success) {
        window.dispatchEvent(new CustomEvent("northstar-lead-saved"));
        router.push(`/app/leads/${res.data.leadId}`);
      } else {
        toast.error(res.error);
      }
    });
  }

  function fieldCls(key: keyof Fields) {
    return cn(
      "transition-colors",
      aiFilled.has(key) && "border-status-success bg-green-50/60",
      callActive &&
        missingDuringCall.includes(key) &&
        !missingRequired.includes(key) &&
        "border-amber-400 bg-amber-50 ring-1 ring-amber-200",
      callActive && missingRequired.includes(key) && "border-red-400 bg-red-50"
    );
  }

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          New lead
          {callActive ? (
            <Badge variant="secondary" className="gap-1">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
              </span>
              <Bot className="h-3 w-3" />
              AI filling this live from the call
            </Badge>
          ) : null}
        </CardTitle>
        <CardDescription>
          {callActive
            ? "Watch the fields and notes fill as the AI talks. Anything red is still needed — ask for it. You can also type over anything."
            : live?.phase === "done"
              ? "The call is complete. Review what the AI captured, then click Save lead to open the CRM record."
              : "Enter a lead by hand (walk-in, phone note, or if the AI is offline). It saves to the CRM and gets AI-analyzed like any other lead."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {(callActive || live?.phase === "done") && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            AI can miss a detail in live conversation. Review the fields before saving, and type in
            anything still blank.
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="First name" required filled={aiFilled.has("first_name")} missing={missingDuringCall.includes("first_name")}>
            <Input value={fields.first_name} onChange={(e) => update("first_name", e.target.value)} className={fieldCls("first_name")} />
          </Field>
          <Field label="Last name" filled={aiFilled.has("last_name")} missing={missingDuringCall.includes("last_name")}>
            <Input value={fields.last_name} onChange={(e) => update("last_name", e.target.value)} className={fieldCls("last_name")} />
          </Field>
          <Field label="Phone" required filled={aiFilled.has("phone")} missing={missingDuringCall.includes("phone")}>
            <Input value={fields.phone} onChange={(e) => update("phone", e.target.value)} className={fieldCls("phone")} />
          </Field>
          <Field label="Email" filled={aiFilled.has("email")} missing={missingDuringCall.includes("email")}>
            <Input value={fields.email} onChange={(e) => update("email", e.target.value)} className={fieldCls("email")} />
          </Field>
          <Field label="Street address" filled={aiFilled.has("street_address")} missing={missingDuringCall.includes("street_address")}>
            <Input value={fields.street_address} onChange={(e) => update("street_address", e.target.value)} className={fieldCls("street_address")} />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="City" filled={aiFilled.has("city")} missing={missingDuringCall.includes("city")}>
              <Input value={fields.city} onChange={(e) => update("city", e.target.value)} className={fieldCls("city")} />
            </Field>
            <Field label="State" filled={aiFilled.has("state")}>
              <Input value={fields.state} onChange={(e) => update("state", e.target.value)} className={fieldCls("state")} />
            </Field>
            <Field label="ZIP" filled={aiFilled.has("zip_code")} missing={missingDuringCall.includes("zip_code")}>
              <Input value={fields.zip_code} onChange={(e) => update("zip_code", e.target.value)} className={fieldCls("zip_code")} />
            </Field>
          </div>
          <Field label="Service" filled={aiFilled.has("service_type")} missing={missingDuringCall.includes("service_type")}>
            <Select value={fields.service_type} onValueChange={(v) => update("service_type", v)}>
              <SelectTrigger className={fieldCls("service_type")}>
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {SERVICES.map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Active leak?" filled={aiFilled.has("active_leak")}>
            <Select value={fields.active_leak} onValueChange={(v) => update("active_leak", v)}>
              <SelectTrigger className={fieldCls("active_leak")}>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Yes</SelectItem>
                <SelectItem value="no">No</SelectItem>
                <SelectItem value="not_sure">Not sure</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="rounded-lg border bg-secondary/30 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Spouse or secondary contact
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <Input
                value={fields.secondary_contact_name}
                onChange={(e) => update("secondary_contact_name", e.target.value)}
                className={fieldCls("secondary_contact_name")}
                placeholder="Optional"
              />
            </Field>
            <Field label="Relationship">
              <Input
                value={fields.secondary_contact_relationship}
                onChange={(e) => update("secondary_contact_relationship", e.target.value)}
                className={fieldCls("secondary_contact_relationship")}
                placeholder="Spouse, partner, property manager…"
              />
            </Field>
            <Field label="Phone">
              <Input
                value={fields.secondary_contact_phone}
                onChange={(e) => update("secondary_contact_phone", e.target.value)}
                className={fieldCls("secondary_contact_phone")}
              />
            </Field>
            <Field label="Email">
              <Input
                value={fields.secondary_contact_email}
                onChange={(e) => update("secondary_contact_email", e.target.value)}
                className={fieldCls("secondary_contact_email")}
              />
            </Field>
          </div>
        </div>

        <Field label="Notes / what's going on" filled={aiFilled.has("description")} missing={missingDuringCall.includes("description")}>
          <Textarea
            rows={3}
            value={fields.description}
            onChange={(e) => update("description", e.target.value)}
            className={fieldCls("description")}
          />
        </Field>

        {callActive ? (
          <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
            <PhoneCall className="h-4 w-4 text-primary" />
            Call in progress — the AI is drafting this record live.
          </div>
        ) : (
          <Button onClick={save} disabled={saving} data-tour="lead-intake-save">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save lead
          </Button>
        )}
      </CardContent>
    </Card>
    {repAssistedCall && (
      <SchedulingAssistantPopup
        assist={schedulingAssist}
        open={schedulerOpen}
        onClose={() => setSchedulerOpen(false)}
        onOpen={() => setSchedulerOpen(true)}
      />
    )}
    </>
  );
}

function Field({
  label,
  required,
  filled,
  missing,
  children,
}: {
  label: string;
  required?: boolean;
  filled?: boolean;
  missing?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1 text-xs">
        {label}
        {required && <span className="text-red-500">*</span>}
        {filled && (
          <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] font-medium text-status-success">
            <Check className="h-3 w-3" /> AI
          </span>
        )}
        {missing && !filled && (
          <span className="ml-1 text-[10px] font-semibold text-amber-700">Ask customer</span>
        )}
      </Label>
      {children}
    </div>
  );
}

function SchedulingAssistantPopup({
  assist,
  open,
  onClose,
  onOpen,
}: {
  assist: ReturnType<typeof buildRepSchedulingAssist>;
  open: boolean;
  onClose: () => void;
  onOpen: () => void;
}) {
  const days = Array.from(
    new Map(
      assist.slots.map((slot) => [
        demoDateKey(slot.start),
        {
          key: demoDateKey(slot.start),
          label: formatDemoDate(slot.start, { weekday: "short", month: "numeric", day: "numeric" }),
        },
      ])
    ).values()
  ).slice(0, 3);
  const preferenceLabels: Record<Exclude<SchedulingPreference, null>, string> = {
    morning: "Prefers morning",
    afternoon: "Prefers afternoon",
    evening: "Prefers evening",
    after_5: "Works until 5",
  };
  const statusLabel =
    assist.status === "listening"
      ? "Listening"
      : assist.status === "ready"
        ? "Ready"
        : assist.status === "open"
          ? "Open"
          : assist.status === "coach"
            ? "Coaching"
            : "Conflict";

  if (!open) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full border border-brand-gold/40 bg-brand-dark px-4 py-3 text-sm font-semibold text-white shadow-2xl"
        data-tour="rep-assisted-slot-picker"
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-gold opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-gold" />
        </span>
        AI scheduler
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-50 max-h-[calc(100dvh-2rem)] w-[min(440px,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl sm:bottom-6 sm:right-6"
      data-tour="rep-assisted-slot-picker"
    >
      <div className="flex items-start justify-between gap-3 border-b bg-brand-dark px-4 py-3 text-white">
        <div className="flex items-start gap-3">
          <div className="relative mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
            {assist.status === "listening" ? (
              <>
                <span className="absolute h-9 w-9 animate-ping rounded-full bg-brand-gold/40" />
                <Loader2 className="relative h-4 w-4 animate-spin text-brand-gold" />
              </>
            ) : (
              <Sparkles className="h-4 w-4 text-brand-gold" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold">AI scheduling assistant</p>
            <p className="mt-0.5 text-xs text-white/70">{statusLabel} to the live call</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1 text-white/70 transition hover:bg-white/10 hover:text-white"
          aria-label="Close scheduling assistant"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4 p-4">
        <div className="rounded-xl border bg-secondary/25 p-3">
          <div className="flex items-start gap-2">
            <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-brand-dark" />
            <div>
              <p className="text-sm font-semibold text-foreground">{assist.title}</p>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">{assist.body}</p>
              <p className="mt-2 text-xs font-medium text-brand-dark">{assist.cue}</p>
            </div>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Customer cues
          </p>
          <div className="flex flex-wrap gap-2">
            {assist.preferences.length > 0 ? (
              assist.preferences.map((preference) => (
                <Badge key={preference} variant="secondary">
                  {preferenceLabels[preference]}
                </Badge>
              ))
            ) : (
              <span className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
                Listening for schedule constraints
              </span>
            )}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Calendar check
            </p>
            {assist.request && (
              <span className="text-xs text-muted-foreground">
                Requested: {formatDemoTime(assist.request.start)}
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {days.map((day) => (
              <div key={day.key} className="rounded-xl border bg-background p-2">
                <p className="mb-2 text-center text-xs font-semibold text-foreground">{day.label}</p>
                <div className="space-y-1.5">
                  {assist.slots
                    .filter((slot) => demoDateKey(slot.start) === day.key)
                    .map((slot) => {
                      const requested = Boolean(assist.request && sameMinute(slot.start, assist.request.start));
                      const suggested = Boolean(
                        assist.suggestion && sameMinute(slot.start, assist.suggestion.start)
                      );
                      const selected = Boolean(
                        assist.selected && sameMinute(slot.start, new Date(assist.selected.start))
                      );
                      const hasPreference = assist.preferences.length > 0;
                      const fitsPreference = slotFitsPreferences(slot.start, assist.preferences);
                      const preferenceMatch = hasPreference && fitsPreference && slot.status === "open";
                      const preferenceConflict = hasPreference && !fitsPreference;
                      return (
                        <div
                          key={slot.start.toISOString()}
                          className={cn(
                            "rounded-lg border px-2 py-1.5 text-center text-[11px] font-medium",
                            slot.status === "open"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                              : "border-muted bg-muted/55 text-muted-foreground line-through",
                            preferenceMatch &&
                              "border-brand-gold bg-brand-gold/20 text-brand-dark no-underline",
                            preferenceConflict &&
                              "border-muted bg-muted/45 text-muted-foreground opacity-45 no-underline",
                            requested && "border-red-300 bg-red-50 text-red-800 line-through",
                            suggested && "border-brand-gold bg-brand-gold/20 text-brand-dark no-underline",
                            selected && "border-brand-dark bg-brand-dark text-white no-underline"
                          )}
                        >
                          <span className="block">{formatDemoTime(slot.start)}</span>
                          {requested && <span className="block text-[10px]">asked</span>}
                          {preferenceMatch && !requested && !suggested && !selected && (
                            <span className="block text-[10px]">matches</span>
                          )}
                          {suggested && <span className="block text-[10px]">try this</span>}
                          {selected && <span className="block text-[10px]">selected</span>}
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {assist.selected && (
          <div className="rounded-xl border border-brand-gold bg-brand-gold/15 px-3 py-2 text-sm font-medium text-brand-dark">
            Booking ready for Save lead: {assist.selected.label}
          </div>
        )}
      </div>
    </div>
  );
}
