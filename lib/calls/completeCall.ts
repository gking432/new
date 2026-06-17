import type { SupabaseClient } from "@supabase/supabase-js";
import { analyzeAndSaveLead } from "@/lib/ai/analyzeLead";
import { summarizeCall } from "@/lib/ai/summarizeCall";
import type { CallSummaryOutput } from "@/lib/ai/callSchemas";
import {
  getAvailableSlots,
  resolveAppointmentTime,
  slotLabel,
} from "@/lib/integrations/calendar/internalCalendar";
import { scheduleAppointmentReminders } from "@/lib/communications/reminders";
import { customerServiceLabel } from "@/lib/utils/statuses";
import type { Call, Lead, TranscriptTurn } from "@/types/app";

export interface CompleteCallInput {
  callId: string;
  transcriptTurns: TranscriptTurn[];
  durationSeconds: number;
  mode: "realtime" | "scripted_fallback";
  /** "customer" = the AI played the homeowner; flip transcript roles for the summary. */
  aiRole?: "agent" | "customer";
  /** Ground-truth facts from a scripted scenario, if any. */
  seedFields?: Record<string, string | null>;
  /** Save transcript + summary only; the intake form creates the CRM record. */
  deferLeadCreation?: boolean;
}

export interface CompleteCallResult {
  callId: string;
  leadId: string | null;
  leadCreated: boolean;
  /** True when the UI simulated the conversation without creating a call row. */
  simulatedOnly?: boolean;
  /** True when the AI never actually made contact (empty/aborted call). */
  failedContact: boolean;
  summary: CallSummaryOutput | null;
  aiStatus: "completed" | "fallback" | "failed";
  appointment: { id: string; start_time: string; label: string } | null;
  deferredLeadCreation?: boolean;
  pendingAppointmentStartTime?: string | null;
  pendingAppointmentLabel?: string | null;
  tasksCreated: number;
  confirmationDraftId: string | null;
}

async function findSalesRep(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("id, role")
    .order("role")
    .limit(20);
  const rep = (data ?? []).find((p) => p.role === "sales_rep") ?? (data ?? [])[0];
  return rep?.id ?? null;
}

function turnsToText(turns: TranscriptTurn[], aiRole: "agent" | "customer" = "agent") {
  // The summarizer always extracts the CUSTOMER's info, so label the homeowner's
  // lines "Customer". Normally that's the human ("customer" speaker); in
  // you-answer-an-AI-customer mode the homeowner is the "ai" speaker, so flip.
  return turns
    .filter((t) => t.speaker !== "system")
    .map((t) => {
      const isCustomer = aiRole === "customer" ? t.speaker === "ai" : t.speaker === "customer";
      return `${isCustomer ? "Customer" : "Agent"}: ${t.text}`;
    })
    .join("\n");
}

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 7 ? digits.slice(-10) : null;
}

type ExtractedFields = CallSummaryOutput["extracted_fields"] & {
  street_address?: string | null;
  state?: string | null;
  zip_code?: string | null;
};

function clean(value: string | null | undefined) {
  const text = value?.trim();
  return text ? text : null;
}

function seedValue(seed: Record<string, string | null> | undefined, ...keys: string[]) {
  if (!seed) return null;
  for (const key of keys) {
    const value = clean(seed[key]);
    if (value) return value;
  }
  return null;
}

function extractEmail(text: string) {
  const direct = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0]?.replace(/[.,;:]+$/, "");
  if (direct) return direct;
  const spoken = text.match(
    /([a-z0-9.\s-]+?)\s+at\s+([a-z0-9\s-]+?)\s+dot\s+(com|net|org|co|edu|io|us)\b/i
  );
  if (!spoken) return null;
  const user = spoken[1].replace(/\s+dot\s+/gi, ".").replace(/\s+/g, "").toLowerCase();
  const domain = spoken[2].replace(/\s+/g, "").toLowerCase();
  return `${user}@${domain}.${spoken[3].toLowerCase()}`;
}

const SPOKEN_DIGITS: Record<string, string> = {
  zero: "0",
  oh: "0",
  o: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
};

function extractPhone(text: string) {
  const direct = text.match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/)?.[0];
  if (direct) return direct;
  const words = text
    .toLowerCase()
    .match(/\b(zero|oh|o|one|two|three|four|five|six|seven|eight|nine)\b/g);
  const digits = words?.map((word) => SPOKEN_DIGITS[word]).join("") ?? "";
  return digits.length >= 10 ? digits.slice(-10) : null;
}

function formatNameCandidate(value: string | null | undefined) {
  if (!value) return null;
  const cleaned = value
    .replace(/^(?:sure|yeah|yes|yep|okay|ok|hi|hello|hey)[,.\s]+/i, "")
    .replace(/^(?:my name(?:\s+is|'?s|s)?|name(?:\s+is|'?s)?|it'?s|this is|i'?m|i am)\s+/i, "")
    .split(/[,.]/)[0]
    .replace(/\b(?:speaking|here|calling)\b.*$/i, "")
    .replace(/\b(?:my|the)?\s*(?:phone|number|cell|email|address)\b.*$/i, "")
    .trim();
  const words = cleaned.match(/[a-z]+(?:['-][a-z]+)?/gi) ?? [];
  const filtered = words.filter(
    (word) =>
      !/^(the|a|an|and|my|name|names|phone|number|cell|email|address|storm|damage|roof|leak|water|lakeview|court|street|avenue|drive|road|wisconsin|pewaukee)$/i.test(
        word
      )
  );
  if (filtered.length < 1 || filtered.length > 3) return null;
  return filtered
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function splitFormattedName(name: string | null) {
  if (!name) return { first: null, last: null };
  const [first, ...rest] = name.split(/\s+/).filter(Boolean);
  return {
    first: first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : null,
    last:
      rest.length > 0
        ? rest.map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(" ")
        : null,
  };
}

function cleanNamePart(value: string | null | undefined) {
  const text = clean(value);
  if (!text || /^(name'?s|names|name|new|unknown|caller|homeowner|customer)$/i.test(text))
    return null;
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

function safeGreetingName(value: string | null | undefined) {
  const first = cleanNamePart(value);
  return first && /^(new|unknown|caller|homeowner|customer)$/i.test(first) ? null : first;
}

function splitAddress(
  raw: string | null | undefined,
  hints: { city?: string | null; state?: string | null; zip?: string | null } = {}
) {
  let street = clean(raw);
  let city = clean(hints.city);
  let state = clean(hints.state);
  let zip = clean(hints.zip);
  if (!street) return { street: null, city, state, zip };

  const zipMatch = street.match(/\b\d{5}(?:-\d{4})?\b/);
  if (!zip && zipMatch) zip = zipMatch[0];
  street = street.replace(/\b\d{5}(?:-\d{4})?\b/g, "").trim();

  const stateMatch = street.match(/\b(WI|Wisconsin|MN|Minnesota)\b/i);
  if (!state && stateMatch) {
    state = /^wisconsin$/i.test(stateMatch[1])
      ? "WI"
      : /^minnesota$/i.test(stateMatch[1])
        ? "MN"
        : stateMatch[1].toUpperCase();
  }
  street = street.replace(/\b(WI|Wisconsin|MN|Minnesota)\b/gi, "").trim();

  const inCity = street.match(/\s+\bin\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s*$/);
  if (!city && inCity) city = inCity[1];
  if (inCity) street = street.slice(0, inCity.index).trim();

  const parts = street
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length > 1) {
    street = parts[0];
    if (!city) city = parts[1];
  }

  const suffixPattern =
    "(?:Lane|Ln|Street|St|Avenue|Ave|Drive|Dr|Court|Ct|Road|Rd|Way|Place|Pl|Boulevard|Blvd|Circle|Cir)";
  const trailingCity = street.match(
    new RegExp(`\\b${suffixPattern}\\s+([a-z]+(?:\\s+[a-z]+)?)$`, "i")
  );
  if (!city && trailingCity) {
    city = trailingCity[1]
      .split(/\s+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");
    street = street.replace(
      new RegExp(`\\b(${suffixPattern})\\s+[a-z]+(?:\\s+[a-z]+)?$`, "i"),
      "$1"
    );
  }

  return {
    street: clean(street),
    city,
    state,
    zip,
  };
}

function extractCityFromTranscript(text: string) {
  const explicit =
    text.match(/\bin\s+([a-z]+(?:\s+[a-z]+)?)\s*,?\s*(?:wisconsin|wi|minnesota|mn)\b/i) ||
    text.match(/\b([a-z]+(?:\s+[a-z]+)?)\s*,\s*(?:wisconsin|wi|minnesota|mn)\b/i) ||
    text.match(/\b(?:city(?:\s+is|'s)?|located in|over in|out in)\s+([a-z]+(?:\s+[a-z]+)?)/i) ||
    text.match(/\b(?:i'?m|i am|we'?re|we are)\s+in\s+([a-z]+(?:\s+[a-z]+)?)/i);
  const city = explicit?.[1]?.trim();
  const cleaned = city
    ?.replace(/\b(?:and|but|with|near|by|for|about|because|the|a|an)\b.*$/i, "")
    .trim();
  if (!cleaned || /^(the|a|an|my|your|our|street|road|drive|court|avenue)$/i.test(cleaned)) {
    return null;
  }
  return cleaned
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function extractNameFromTranscript(text: string) {
  const lines = text.split("\n");
  const splitName = text.match(
    /\bfirst name(?: is|'s)?\s+([a-z]+)\b[\s\S]{0,80}?\blast name(?: is|'s)?\s+([a-z]+)\b/i
  );
  if (splitName) {
    return {
      first: splitName[1].charAt(0).toUpperCase() + splitName[1].slice(1).toLowerCase(),
      last: splitName[2].charAt(0).toUpperCase() + splitName[2].slice(1).toLowerCase(),
    };
  }
  const afterQuestion = lines
    .map((line, index) => {
      if (!line.startsWith("Customer:")) return null;
      const previous = [...lines.slice(0, index)].reverse().find((entry) => !entry.startsWith("System:"));
      if (
        previous?.startsWith("Agent:") &&
        /\b(name|who am i speaking|who is this|who'?s calling)\b/i.test(previous)
      ) {
        return formatNameCandidate(line.replace(/^Customer:\s*/i, ""));
      }
      return null;
    })
    .find(Boolean);
  if (afterQuestion) {
    const [first, ...rest] = afterQuestion.split(/\s+/);
    return { first, last: rest.join(" ") };
  }

  const intro = text.match(
    /Customer:\s*(?:hi|hello|hey|sure|yeah|yes|yep|okay|ok)?[,.\s]*(?:this is|i'?m|i am|my name(?:\s+is|'?s|s)?|name(?:\s+is|'?s|s)?|it'?s)\s+([a-z]+(?:\s+[a-z]+){0,2})/i
  );
  if (!intro) {
    const standalone = lines
      .map((line) =>
        formatNameCandidate(
          line.match(
            /^Customer:\s*(?:sure,?\s*|yeah,?\s*|yes,?\s*)?([a-z]+(?:\s+[a-z]+){1,2})(?:\s+(?:speaking|here))?[,.!?\s]*$/i
          )?.[1]
        )
      )
      .find(Boolean);
    if (!standalone) {
      return { first: null, last: null };
    }
    const [first, ...rest] = standalone.split(/\s+/);
    return {
      first: first.charAt(0).toUpperCase() + first.slice(1).toLowerCase(),
      last: rest.map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(" "),
    };
  }
  const raw = intro[1];
  if (/\b(getting|going|happening|calling|checking|hoping|looking)\b/i.test(raw)) {
    return { first: null, last: null };
  }
  return splitFormattedName(formatNameCandidate(raw));
}

function normalizeExtractedFields(
  rawFields: CallSummaryOutput["extracted_fields"],
  seedFields: Record<string, string | null> | undefined,
  transcriptText: string,
  existingLead: Lead | null
): ExtractedFields {
  const fields = rawFields as ExtractedFields;
  const transcriptName = extractNameFromTranscript(transcriptText);
  const rawFieldFirst = clean(fields.first_name);
  const invalidFieldFirst =
    !rawFieldFirst || /^(name'?s|names|name|new|unknown|caller|homeowner|customer)$/i.test(rawFieldFirst);
  const fieldFirst = invalidFieldFirst ? null : cleanNamePart(rawFieldFirst);
  const fieldLast = invalidFieldFirst ? null : cleanNamePart(fields.last_name);
  const phoneCandidate =
    clean(fields.phone) ??
    seedValue(seedFields, "phone") ??
    existingLead?.phone ??
    extractPhone(transcriptText);
  const streetSource =
    clean(fields.address) ??
    clean(fields.street_address) ??
    seedValue(seedFields, "street_address", "address") ??
    existingLead?.street_address ??
    transcriptText.match(
      /\d+\s+[A-Z][\w]*(?:\s+[A-Z][\w]*)*\s+(?:Lane|Ln|Street|St|Avenue|Ave|Drive|Dr|Court|Ct|Road|Rd|Way|Place|Pl|Boulevard|Blvd|Circle|Cir)\b[^.,?!]*/i
    )?.[0] ??
    null;
  const split = splitAddress(streetSource, {
    city:
      clean(fields.city) ??
      seedValue(seedFields, "city") ??
      existingLead?.city ??
      extractCityFromTranscript(transcriptText),
    state: clean(fields.state) ?? seedValue(seedFields, "state") ?? existingLead?.state,
    zip: clean(fields.zip_code) ?? seedValue(seedFields, "zip_code", "zip") ?? existingLead?.zip_code,
  });

  return {
    ...fields,
    first_name:
      fieldFirst ??
      seedValue(seedFields, "first_name") ??
      existingLead?.first_name ??
      transcriptName.first,
    last_name:
      fieldLast ??
      seedValue(seedFields, "last_name") ??
      existingLead?.last_name ??
      transcriptName.last,
    email:
      clean(fields.email) ??
      seedValue(seedFields, "email") ??
      existingLead?.email ??
      extractEmail(transcriptText),
    phone: phoneCandidate ?? normalizePhone(phoneCandidate) ?? null,
    address: split.street,
    city: split.city,
    state: split.state,
    zip_code: split.zip,
    active_leak:
      clean(fields.active_leak) ??
      seedValue(seedFields, "active_leak") ??
      (/water (spot|stain|coming in|is dripping|dripping)|active leak|leaking/i.test(transcriptText) ? "yes" : null),
    insurance_started:
      clean(fields.insurance_started) ?? seedValue(seedFields, "insurance_started") ?? null,
    preferred_contact_method:
      clean(fields.preferred_contact_method) ??
      seedValue(seedFields, "preferred_contact_method") ??
      null,
  };
}

function isAppointmentAcceptance(text: string) {
  return /\b(yes|yeah|yep|that works|works for me|sounds good|perfect|great|ok|okay|let'?s do it|that'?s fine|that would work|that will work)\b/i.test(
    text
  );
}

function extractTimePhrase(text: string) {
  const normalized = text
    .replace(/\b(oh|o)\b(?=\s*\d)/gi, "0")
    .replace(/\b(\d{1,2})\s+(\d{2})\b/g, "$1:$2");
  const dayWords =
    "(?:today|tomorrow|next\\s+(?:week\\s+)?(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)|sunday|monday|tuesday|wednesday|thursday|friday|saturday)";
  const time =
    "(?:(?:at|around|about|by|for)\\s*)?(?:\\d{1,2}:\\d{2}|\\d{3,4}|\\d{1,2}\\s*(?:am|pm))\\s*(?:am|pm)?|(?:at|around|about|by|for)\\s*\\d{1,2}\\s*(?:am|pm)?";
  const patterns = [
    new RegExp(`\\b${dayWords}\\b[^.?!\\n]{0,80}?\\b${time}\\b`, "i"),
    new RegExp(`\\b${time}\\b[^.?!\\n]{0,50}?\\b${dayWords}\\b`, "i"),
    /\b(?:at|around|about|by|for)?\s*(?:\d{1,2}:\d{2}|\d{3,4}|\d{1,2}\s*(?:am|pm))\s*(?:am|pm)?\b/i,
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern)?.[0]?.trim();
    if (match) return match;
  }
  return null;
}

function extractAcceptedAppointmentRequest(
  turns: TranscriptTurn[],
  aiRole: "agent" | "customer" = "agent"
) {
  const customerSpeaker = aiRole === "customer" ? "ai" : "customer";
  const agentSpeaker = aiRole === "customer" ? "customer" : "ai";
  const usable = turns.filter((turn) => turn.speaker !== "system" && turn.text.trim());
  let acceptedAgentOffer: string | null = null;
  let acceptedCustomerOffer: string | null = null;

  for (let index = 0; index < usable.length; index += 1) {
    const turn = usable[index];
    const phrase = extractTimePhrase(turn.text);
    if (!phrase) continue;
    const hasDay = /\b(today|tomorrow|next\s+(?:week\s+)?(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i.test(
      phrase
    );
    const recentDayContext = hasDay
      ? null
      : [...usable.slice(Math.max(0, index - 4), index)]
          .reverse()
          .map((previous) =>
            previous.text.match(
              /\b(today|tomorrow|next\s+(?:week\s+)?(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i
            )?.[0]
          )
          .find(Boolean);
    const contextualPhrase = recentDayContext ? `${recentDayContext} ${phrase}` : phrase;

    if (turn.speaker === agentSpeaker) {
      const accepted = usable
        .slice(index + 1, index + 5)
        .some((next) => next.speaker === customerSpeaker && isAppointmentAcceptance(next.text));
      if (accepted) acceptedAgentOffer = contextualPhrase;
    } else if (turn.speaker === customerSpeaker) {
      const accepted = usable
        .slice(index + 1, index + 5)
        .some((next) => next.speaker === agentSpeaker && isAppointmentAcceptance(next.text));
      if (accepted) acceptedCustomerOffer = contextualPhrase;
    }
  }

  return acceptedAgentOffer ?? acceptedCustomerOffer;
}

function extractAppointmentRequest(
  summaryTime: string | null,
  transcriptText: string,
  seedFields: Record<string, string | null> | undefined,
  turns: TranscriptTurn[] = [],
  aiRole: "agent" | "customer" = "agent"
) {
  const accepted = extractAcceptedAppointmentRequest(turns, aiRole);
  if (accepted) return accepted;

  const direct = clean(summaryTime);
  if (direct) return direct;

  const lines = transcriptText
    .split("\n")
    .filter((line) => /appointment|inspection|schedule|book|available|works|reschedule|move/i.test(line));
  const searchText = `${lines.join(" ")} ${transcriptText}`;
  return (
    searchText.match(
      /\b(?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)?[^.?!\n]{0,60}\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i
    )?.[0]?.trim() ??
    searchText.match(
      /\b(?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)[^.?!\n]{0,80}\b\d{1,2}(?::\d{2})?\b/i
    )?.[0]?.trim() ??
    searchText.match(
      /\b(?:available|opening|works|book|schedule|inspection|appointment|let'?s do|that works)[^.?!\n]{0,80}\b\d{1,2}(?::\d{2})?\b/i
    )?.[0]?.trim() ??
    searchText.match(
      /\b\d{1,2}(?::\d{2})?\b[^.?!\n]{0,80}\b(?:available|opening|works|book|schedule|inspection|appointment|let'?s do|that works)\b/i
    )?.[0]?.trim() ??
    seedValue(seedFields, "appointment_time")
  );
}

/**
 * Removes any sentence that states a scheduled day/time from an AI summary so
 * the canonical booked-slot label is the ONLY time mentioned in the CRM note.
 * Without this the model's own prose ("…scheduled for next Monday at 11 AM…")
 * can contradict the slot we actually booked in the very same paragraph.
 */
function stripScheduledTimeSentences(text: string) {
  return text
    .replace(
      /[^.?!]*\b(?:schedul\w*|appointment|inspection|book\w*|set (?:up|for)|slot|come out|stop by)\b[^.?!]*\b(?:a\.?m\.?|p\.?m\.?|o'?clock|noon|morning|afternoon|evening|today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week)\b[^.?!]*[.?!]\s*/gi,
      " "
    )
    .replace(/\s{2,}/g, " ")
    .trim();
}

function confirmationBody(firstName: string | null | undefined, startTime: string | null) {
  const when = startTime ? slotLabel(new Date(startTime)) : "the scheduled time";
  const greetingName = safeGreetingName(firstName);
  return `Hi${greetingName ? ` ${greetingName}` : " there"}, your appointment is confirmed for ${when}. If you need to reschedule, reply to this message.`;
}

async function completeSatisfiedCallTasks(
  supabase: SupabaseClient,
  leadId: string,
  args: { appointmentBooked: boolean; confirmationDrafted: boolean; callId: string }
) {
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, status")
    .eq("lead_id", leadId)
    .in("status", ["open", "in_progress"])
    .limit(100);

  const doneIds = (tasks ?? [])
    .filter((task) => {
      const title = String(task.title ?? "").toLowerCase();
      if (title.includes("texted") || title.includes("email")) return false;
      if (args.appointmentBooked && /call|storm|leak|speed-to-lead|request/.test(title)) {
        return true;
      }
      if (args.confirmationDrafted && /confirm|confirmation|follow up/.test(title)) {
        return true;
      }
      return false;
    })
    .map((task) => task.id);

  if (doneIds.length === 0) return 0;
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("tasks")
    .update({ status: "complete", completed_at: now, updated_at: now })
    .in("id", doneIds);
  if (error) return 0;

  await supabase.from("activities").insert({
    lead_id: leadId,
    type: "task_created",
    title: `${doneIds.length} task${doneIds.length === 1 ? "" : "s"} completed by AI call workflow`,
    description:
      "The call handled the requested follow-up, appointment, or confirmation work, so matching open tasks were closed.",
    metadata: { call_id: args.callId, completed_task_ids: doneIds },
  });
  return doneIds.length;
}

async function completePreAppointmentCallTasks(
  supabase: SupabaseClient,
  leadId: string
) {
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, type, status")
    .eq("lead_id", leadId)
    .in("status", ["open", "in_progress"])
    .limit(100);

  const doneIds = (tasks ?? [])
    .filter((task) => {
      const title = String(task.title ?? "").toLowerCase();
      if (/confirm|confirmation|sms|text|approval/.test(title)) return false;
      return task.type === "call" || /call|request|lead|speed-to-lead|urgent/.test(title);
    })
    .map((task) => task.id);

  if (doneIds.length === 0) return 0;
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("tasks")
    .update({ status: "complete", completed_at: now, updated_at: now })
    .in("id", doneIds);
  return error ? 0 : doneIds.length;
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

  const transcriptText = turnsToText(input.transcriptTurns, input.aiRole);
  const endedAt = new Date().toISOString();

  // Did the customer actually say anything? Scripted/AI-to-AI calls always
  // "happened" (the script IS the conversation). For a live Realtime call we
  // require real customer turns — otherwise the call failed (no mic, aborted,
  // no answer) and we must NEVER fabricate data from seeds.
  const customerSpeaker = input.aiRole === "customer" ? "ai" : "customer";
  const customerTurns = input.transcriptTurns.filter(
    (t) => t.speaker === customerSpeaker && t.text.trim().length > 2
  ).length;
  const hadContact = input.mode === "scripted_fallback" || customerTurns >= 2;

  await supabase
    .from("calls")
    .update({
      status: !hadContact ? "failed" : input.mode === "scripted_fallback" ? "scripted_fallback" : "completed",
      ended_at: endedAt,
      duration_seconds: Math.max(1, Math.round(input.durationSeconds)),
      updated_at: endedAt,
    })
    .eq("id", input.callId);

  await supabase.from("call_transcripts").insert({
    call_id: input.callId,
    transcript_text: transcriptText || "(no conversation captured — contact unsuccessful)",
    transcript_json: input.transcriptTurns,
    storage_visibility: "hidden",
  });

  if (!hadContact) {
    return handleFailedContact(supabase, call, lead, endedAt);
  }

  // Only scripted/fallback calls use seed facts. Realtime calls are summarized
  // only from the transcript, so the CRM never invents a caller profile.
  const seedFields = input.mode === "scripted_fallback" ? input.seedFields : undefined;

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
          seedFields,
        });

  await supabase
    .from("calls")
    .update({ ai_status: aiStatus === "completed" ? "completed" : "fallback" })
    .eq("id", input.callId);

  // ── Create or update the lead ──────────────────────────────────────────────
  let leadCreated = false;
  const fields = normalizeExtractedFields(summary.extracted_fields, seedFields, transcriptText, lead);
  summary.extracted_fields = fields;

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
    const transcriptName = extractNameFromTranscript(transcriptText);
    if (transcriptName.first) return { first: transcriptName.first, last: transcriptName.last ?? "" };
    return { first: "Unknown", last: "Caller" };
  }
  const resolvedName = resolveCallerName();

  const requestedAppointment = extractAppointmentRequest(
    summary.appointment_time,
    transcriptText,
    seedFields,
    input.transcriptTurns,
    input.aiRole
  );
  const slots =
    summary.appointment_requested || requestedAppointment
      ? await getAvailableSlots(supabase, 21, 160)
      : [];
  const resolvedRequestedSlot = requestedAppointment
    ? resolveAppointmentTime(requestedAppointment, slots)
    : null;

  if (input.deferLeadCreation) {
    const pendingAppointment = resolvedRequestedSlot
      ? {
          start_time: resolvedRequestedSlot.start.toISOString(),
          label: slotLabel(resolvedRequestedSlot.start),
        }
      : null;
    if (pendingAppointment) {
      summary.appointment_requested = true;
      summary.appointment_time = pendingAppointment.start_time;
      summary.next_action = `Save the lead, then review and send the confirmation SMS for ${pendingAppointment.label}.`;
      summary.crm_note = `${stripScheduledTimeSentences(summary.summary).replace(/[.?!]\s*$/, "")}. Inspection discussed for ${pendingAppointment.label}.`;
      summary.recommended_tasks = [
        {
          title: "Review and send appointment confirmation",
          description: `Review the AI-drafted SMS confirming the inspection for ${pendingAppointment.label}, then send it from the Approval Queue.`,
          priority: fields.active_leak === "yes" ? "high" : "medium",
          due_in_minutes: 5,
        },
      ];
    }

    await supabase.from("call_summaries").insert({
      call_id: input.callId,
      lead_id: null,
      summary: summary.summary,
      crm_note: summary.crm_note,
      customer_intent: summary.customer_intent,
      service_type: summary.service_type,
      urgency: summary.urgency,
      lead_quality: summary.lead_quality,
      next_action: summary.next_action,
      appointment_requested: summary.appointment_requested,
      appointment_time: pendingAppointment?.start_time ?? null,
      objections: summary.objections,
      extracted_fields: summary.extracted_fields,
      recommended_tasks: summary.recommended_tasks,
      raw_output: summary,
    });

    return {
      callId: input.callId,
      leadId: null,
      leadCreated: false,
      failedContact: false,
      summary,
      aiStatus,
      appointment: null,
      deferredLeadCreation: true,
      pendingAppointmentStartTime: pendingAppointment?.start_time ?? null,
      pendingAppointmentLabel: pendingAppointment?.label ?? null,
      tasksCreated: 0,
      confirmationDraftId: null,
    };
  }

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
        state: fields.state,
        zip_code: fields.zip_code,
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
        state: fields.state,
        zip_code: fields.zip_code,
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
        title:
          input.aiRole === "customer"
            ? "Lead created from rep-assisted phone call"
            : "Lead created from AI-handled phone call",
        description:
          input.aiRole === "customer"
            ? "Created from a live inbound call while the AI listened, filled the form, and drafted CRM notes."
            : "Created automatically from an inbound call answered by the AI intake assistant.",
        metadata: { call_id: input.callId },
      });
    }
  } else if (lead) {
    const updates: Record<string, unknown> = { updated_at: endedAt };
    const hasPlaceholderName =
      /^(new|unknown)$/i.test(lead.first_name) && /^caller$/i.test(lead.last_name);
    if (fields.first_name && hasPlaceholderName) updates.first_name = fields.first_name;
    if (fields.last_name && hasPlaceholderName) updates.last_name = fields.last_name;
    if (fields.email && !lead.email) updates.email = fields.email;
    if (fields.phone && !lead.phone) updates.phone = fields.phone;
    if (fields.address && !lead.street_address) updates.street_address = fields.address;
    if (fields.city && !lead.city) updates.city = fields.city;
    if (fields.state && !lead.state) updates.state = fields.state;
    if (fields.zip_code && !lead.zip_code) updates.zip_code = fields.zip_code;
    if (fields.active_leak && lead.active_leak !== "yes") updates.active_leak = fields.active_leak;
    if (fields.insurance_started && !lead.insurance_started)
      updates.insurance_started = fields.insurance_started;
    if (summary.urgency === "emergency" && lead.urgency !== "emergency")
      updates.urgency = "emergency";
    if (lead.stage === "new") updates.stage = "contacted";
    await supabase.from("leads").update(updates).eq("id", lead.id);
    lead = { ...lead, ...updates } as Lead;
  }

  // ── Appointment ────────────────────────────────────────────────────────────
  let appointment: CompleteCallResult["appointment"] = null;
  if ((summary.appointment_requested || requestedAppointment) && lead) {
    const slot = resolvedRequestedSlot ?? (requestedAppointment ? resolveAppointmentTime(requestedAppointment, slots) : null);
    if (slot) {
      const { data: existingAppt } =
        call.scenario === "existing_customer_call"
          ? await supabase
              .from("appointments")
              .select("id, start_time, end_time, status")
              .eq("lead_id", lead.id)
              .in("status", ["scheduled", "confirmed", "rescheduled"])
              .gte("start_time", new Date().toISOString())
              .order("start_time", { ascending: true })
              .limit(1)
              .maybeSingle()
          : { data: null };

      const previousStart = existingAppt?.start_time ?? null;
      const { data: appt } = existingAppt
        ? await supabase
            .from("appointments")
            .update({
              start_time: slot.start.toISOString(),
              end_time: slot.end.toISOString(),
              status: "rescheduled",
              source: "ai_call",
              updated_at: endedAt,
            })
            .eq("id", existingAppt.id)
            .select("id, start_time")
            .single()
        : await supabase
            .from("appointments")
            .insert({
              lead_id: lead.id,
              title: `${customerServiceLabel(summary.service_type).toLowerCase()} inspection — ${lead.first_name} ${lead.last_name}`,
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
        lead = { ...lead, stage: "appointment_scheduled", updated_at: endedAt } as Lead;
        await supabase.from("activities").insert({
          lead_id: lead.id,
          type: "appointment",
          title: existingAppt
            ? `Inspection moved by AI call assistant: ${slotLabel(slot.start)}`
            : `Inspection booked by AI call assistant: ${slotLabel(slot.start)}`,
          description:
            existingAppt && previousStart
              ? `Previous appointment: ${slotLabel(new Date(previousStart))}.`
              : null,
          metadata: {
            call_id: input.callId,
            appointment_id: appt.id,
            rescheduled: Boolean(existingAppt),
            previous_start_time: previousStart,
          },
        });
        await scheduleAppointmentReminders(supabase, {
          lead: {
            id: lead.id,
            first_name: lead.first_name,
            service_type: lead.service_type,
            phone: fields.phone ?? lead.phone,
          },
          appointmentId: appt.id,
          startTime: appt.start_time,
          source: existingAppt ? "reschedule" : "ai_call",
        });
        await completePreAppointmentCallTasks(supabase, lead.id);
      }
    }
  }

  if (appointment && lead) {
    const fullLeadName = `${lead.first_name} ${lead.last_name}`.trim();
    const customerName =
      fullLeadName && !/^new caller$/i.test(fullLeadName) ? fullLeadName : "the customer";
    const nextAction = `Inspection is scheduled for ${appointment.label}. Review and send the confirmation SMS, then prep the inspector with the call notes.`;
    const baseSummary = stripScheduledTimeSentences(
      summary.summary
        .replace(/They are open to scheduling an inspection\.?/gi, "")
        .replace(/An inspection was tentatively set for[^.]+\.?/gi, "")
        .replace(/Recommended next step:\s*Call back within 15 minutes[^.]*\.?/gi, "")
    );
    const summaryBase = (
      baseSummary || `${customerName} called about ${customerServiceLabel(summary.service_type).toLowerCase()} work`
    ).replace(/[.?!]\s*$/, "");
    summary.summary = `${summaryBase}. Inspection scheduled for ${appointment.label}.`;
    summary.crm_note = `${summary.summary} Next step: ${nextAction}`;
    summary.next_action = nextAction;
    summary.appointment_requested = true;
    summary.appointment_time = appointment.start_time;
    summary.recommended_tasks = [
      {
        title: "Review and send appointment confirmation",
        description:
          `Review the AI-drafted SMS confirming ${customerName}'s inspection for ${appointment.label}, then send it from the Approval Queue.`,
        priority: fields.active_leak === "yes" ? "high" : "medium",
        due_in_minutes: 5,
      },
    ];
    await supabase
      .from("leads")
      .update({
        description: summary.summary,
        urgency: summary.urgency,
        lead_quality: summary.lead_quality,
        service_type: summary.service_type,
        active_leak: fields.active_leak ?? lead.active_leak,
        updated_at: endedAt,
      })
      .eq("id", lead.id);
    lead = {
      ...lead,
      description: summary.summary,
      urgency: summary.urgency,
      lead_quality: summary.lead_quality,
      service_type: summary.service_type,
      active_leak: fields.active_leak ?? lead.active_leak,
      updated_at: endedAt,
    } as Lead;
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
      title:
        input.aiRole === "customer"
          ? "AI-assisted call note saved"
          : `AI call ${call.direction === "outbound" ? "placed" : "handled"} (${call.scenario.replace(/_/g, " ")})`,
      description: summary.crm_note,
      // Sort just after the "lead created" entry from the same execution.
      created_at: new Date(Date.now() + 1500).toISOString(),
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
      type: /sms|text|confirmation/i.test(`${task.title} ${task.description}`) ? "sms" : "call",
      priority: task.priority,
      status: "open",
      due_at: new Date(Date.now() + task.due_in_minutes * 60_000).toISOString(),
    });
    if (!error) tasksCreated += 1;
  }

  if (lead) {
    try {
      await analyzeAndSaveLead(supabase, {
        ...lead,
        email: fields.email ?? lead.email,
        phone: fields.phone ?? lead.phone,
        street_address: fields.address ?? lead.street_address,
        city: fields.city ?? lead.city,
        state: fields.state ?? lead.state,
        zip_code: fields.zip_code ?? lead.zip_code,
        service_type: summary.service_type,
        description: summary.summary || lead.description,
        active_leak: fields.active_leak ?? lead.active_leak,
        insurance_started: fields.insurance_started ?? lead.insurance_started,
        urgency: summary.urgency,
        lead_quality: summary.lead_quality,
        stage: appointment ? "appointment_scheduled" : lead.stage,
      } as Lead, appointment
        ? { createTasks: false, forceHeuristic: true, statusOverride: "completed" }
        : undefined);
    } catch (error) {
      console.error("Post-call lead analysis failed:", error);
    }
  }

  // The call lives in the Calls tab and on the lead timeline — it is NOT an
  // inbox conversation. Only the outbound confirmation draft goes to the inbox
  // for human approval. Use SMS whenever we have a phone number; otherwise
  // fall back to email.
  let confirmationDraftId: string | null = null;
  if (summary.confirmation_message_draft || appointment) {
    const channel = lead?.phone ?? fields.phone ?? call.caller_phone ? "sms" : "email";
    const body = appointment
      ? confirmationBody(lead?.first_name ?? fields.first_name, appointment.start_time)
      : summary.confirmation_message_draft;
    const { data: draft } = await supabase
      .from("communications")
      .insert({
        lead_id: lead?.id ?? null,
        call_id: input.callId,
        channel,
        direction: "outbound",
        status: "draft",
        from_value: "Northstar Exterior & Home",
        to_value:
          channel === "email"
            ? (lead?.email ?? fields.email ?? null)
            : (lead?.phone ?? fields.phone ?? null),
        subject: "Appointment confirmation",
        body,
        ai_generated: true,
        human_approved: false,
      })
      .select("id")
      .single();
    confirmationDraftId = draft?.id ?? null;
  }

  if (lead && !appointment) {
    await completeSatisfiedCallTasks(supabase, lead.id, {
      appointmentBooked: Boolean(appointment),
      confirmationDrafted: Boolean(confirmationDraftId),
      callId: input.callId,
    });
  }

  return {
    callId: input.callId,
    leadId: lead?.id ?? null,
    leadCreated,
    failedContact: false,
    summary,
    aiStatus,
    appointment,
    tasksCreated,
    confirmationDraftId,
  };
}

/**
 * The AI never actually reached the customer (call aborted, no mic, no answer).
 * We do NOT invent any data. Instead we flag it loudly: an urgent call-back
 * task assigned to a sales rep, and a clear timeline note. A real lead's data
 * is left untouched; a brand-new caller becomes a minimal "needs follow-up"
 * lead built only from the caller ID we actually have.
 */
async function handleFailedContact(
  supabase: SupabaseClient,
  call: Call,
  existingLead: Lead | null,
  endedAt: string
): Promise<CompleteCallResult> {
  await supabase.from("calls").update({ ai_status: "failed" }).eq("id", call.id);

  const rep = await findSalesRep(supabase);
  let lead = existingLead;
  let leadId = lead?.id ?? null;
  let leadCreated = false;

  // For an inbound call with no existing record, capture the caller ID we have
  // (phone, and name only if it isn't a placeholder) so the lead isn't lost.
  if (!lead && call.scenario === "new_inbound_call" && call.caller_phone) {
    const existing = await findExistingLead(supabase, call.caller_phone);
    if (existing) {
      lead = existing;
      leadId = existing.id;
      await supabase.from("calls").update({ lead_id: existing.id }).eq("id", call.id);
    } else {
      const raw = call.caller_name?.trim() ?? "";
      const real = raw && !["unknown caller", "homeowner", ""].includes(raw.toLowerCase());
      const [first, ...rest] = (real ? raw : "Missed Call").split(/\s+/);
      const { data: newLead } = await supabase
        .from("leads")
        .insert({
          first_name: first,
          last_name: rest.join(" "),
          phone: call.caller_phone,
          source: "phone_call",
          stage: "new",
          urgency: "emergency",
          lead_quality: "warm",
          ai_status: "failed",
          description:
            "Inbound call where the AI assistant could not complete intake (no contact was made). Needs immediate manual follow-up — no details were captured.",
          assigned_to: rep,
        })
        .select("id")
        .single();
      if (newLead) {
        leadId = newLead.id;
        leadCreated = true;
        await supabase.from("calls").update({ lead_id: newLead.id }).eq("id", call.id);
      }
    }
  }

  const who =
    call.direction === "outbound"
      ? (call.callee_name ?? "the homeowner")
      : (call.caller_name && call.caller_name.toLowerCase() !== "unknown caller"
          ? call.caller_name
          : "the caller");

  await supabase.from("tasks").insert({
    lead_id: leadId,
    assigned_to: rep,
    title: `URGENT: AI couldn't reach ${who} — call back now`,
    description:
      "The AI scheduling assistant was unable to make contact — the call ended before any information was gathered. Follow up immediately by phone so we don't lose this lead.",
    type: "call",
    priority: "urgent",
    status: "open",
    due_at: new Date(Date.now() + 5 * 60_000).toISOString(),
  });

  if (leadId) {
    await supabase
      .from("leads")
      .update({ assigned_to: rep, urgency: "emergency", updated_at: endedAt })
      .eq("id", leadId);
    await supabase.from("activities").insert({
      lead_id: leadId,
      type: "ai_call",
      title: "AI call — contact unsuccessful",
      description:
        "The AI scheduling assistant could not reach the customer. Flagged urgent and assigned to a sales rep for immediate manual follow-up. No information was captured on this attempt.",
      metadata: { call_id: call.id, failed: true },
    });
  }

  return {
    callId: call.id,
    leadId,
    leadCreated,
    failedContact: true,
    summary: null,
    aiStatus: "failed",
    appointment: null,
    tasksCreated: 1,
    confirmationDraftId: null,
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
