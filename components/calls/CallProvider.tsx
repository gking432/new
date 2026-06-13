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
import { GripHorizontal, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import type { CompleteCallResult } from "@/lib/calls/completeCall";
import { appendDemoEvent } from "@/lib/demo-log";
import { useRingtone } from "@/lib/ringtone";
import type { CallScenario } from "@/types/app";
import { AiToAiPlayback } from "./AiToAiPlayback";
import { extractLiveFields } from "./CallShared";
import { MockPhoneFrame, type PhoneFrameState } from "./MockPhoneFrame";
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
  onFinished?: (result: CompleteCallResult) => void;
}

interface CallContextValue {
  startCall: (options: StartCallOptions) => void;
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

  const startCall = useCallback((options: StartCallOptions) => {
    runCounter.current += 1;
    setCall({ ...options, runId: runCounter.current });
    // Let the guided tour advance off "a call started" (used by the
    // cross-tab speed-to-lead handoff).
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("northstar-call-started"));
    }
  }, []);

  // Cross-tab speed-to-lead handoff: when the user submits the public request
  // form in a separate tab, that tab broadcasts here and the AI call starts on
  // the dashboard automatically — no manual step back.
  useEffect(() => {
    const handled = new Set<number>();
    const startSpeedToLead = (leadId: string, ts: number) => {
      if (handled.has(ts)) return;
      handled.add(ts);
      startCall({
        scenario: "speed_to_lead_outbound",
        leadId,
        callerName: "Northstar Exterior & Home",
        subtitle: "AI Scheduling Assistant",
        direction: "inbound",
        navigateTo: `/app/leads/${leadId}`,
      });
    };
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
    setLive(null);
  }, []);

  return (
    <CallContext.Provider value={{ startCall, callActive: call !== null }}>
      <LiveCallContext.Provider value={live}>
        {children}
        {call && (
          <ActiveCallWindow key={call.runId} options={call} publish={setLive} onClose={close} />
        )}
      </LiveCallContext.Provider>
    </CallContext.Provider>
  );
}

function ActiveCallWindow({
  options,
  publish,
  onClose,
}: {
  options: StartCallOptions;
  publish: (state: LiveCallState | null) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const persona = options.persona ?? "agent";
  const customerSpeaker = persona === "customer" ? "ai" : "customer";
  const engine = useCallEngine({
    scenario: options.scenario,
    leadId: options.leadId,
    callerName: options.callerName,
    callerPhone: options.callerPhone,
    direction: options.direction,
    persona,
    seedFields: options.seedFields,
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
    muted,
    aiSpeaking,
    result,
    error,
    realtimeError,
    audioRef,
    answer,
    decline,
    endCall,
    toggleMute,
    pushTurn,
    setAiSpeaking,
  } = engine;

  // ── Draggable position ──────────────────────────────────────────────────
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(
    null
  );
  const windowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Default position: top-left corner, below the header.
    if (typeof window !== "undefined") {
      setPos({ x: 16, y: 72 });
    }
  }, []);

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
      extracted: extractLiveFields(turns, session?.scripted.seedFields, customerSpeaker),
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
    } else {
      toast.success("Call complete — lead, notes, and next steps are updated");
    }
    const leadId = result?.leadId;
    if (leadId) router.push(`/app/leads/${leadId}`);
    const t = setTimeout(onClose, result?.failedContact ? 2600 : 1800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const onDragStart = useCallback(
    (e: React.PointerEvent) => {
      if (!pos) return;
      dragRef.current = { startX: e.clientX, startY: e.clientY, baseX: pos.x, baseY: pos.y };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [pos]
  );
  const onDragMove = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const width = windowRef.current?.offsetWidth ?? 360;
    setPos({
      x: Math.min(Math.max(8, drag.baseX + e.clientX - drag.startX), window.innerWidth - width - 8),
      y: Math.min(Math.max(8, drag.baseY + e.clientY - drag.startY), window.innerHeight - 80),
    });
  }, []);
  const onDragEnd = useCallback(() => {
    dragRef.current = null;
  }, []);

  // ── Ringing: full phone frame as a centered overlay ─────────────────────
  if (phase === "incoming" || phase === "dialing" || phase === "connecting") {
    const frameState: PhoneFrameState =
      phase === "incoming" ? "incoming" : phase === "dialing" ? "dialing" : "connecting";
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <audio ref={audioRef} autoPlay className="hidden" />
        <div className="w-full max-w-sm space-y-3">
          {options.crmContext && options.crmContext.length > 0 && (
            <div className="rounded-lg border border-brand-gold/50 bg-amber-50 p-3 shadow-lg">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-dark">
                Matched CRM record
              </p>
              <dl className="mt-1.5 grid gap-x-6 gap-y-0.5 text-sm sm:grid-cols-2">
                {options.crmContext.map((row) => (
                  <div key={row.label} className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{row.label}</dt>
                    <dd className="font-medium capitalize">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          <MockPhoneFrame
            state={frameState}
            name={options.callerName}
            phone={options.callerPhone}
            subtitle={options.subtitle}
            onAnswer={() => void answer()}
            onDecline={() => {
              decline();
              onClose();
            }}
          />
        </div>
      </div>
    );
  }

  // ── Connected / processing / done / failed: a floating, draggable PHONE ──
  // It's literally just the phone. The live transcript + the CRM filling in
  // happen on the lead page behind it.
  if (!pos) return null;
  const frameState: PhoneFrameState =
    phase === "connected" ? "connected" : phase === "failed" ? "failed" : "ended";
  return (
    <div
      ref={windowRef}
      className="fixed z-50 w-[300px] max-w-[calc(100vw-16px)]"
      style={{ left: pos.x, top: pos.y }}
    >
      <audio ref={audioRef} autoPlay className="hidden" />

      {/* Slim drag grip above the phone */}
      <div
        className="flex cursor-grab touch-none items-center justify-center gap-2 rounded-t-2xl bg-black/70 px-3 py-1.5 text-white active:cursor-grabbing"
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
      >
        {phase === "connected" && (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
        )}
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/80">
          {phase === "connected"
            ? "Live call"
            : phase === "processing"
              ? "Wrapping up"
              : phase === "failed"
                ? "Call failed"
                : "Call complete"}
        </span>
        <GripHorizontal className="h-3.5 w-3.5 text-white/40" />
        {(phase === "failed" || phase === "done") && (
          <button
            type="button"
            className="text-white/60 hover:text-white"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="-mt-1">
        <MockPhoneFrame
          state={frameState}
          name={options.callerName}
          phone={options.callerPhone}
          subtitle={options.subtitle}
          seconds={seconds}
          muted={muted}
          aiSpeaking={aiSpeaking}
          showMute={mode !== "scripted"}
          onEnd={() => void endCall()}
          onToggleMute={toggleMute}
        >
          {/* Existing-customer callback is AI ↔ AI (both voiced). */}
          {phase === "connected" &&
            mode === "scripted" &&
            session &&
            options.scenario === "existing_customer_call" && (
              <AiToAiPlayback
                scenario={session.scripted}
                onAiLine={(text) => {
                  pushTurn({ speaker: "ai", text, at: secondsRef.current });
                  setAiSpeaking(true);
                  setTimeout(() => setAiSpeaking(false), 1200);
                }}
                onCustomerLine={(text) =>
                  pushTurn({ speaker: "customer", text, at: secondsRef.current })
                }
                onComplete={() => void endCall(session.scripted.seedFields)}
              />
            )}

          {/* Scripted (no API key) — click the customer's lines. */}
          {phase === "connected" &&
            mode === "scripted" &&
            session &&
            options.scenario !== "existing_customer_call" && (
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

          {phase === "connected" && mode !== "scripted" && realtimeError && (
            <p className="text-center text-[11px] text-amber-300">{realtimeError}</p>
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
        </MockPhoneFrame>
      </div>
    </div>
  );
}
