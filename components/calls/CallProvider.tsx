"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  GripHorizontal,
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CompleteCallResult } from "@/lib/calls/completeCall";
import { appendDemoEvent } from "@/lib/demo-log";
import { useRingtone } from "@/lib/ringtone";
import { cn } from "@/lib/utils";
import type { CallScenario } from "@/types/app";
import { AiToAiPlayback } from "./AiToAiPlayback";
import { TranscriptBubble, extractLiveFields } from "./CallShared";
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
  }, []);

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
    liveAiText,
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

  // Ring while the call is incoming/dialing.
  useRingtone(phase === "incoming" || phase === "dialing");

  // AI-answered calls don't get a "here's what the AI did" popup — the lead
  // record is already open and refreshed. Show a brief toast, make sure we're
  // on the (now-populated) lead, then close the window.
  useEffect(() => {
    if (phase !== "done") return;
    toast.success("Call complete — lead, notes, and next steps are updated");
    const leadId = result?.leadId;
    if (leadId) router.push(`/app/leads/${leadId}`);
    const t = setTimeout(onClose, 1800);
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

  const [expanded, setExpanded] = useState(true);
  const transcriptBoxRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    transcriptBoxRef.current?.scrollTo({ top: 99999, behavior: "smooth" });
  }, [turns, liveAiText]);

  const timer = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

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

  // ── Connected / processing / done / failed: floating draggable window ───
  if (!pos) return null;
  return (
    <div
      ref={windowRef}
      className="fixed z-50 w-[360px] max-w-[calc(100vw-16px)] overflow-hidden rounded-xl border bg-card shadow-2xl"
      style={{ left: pos.x, top: pos.y }}
    >
      <audio ref={audioRef} autoPlay className="hidden" />

      {/* Drag handle / header */}
      <div
        className={cn(
          "flex cursor-grab touch-none items-center gap-2 px-3 py-2 active:cursor-grabbing",
          phase === "connected" ? "bg-brand-dark text-white" : "bg-secondary"
        )}
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
      >
        {phase === "connected" ? (
          <>
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
            <span className="text-xs font-bold uppercase tracking-widest">Live call</span>
          </>
        ) : (
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {phase === "processing" ? "Wrapping up…" : phase === "done" ? "Call complete" : "Call"}
          </span>
        )}
        <span className={cn("min-w-0 flex-1 truncate text-sm", phase === "connected" ? "text-white/80" : "text-foreground")}>
          {options.callerName}
          {phase === "connected" && <span className="ml-2 tabular-nums text-white/60">{timer}</span>}
        </span>
        <GripHorizontal className={cn("h-4 w-4", phase === "connected" ? "text-white/40" : "text-muted-foreground")} />
        <button
          type="button"
          className={cn(
            "rounded p-0.5",
            phase === "connected" ? "text-white/60 hover:text-white" : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
        {phase !== "connected" && phase !== "processing" && (
          <button
            type="button"
            className="rounded p-0.5 text-muted-foreground hover:text-foreground"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Connected controls */}
      {phase === "connected" && (
        <div className="flex items-center gap-2 border-b bg-brand-dark/95 px-3 pb-2.5 pt-1">
          <div className="flex h-6 flex-1 items-center gap-0.5 overflow-hidden">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
              <span
                key={i}
                className={cn(
                  "call-wave-bar w-0.5 rounded-full",
                  aiSpeaking ? "bg-emerald-400" : "bg-white/25"
                )}
                style={{
                  height: `${[8, 13, 18, 22, 18, 13, 8, 13, 18, 22, 18, 13][i]}px`,
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
          {mode !== "scripted" && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-white/80 hover:bg-white/10 hover:text-white"
              onClick={toggleMute}
              title={muted ? "Unmute" : "Mute"}
            >
              {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
          )}
          {options.leadId && (
            <Button asChild size="sm" variant="secondary" className="h-8">
              <Link href={`/app/leads/${options.leadId}`}>Open lead</Link>
            </Button>
          )}
          <Button
            size="icon"
            className="h-8 w-8 bg-red-500 text-white hover:bg-red-600"
            onClick={() => void endCall()}
            title="End call"
          >
            <PhoneOff className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Body */}
      {expanded && (
        <div className="max-h-[55vh] overflow-y-auto p-3">
          {phase === "connected" && (
            <>
              {mode === "scripted" && (
                <div className="mb-2 space-y-1.5">
                  <Badge variant="secondary" className="text-[10px]">
                    Scripted demo mode
                  </Badge>
                  {realtimeError && (
                    <p className="flex items-start gap-1.5 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Live AI voice unavailable: {realtimeError}
                    </p>
                  )}
                </div>
              )}
              <div ref={transcriptBoxRef} className="max-h-44 space-y-2 overflow-y-auto pr-1">
                {turns.map((turn, i) => (
                  <TranscriptBubble key={i} turn={turn} />
                ))}
                {liveAiText && <TranscriptBubble turn={{ speaker: "ai", text: liveAiText }} live />}
                {turns.length === 0 && !liveAiText && (
                  <p className="text-xs text-muted-foreground">
                    {mode === "scripted"
                      ? "Pick the customer's lines below."
                      : "Speak after the assistant greets you…"}
                  </p>
                )}
              </div>
              {mode === "scripted" && session && options.scenario === "existing_customer_call" ? (
                /* Existing-customer callback is AI ↔ AI: the assistant and the
                   customer are both voiced (distinct voices), auto-playing. */
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
              ) : mode === "scripted" && session ? (
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
              ) : null}
              <LiveCaptured turns={turns} seed={session?.scripted.seedFields} speaker={customerSpeaker} />
            </>
          )}

          {phase === "processing" && (
            <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Updating the lead record, notes, and next steps…
            </p>
          )}

          {/* AI-answered calls get no result panel — the lead record is already
              open and refreshed. A brief toast confirms, then the window closes. */}
          {phase === "done" && (
            <p className="flex items-center gap-2 py-4 text-sm text-status-success">
              <Loader2 className="h-4 w-4 animate-spin" />
              Call complete — opening the updated lead…
            </p>
          )}

          {phase === "failed" && (
            <div className="space-y-2 py-2">
              <p className="text-sm text-red-600">{error ?? "Call failed."}</p>
              <Button size="sm" variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Live "info captured so far" list shown under the transcript during a call. */
function LiveCaptured({
  turns,
  seed,
  speaker = "customer",
}: {
  turns: Parameters<typeof extractLiveFields>[0];
  seed?: Record<string, string | null>;
  speaker?: "ai" | "customer";
}) {
  const fields = extractLiveFields(turns, seed, speaker);
  const entries = Object.entries(fields);
  if (entries.length === 0) return null;
  return (
    <div className="mt-3 rounded-lg border bg-secondary/40 p-2.5">
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Captured so far → filling the CRM
      </p>
      <dl className="space-y-0.5 text-xs">
        {entries.map(([key, value]) => (
          <div key={key} className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{key}</dt>
            <dd className="text-right font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
