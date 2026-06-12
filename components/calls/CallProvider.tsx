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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CompleteCallResult } from "@/lib/calls/completeCall";
import { appendDemoEvent } from "@/lib/demo-log";
import { cn } from "@/lib/utils";
import type { CallScenario } from "@/types/app";
import { TranscriptBubble } from "./CallShared";
import { MockPhoneFrame, type PhoneFrameState } from "./MockPhoneFrame";
import { ScriptedCallFallback } from "./ScriptedCallFallback";
import { useCallEngine } from "./useCallEngine";

export interface StartCallOptions {
  scenario: Exclude<CallScenario, "manual_call_note">;
  leadId?: string;
  callerName: string;
  callerPhone?: string | null;
  subtitle?: string | null;
  direction: "inbound" | "outbound";
  crmContext?: { label: string; value: string }[];
  /** Route to navigate to once the call connects (so you can browse the CRM mid-call). */
  navigateTo?: string;
  onFinished?: (result: CompleteCallResult) => void;
}

interface CallContextValue {
  startCall: (options: StartCallOptions) => void;
  callActive: boolean;
}

const CallContext = createContext<CallContextValue | null>(null);

export function useCall(): CallContextValue {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall must be used inside CallProvider");
  return ctx;
}

/**
 * App-wide call host. Calls render in a floating window that persists across
 * route navigation — answer a call, get sent to the dashboard, and browse the
 * lead's record while the conversation continues. The window is draggable and
 * shows a LIVE CALL indicator.
 */
export function CallProvider({ children }: { children: React.ReactNode }) {
  const [call, setCall] = useState<(StartCallOptions & { runId: number }) | null>(null);
  const runCounter = useRef(0);

  const startCall = useCallback((options: StartCallOptions) => {
    runCounter.current += 1;
    setCall({ ...options, runId: runCounter.current });
  }, []);

  return (
    <CallContext.Provider value={{ startCall, callActive: call !== null }}>
      {children}
      {call && (
        <ActiveCallWindow key={call.runId} options={call} onClose={() => setCall(null)} />
      )}
    </CallContext.Provider>
  );
}

function ActiveCallWindow({
  options,
  onClose,
}: {
  options: StartCallOptions;
  onClose: () => void;
}) {
  const router = useRouter();
  const engine = useCallEngine({
    scenario: options.scenario,
    leadId: options.leadId,
    callerName: options.callerName,
    callerPhone: options.callerPhone,
    direction: options.direction,
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
    // Default position: top-right corner, below the header.
    if (typeof window !== "undefined") {
      setPos({ x: Math.max(8, window.innerWidth - 376), y: 72 });
    }
  }, []);

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
              {mode === "scripted" && session && (
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
            </>
          )}

          {phase === "processing" && (
            <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating transcript, CRM notes, and next steps…
            </p>
          )}

          {phase === "done" && result && (
            <div className="space-y-3">
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5">
                <p className="text-[10px] font-medium uppercase tracking-wide text-primary">
                  CRM note saved to the timeline
                </p>
                <p className="mt-1 text-sm">{result.summary.crm_note}</p>
              </div>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {result.leadCreated && <li>• New lead created from the call</li>}
                {result.appointment && <li>• Inspection booked: {result.appointment.label}</li>}
                {result.tasksCreated > 0 && <li>• {result.tasksCreated} follow-up task(s) created</li>}
                {result.confirmationDraftId && <li>• Confirmation draft awaiting approval in the Inbox</li>}
                <li>
                  • Full transcript stored (
                  {result.aiStatus === "completed" ? "AI summary" : "rule-based summary"})
                </li>
              </ul>
              <div className="flex flex-wrap gap-2">
                {result.leadId && (
                  <Button asChild size="sm">
                    <Link href={`/app/leads/${result.leadId}`}>Open lead</Link>
                  </Button>
                )}
                <Button asChild size="sm" variant="outline">
                  <Link href={`/app/calls/${result.callId}`}>Call record</Link>
                </Button>
                <Button size="sm" variant="ghost" onClick={onClose}>
                  Dismiss
                </Button>
              </div>
            </div>
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
