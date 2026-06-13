"use client";

import Link from "next/link";
import { AlertCircle, Check, Loader2, PhoneCall } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLiveCall } from "@/components/calls/CallProvider";
import { cn } from "@/lib/utils";

const FIELDS: { key: string; label: string; required: boolean }[] = [
  { key: "Name", label: "Name", required: true },
  { key: "Phone", label: "Phone", required: true },
  { key: "Address", label: "Property address", required: true },
  { key: "Service", label: "Service needed", required: true },
  { key: "Active leak", label: "Active leak / damage?", required: false },
  { key: "Insurance", label: "Insurance started?", required: false },
  { key: "Email", label: "Email", required: false },
  { key: "Requested appointment", label: "Preferred time", required: false },
];

/**
 * Live lead form that fills itself from the call's extracted info, and
 * highlights the required fields still missing so the rep on the phone knows
 * what to ask. Used in the you-answer-an-AI-customer mode.
 */
export function LiveIntakeForm() {
  const live = useLiveCall();

  if (!live) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-sm text-muted-foreground">
          No active call. Start a call from the Demo Center or the guided tour and this form will
          fill itself in real time.
        </CardContent>
      </Card>
    );
  }

  const extracted = live.extracted;
  const requiredCaptured = FIELDS.filter((f) => f.required && extracted[f.key]).length;
  const requiredTotal = FIELDS.filter((f) => f.required).length;
  const done = live.phase === "done" || live.phase === "processing";

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <PhoneCall className="h-4 w-4 text-primary" />
          Live call — taking notes as you talk
          <Badge variant="secondary" className="gap-1 text-[10px]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            {live.callerName}
          </Badge>
        </CardTitle>
        <CardDescription>
          You&apos;re the rep — the homeowner is on the line. Fields fill automatically; anything
          highlighted in red still needs to be asked. ({requiredCaptured}/{requiredTotal} required
          captured)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map((field) => {
            const value = extracted[field.key];
            const missingRequired = field.required && !value;
            return (
              <div
                key={field.key}
                className={cn(
                  "rounded-lg border p-3 transition-colors",
                  value
                    ? "border-status-success/40 bg-green-50/60"
                    : missingRequired
                      ? "border-red-400 bg-red-50 animate-pulse"
                      : "border-dashed"
                )}
              >
                <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {value ? (
                    <Check className="h-3.5 w-3.5 text-status-success" />
                  ) : missingRequired ? (
                    <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                  ) : null}
                  {field.label}
                  {field.required && <span className="text-red-500">*</span>}
                </p>
                <p className={cn("mt-1 text-sm", value ? "font-medium" : "text-muted-foreground")}>
                  {value ?? (missingRequired ? "Still need — ask the customer" : "—")}
                </p>
              </div>
            );
          })}
        </div>

        {done && (
          <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Call wrapping up — saving the lead and opening the record…
            {live.result?.leadId && (
              <Button asChild size="sm" variant="outline" className="ml-auto">
                <Link href={`/app/leads/${live.result.leadId}`}>Open lead</Link>
              </Button>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          The phone is in the top-left corner. When the call ends, the AI writes the CRM note,
          creates tasks, and (if a time was set) books the inspection — then this opens the saved
          lead.
        </p>
      </CardContent>
    </Card>
  );
}
