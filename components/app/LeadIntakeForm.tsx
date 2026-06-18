"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, CalendarClock, Check, Loader2, PhoneCall, Save, Sparkles } from "lucide-react";
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
import { cn } from "@/lib/utils";
import {
  demoDatePlusDays,
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

const FIVE_THIRTY_RE = /\b(?:5\s*:?\s*30|five[\s-]?thirty)\s*(?:p\.?m\.?)?\b/i;
const FOUR_PM_RE = /\b(?:4\s*(?::00)?|four(?:\s+o'?clock)?)\s*(?:p\.?m\.?)?\b/i;

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

function mentionsTomorrow(text: string) {
  return /\btomorrow\b/i.test(text);
}

function mentionsRecommendedDay(text: string, recommended: Date) {
  const lower = text.toLowerCase();
  const longWeekday = formatDemoDate(recommended, { weekday: "long" }).toLowerCase();
  const shortWeekday = formatDemoDate(recommended, { weekday: "short" }).toLowerCase();
  const monthDay = formatDemoDate(recommended, { month: "long", day: "numeric" }).toLowerCase();
  const shortMonthDay = formatDemoDate(recommended, { month: "short", day: "numeric" }).toLowerCase();

  return (
    /\bday after tomorrow\b/i.test(text) ||
    lower.includes(longWeekday) ||
    lower.includes(shortWeekday) ||
    lower.includes(monthDay) ||
    lower.includes(shortMonthDay)
  );
}

function buildRepSchedulingAssist(turns: TranscriptTurn[]) {
  const tomorrowAt530 = demoDatePlusDays(1, 17, 30);
  const tomorrowAt4 = demoDatePlusDays(1, 16, 0);
  const recommended = demoDatePlusDays(2, 17, 30);
  const repText = turns
    .filter((turn) => turn.speaker === "customer")
    .map((turn) => turn.text)
    .join(" ");

  const askedTomorrow530 = mentionsTomorrow(repText) && FIVE_THIRTY_RE.test(repText);
  const askedTomorrow4 = mentionsTomorrow(repText) && FOUR_PM_RE.test(repText);
  const askedRecommended =
    mentionsRecommendedDay(repText, recommended) && FIVE_THIRTY_RE.test(repText);

  const recommendedLabel = humanSlotLabel(recommended);
  const selected = askedRecommended
    ? {
        start: recommended.toISOString(),
        label: crmSlotLabel(recommended),
      }
    : null;

  if (selected) {
    return {
      status: "ready" as const,
      eyebrow: "AI scheduling assist",
      title: `${recommendedLabel} is open.`,
      body:
        "The AI matched the time you discussed to a real available inspection slot. This is the appointment that will save to the CRM.",
      details: [
        "Jordan works until 5, so evening slots are a better fit.",
        "The confirmation text will use this exact date and time.",
      ],
      selected,
    };
  }

  if (askedTomorrow4) {
    return {
      status: "coach" as const,
      eyebrow: "AI scheduling assist",
      title: `${humanSlotLabel(tomorrowAt4)} is open, but it is probably a bad fit.`,
      body: `Jordan said she works until 5:00, so ask about ${recommendedLabel} instead.`,
      details: [
        "The AI is checking calendar availability and customer constraints at the same time.",
        "Try the later evening opening so the rep does not book a slot the homeowner cannot make.",
      ],
      selected: null,
    };
  }

  if (askedTomorrow530) {
    return {
      status: "conflict" as const,
      eyebrow: "AI scheduling assist",
      title: `${humanSlotLabel(tomorrowAt530)} is not available.`,
      body: `Try ${formatDemoTime(tomorrowAt4)} tomorrow, or ask about ${recommendedLabel}.`,
      details: [
        "The AI caught the conflict while you were still talking.",
        "It is suggesting a real next step instead of making the rep search manually.",
      ],
      selected: null,
    };
  }

  return {
    status: "listening" as const,
    eyebrow: "AI scheduling assist",
    title: "Listening for appointment times.",
    body: `Try asking about 5:30 tomorrow. The AI will check the calendar, flag conflicts, and suggest the next best slot.`,
    details: [
      "This panel is not a manual picker.",
      "It reacts to what the rep says and prepares the correct booking for Save lead.",
    ],
    selected: null,
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
      (live?.result?.summary?.appointment_requested ||
        live?.result?.pendingAppointmentStartTime ||
        live?.extracted?.["Requested appointment"])
  );

  // Caller ID is known as soon as the phone rings. Everything else waits for
  // the conversation and merges with a short delay so it reads like live notes.
  useEffect(() => {
    if (!live?.callerPhone || touched.current.has("phone")) return;
    setFields((prev) => (prev.phone ? prev : { ...prev, phone: live.callerPhone ?? "" }));
  }, [live?.callerPhone]);

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
    const safeSummaryName = /^(name'?s|names|name|new|unknown|caller)\b/i.test(summaryName)
      ? ""
      : summaryName;
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
        if (extractedFields["Name"]) {
          const [f, ...r] = extractedFields["Name"].split(/\s+/);
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
    if (
      schedulingAssist.selected &&
      selectedAppointment?.start !== schedulingAssist.selected.start
    ) {
      setSelectedAppointment(schedulingAssist.selected);
    }
  }, [repAssistedCall, schedulingAssist.selected, selectedAppointment]);

  function update(key: keyof Fields, value: string) {
    touched.current.add(key);
    setFields((p) => ({ ...p, [key]: value }) as Fields);
  }

  const missingRequired = useMemo(() => {
    const req: (keyof Fields)[] = ["first_name", "phone"];
    return req.filter((k) => !fields[k]);
  }, [fields]);

  function save() {
    if (live?.phase === "done" && live.result?.leadId) {
      router.push(`/app/leads/${live.result.leadId}`);
      return;
    }
    if (!fields.first_name) {
      toast.error("At least a name is required");
      return;
    }
    if (appointmentWasDiscussed && !selectedAppointment) {
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
        live?.phase === "done" && !live.result?.simulatedOnly
          ? (live.result?.callId ?? null)
          : null,
      appointment_start_time:
        live?.phase === "done"
          ? (selectedAppointment?.start ??
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
      callActive && missingRequired.includes(key) && "border-red-400 bg-red-50"
    );
  }

  return (
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
        {repAssistedCall && (
          <div
            className={cn(
              "rounded-xl border-2 p-3 shadow-sm transition-colors",
              schedulingAssist.status === "ready" && "border-brand-gold bg-brand-gold/10",
              schedulingAssist.status === "conflict" && "border-amber-300 bg-amber-50",
              schedulingAssist.status === "coach" && "border-blue-300 bg-blue-50",
              schedulingAssist.status === "listening" && "border-primary/25 bg-primary/5"
            )}
            data-tour="rep-assisted-slot-picker"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <CalendarClock className="mt-0.5 h-4 w-4 text-brand-dark" />
                <div>
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-brand-dark">
                    {schedulingAssist.eyebrow}
                    {schedulingAssist.status === "ready" && (
                      <Badge className="bg-brand-dark text-white">Booking ready</Badge>
                    )}
                    {schedulingAssist.status === "conflict" && (
                      <Badge variant="secondary">Conflict found</Badge>
                    )}
                    {schedulingAssist.status === "coach" && (
                      <Badge variant="secondary">Suggestion</Badge>
                    )}
                  </p>
                  <p className="mt-1 text-sm font-medium leading-5 text-brand-dark">
                    {schedulingAssist.title}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-brand-dark/75">
                    {schedulingAssist.body}
                  </p>
                </div>
              </div>
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" />
            </div>
            <ul className="mt-3 space-y-1.5 text-xs leading-5 text-brand-dark/75">
              {schedulingAssist.details.map((detail) => (
                <li key={detail} className="flex gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brand-dark/55" />
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
            {selectedAppointment && (
              <div className="mt-3 rounded-lg border border-brand-dark/15 bg-white/70 px-3 py-2 text-xs font-medium text-brand-dark">
                Selected by AI for Save lead: {selectedAppointment.label}
              </div>
            )}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="First name" required filled={aiFilled.has("first_name")}>
            <Input value={fields.first_name} onChange={(e) => update("first_name", e.target.value)} className={fieldCls("first_name")} />
          </Field>
          <Field label="Last name" filled={aiFilled.has("last_name")}>
            <Input value={fields.last_name} onChange={(e) => update("last_name", e.target.value)} className={fieldCls("last_name")} />
          </Field>
          <Field label="Phone" required filled={aiFilled.has("phone")}>
            <Input value={fields.phone} onChange={(e) => update("phone", e.target.value)} className={fieldCls("phone")} />
          </Field>
          <Field label="Email" filled={aiFilled.has("email")}>
            <Input value={fields.email} onChange={(e) => update("email", e.target.value)} className={fieldCls("email")} />
          </Field>
          <Field label="Street address" filled={aiFilled.has("street_address")}>
            <Input value={fields.street_address} onChange={(e) => update("street_address", e.target.value)} className={fieldCls("street_address")} />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="City" filled={aiFilled.has("city")}>
              <Input value={fields.city} onChange={(e) => update("city", e.target.value)} className={fieldCls("city")} />
            </Field>
            <Field label="State" filled={aiFilled.has("state")}>
              <Input value={fields.state} onChange={(e) => update("state", e.target.value)} className={fieldCls("state")} />
            </Field>
            <Field label="ZIP" filled={aiFilled.has("zip_code")}>
              <Input value={fields.zip_code} onChange={(e) => update("zip_code", e.target.value)} className={fieldCls("zip_code")} />
            </Field>
          </div>
          <Field label="Service" filled={aiFilled.has("service_type")}>
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

        <Field label="Notes / what's going on" filled={aiFilled.has("description")}>
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
  );
}

function Field({
  label,
  required,
  filled,
  children,
}: {
  label: string;
  required?: boolean;
  filled?: boolean;
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
      </Label>
      {children}
    </div>
  );
}
