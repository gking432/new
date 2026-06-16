"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { runDueReminderAutomations } from "@/lib/actions/inbox";

export function ReminderAutomationCard({
  scheduledCount,
  dueCount,
}: {
  scheduledCount: number;
  dueCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function runDue() {
    startTransition(async () => {
      const result = await runDueReminderAutomations();
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.data.sent > 0
          ? `Sent ${result.data.sent} due reminder${result.data.sent === 1 ? "" : "s"} (simulated)`
          : "No due reminders right now"
      );
      router.refresh();
    });
  }

  return (
    <Card data-tour="automation-reminders">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          Appointment Reminder Lifecycle
        </CardTitle>
        <CardDescription>
          Booked inspections create pre-approved 24-hour and 1-hour reminder texts. In demo mode,
          due reminders auto-send as simulated messages and log back to the customer timeline.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <div className="rounded-md border bg-secondary/30 px-3 py-2 text-sm">
          <span className="font-semibold">{scheduledCount}</span>{" "}
          automated reminder{scheduledCount === 1 ? "" : "s"}
        </div>
        <div className="rounded-md border bg-secondary/30 px-3 py-2 text-sm">
          <span className="font-semibold">{dueCount}</span> due now
        </div>
        <Button size="sm" onClick={runDue} disabled={pending}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Run due reminders
        </Button>
      </CardContent>
    </Card>
  );
}
