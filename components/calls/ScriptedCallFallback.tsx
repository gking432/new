"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ScriptedScenario } from "@/lib/calls/scriptedScenarios";

/**
 * Click-through call mode used when Realtime voice is unavailable. The AI
 * lines are prewritten; the user picks the customer's replies. The parent
 * collects the transcript exactly like a live call.
 */
export function ScriptedCallFallback({
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
  const [stepIndex, setStepIndex] = useState(0);
  const [waitingForAi, setWaitingForAi] = useState(true);
  const spokenRef = useRef(-1);

  const step = scenario.steps[stepIndex];

  // Speak the AI line for the current step (once), with a natural delay.
  useEffect(() => {
    if (!step || spokenRef.current >= stepIndex) return;
    spokenRef.current = stepIndex;
    setWaitingForAi(true);
    const t = setTimeout(
      () => {
        onAiLine(step.ai);
        setWaitingForAi(false);
        if (step.options.length === 0) {
          // Closing line — end the call shortly after.
          setTimeout(onComplete, 2000);
        }
      },
      stepIndex === 0 ? 900 : 1300
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, step]);

  if (!step) return null;

  return (
    <div className="mt-3 border-t pt-3">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {waitingForAi
          ? "AI assistant is speaking…"
          : step.options.length > 0
            ? "Choose the customer's reply"
            : "Wrapping up…"}
      </p>
      <div className="flex flex-col gap-1.5">
        {!waitingForAi &&
          step.options.map((option) => (
            <Button
              key={option}
              variant="outline"
              size="sm"
              className="h-auto justify-start whitespace-normal py-2 text-left font-normal"
              onClick={() => {
                onCustomerLine(option);
                setStepIndex((i) => i + 1);
              }}
            >
              &ldquo;{option}&rdquo;
            </Button>
          ))}
      </div>
    </div>
  );
}
