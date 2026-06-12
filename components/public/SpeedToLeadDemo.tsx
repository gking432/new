"use client";

import { useEffect, useState } from "react";
import { PhoneIncoming, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RealtimeCallSimulator } from "@/components/calls/RealtimeCallSimulator";

/**
 * The speed-to-lead wow moment on the public success page: moments after the
 * form is submitted, the company's AI scheduling assistant "calls" the
 * homeowner — right here in the browser.
 */
export function SpeedToLeadDemo({
  leadId,
  name,
  phone,
}: {
  leadId: string;
  name: string;
  phone?: string | null;
}) {
  const [showCall, setShowCall] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowCall(true), 2200);
    return () => clearTimeout(t);
  }, []);

  return (
    <Card className="mt-8 border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-brand-gold" />
          Demo: the AI scheduling assistant is calling the homeowner now
          <Badge variant="secondary" className="text-[10px]">
            No real phone call placed
          </Badge>
        </CardTitle>
        <CardDescription>
          This is the speed-to-lead moment: instead of the request sitting in a queue for hours,
          the company&apos;s AI assistant calls back within seconds to confirm details and book the
          inspection. You play the homeowner — answer the call.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {showCall ? (
          <RealtimeCallSimulator
            scenario="speed_to_lead_outbound"
            leadId={leadId}
            callerName="Northstar Exterior & Home"
            callerPhone="(800) 555-0144"
            subtitle="AI Scheduling Assistant"
            direction="inbound"
            audience="public"
          />
        ) : (
          <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <PhoneIncoming className="h-4 w-4 animate-pulse text-primary" />
            Your phone is about to ring{name ? `, ${name}` : ""}…
          </p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          {phone ? `Pretend ${phone} just rang. ` : ""}With a live AI key this is a real voice
          conversation; without one it runs as a click-through script. Either way the call produces
          CRM notes, tasks, and an appointment on the team side.
        </p>
      </CardContent>
    </Card>
  );
}
