"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  FileText,
  MessageSquareText,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CompleteCallResult } from "@/lib/calls/completeCall";
import { cn } from "@/lib/utils";
import type { TranscriptTurn } from "@/types/app";

export function TranscriptBubble({ turn, live = false }: { turn: TranscriptTurn; live?: boolean }) {
  const isAi = turn.speaker === "ai";
  return (
    <div className={cn("flex", isAi ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3 py-2 text-sm",
          isAi ? "bg-primary/10 text-foreground" : "bg-secondary",
          live && "opacity-70"
        )}
      >
        <p className="mb-0.5 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {isAi && <Bot className="h-3 w-3" />}
          {isAi ? "AI assistant" : "Customer"}
        </p>
        {turn.text}
      </div>
    </div>
  );
}

/** Lightweight live field extraction for the side panel during a call. */
export function extractLiveFields(
  turns: TranscriptTurn[],
  seed?: Record<string, string | null>
): Record<string, string> {
  const customerText = turns
    .filter((t) => t.speaker === "customer")
    .map((t) => t.text)
    .join(" ");
  const all = turns.map((t) => t.text).join(" ");
  const out: Record<string, string> = {};

  const claim = (label: string, value: string | null | undefined) => {
    if (value) out[label] = value;
  };

  if (seed && turns.length > 0) {
    const seenName = turns.length >= 2;
    if (seenName)
      claim("Name", [seed.first_name, seed.last_name].filter(Boolean).join(" ") || null);
  }
  const phoneMatch = customerText.match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
  claim("Phone", phoneMatch?.[0]);
  const emailMatch = customerText.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  claim("Email", emailMatch?.[0]);
  const addressMatch = customerText.match(
    /\d+\s+[A-Z][\w]*\s+(?:Lane|Ln|Street|St|Avenue|Ave|Drive|Dr|Court|Ct|Road|Rd)\b[^.,]*/i
  );
  claim("Address", addressMatch?.[0]);
  if (/hail|storm|wind/i.test(all)) out["Service"] = "Storm damage / roofing";
  else if (/window/i.test(customerText)) out["Service"] = "Windows";
  if (/water (spot|stain)|leak|dripping/i.test(customerText))
    out["Active leak"] = "Likely — flagged urgent";
  if (/insurance/i.test(all)) {
    out["Insurance"] = /haven'?t|not yet|no[,.]?\s/i.test(customerText)
      ? "Not started"
      : "Discussed";
  }
  const apptMatch = all.match(/tomorrow[^.?!]*\b(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)?/i);
  claim("Requested appointment", apptMatch?.[0]);
  return out;
}

export function CallResultPanel({
  result,
  audience,
  onDismiss,
}: {
  result: CompleteCallResult;
  audience: "internal" | "public";
  onDismiss?: () => void;
}) {
  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CheckCircle2 className="h-5 w-5 text-status-success" />
          Call complete — here&apos;s what the AI did
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-primary">
            <FileText className="h-3.5 w-3.5" />
            CRM note (saved to the timeline)
          </p>
          <p className="mt-1.5 text-sm">{result.summary.crm_note}</p>
        </div>

        <ul className="space-y-2 text-sm">
          {result.leadCreated && <ResultLine icon={Sparkles} text="New lead created from the call" />}
          {result.appointment && (
            <ResultLine
              icon={CalendarCheck}
              text={`Inspection booked: ${result.appointment.label} — lead moved to Appointment Scheduled`}
            />
          )}
          {result.tasksCreated > 0 && (
            <ResultLine
              icon={ClipboardList}
              text={`${result.tasksCreated} follow-up task${result.tasksCreated > 1 ? "s" : ""} created for the team`}
            />
          )}
          {result.confirmationDraftId && (
            <ResultLine
              icon={MessageSquareText}
              text="Confirmation message drafted — waiting for human approval in the Inbox"
            />
          )}
          <ResultLine
            icon={FileText}
            text={`Full transcript stored for reference (${
              result.aiStatus === "completed" ? "AI summary" : "rule-based summary"
            })`}
          />
        </ul>

        {result.summary.next_action && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Recommended next action:</span>{" "}
            {result.summary.next_action}
          </p>
        )}

        {audience === "internal" && result.leadId ? (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button asChild size="sm">
              <Link href={`/app/leads/${result.leadId}`}>
                Open lead
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`/app/calls/${result.callId}`}>View call record</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/app/inbox">Review drafts in Inbox</Link>
            </Button>
            {onDismiss && (
              <Button size="sm" variant="ghost" onClick={onDismiss}>
                Dismiss
              </Button>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            On the team side, this call just created CRM notes, tasks
            {result.appointment ? ", an appointment," : ""} and a confirmation draft. Log in to the
            Command Center to see it.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ResultLine({
  icon: Icon,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
}) {
  return (
    <li className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <span>{text}</span>
    </li>
  );
}
