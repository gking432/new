"use client";

import { useState } from "react";
import { Phone, PhoneIncoming, PhoneOutgoing } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CompleteCallResult } from "@/lib/calls/completeCall";
import type { CallScenario } from "@/types/app";
import { RealtimeCallSimulator } from "./RealtimeCallSimulator";

/**
 * Button + dialog wrapper around the call simulator. Shows the matched CRM
 * record before answering when context is provided (existing-customer demo).
 */
export function CallLauncher({
  scenario,
  leadId,
  callerName,
  callerPhone,
  subtitle,
  direction,
  buttonLabel,
  buttonVariant = "default",
  buttonSize = "default",
  crmContext,
  onEvent,
  onFinished,
}: {
  scenario: Exclude<CallScenario, "manual_call_note">;
  leadId?: string;
  callerName: string;
  callerPhone?: string | null;
  subtitle?: string | null;
  direction: "inbound" | "outbound";
  buttonLabel: string;
  buttonVariant?: "default" | "outline" | "secondary";
  buttonSize?: "default" | "sm" | "lg";
  crmContext?: { label: string; value: string }[];
  onEvent?: (label: string) => void;
  onFinished?: (result: CompleteCallResult) => void;
}) {
  const [open, setOpen] = useState(false);
  // Remount the simulator each time the dialog opens so every run is fresh.
  const [runKey, setRunKey] = useState(0);

  return (
    <>
      <Button
        variant={buttonVariant}
        size={buttonSize}
        onClick={() => {
          setRunKey((k) => k + 1);
          setOpen(true);
        }}
      >
        {direction === "inbound" ? (
          <PhoneIncoming className="h-4 w-4" />
        ) : (
          <PhoneOutgoing className="h-4 w-4" />
        )}
        {buttonLabel}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" />
              {direction === "inbound" ? "Incoming call" : "Outbound AI call"}
              <Badge variant="secondary" className="text-[10px]">
                Demo — no real phone call placed
              </Badge>
            </DialogTitle>
            <DialogDescription>
              {direction === "inbound"
                ? "The AI assistant answers, gathers details, and writes the CRM notes."
                : "The AI scheduling assistant calls the homeowner moments after their request."}
            </DialogDescription>
          </DialogHeader>

          {crmContext && crmContext.length > 0 && (
            <div className="rounded-lg border border-brand-gold/40 bg-brand-gold/10 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-dark">
                Matched CRM record
              </p>
              <dl className="mt-1.5 grid gap-x-6 gap-y-0.5 text-sm sm:grid-cols-2">
                {crmContext.map((row) => (
                  <div key={row.label} className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{row.label}</dt>
                    <dd className="font-medium">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {open && (
            <RealtimeCallSimulator
              key={runKey}
              scenario={scenario}
              leadId={leadId}
              callerName={callerName}
              callerPhone={callerPhone}
              subtitle={subtitle}
              direction={direction}
              onEvent={onEvent}
              onFinished={onFinished}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
