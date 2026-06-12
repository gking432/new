"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, MessageSquareText, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CompleteCallResult } from "@/lib/calls/completeCall";
import type { CallScenario } from "@/types/app";
import { CallResultPanel, TranscriptBubble, extractLiveFields } from "./CallShared";
import { MockPhoneFrame, type PhoneFrameState } from "./MockPhoneFrame";
import { ScriptedCallFallback } from "./ScriptedCallFallback";
import { SmsReceivePanel } from "./SmsReceivePanel";
import { useCallEngine } from "./useCallEngine";

/**
 * Full-panel call experience: phone frame + live transcript + extracted
 * fields, then the result panel. Used on the public success page (in a
 * dialog). Inside the app the floating call window is used instead so calls
 * survive navigation.
 */
export function RealtimeCallSimulator({
  scenario,
  leadId,
  callerName,
  callerPhone,
  subtitle,
  direction,
  audience = "internal",
  keepPhoneOpenAfterCall = false,
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
  /** Keep the phone frame visible after the call to "receive" the follow-up SMS. */
  keepPhoneOpenAfterCall?: boolean;
  onFinished?: (result: CompleteCallResult) => void;
  onEvent?: (label: string) => void;
}) {
  const engine = useCallEngine({
    scenario,
    leadId,
    callerName,
    callerPhone,
    direction,
    onEvent,
    onFinished,
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

  const transcriptBoxRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    transcriptBoxRef.current?.scrollTo({ top: 99999, behavior: "smooth" });
  }, [turns, liveAiText]);

  const [resultForPhone, setResultForPhone] = useState<CompleteCallResult | null>(null);
  useEffect(() => {
    if (result) setResultForPhone(result);
  }, [result]);

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
  const showPhone = phase !== "done" || keepPhoneOpenAfterCall;

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <audio ref={audioRef} autoPlay className="hidden" />

      {showPhone && (
        <div className="shrink-0">
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
            {phase === "done" && keepPhoneOpenAfterCall && resultForPhone?.leadId && (
              <SmsReceivePanel leadId={resultForPhone.leadId} />
            )}
          </MockPhoneFrame>
        </div>
      )}

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
              {mode === "scripted" && realtimeError && (
                <p className="mb-2 flex items-start gap-1.5 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Live AI voice unavailable: {realtimeError}
                </p>
              )}
              <div ref={transcriptBoxRef} className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {turns.map((turn, i) => (
                  <TranscriptBubble key={i} turn={turn} />
                ))}
                {liveAiText && <TranscriptBubble turn={{ speaker: "ai", text: liveAiText }} live />}
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
                    <div key={key} className="flex justify-between gap-3 border-b py-1">
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

      {phase === "done" && result && (
        <div className="min-w-0 flex-1">
          <CallResultPanel result={result} audience={audience} />
        </div>
      )}
    </div>
  );
}
