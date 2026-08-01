"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { finishCall, markCallMissed } from "@/lib/actions/calls";
import type { CompleteCallResult } from "@/lib/calls/completeCall";
import type { ScriptedScenario } from "@/lib/calls/scriptedScenarios";
import type { CallScenario, TranscriptTurn } from "@/types/app";

export type CallPhase =
  | "idle"
  | "incoming"
  | "dialing"
  | "connecting"
  | "connected"
  | "processing"
  | "done"
  | "failed";

export interface SessionResponse {
  call_id: string;
  scenario: string;
  mode: "realtime" | "scripted_fallback";
  max_seconds: number;
  scripted: ScriptedScenario;
  seedFields?: Record<string, string | null>;
  realtime_error?: string;
  client_secret?: string;
  webrtc_url?: string;
  realtime_api?: "ga" | "beta";
  model?: string;
}

export interface CallEngineOptions {
  scenario: Exclude<CallScenario, "manual_call_note">;
  leadId?: string;
  callerName: string;
  callerPhone?: string | null;
  direction: "inbound" | "outbound";
  // "customer" = the AI plays the homeowner and the human is the company rep.
  persona?: "agent" | "customer";
  // Ground-truth facts to seed the summary (used by scripted + AI-customer modes).
  seedFields?: Record<string, string | null>;
  // Rep-assisted intake calls should not create CRM records until the user
  // reviews the live-filled form and clicks Save Lead.
  deferLeadCreation?: boolean;
  onEvent?: (label: string) => void;
  onAnswered?: () => void;
  onFinished?: (result: CompleteCallResult) => void;
}

/**
 * The call engine: owns the Realtime WebRTC connection (or scripted state),
 * the transcript, the timer/cap, and the post-call pipeline call. UI shells
 * (the public success-page panel and the in-app floating call window) render
 * on top of this hook, so a call survives route navigation as long as the
 * component hosting the hook stays mounted.
 */
export function useCallEngine(options: CallEngineOptions) {
  const [phase, setPhase] = useState<CallPhase>(
    options.direction === "inbound" ? "incoming" : "dialing"
  );
  const [mode, setMode] = useState<"realtime" | "scripted" | null>(null);
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [liveAiText, setLiveAiText] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [result, setResult] = useState<CompleteCallResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [realtimeError, setRealtimeError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const callIdRef = useRef<string | null>(null);
  const turnsRef = useRef<TranscriptTurn[]>([]);
  const secondsRef = useRef(0);
  const wrapUpSentRef = useRef(false);
  const endedRef = useRef(false);
  const sessionRef = useRef<SessionResponse | null>(null);
  const modeRef = useRef<"realtime" | "scripted" | null>(null);

  const optionsRef = useRef(options);
  optionsRef.current = options;
  const emit = useCallback((label: string) => optionsRef.current.onEvent?.(label), []);

  const pushTurn = useCallback((turn: TranscriptTurn) => {
    turnsRef.current = [...turnsRef.current, turn];
    setTurns(turnsRef.current);
  }, []);

  const cleanupMedia = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    dcRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
  }, []);

  useEffect(() => () => cleanupMedia(), [cleanupMedia]);

  const sendWrapUp = useCallback(() => {
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
      // Non-fatal: the hard cap ends the call shortly anyway.
    }
  }, []);

  const endCall = useCallback(
    async (scriptedSeed?: Record<string, string | null>) => {
      if (endedRef.current) return;
      endedRef.current = true;
      cleanupMedia();
      setAiSpeaking(false);
      setPhase("processing");
      emit("Call ended — generating transcript, CRM notes, and next steps");

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
        mode: modeRef.current === "scripted" ? "scripted_fallback" : "realtime",
        // When the AI played the homeowner, its lines ARE the customer's.
        aiRole: optionsRef.current.persona === "customer" ? "customer" : "agent",
        // Seed facts are only used for scripted/fallback calls. Realtime calls
        // must be summarized from what was actually said on the call.
        seedFields:
          modeRef.current === "scripted"
            ? (scriptedSeed ??
              optionsRef.current.seedFields ??
              sessionRef.current?.seedFields ??
              sessionRef.current?.scripted.seedFields)
            : undefined,
        deferLeadCreation: optionsRef.current.deferLeadCreation,
      });
      if (!response.success) {
        setPhase("failed");
        setError(response.error);
        return;
      }
      setResult(response.data);
      setPhase("done");
      emit("CRM note created and saved to the lead timeline");
      if (response.data.appointment) emit(`Appointment booked: ${response.data.appointment.label}`);
      if (response.data.tasksCreated > 0)
        emit(`${response.data.tasksCreated} follow-up task(s) created`);
      if (response.data.confirmationDraftId)
        emit("Confirmation message drafted — awaiting human approval");
      optionsRef.current.onFinished?.(response.data);
    },
    [cleanupMedia, emit]
  );

  // Call timer + duration cap.
  useEffect(() => {
    if (phase !== "connected") return;
    const interval = setInterval(() => {
      secondsRef.current += 1;
      setSeconds(secondsRef.current);
      const cap = sessionRef.current?.max_seconds ?? 180;
      if (modeRef.current === "realtime" && secondsRef.current === cap && !wrapUpSentRef.current) {
        wrapUpSentRef.current = true;
        sendWrapUp();
        emit("Demo time cap reached — assistant is wrapping up");
      }
      if (modeRef.current === "realtime" && secondsRef.current >= cap + 25) {
        void endCall();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, sendWrapUp, endCall, emit]);

  const fallbackToScripted = useCallback(
    (reason?: string) => {
      cleanupMedia();
      // The you-answer-an-AI-customer mode needs live voice (a human is on the
      // line). Never fall back to the agent script — fail clearly instead so we
      // don't pretend a conversation happened.
      if (optionsRef.current.persona === "customer") {
        setRealtimeError(reason ?? null);
        setError(
          reason
            ? `Couldn't start live AI voice: ${reason}. Enable your mic and check AI voice status in the Demo Center.`
            : "Live AI voice is required to answer as the rep."
        );
        setPhase("failed");
        return;
      }
      modeRef.current = "scripted";
      setMode("scripted");
      setPhase("connected");
      if (reason) setRealtimeError(reason);
      emit(
        `Realtime voice unavailable — switched to scripted demo mode${reason ? ` (${reason})` : ""}`
      );
    },
    [cleanupMedia, emit]
  );

  const connectRealtime = useCallback(
    async (s: SessionResponse) => {
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
          emit("Live AI voice connected");
          optionsRef.current.onAnswered?.();
          if (optionsRef.current.persona !== "customer") {
            dc.send(JSON.stringify({ type: "response.create" }));
          }
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
                pushTurn({
                  speaker: "customer",
                  text: data.transcript.trim(),
                  at: secondsRef.current,
                });
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
            fallbackToScripted("connection dropped");
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
        if (!sdpResponse.ok) {
          throw new Error(`SDP exchange failed: ${sdpResponse.status}`);
        }
        const answer = { type: "answer" as const, sdp: await sdpResponse.text() };
        await pc.setRemoteDescription(answer);
        modeRef.current = "realtime";
        setMode("realtime");
      } catch (err) {
        console.error("Realtime connection failed:", err);
        fallbackToScripted(err instanceof Error ? err.message : "connection error");
      }
    },
    [emit, fallbackToScripted, pushTurn]
  );

  const answer = useCallback(async () => {
    setPhase("connecting");
    try {
      const opts = optionsRef.current;
      const res = await fetch("/api/realtime/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario: opts.scenario,
          leadId: opts.leadId,
          callerName: opts.callerName,
          callerPhone: opts.callerPhone ?? undefined,
          persona: opts.persona ?? "agent",
          seedFields: opts.seedFields,
        }),
      });
      if (!res.ok) {
        let message = "Session request failed";
        try {
          const payload = (await res.json()) as { error?: string };
          message = payload.error ?? message;
        } catch {
          // Keep the generic message when the server does not return JSON.
        }
        throw new Error(message);
      }
      const s = (await res.json()) as SessionResponse;
      sessionRef.current = s;
      setSession(s);
      callIdRef.current = s.call_id;
      if (s.realtime_error) setRealtimeError(s.realtime_error);
      emit(
        s.mode === "realtime"
          ? "Call answered — connecting live AI voice"
          : `Call answered — running in scripted demo mode${s.realtime_error ? ` (${s.realtime_error})` : ""}`
      );
      if (s.mode === "realtime") {
        await connectRealtime(s);
      } else if (opts.persona === "customer") {
        // You-answer mode needs live voice; don't run the agent script.
        setRealtimeError(s.realtime_error ?? null);
        setError(
          s.realtime_error
            ? `Couldn't start live AI voice: ${s.realtime_error}`
            : "Live AI voice is required to answer as the rep."
        );
        setPhase("failed");
      } else {
        modeRef.current = "scripted";
        setMode("scripted");
        setPhase("connected");
        optionsRef.current.onAnswered?.();
      }
    } catch (err) {
      console.error("Could not start call:", err);
      setError(
        err instanceof Error
          ? `Could not start the call. ${err.message}`
          : "Could not start the call. Check that Supabase is configured."
      );
      setPhase("failed");
    }
  }, [connectRealtime, emit]);

  // Outbound calls "ring" briefly, then auto-answer (the homeowner picks up).
  useEffect(() => {
    if (optionsRef.current.direction === "outbound" && phase === "dialing") {
      const t = setTimeout(() => void answer(), 2600);
      return () => clearTimeout(t);
    }
  }, [phase, answer]);

  const decline = useCallback(() => {
    if (callIdRef.current) void markCallMissed(callIdRef.current);
    setPhase("failed");
    setError("Call declined.");
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((current) => {
      const next = !current;
      streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
      return next;
    });
  }, []);

  return {
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
  };
}

export type CallEngine = ReturnType<typeof useCallEngine>;
