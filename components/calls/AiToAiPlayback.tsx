"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Volume2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ScriptedScenario } from "@/lib/calls/scriptedScenarios";
import { cancelSpeech, pickTwoVoices, speak, type TtsVoice } from "@/lib/tts";

/**
 * Auto-plays an AI-to-AI call: the assistant and the customer are BOTH AI,
 * each voiced with a distinct browser voice (used for the existing-customer
 * callback, where Sarah is also AI). The human just watches; the transcript is
 * built exactly like any other call so the post-call pipeline is unchanged.
 */
export function AiToAiPlayback({
  scenario,
  onAiLine,
  onCustomerLine,
  onComplete,
}: {
  scenario: ScriptedScenario;
  onAiLine: (text: string) => void;
  onCustomerLine: (text: string) => void;
  onComplete: () => void;
}) {
  const [speaker, setSpeaker] = useState<"agent" | "customer" | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    let cancelled = false;

    async function run() {
      const voices = await pickTwoVoices();
      const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

      for (const step of scenario.steps) {
        if (cancelled) return;
        setSpeaker("agent");
        onAiLine(step.ai);
        await speakLine(step.ai, voices.agent, cancelled);
        if (cancelled) return;

        // The customer's reply = the first scripted option (no human choosing).
        const customerLine = step.options[0];
        if (customerLine) {
          await pause(350);
          if (cancelled) return;
          setSpeaker("customer");
          onCustomerLine(customerLine);
          await speakLine(customerLine, voices.customer, cancelled);
          await pause(250);
        }
      }
      if (!cancelled) {
        setSpeaker(null);
        await pause(500);
        onComplete();
      }
    }

    void run();
    return () => {
      cancelled = true;
      cancelSpeech();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mt-3 flex items-center gap-2 rounded-md border bg-secondary/40 px-3 py-2 text-xs">
      <Badge variant="secondary" className="gap-1 text-[10px]">
        <Bot className="h-3 w-3" />
        AI ↔ AI
      </Badge>
      {speaker ? (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Volume2 className="h-3.5 w-3.5 animate-pulse text-primary" />
          {speaker === "agent" ? "Assistant speaking…" : "Sarah speaking…"}
        </span>
      ) : (
        <span className="text-muted-foreground">Wrapping up…</span>
      )}
    </div>
  );
}

async function speakLine(text: string, voice: TtsVoice, cancelled: boolean) {
  if (cancelled) return;
  await speak(text, voice);
}
