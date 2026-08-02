"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Loader2,
  MoreHorizontal,
  NotebookPen,
  Phone,
  PhoneOff,
} from "lucide-react";
import { toast } from "sonner";
import type { CompleteCallResult } from "@/lib/calls/completeCall";
import { getDemoInspectionSlots } from "@/lib/actions/appointments";
import { finishCall } from "@/lib/actions/calls";
import { appendDemoEvent } from "@/lib/demo-log";
import { slotLabel } from "@/lib/integrations/calendar/internalCalendar";
import { demoDatePlusDays } from "@/lib/utils/demoTime";
import { useRingtone } from "@/lib/ringtone";
import type { CallScenario } from "@/types/app";
import { extractLiveFields } from "./CallShared";
import { ScriptedCallFallback } from "./ScriptedCallFallback";
import { useCallEngine } from "./useCallEngine";
import type { TranscriptTurn } from "@/types/app";

export interface StartCallOptions {
  scenario: Exclude<CallScenario, "manual_call_note">;
  leadId?: string;
  callerName: string;
  callerPhone?: string | null;
  subtitle?: string | null;
  direction: "inbound" | "outbound";
  // "customer" = the AI plays the homeowner and the human is the company rep.
  persona?: "agent" | "customer";
  seedFields?: Record<string, string | null>;
  crmContext?: { label: string; value: string }[];
  /** Route to navigate to once the call connects (so you can browse the CRM mid-call). */
  navigateTo?: string;
  /** Keep the user on the intake form after the call so the tour can highlight Save Lead. */
  waitForManualLeadOpen?: boolean;
  onFinished?: (result: CompleteCallResult) => void;
}

interface CallContextValue {
  startCall: (options: StartCallOptions) => void;
  simulateRepAssistedCall: () => void;
  simulateCustomerCall: () => Promise<void>;
  callActive: boolean;
}

/** Live call state shared with the rest of the app (the live-fill lead form). */
export interface LiveCallState {
  phase: string;
  scenario: CallScenario;
  persona: "agent" | "customer";
  leadId?: string;
  callerName: string;
  callerPhone?: string | null;
  turns: TranscriptTurn[];
  extracted: Record<string, string>;
  result: CompleteCallResult | null;
}

const CallContext = createContext<CallContextValue | null>(null);
const LiveCallContext = createContext<LiveCallState | null>(null);

export function useCall(): CallContextValue {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall must be used inside CallProvider");
  return ctx;
}

/** Read-only live state of the active call (null when no call). */
export function useLiveCall(): LiveCallState | null {
  return useContext(LiveCallContext);
}

/**
 * App-wide call host. Calls render in a floating window that persists across
 * route navigation — answer a call, get sent to the dashboard, and browse the
 * lead's record while the conversation continues. The window is draggable and
 * shows a LIVE CALL indicator.
 */
export function CallProvider({ children }: { children: React.ReactNode }) {
  const [call, setCall] = useState<(StartCallOptions & { runId: number }) | null>(null);
  const [live, setLive] = useState<LiveCallState | null>(null);
  const runCounter = useRef(0);
  const router = useRouter();

  const startCall = useCallback((options: StartCallOptions) => {
    runCounter.current += 1;
    setLive(null);
    setCall({ ...options, runId: runCounter.current });
    // Let the guided tour advance off "a call started" (used by the
    // cross-tab speed-to-lead handoff).
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("northstar-call-started"));
    }
  }, []);

  const simulateRepAssistedCall = useCallback(() => {
    const appointment = demoDatePlusDays(2, 17, 30);
    const appointmentLabel = slotLabel(appointment);
    const turns: TranscriptTurn[] = [
      {
        speaker: "customer",
        text: "Northstar Exterior and Home, this is the sales team. How can I help?",
        at: 0,
      },
      {
        speaker: "ai",
        text: "Hi, my name is Jordan Avery. We had a storm last night and I have water staining near the upstairs ceiling.",
        at: 2,
      },
      {
        speaker: "customer",
        text: "I can help with that. What is the best phone number, email, and property address?",
        at: 8,
      },
      {
        speaker: "ai",
        text: "The phone number is 414-555-0123. Email is jordan@example.com. The address is 508 Granite Court, Pewaukee, Wisconsin 53072.",
        at: 12,
      },
      {
        speaker: "customer",
        text: `We can inspect it ${appointmentLabel}. Does that work?`,
        at: 20,
      },
      {
        speaker: "ai",
        text: "Yes, that works. Thank you.",
        at: 24,
      },
    ];
    const result: CompleteCallResult = {
      callId: crypto.randomUUID(),
      leadId: null,
      leadCreated: false,
      simulatedOnly: true,
      failedContact: false,
      summary: {
        summary:
          "Jordan Avery called about storm damage with possible active water intrusion. Inspection confirmed.",
        crm_note: `Jordan Avery reported storm damage and possible active water intrusion. Inspection confirmed for ${appointmentLabel}.`,
        customer_intent: "Schedule a storm damage inspection.",
        service_type: "storm_damage",
        urgency: "emergency",
        lead_quality: "hot",
        next_action: `Save the lead, then review and send the confirmation SMS for ${appointmentLabel}.`,
        appointment_requested: true,
        appointment_time: appointment.toISOString(),
        objections: [],
        extracted_fields: {
          first_name: "Jordan",
          last_name: "Avery",
          email: "jordan@example.com",
          phone: "(414) 555-0123",
          address: "508 Granite Court",
          city: "Pewaukee",
          state: "WI",
          zip_code: "53072",
          active_leak: "yes",
          insurance_started: null,
          roof_age: null,
          siding_age: null,
          last_painted: null,
          preferred_contact_method: "text",
        },
        recommended_tasks: [
          {
            title: "Review and send appointment confirmation",
            description: `Review the AI-drafted SMS confirming Jordan's inspection for ${appointmentLabel}.`,
            priority: "high",
            due_in_minutes: 5,
          },
        ],
        confirmation_message_draft: `Hi Jordan, your appointment is confirmed for ${appointmentLabel}. If you need to reschedule, reply to this message.`,
      },
      aiStatus: "completed",
      appointment: null,
      deferredLeadCreation: true,
      pendingAppointmentStartTime: appointment.toISOString(),
      pendingAppointmentLabel: appointmentLabel,
      tasksCreated: 0,
      confirmationDraftId: null,
    };
    setCall(null);
    router.push("/app/leads/new");
    setLive({
      phase: "done",
      scenario: "new_inbound_call",
      persona: "customer",
      callerName: "Unknown Caller",
      callerPhone: "(414) 555-0123",
      turns,
      extracted: extractLiveFields(turns, undefined, "ai"),
      result,
    });
    window.dispatchEvent(new CustomEvent("northstar-call-started"));
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("northstar-call-done"));
    }, 50);
  }, [router]);

  const simulateCustomerCall = useCallback(async () => {
    const activeCall = call;
    if (!activeCall?.leadId || activeCall.scenario !== "speed_to_lead_outbound") {
      toast.error("Open the web lead call before simulating it.");
      return;
    }
    const res = await fetch("/api/realtime/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scenario: activeCall.scenario,
        leadId: activeCall.leadId,
        callerName: activeCall.callerName,
        callerPhone: activeCall.callerPhone ?? undefined,
        persona: activeCall.persona ?? "agent",
        forceScripted: true,
      }),
    });
    if (!res.ok) {
      toast.error("Could not create the simulated call.");
      return;
    }
    const session = (await res.json()) as { call_id: string };
    const slotResult = await getDemoInspectionSlots(10, 6);
    const simulatedSlot = slotResult.success ? slotResult.data[0] : null;
    const simulatedSlotLabel = simulatedSlot?.label ?? "tomorrow at 12 noon";
    const turns: TranscriptTurn[] = [
      {
        speaker: "ai",
        text: "Hi, this is Riley with Northstar Exterior & Home. I'm calling about your request. Did I catch you at an okay time?",
        at: 0,
      },
      {
        speaker: "customer",
        text: "Yeah, now is a great time.",
        at: 4,
      },
      {
        speaker: "ai",
        text: "Great. Tell me what is going on with the project.",
        at: 7,
      },
      {
        speaker: "customer",
        text: "We are flipping a house and it needs new windows, new doors, siding, and a new roof. The roof has holes in it, so that is the top priority.",
        at: 14,
      },
      {
        speaker: "ai",
        text: "That makes sense. Do mornings, afternoons, or evenings generally work best for a free inspection?",
        at: 24,
      },
      {
        speaker: "customer",
        text: "Afternoon is best. What is your next available appointment?",
        at: 30,
      },
      {
        speaker: "ai",
        text: `We have an opening ${simulatedSlotLabel}. Would that work?`,
        at: 35,
      },
      {
        speaker: "customer",
        text: "Yes, that works.",
        at: 41,
      },
      {
        speaker: "ai",
        text: `Perfect, I have you down for ${simulatedSlotLabel}. We will text you a quick confirmation.`,
        at: 44,
      },
      {
        speaker: "customer",
        text: "Great, thank you.",
        at: 49,
      },
    ];
    setCall(null);
    setLive({
      phase: "processing",
      scenario: "speed_to_lead_outbound",
      persona: "agent",
      leadId: activeCall.leadId,
      callerName: activeCall.callerName,
      callerPhone: activeCall.callerPhone,
      turns,
      extracted: extractLiveFields(turns, activeCall.seedFields, "customer"),
      result: null,
    });
    const completed = await finishCall({
      callId: session.call_id,
      transcriptTurns: turns,
      durationSeconds: 58,
      mode: "scripted_fallback",
      aiRole: "agent",
    });
    if (!completed.success) {
      toast.error(completed.error);
      setLive((current) => (current ? { ...current, phase: "failed" } : current));
      return;
    }
    setLive((current) =>
      current
        ? {
            ...current,
            phase: "done",
            leadId: completed.data.leadId ?? current.leadId,
            result: completed.data,
          }
        : current
    );
    window.dispatchEvent(new CustomEvent("northstar-call-done"));
    router.refresh();
    if (completed.data.leadId) router.push(`/app/leads/${completed.data.leadId}`);
  }, [call, router]);

  // Cross-tab speed-to-lead handoff: when the user submits the public request
  // form in a separate tab, that tab broadcasts here and the AI call starts on
  // the dashboard automatically — no manual step back.
  useEffect(() => {
    const handled = new Set<number>();
    const startSpeedToLead = (leadId: string, ts: number) => {
      if (handled.has(ts)) return;
      handled.add(ts);
      try {
        localStorage.removeItem("northstar-demo-speed-to-lead");
      } catch {
        // Storage is only a resilience fallback; the live dashboard path still works without it.
      }
      startCall({
        scenario: "speed_to_lead_outbound",
        leadId,
        callerName: "Northstar Exterior & Home",
        subtitle: "AI Scheduling Assistant",
        direction: "inbound",
        navigateTo: `/app/leads/${leadId}`,
      });
    };
    try {
      const pending = localStorage.getItem("northstar-demo-speed-to-lead");
      if (pending) {
        const data = JSON.parse(pending) as { leadId?: string; ts?: number };
        const timestamp = data.ts ?? Date.now();
        if (data.leadId && Date.now() - timestamp < 2 * 60 * 1000) {
          startSpeedToLead(data.leadId, timestamp);
        } else {
          localStorage.removeItem("northstar-demo-speed-to-lead");
        }
      }
    } catch {
      localStorage.removeItem("northstar-demo-speed-to-lead");
    }
    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      bc = new BroadcastChannel("northstar-demo");
      bc.onmessage = (e) => {
        if (e.data?.type === "speed_to_lead" && e.data.leadId) {
          startSpeedToLead(e.data.leadId, e.data.ts ?? Date.now());
        }
      };
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === "northstar-demo-speed-to-lead" && e.newValue) {
        try {
          const d = JSON.parse(e.newValue);
          if (d.leadId) startSpeedToLead(d.leadId, d.ts ?? Date.now());
        } catch {
          // ignore malformed
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      bc?.close();
      window.removeEventListener("storage", onStorage);
    };
  }, [startCall]);

  const close = useCallback(() => {
    setCall(null);
    setLive((current) => (current?.phase === "done" ? current : null));
  }, []);

  return (
    <CallContext.Provider
      value={{
        startCall,
        simulateRepAssistedCall,
        simulateCustomerCall,
        callActive: call !== null,
      }}
    >
      <LiveCallContext.Provider value={live}>
        {children}
        {call && (
          <ActiveCallWindow
            key={call.runId}
            options={call}
            publish={setLive}
            onClose={close}
            onSimulateCustomerCall={simulateCustomerCall}
          />
        )}
      </LiveCallContext.Provider>
    </CallContext.Provider>
  );
}

function ActiveCallWindow({
  options,
  publish,
  onClose,
  onSimulateCustomerCall,
}: {
  options: StartCallOptions;
  publish: (state: LiveCallState | null) => void;
  onClose: () => void;
  onSimulateCustomerCall?: () => Promise<void>;
}) {
  const router = useRouter();
  const persona = options.persona ?? "agent";
  const customerSpeaker = persona === "customer" ? "ai" : "customer";
  const [notesCollapsed, setNotesCollapsed] = useState(false);
  const engine = useCallEngine({
    scenario: options.scenario,
    leadId: options.leadId,
    callerName: options.callerName,
    callerPhone: options.callerPhone,
    direction: options.direction,
    persona,
    seedFields: options.seedFields,
    deferLeadCreation: Boolean(options.waitForManualLeadOpen),
    onEvent: appendDemoEvent,
    onAnswered: () => {
      if (options.navigateTo) router.push(options.navigateTo);
    },
    onFinished: (result) => {
      options.onFinished?.(result);
      router.refresh();
    },
  });
  const {
    phase,
    mode,
    session,
    turns,
    seconds,
    secondsRef,
    aiSpeaking,
    result,
    error,
    realtimeError,
    audioRef,
    answer,
    decline,
    endCall,
    pushTurn,
    setAiSpeaking,
  } = engine;

  // Publish live state so the live-fill lead form (and anything else) can read it.
  useEffect(() => {
    publish({
      phase,
      scenario: options.scenario,
      persona,
      leadId: options.leadId ?? result?.leadId ?? undefined,
      callerName: options.callerName,
      callerPhone: options.callerPhone,
      turns,
      extracted: extractLiveFields(
        turns,
        options.seedFields ?? session?.seedFields ?? session?.scripted.seedFields,
        customerSpeaker
      ),
      result,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, turns, result]);

  // Let the guided tour know a call resolved (success or failure) so its
  // call steps can advance.
  useEffect(() => {
    if (phase === "done" || phase === "failed") {
      window.dispatchEvent(
        new CustomEvent("northstar-call-done", { detail: { failed: phase === "failed" } })
      );
    }
  }, [phase]);

  // Ring while the call is incoming/dialing.
  useRingtone(phase === "incoming" || phase === "dialing");

  // AI-answered calls don't get a "here's what the AI did" popup — the lead
  // record is already open and refreshed. Show a brief toast, make sure we're
  // on the (now-populated) lead, then close the window.
  useEffect(() => {
    if (phase !== "done") return;
    if (result?.failedContact) {
      toast.error("Contact unsuccessful — flagged URGENT and assigned to a rep for immediate follow-up", {
        duration: 9000,
      });
    }
    const leadId = result?.leadId;
    if (leadId && !options.waitForManualLeadOpen) router.push(`/app/leads/${leadId}`);
    const t = setTimeout(onClose, result?.failedContact ? 2600 : 1800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const extracted = extractLiveFields(
    turns,
    options.seedFields ?? session?.seedFields ?? session?.scripted.seedFields,
    customerSpeaker
  );
  const showCallDetails =
    (phase === "connected" &&
      (mode === "scripted" || persona === "agent" || Boolean(realtimeError))) ||
    phase === "processing" ||
    phase === "done" ||
    phase === "failed";

  return (
    <div className="fixed left-1/2 top-4 z-50 w-[min(620px,calc(100vw-32px))] -translate-x-1/2">
      <audio ref={audioRef} autoPlay className="hidden" />
      {options.crmContext && options.crmContext.length > 0 && phase === "incoming" && (
        <div className="mb-2 rounded-2xl border border-brand-gold/50 bg-amber-50 p-3 text-sm shadow-xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-dark">
            Matched CRM record
          </p>
          <dl className="mt-1.5 grid gap-x-6 gap-y-0.5 sm:grid-cols-2">
            {options.crmContext.map((row) => (
              <div key={row.label} className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className="font-medium capitalize">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      <CallPill
        phase={phase}
        name={options.callerName}
        phone={options.callerPhone}
        subtitle={options.subtitle}
        seconds={seconds}
        aiSpeaking={aiSpeaking}
        onAnswer={() => void answer()}
        onDecline={() => {
          decline();
          onClose();
        }}
        onEnd={() => void endCall()}
        onClose={onClose}
      />

      {options.scenario === "speed_to_lead_outbound" &&
        ["dialing", "incoming", "connecting", "connected"].includes(phase) && (
          <div className="mt-2 flex justify-center">
            <button
              type="button"
              onClick={() => void onSimulateCustomerCall?.()}
              className="rounded-full border border-white/20 bg-zinc-950/90 px-4 py-2 text-xs font-semibold text-white shadow-xl transition hover:bg-zinc-800"
            >
              Simulate call
            </button>
          </div>
        )}

      {showCallDetails && (
        <div className="mt-2 overflow-hidden rounded-2xl border border-white/15 bg-zinc-950/92 p-3 text-white shadow-2xl backdrop-blur">
          {phase === "connected" && mode === "scripted" && session && (
            <ScriptedCallFallback
              scenario={session.scripted}
              onAiLine={(text) => {
                pushTurn({ speaker: "ai", text, at: secondsRef.current });
                setAiSpeaking(true);
                setTimeout(() => setAiSpeaking(false), 1500);
              }}
              onCustomerLine={(text) =>
                pushTurn({ speaker: "customer", text, at: secondsRef.current })
              }
              onComplete={() => void endCall(session.scripted.seedFields)}
            />
          )}

          {phase === "connected" && mode !== "scripted" && persona === "agent" && (
            <div>
              <button
                type="button"
                onClick={() => setNotesCollapsed((current) => !current)}
                className="flex w-full items-center justify-between gap-3 rounded-lg bg-white/10 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-lime-200 transition hover:bg-white/15"
              >
                <span className="flex items-center gap-2">
                  <NotebookPen className="h-3.5 w-3.5" />
                  Live AI notepad
                </span>
                {notesCollapsed ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronUp className="h-4 w-4" />
                )}
              </button>
              {!notesCollapsed && (
                <LiveCallNotes
                  extracted={extracted}
                  turns={turns}
                  customerSpeaker={customerSpeaker}
                />
              )}
            </div>
          )}

          {phase === "connected" && mode !== "scripted" && realtimeError && (
            <p className="mt-2 text-center text-[11px] text-amber-300">{realtimeError}</p>
          )}

          {phase === "processing" && (
            <p className="flex items-center justify-center gap-2 text-xs text-white/70">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Updating the lead…
            </p>
          )}

          {phase === "done" && (
            <p className="text-center text-xs text-white/70">
              {result?.failedContact
                ? "Contact unsuccessful — flagging follow-up…"
                : "Updating the lead…"}
            </p>
          )}

          {phase === "failed" && error && (
            <p className="text-center text-[11px] text-red-300">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}

function CallPill({
  phase,
  name,
  phone,
  subtitle,
  seconds,
  aiSpeaking,
  onAnswer,
  onDecline,
  onEnd,
  onClose,
}: {
  phase: string;
  name: string;
  phone?: string | null;
  subtitle?: string | null;
  seconds: number;
  aiSpeaking: boolean;
  onAnswer: () => void;
  onDecline: () => void;
  onEnd: () => void;
  onClose: () => void;
}) {
  const timer = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";
  const status =
    phase === "incoming"
      ? phone || "Incoming demo call"
      : phase === "dialing"
        ? "Calling..."
        : phase === "connecting"
          ? "Connecting..."
          : phase === "connected"
            ? `${phone ? `${phone} • ` : ""}${timer} • ${subtitle ?? "Demo call"}`
            : phase === "processing"
              ? "Wrapping up..."
              : phase === "failed"
                ? "Call failed"
                : "Call complete";

  return (
    <div className="flex items-center gap-3 rounded-[2rem] border border-white/10 bg-gradient-to-r from-[#143f44] via-[#123b3b] to-[#0d302d] px-4 py-3 text-white shadow-2xl">
      <button
        type="button"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-white/90 transition hover:bg-white/20"
        aria-label="Back"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-slate-700 text-sm font-bold">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-tight">{name}</p>
        <p className="truncate text-xs text-white/70">{status}</p>
      </div>
      <div className="hidden h-6 min-w-24 items-center justify-center gap-0.5 sm:flex">
        {Array.from({ length: 28 }).map((_, index) => (
          <span
            key={index}
            className="call-wave-bar w-0.5 rounded-full bg-lime-300"
            style={{
              height: `${6 + ((index * 7) % 15)}px`,
              animationDelay: `${index * 0.04}s`,
              animationPlayState: aiSpeaking || phase === "connected" ? "running" : "paused",
            }}
          />
        ))}
      </div>
      <button
        type="button"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/20"
        aria-label="More"
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>
      {phase === "incoming" ? (
        <>
          <button
            type="button"
            onClick={onDecline}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-500 text-white transition hover:bg-red-400"
            aria-label="Decline"
          >
            <PhoneOff className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={onAnswer}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-500 text-white transition hover:bg-green-400"
            aria-label="Answer"
          >
            <Phone className="h-5 w-5" />
          </button>
        </>
      ) : phase === "done" || phase === "failed" ? (
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-white/15 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
        >
          Close
        </button>
      ) : (
        <button
          type="button"
          onClick={onEnd}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-500 text-white transition hover:bg-red-400"
          aria-label="End call"
        >
          <PhoneOff className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}

function LiveCallNotes({
  extracted,
  turns,
  customerSpeaker,
}: {
  extracted: Record<string, string>;
  turns: TranscriptTurn[];
  customerSpeaker: "ai" | "customer";
}) {
  const customerText = turns
    .filter((turn) => turn.speaker === customerSpeaker)
    .map((turn) => turn.text)
    .join(" ");
  const notes = [
    extracted.Name && `Customer: ${extracted.Name}`,
    extracted.Phone && `Phone: ${extracted.Phone}`,
    extracted.Email && `Email: ${extracted.Email}`,
    (extracted.Address || extracted.City) &&
      `Property: ${[extracted.Address, extracted.City, extracted.State, extracted.ZIP]
        .filter(Boolean)
        .join(", ")}`,
    extracted.Service && `Project type: ${extracted.Service}`,
    /flip|rental|investment/i.test(customerText) && "Context: investment or flip project.",
    /roof/i.test(customerText) && /hole|leak|water|damage/i.test(customerText)
      ? "Priority: roof may need attention before interior damage worsens."
      : null,
    /cheap|budget|price|cost/i.test(customerText) && "Budget signal: customer is price sensitive.",
    extracted["Active leak"] && `Urgency: ${extracted["Active leak"]}`,
    extracted["Requested appointment"] && `Appointment preference: ${extracted["Requested appointment"]}`,
  ].filter(Boolean) as string[];

  return (
    <div className="mt-2">
      {notes.length > 0 ? (
        <ul className="mt-2 space-y-1.5 text-sm text-white/85">
          {notes.slice(-7).map((note) => (
            <li key={note} className="rounded-lg bg-white/10 px-2.5 py-1.5">
              {note}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-white/65">
          Listening for the customer&apos;s name, contact info, project details, urgency, and appointment preference.
        </p>
      )}
    </div>
  );
}
