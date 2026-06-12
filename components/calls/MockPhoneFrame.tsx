"use client";

import { Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/utils/format";

export type PhoneFrameState =
  | "incoming"
  | "dialing"
  | "connecting"
  | "connected"
  | "ended"
  | "failed";

/**
 * A modern phone-call screen rendered in the browser. Purely presentational —
 * the call simulator drives its state. No real phone call is placed.
 */
export function MockPhoneFrame({
  state,
  name,
  phone,
  subtitle,
  seconds = 0,
  muted = false,
  aiSpeaking = false,
  showMute = true,
  onAnswer,
  onDecline,
  onEnd,
  onToggleMute,
  children,
}: {
  state: PhoneFrameState;
  name: string;
  phone?: string | null;
  subtitle?: string | null;
  seconds?: number;
  muted?: boolean;
  aiSpeaking?: boolean;
  showMute?: boolean;
  onAnswer?: () => void;
  onDecline?: () => void;
  onEnd?: () => void;
  onToggleMute?: () => void;
  children?: React.ReactNode;
}) {
  const timer = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const statusLine =
    state === "incoming"
      ? "incoming call…"
      : state === "dialing"
        ? "calling…"
        : state === "connecting"
          ? "connecting…"
          : state === "connected"
            ? timer
            : state === "ended"
              ? "call ended"
              : "call failed";

  return (
    <div className="mx-auto w-full max-w-[340px]">
      <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-gradient-to-b from-[#1c2733] via-[#10181f] to-[#0a0f14] px-6 pb-8 pt-4 text-white shadow-2xl">
        {/* Status bar */}
        <div className="flex items-center justify-between text-[11px] text-white/50">
          <span>
            {new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </span>
          <span className="h-1.5 w-16 rounded-full bg-white/20" />
          <span>Demo Call</span>
        </div>

        {/* Caller identity */}
        <div className="mt-8 flex flex-col items-center text-center">
          <div className="relative">
            {(state === "incoming" || state === "dialing") && (
              <>
                <span className="call-ring-pulse absolute inset-0 rounded-full border-2 border-emerald-400/60" />
                <span
                  className="call-ring-pulse absolute inset-0 rounded-full border-2 border-emerald-400/40"
                  style={{ animationDelay: "0.5s" }}
                />
              </>
            )}
            <div
              className={cn(
                "relative flex h-20 w-20 items-center justify-center rounded-full text-2xl font-semibold",
                state === "connected"
                  ? "bg-emerald-600/30 text-emerald-200 ring-2 ring-emerald-400/40"
                  : "bg-white/10 text-white/90"
              )}
            >
              {initials(name)}
            </div>
          </div>
          <h3 className="mt-4 text-xl font-semibold tracking-tight">{name}</h3>
          {phone ? <p className="mt-0.5 text-sm text-white/60">{phone}</p> : null}
          {subtitle ? (
            <p className="mt-1 rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] text-white/70">
              {subtitle}
            </p>
          ) : null}
          <p
            className={cn(
              "mt-3 text-sm tabular-nums",
              state === "connected" ? "text-emerald-300" : "text-white/50",
              (state === "incoming" || state === "dialing" || state === "connecting") &&
                "animate-pulse"
            )}
          >
            {statusLine}
          </p>
        </div>

        {/* Waveform while connected */}
        <div className="mt-5 flex h-10 items-center justify-center gap-1">
          {state === "connected" ? (
            [0, 1, 2, 3, 4, 5, 6].map((i) => (
              <span
                key={i}
                className={cn(
                  "call-wave-bar w-1 rounded-full",
                  aiSpeaking ? "bg-emerald-400" : "bg-white/25"
                )}
                style={{
                  height: `${[14, 24, 34, 40, 34, 24, 14][i]}px`,
                  animationDelay: `${i * 0.12}s`,
                  animationPlayState: aiSpeaking || !muted ? "running" : "paused",
                }}
              />
            ))
          ) : (
            <span className="h-px w-24 bg-white/10" />
          )}
        </div>

        {/* Inline content (live captions etc.) */}
        {children ? <div className="mt-2">{children}</div> : null}

        {/* Controls */}
        <div className="mt-6 flex items-center justify-center gap-10">
          {state === "incoming" ? (
            <>
              <CallButton color="red" label="Decline" onClick={onDecline}>
                <PhoneOff className="h-6 w-6" />
              </CallButton>
              <CallButton color="green" label="Answer" pulse onClick={onAnswer}>
                <Phone className="h-6 w-6" />
              </CallButton>
            </>
          ) : state === "dialing" || state === "connecting" || state === "connected" ? (
            <>
              {showMute && (
                <CallButton
                  color={muted ? "white" : "gray"}
                  label={muted ? "Unmute" : "Mute"}
                  onClick={onToggleMute}
                >
                  {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </CallButton>
              )}
              <CallButton color="red" label="End" onClick={onEnd}>
                <PhoneOff className="h-6 w-6" />
              </CallButton>
            </>
          ) : null}
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        Demo call — no real phone call is placed.
      </p>
    </div>
  );
}

function CallButton({
  color,
  label,
  pulse = false,
  onClick,
  children,
}: {
  color: "green" | "red" | "gray" | "white";
  label: string;
  pulse?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full transition-transform hover:scale-105 active:scale-95",
          color === "green" && "bg-emerald-500 text-white",
          color === "red" && "bg-red-500 text-white",
          color === "gray" && "bg-white/15 text-white",
          color === "white" && "bg-white text-slate-900",
          pulse && "animate-pulse"
        )}
        aria-label={label}
      >
        {children}
      </button>
      <span className="text-[11px] text-white/60">{label}</span>
    </div>
  );
}
