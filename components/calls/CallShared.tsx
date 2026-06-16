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

const SPOKEN_DIGITS: Record<string, string> = {
  zero: "0",
  oh: "0",
  o: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
};

function extractSpokenPhone(text: string) {
  const words = text.toLowerCase().match(/\b(zero|oh|o|one|two|three|four|five|six|seven|eight|nine)\b/g);
  const digits = words?.map((word) => SPOKEN_DIGITS[word]).join("") ?? "";
  return digits.length >= 10 ? digits.slice(-10).replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3") : null;
}

function formatNameCandidate(value: string | null | undefined) {
  if (!value) return null;
  const cleaned = value
    .replace(/^(?:sure|yeah|yes|yep|okay|ok|hi|hello|hey)[,.\s]+/i, "")
    .replace(/^(?:my name(?:\s+is|'?s|s)?|name(?:\s+is|'?s)?|it'?s|this is|i'?m|i am)\s+/i, "")
    .split(/[,.]/)[0]
    .replace(/\b(?:speaking|here|calling)\b.*$/i, "")
    .replace(/\b(?:my|the)?\s*(?:phone|number|cell|email|address)\b.*$/i, "")
    .trim();
  const words = cleaned.match(/[a-z]+(?:['-][a-z]+)?/gi) ?? [];
  const filtered = words.filter(
    (word) =>
      !/^(the|a|an|and|my|name|names|phone|number|cell|email|address|storm|damage|roof|leak|water|lakeview|court|street|avenue|drive|road|wisconsin|pewaukee)$/i.test(
        word
      )
  );
  if (filtered.length < 1 || filtered.length > 3) return null;
  return filtered
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

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

/**
 * Lightweight live field extraction for the side panel during a call.
 * `customerSpeaker` says which transcript role is the homeowner — normally
 * "customer", but "ai" in the you-answer-an-AI-customer mode where the AI
 * plays the homeowner.
 */
export function extractLiveFields(
  turns: TranscriptTurn[],
  _seed?: Record<string, string | null>,
  customerSpeaker: "ai" | "customer" = "customer"
): Record<string, string> {
  const customerText = turns
    .filter((t) => t.speaker === customerSpeaker)
    .map((t) => t.text)
    .join(" ");
  const customerLines = turns
    .filter((t) => t.speaker === customerSpeaker)
    .map((t) => t.text.trim())
    .filter(Boolean);
  const all = turns.map((t) => t.text).join(" ");
  const out: Record<string, string> = {};

  const claim = (label: string, value: string | null | undefined) => {
    if (value) out[label] = value.trim();
  };

  // Name — "I'm Jordan Avery" / "this is Jordan" / "my name is Jordan Avery"
  const nameMatch = customerText.match(
    /\b(?:i'?m|i am|this is|my name(?:\s+is|'?s|s)?|name(?:\s+is|'?s|s)?|it'?s)\s+([a-z]+(?:\s+[a-z]+){0,2})\b/i
  );
  // Avoid false positives like "this is getting worse".
  if (nameMatch) {
    const candidate = formatNameCandidate(nameMatch[1]);
    if (
      candidate &&
      !/\b(getting|going|happening|really|so|just|the|a|an|hoping|calling|checking|looking)\b/i.test(candidate)
    ) {
      claim("Name", candidate);
    }
  }
  if (!out["Name"]) {
    const splitName = customerText.match(
      /\bfirst name(?: is|'s)?\s+([a-z]+)\b[\s\S]{0,80}?\blast name(?: is|'s)?\s+([a-z]+)\b/i
    );
    if (splitName) {
      claim(
        "Name",
        [splitName[1], splitName[2]]
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
          .join(" ")
      );
    }
  }
  if (!out["Name"]) {
    const nameAfterQuestion = turns
      .map((turn, index) => {
        if (turn.speaker !== customerSpeaker) return null;
        const previous = [...turns.slice(0, index)].reverse().find((t) => t.speaker !== "system");
        if (
          previous?.speaker !== customerSpeaker &&
          /\b(name|who am i speaking|who is this|who'?s calling)\b/i.test(previous?.text ?? "")
        ) {
          return formatNameCandidate(turn.text);
        }
        return null;
      })
      .find(Boolean);
    claim("Name", nameAfterQuestion);
  }
  if (!out["Name"]) {
    const standaloneName = customerLines
      .map((line) =>
        formatNameCandidate(
          line.match(
            /^(?:sure,?\s*|yeah,?\s*|yes,?\s*)?([a-z]+(?:\s+[a-z]+){1,2})(?:\s+(?:speaking|here))?[,.!?\s]*$/i
          )?.[1]
        )
      )
      .find(Boolean);
    claim("Name", standaloneName);
  }

  const phoneMatch = customerText.match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
  claim("Phone", phoneMatch?.[0] ?? extractSpokenPhone(customerText));

  // Email — direct form, or the way it gets transcribed when spoken aloud
  // ("jordan dot avery at example dot com").
  let email = customerText.match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0]?.replace(/[.,;:]+$/, "");
  if (!email) {
    const spoken = customerText.match(
      /([a-z0-9.\s-]+?)\s+at\s+([a-z0-9\s-]+?)\s+dot\s+(com|net|org|co|edu|io|us)\b/i
    );
    if (spoken) {
      const user = spoken[1].replace(/\s+dot\s+/gi, ".").replace(/\s+/g, "").toLowerCase();
      const domain = spoken[2].replace(/\s+/g, "").toLowerCase();
      email = `${user}@${domain}.${spoken[3].toLowerCase()}`;
    }
  }
  claim("Email", email);

  const addressMatch = customerText.match(
    /\d+\s+[A-Z][\w]*(?:\s+[A-Z][\w]*)*\s+(?:Lane|Ln|Street|St|Avenue|Ave|Drive|Dr|Court|Ct|Road|Rd|Way|Place|Pl|Boulevard|Blvd|Circle|Cir)\b[^.,?!]*/i
  );
  const rawAddress = addressMatch?.[0];
  const suffixPattern =
    "(?:Lane|Ln|Street|St|Avenue|Ave|Drive|Dr|Court|Ct|Road|Rd|Way|Place|Pl|Boulevard|Blvd|Circle|Cir)";
  const addressWithoutStateZip = rawAddress
    ?.replace(/\b\d{5}(?:-\d{4})?\b/g, "")
    .replace(/\b(WI|Wisconsin|MN|Minnesota)\b/gi, "")
    .trim();
  const cityFromAddressTail = addressWithoutStateZip?.match(
    new RegExp(`\\b${suffixPattern}\\s+([a-z]+(?:\\s+[a-z]+)?)$`, "i")
  )?.[1];
  const streetOnly = addressWithoutStateZip
    ?.replace(/\s+\bin\s+[A-Z][a-z]+(?:\s[A-Z][a-z]+)?(?:\s*,?\s*(?:wisconsin|wi))?.*$/i, "")
    .replace(/\s*,\s*[A-Z][a-z]+(?:\s[A-Z][a-z]+)?\s*$/i, "")
    .replace(new RegExp(`\\b(${suffixPattern})\\s+[a-z]+(?:\\s+[a-z]+)?$`, "i"), "$1")
    .trim();
  claim("Address", streetOnly);

  // City — "in Pewaukee" / "Pewaukee, Wisconsin"
  const cityFromStreet =
    customerText.match(
      new RegExp(`\\b${suffixPattern}\\s*,?\\s+([A-Z][a-z]+(?:\\s[A-Z][a-z]+)?)\\s*,?\\s*(?:wisconsin|wi|minnesota|mn)\\b`, "i")
    ) ??
    customerText.match(
      /\d+\s+[A-Z][\w\s]+,\s*([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s*,?\s*(?:wisconsin|wi|minnesota|mn)\b/i
    );
  const cityMatch =
    customerText.match(/\bin\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s*,?\s*(?:wisconsin|wi|minnesota|mn)\b/i) ||
    customerText.match(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s*,\s*(?:wisconsin|wi|minnesota|mn)\b/);
  const explicitCity =
    customerText.match(/\b(?:city(?:\s+is|'s)?|located in|over in|out in)\s+([a-z]+(?:\s+[a-z]+)?)/i) ||
    customerText.match(/\b(?:i'?m|i am|we'?re|we are)\s+in\s+([a-z]+(?:\s+[a-z]+)?)/i);
  const cleanedCity = explicitCity?.[1]
    ?.replace(/\b(?:and|but|with|near|by|for|about|because|the|a|an)\b.*$/i, "")
    .trim();
  claim("City", cityFromStreet?.[1] ?? cityMatch?.[1] ?? cityFromAddressTail ?? cleanedCity);
  const stateMatch = customerText.match(/\b(WI|Wisconsin|MN|Minnesota)\b/i);
  claim("State", stateMatch?.[1]?.replace(/^wisconsin$/i, "WI").replace(/^minnesota$/i, "MN"));
  const zipMatch = customerText.match(/\b\d{5}(?:-\d{4})?\b/);
  claim("ZIP", zipMatch?.[0]);

  if (/hail|storm|wind/i.test(all)) out["Service"] = "Storm damage / roofing";
  else if (/window/i.test(customerText)) out["Service"] = "Windows";
  else if (/siding/i.test(customerText)) out["Service"] = "Siding";
  else if (/gutter/i.test(customerText)) out["Service"] = "Gutters";
  else if (/roof/i.test(customerText)) out["Service"] = "Roofing";

  if (/water (spot|stain|is dripping)|leak|dripping/i.test(customerText))
    out["Active leak"] = "Likely — flagged urgent";
  if (/insurance/i.test(all)) {
    out["Insurance"] = /haven'?t|not yet|no[,.]?\s/i.test(customerText)
      ? "Not started"
      : "Discussed";
  }
  const apptMatch = all.match(
    /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow)[^.?!]*?\b\d{1,2}(?::\d{2})?\s*(?:am|pm)?/i
  );
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
  if (result.failedContact || !result.summary) {
    return (
      <Card className="border-red-300">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-red-700">
            <FileText className="h-5 w-5" />
            Contact unsuccessful
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            The AI assistant couldn&apos;t complete the call, so nothing was guessed or filled in.
            It&apos;s been flagged <strong>urgent</strong> and assigned to a sales rep for an
            immediate manual follow-up.
          </p>
          {audience === "internal" && result.leadId && (
            <Button asChild size="sm">
              <Link href={`/app/leads/${result.leadId}`}>Open the lead</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }
  const summary = result.summary;
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
          <p className="mt-1.5 text-sm">{summary.crm_note}</p>
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

        {summary.next_action && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Recommended next action:</span>{" "}
            {summary.next_action}
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
