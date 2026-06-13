"use client";

import { PhoneIncoming, PhoneOutgoing } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CompleteCallResult } from "@/lib/calls/completeCall";
import type { CallScenario } from "@/types/app";
import { useCall } from "./CallProvider";

/**
 * Button that starts a call in the app-wide floating call window (via
 * CallProvider), so the user can navigate the CRM while the call runs.
 */
export function CallLauncher({
  scenario,
  leadId,
  callerName,
  callerPhone,
  subtitle,
  direction,
  persona,
  seedFields,
  buttonLabel,
  buttonVariant = "default",
  buttonSize = "default",
  crmContext,
  navigateTo,
  onFinished,
}: {
  scenario: Exclude<CallScenario, "manual_call_note">;
  leadId?: string;
  callerName: string;
  callerPhone?: string | null;
  subtitle?: string | null;
  direction: "inbound" | "outbound";
  persona?: "agent" | "customer";
  seedFields?: Record<string, string | null>;
  buttonLabel: string;
  buttonVariant?: "default" | "outline" | "secondary";
  buttonSize?: "default" | "sm" | "lg";
  crmContext?: { label: string; value: string }[];
  /** Route to open once the call connects (defaults to the overview for lead-linked calls). */
  navigateTo?: string;
  onFinished?: (result: CompleteCallResult) => void;
}) {
  const { startCall, callActive } = useCall();

  return (
    <Button
      variant={buttonVariant}
      size={buttonSize}
      disabled={callActive}
      onClick={() =>
        startCall({
          scenario,
          leadId,
          callerName,
          callerPhone,
          subtitle,
          direction,
          persona,
          seedFields,
          crmContext,
          navigateTo,
          onFinished,
        })
      }
    >
      {direction === "inbound" ? (
        <PhoneIncoming className="h-4 w-4" />
      ) : (
        <PhoneOutgoing className="h-4 w-4" />
      )}
      {buttonLabel}
    </Button>
  );
}
