"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  FileText,
  Loader2,
  MessageSquareText,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { finishCall, markCallMissed } from "@/lib/actions/calls";
import type { CompleteCallResult } from "@/lib/calls/completeCall";
import type { ScriptedScenario } from "@/lib/calls/scriptedScenarios";
import { cn } from "@/lib/utils";
import type { CallScenario, TranscriptTurn } from "@/types/app";
import { MockPhoneFrame, type PhoneFrameState } from "./MockPhoneFrame";
import { ScriptedCallFallback } from "./ScriptedCallFallback";

type Phase =
  | "idle"
  | "incoming"
  | "dialing"
  | "connecting"
  | "connected"
  | "processing"
  | "done"
  | "failed";

interface SessionResponse {
  call_id: string;
  scenario: string;
  mode: "realtime" | "scripted_fallback";
  max_seconds: number;
  scripted: ScriptedScenario;
  client_secret?: string;
  webrtc_url?: string;
  realtime_api?: "ga" | "beta";
  model?: string;
}

/**
 * Browser-based AI call simulator. Connects to OpenAI Realtime over WebRTC
 * when configured; otherwise runs the deterministic scripted scenario inside
 * the same phone UI. Either way, ending the call runs the full pipeline:
 * transcript → AI summary → CRM note → lead/appointment/tasks → confirmation
 * draft.
 */
export function RealtimeCallSimulator({
  scenario,
  leadId,
  callerName,
  callerPhone,
  subtitle,
  direction,
  audience = "internal",
  onFinished,
  onEvent,
}: {
  scenario: Exclude<CallScenario, "manual_call_note">;
  leadId?: string;
  callerName: string;
  callerPhone?: string | null;
  subtitle?: string | null;
  direction: "inbound" | "outbound";
  audience?: "internal" | "public";
  onFinished?: (result: CompleteCallResult) => void;
  onEvent?: (label: string) => void;
}) {
  const [phase, setPhase] = useState<Phase>(direction === "inbound" ? "incoming" : "dialing");
  const [mode, setMode] = useState<"realtime" | "scripted" | null>(null);
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [liveAiText, setLiveAiText] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [result, setResult] = useState<CompleteCallResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const callIdRef = useRef<string | null>(null);
  const turnsRef = useRef<TranscriptTurn[]>([]);
  const secondsRef = useRef(0);
  const wrapUpSentRef = useRef(false);
  const endedRef = useRef(false);
  const transcriptBoxRef = useRef<HTMLDivElement | null>(null);
  const eventRef = useRef(onEvent);
  eventRef.current = onEvent;

  const pushTurn = useCallback((turn: TranscriptTurn) => {
    turnsRef.current = [...turnsRef.current, turn];
    setTurns(turnsRef.current);
  }, []);

  // Auto-scroll transcript.
  useEffect(() => {
    transcriptBoxRef.current?.scrollTo({ top: 99999, behavior: "smooth" });
  }, [turns, liveAiText]);

  const cleanupMedia = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
  }, []);

  useEffect(() => () => cleanupMedia(), [cleanupMedia]);

  // Call timer + duration cap.
  useEffect(() => {
    if (phase !== "connected") return;
    const interval = setInterval(() => {
      secondsRef.current += 1;
      setSeconds(secondsRef.current);
      const cap = session?.max_seconds ?? 180;
      if (mode === "realtime" && secondsRef.current === cap && !wrapUpSentRef.current) {
        wrapUpSentRef.current = true;
        sendWrapUp();
        eventRef.current?.("Demo time cap reached — assistant is wrapping up");
      }
      if (mode === "realtime" && secondsRef.current >= cap + 25) {
        void endCall();
      }
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, mode, session?.max_seconds]);

  const dcRef = useRef<RTCDataChannel | null>(null);

  function sendWrapUp() {
    const dc = dcRef.current;
    if (!dc || dc.readyState !== "open") return;
    try {
      dc.send(
        JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "system",
            content: [
              {
                type: "input_text",
                text: 'TIME LIMIT REACHED. Politely end the call now with: "Thanks, I have what I need. Our team will follow up with the next step shortly." Then say goodbye.',
              },
            ],
          },
        })
      );
      dc.send(JSON.stringify({ type: "response.create" }));
    } catch {
      // Non-fatal: the hard cap will end the call shortly anyway.
    }
  }

  const fallbackToScripted = useCallback(() => {
    cleanupMedia();
    setMode("scripted");
    setPhase("connected");
    eventRef.current?.("Realtime voice unavailable — switched to scripted demo mode");
  }, [cleanupMedia]);

  async function connectRealtime(s: SessionResponse) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        if (audioRef.current) {
          audioRef.current.srcObject = event.streams[0];
          void audioRef.current.play().catch(() => undefined);
        }
      };

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;
      const aiBuffer = { text: "" };

      dc.onopen = () => {
        setPhase("connected");
        eventRef.current?.("Live AI voice connected");
        // Kick the assistant to speak first.
        dc.send(JSON.stringify({ type: "response.create" }));
      };

      dc.onmessage = (event) => {
        let data: { type?: string; transcript?: string; delta?: string };
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }
        switch (data.type) {
          case "conversation.item.input_audio_transcription.completed":
            if (data.transcript?.trim()) {
              pushTurn({ speaker: "customer", text: data.transcript.trim(), at: secondsRef.current });
            }
            break;
          case "response.audio_transcript.delta":
          case "response.output_audio_transcript.delta":
            setAiSpeaking(true);
            aiBuffer.text += data.delta ?? "";
            setLiveAiText(aiBuffer.text);
            break;
          case "response.audio_transcript.done":
          case "response.output_audio_transcript.done": {
            const text = (data.transcript ?? aiBuffer.text).trim();
            if (text) pushTurn({ speaker: "ai", text, at: secondsRef.current });
            aiBuffer.text = "";
            setLiveAiText("");
            break;
          }
          case "output_audio_buffer.stopped":
          case "response.done":
            setAiSpeaking(false);
            break;
          default:
            break;
        }
      };

      pc.onconnectionstatechange = () => {
        if (
          (pc.connectionState === "failed" || pc.connectionState === "disconnected") &&
          !endedRef.current &&
          turnsRef.current.length === 0
        ) {
          fallbackToScripted();
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const sdpResponse = await fetch(s.webrtc_url!, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${s.client_secret}`,
          "Content-Type": "application/sdp",
          ...(s.realtime_api === "beta" ? { "OpenAI-Beta": "realtime=v1" } : {}),
        },
        body: offer.sdp,
      });
      if (!sdpResponse.ok) throw new Error(`SDP exchange failed: ${sdpResponse.status}`);
      const answer = { type: "answer" as const, sdp: await sdpResponse.text() };
      await pc.setRemoteDescription(answer);
      setMode("realtime");
    } catch (err) {
      console.error("Realtime connection failed:", err);
      fallbackToScripted();
    }
  }

  async function answer() {
    setPhase("connecting");
    try {
      const res = await fetch("/api/realtime/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario, leadId, callerName, callerPhone }),
      });
      if (!res.ok) throw new Error("Session request failed");
      const s = (await res.json()) as SessionResponse;
      setSession(s);
      callIdRef.current = s.call_id;
      eventRef.current?.(
        s.mode === "realtime"
          ? "Call answered — connecting live AI voice"
          : "Call answered — running in scripted demo mode"
      );
      if (s.mode === "realtime") {
        await connectRealtime(s);
      } else {
        setMode("scripted");
        setPhase("connected");
      }
    } catch (err) {
      console.error("Could not start call:", err);
      setError("Could not start the call. Check that Supabase is configured.");
      setPhase("failed");
    }
  }

  // Outbound calls "ring" briefly, then auto-answer (the homeowner picks up).
  useEffect(() => {
    if (direction === "outbound" && phase === "dialing") {
      const t = setTimeout(() => void answer(), 2600);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direction, phase]);

  async function decline() {
    if (callIdRef.current) void markCallMissed(callIdRef.current);
    setPhase("failed");
    setError("Call declined.");
  }

  async function endCall(scriptedSeed?: Record<string, string | null>) {
    if (endedRef.current) return;
    endedRef.current = true;
    cleanupMedia();
    setAiSpeaking(false);
    setPhase("processing");
    eventRef.current?.("Call ended — generating transcript, CRM notes, and next steps");

    const callId = callIdRef.current;
    if (!callId) {
      setPhase("failed");
      setError("No call record was created.");
      return;
    }
    const response = await finishCall({
      callId,
      transcriptTurns: turnsRef.current.slice(0, 200),
      durationSeconds: secondsRef.current,
      mode: mode === "scripted" ? "scripted_fallback" : "realtime",
      seedFields: scriptedSeed ?? (mode === "scripted" ? session?.scripted.seedFields : undefined),
    });
    if (!response.success) {
      setPhase("failed");
      setError(response.error);
      return;
    }
    setResult(response.data);
    setPhase("done");
    eventRef.current?.("CRM note created and saved to the lead timeline");
    if (response.data.appointment) {
      eventRef.current?.(`Appointment booked: ${response.data.appointment.label}`);
    }
    if (response.data.tasksCreated > 0) {
      eventRef.current?.(`${response.data.tasksCreated} follow-up task(s) created`);
    }
    if (response.data.confirmationDraftId) {
      eventRef.current?.("Confirmation message drafted — awaiting human approval");
    }
    onFinished?.(response.data);
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
  }

  const frameState: PhoneFrameState =
    phase === "incoming"
      ? "incoming"
      : phase === "dialing"
        ? "dialing"
        : phase === "connecting"
          ? "connecting"
          : phase === "connected"
            ? "connected"
            : phase === "failed"
              ? "failed"
              : "ended";

  const extracted = extractLiveFields(turns, session?.scripted.seedFields);

  if (phase === "done" && result) {
    return <CallResultPanel result={result} audience={audience} />;
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <audio ref={audioRef} autoPlay className="hidden" />
      <MockPhoneFrame
        state={frameState}
        name={callerName}
        phone={callerPhone}
        subtitle={subtitle}
        seconds={seconds}
        muted={muted}
        aiSpeaking={aiSpeaking}
        showMute={mode !== "scripted"}
        onAnswer={() => void answer()}
        onDecline={() => void decline()}
        onEnd={() => void endCall()}
        onToggleMute={toggleMute}
      >
        {phase === "processing" && (
          <p className="flex items-center justify-center gap-2 text-xs text-white/60">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Generating CRM notes…
          </p>
        )}
        {phase === "failed" && error && (
          <p className="text-center text-xs text-red-300">{error}</p>
        )}
      </MockPhoneFrame>

      {(phase === "connected" || phase === "processing") && (
        <div className="min-w-0 flex-1 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <MessageSquareText className="h-4 w-4 text-primary" />
                Live transcript
                {mode === "scripted" && (
                  <Badge variant="secondary" className="text-[10px]">
                    Scripted demo mode
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div ref={transcriptBoxRef} className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {turns.map((turn, i) => (
                  <TranscriptBubble key={i} turn={turn} />
                ))}
                {liveAiText && (
                  <TranscriptBubble turn={{ speaker: "ai", text: liveAiText }} live />
                )}
                {turns.length === 0 && !liveAiText && (
                  <p className="text-sm text-muted-foreground">
                    {mode === "scripted"
                      ? "Pick the customer's lines below to play out the call."
                      : "Waiting for the conversation to start… speak after the assistant greets you."}
                  </p>
                )}
              </div>
              {mode === "scripted" && session && phase === "connected" && (
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
            </CardContent>
          </Card>

          {Object.keys(extracted).length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Sparkles className="h-4 w-4 text-brand-gold" />
                  Extracted during call
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                  {Object.entries(extracted).map(([key, value]) => (
                    <div key={key} className="flex justify-between gap-3 border-b py-1 last:border-0 sm:last:border-b">
                      <dt className="text-muted-foreground">{key}</dt>
                      <dd className="text-right font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function TranscriptBubble({ turn, live = false }: { turn: TranscriptTurn; live?: boolean }) {
  const isAi = turn.speaker === "ai";
  return (
    <div className={cn("flex", isAi ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3 py-2 text-sm",
          isAi ? "bg-primary/10 text-foreground" : "bg-secondary",
          live && "opacity-70"
        )}
      >
        <p className="mb-0.5 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {isAi && <Bot className="h-3 w-3" />}
          {isAi ? "AI assistant" : "Customer"}
        </p>
        {turn.text}
      </div>
    </div>
  );
}

/** Lightweight live field extraction for the side panel during a call. */
function extractLiveFields(
  turns: TranscriptTurn[],
  seed?: Record<string, string | null>
): Record<string, string> {
  const customerText = turns
    .filter((t) => t.speaker === "customer")
    .map((t) => t.text)
    .join(" ");
  const all = turns.map((t) => t.text).join(" ");
  const out: Record<string, string> = {};

  const claim = (label: string, value: string | null | undefined) => {
    if (value) out[label] = value;
  };

  if (seed && turns.length > 0) {
    const seenName = turns.length >= 2;
    if (seenName) claim("Name", [seed.first_name, seed.last_name].filter(Boolean).join(" ") || null);
  }
  const phoneMatch = customerText.match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
  claim("Phone", phoneMatch?.[0]);
  const emailMatch = customerText.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  claim("Email", emailMatch?.[0]);
  const addressMatch = customerText.match(
    /\d+\s+[A-Z][\w]*\s+(?:Lane|Ln|Street|St|Avenue|Ave|Drive|Dr|Court|Ct|Road|Rd)\b[^.,]*/i
  );
  claim("Address", addressMatch?.[0]);
  if (/hail|storm|wind/i.test(all)) out["Service"] = "Storm damage / roofing";
  else if (/window/i.test(customerText)) out["Service"] = "Windows";
  if (/water (spot|stain)|leak|dripping/i.test(customerText)) out["Active leak"] = "Likely — flagged urgent";
  if (/insurance/i.test(all)) {
    out["Insurance"] = /haven'?t|not yet|no[,.]?\s/i.test(customerText) ? "Not started" : "Discussed";
  }
  const apptMatch = all.match(/tomorrow[^.?!]*\b(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)?/i);
  claim("Requested appointment", apptMatch?.[0]);
  return out;
}

function CallResultPanel({
  result,
  audience,
}: {
  result: CompleteCallResult;
  audience: "internal" | "public";
}) {
  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CheckCircle2 className="h-5 w-5 text-status-success" />
          Call complete — here&apos;s what the AI did
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-primary">
            <FileText className="h-3.5 w-3.5" />
            CRM note (saved to the timeline)
          </p>
          <p className="mt-1.5 text-sm">{result.summary.crm_note}</p>
        </div>

        <ul className="space-y-2 text-sm">
          {result.leadCreated && (
            <ResultLine icon={Sparkles} text="New lead created from the call" />
          )}
          {result.appointment && (
            <ResultLine
              icon={CalendarCheck}
              text={`Inspection booked: ${result.appointment.label} — lead moved to Appointment Scheduled`}
            />
          )}
          {result.tasksCreated > 0 && (
            <ResultLine
              icon={ClipboardList}
              text={`${result.tasksCreated} follow-up task${result.tasksCreated > 1 ? "s" : ""} created for the team`}
            />
          )}
          {result.confirmationDraftId && (
            <ResultLine
              icon={MessageSquareText}
              text="Confirmation message drafted — waiting for human approval in the Inbox"
            />
          )}
          <ResultLine
            icon={FileText}
            text={`Full transcript stored for reference (${
              result.aiStatus === "completed" ? "AI summary" : "rule-based summary"
            })`}
          />
        </ul>

        {result.summary.next_action && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Recommended next action:</span>{" "}
            {result.summary.next_action}
          </p>
        )}

        {audience === "internal" && result.leadId ? (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button asChild size="sm">
              <Link href={`/app/leads/${result.leadId}`}>
                Open lead
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`/app/calls/${result.callId}`}>View call record</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/app/inbox">Review drafts in Inbox</Link>
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            On the team side, this call just created CRM notes, tasks
            {result.appointment ? ", an appointment," : ""} and a confirmation draft. Log in to the
            Command Center to see it.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ResultLine({
  icon: Icon,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
}) {
  return (
    <li className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <span>{text}</span>
    </li>
  );
}
