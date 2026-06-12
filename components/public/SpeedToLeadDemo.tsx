"use client";

import { useEffect, useState } from "react";
import { PhoneIncoming } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RealtimeCallSimulator } from "@/components/calls/RealtimeCallSimulator";

/**
 * The speed-to-lead wow moment: moments after the form is submitted, a phone
 * pops up — the company's AI scheduling assistant calling the homeowner. The
 * phone stays open after the call to "receive" the confirmation SMS once the
 * team approves it.
 */
export function SpeedToLeadDemo({ leadId, name }: { leadId: string; name: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setOpen(true), 2200);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      {!open && (
        <p className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <PhoneIncoming className="h-4 w-4 animate-pulse text-primary" />
          Demo: your phone is about to ring{name ? `, ${name}` : ""}…
        </p>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              <PhoneIncoming className="h-4 w-4 text-primary" />
              Incoming call: Northstar AI scheduling assistant
              <Badge variant="secondary" className="text-[10px]">
                Demo — no real phone call placed
              </Badge>
            </DialogTitle>
            <DialogDescription>
              You play the homeowner — answer the call. Afterwards, leave this open: when the team
              approves your confirmation text, it arrives right here.
            </DialogDescription>
          </DialogHeader>
          {open && (
            <RealtimeCallSimulator
              scenario="speed_to_lead_outbound"
              leadId={leadId}
              callerName="Northstar Exterior & Home"
              callerPhone="(800) 555-0144"
              subtitle="AI Scheduling Assistant"
              direction="inbound"
              audience="public"
              keepPhoneOpenAfterCall
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
