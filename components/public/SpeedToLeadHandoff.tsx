"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, MonitorSmartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Shown on the request success page when the form was opened from the
 * dashboard guided tour (?demo=dashboard). It broadcasts to the dashboard tab
 * so the AI call starts there automatically, then tells the user to switch
 * back (and tries to close this tab).
 */
export function SpeedToLeadHandoff({
  leadId,
  name,
  serviceType,
}: {
  leadId: string;
  name: string;
  serviceType?: string;
}) {
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    const payload = { type: "speed_to_lead", leadId, serviceType, ts: Date.now() };
    try {
      if (typeof BroadcastChannel !== "undefined") {
        const bc = new BroadcastChannel("northstar-demo");
        bc.postMessage(payload);
        bc.close();
      }
    } catch {
      // ignore
    }
    try {
      // Fallback for browsers without BroadcastChannel (fires `storage` in other tabs).
      localStorage.setItem("northstar-demo-speed-to-lead", JSON.stringify(payload));
    } catch {
      // ignore
    }
    // Try to auto-close this tab (works because the tour opened it via window.open).
    const t = setTimeout(() => {
      window.close();
      setClosed(true);
    }, 3500);
    return () => clearTimeout(t);
  }, [leadId, serviceType]);

  return (
    <Card className="mt-8 border-primary/30">
      <CardContent className="space-y-4 p-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-status-success" />
        <div>
          <h2 className="text-lg font-semibold">Request submitted{name ? `, ${name}` : ""}!</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Head back to your <strong>dashboard tab</strong> — the AI scheduling assistant is
            calling you right now. Answer it and play the homeowner while the CRM fills itself in.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => window.close()}>
            <MonitorSmartphone className="h-4 w-4" />
            {closed ? "You can close this tab" : "Close this tab"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          (This is the customer&apos;s view. The whole demo continues over in the dashboard.)
        </p>
      </CardContent>
    </Card>
  );
}
