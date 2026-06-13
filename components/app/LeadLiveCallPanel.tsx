"use client";

import { Bot, PhoneCall } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useLiveCall } from "@/components/calls/CallProvider";

/**
 * Shown on a lead's page while an AI call about THIS lead is happening — you
 * watch the record update in real time and see the AI "writing" the call note,
 * instead of a separate transcript popup.
 */
export function LeadLiveCallPanel({ leadId }: { leadId: string }) {
  const live = useLiveCall();
  const active =
    live &&
    live.leadId === leadId &&
    ["incoming", "dialing", "connecting", "connected", "processing"].includes(live.phase);
  if (!active || !live) return null;

  const entries = Object.entries(live.extracted);
  const writing = live.phase === "processing";

  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            <PhoneCall className="h-3 w-3" />
            Live call
          </Badge>
          <span className="text-sm font-medium">{live.callerName}</span>
        </div>

        <p className="flex items-center gap-2 text-sm text-primary">
          <Bot className="h-4 w-4" />
          {writing ? (
            <span>AI is writing the call note and updating this record…</span>
          ) : (
            <span>
              AI is on the call — capturing details and taking notes
              <span className="ml-1 inline-flex gap-0.5 align-middle">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.2s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.1s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
              </span>
            </span>
          )}
        </p>

        {entries.length > 0 && (
          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {entries.map(([key, value]) => (
              <div key={key} className="flex justify-between gap-3 border-b py-1">
                <dt className="text-muted-foreground">{key}</dt>
                <dd className="text-right font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
