"use client";

import { useState } from "react";
import Link from "next/link";
import { PlayCircle, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface GuideStep {
  title: string;
  body: string;
  href?: string;
  linkLabel?: string;
}

const PUBLIC_STEPS: GuideStep[] = [
  {
    title: "1. Submit a request as the homeowner",
    body: "Use “Generate demo customer” to auto-fill the form (or type your own info — everything works). Submit it.",
    href: "/request",
    linkLabel: "Open the request form",
  },
  {
    title: "2. Answer the AI callback",
    body: "Seconds after you submit, the company's AI scheduling assistant “calls” you right in the browser. Answer it, talk (or click through the script), and it books your inspection.",
  },
  {
    title: "3. See the team side",
    body: "Log in to the Command Center with admin@northstar-demo.com / demo-password. Your call just created CRM notes, tasks, an appointment, and a confirmation draft.",
    href: "/login",
    linkLabel: "Open the Command Center",
  },
  {
    title: "4. Receive the confirmation text",
    body: "In the Command Center Inbox, approve & send the confirmation SMS — then watch it arrive on the homeowner phone screen you left open.",
  },
];

const INTERNAL_STEPS: GuideStep[] = [
  {
    title: "1. Run the speed-to-lead demo",
    body: "Demo Center → “Submit lead & start AI call.” A website lead is created and the AI calls the homeowner. Answer, then browse the CRM while the call floats on top.",
    href: "/app/demo-center",
    linkLabel: "Open Demo Center",
  },
  {
    title: "2. Take a customer callback",
    body: "“Simulate Existing Customer Call” — the AI matches Sarah's number, shows her CRM record before you answer, and you land on the dashboard with the live call in the corner. Click “Open lead” mid-call to see her full record.",
  },
  {
    title: "3. Work the Inbox",
    body: "Simulate an inbound text and email from the Demo Center, then review the conversations in the Inbox. Approve & send the AI-drafted replies (sending is simulated).",
    href: "/app/inbox",
    linkLabel: "Open Inbox",
  },
  {
    title: "4. Book appointments",
    body: "Set each estimator's weekly availability and book inspections from open slots — the same slots the AI call assistant offers.",
    href: "/app/appointments",
    linkLabel: "Open Appointments",
  },
  {
    title: "5. Sync to HubSpot (dry run)",
    body: "CRM Sync → “Sync to HubSpot.” Without a token it's a dry run: the exact contact/deal/note payloads are shown and logged — nothing external is touched.",
    href: "/app/crm-sync",
    linkLabel: "Open CRM Sync",
  },
  {
    title: "6. Generate a ballpark quote",
    body: "Quote Tool → pick a lead, review the (simulated) property profile, set storm context, and generate an internal ballpark with line items and assumptions.",
    href: "/app/quote-tool",
    linkLabel: "Open Quote Tool",
  },
];

/**
 * Floating demo guide for portfolio visitors: a bottom-right button that opens
 * a step-by-step walkthrough of the whole demo.
 */
export function DemoGuideWidget({ audience }: { audience: "public" | "internal" }) {
  const [open, setOpen] = useState(false);
  const steps = audience === "public" ? PUBLIC_STEPS : INTERNAL_STEPS;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-brand-dark px-4 py-2.5 text-sm font-medium text-white shadow-xl transition-transform hover:scale-105"
      >
        <PlayCircle className="h-4 w-4 text-brand-gold" />
        Demo guide
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand-gold" />
              How to demo this project
            </SheetTitle>
            <SheetDescription>
              A working AI communications layer for a home services company. No real calls, texts,
              or emails — everything else is real.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 px-4 pb-6">
            {audience === "public" && (
              <div className="rounded-lg border bg-secondary/40 p-3 text-xs">
                <p className="font-medium">Demo login</p>
                <p className="mt-1 font-mono">admin@northstar-demo.com</p>
                <p className="font-mono">demo-password</p>
              </div>
            )}
            {steps.map((step) => (
              <div key={step.title} className="rounded-lg border p-3">
                <p className="text-sm font-semibold">{step.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
                {step.href && (
                  <Button asChild size="sm" variant="outline" className="mt-2">
                    <Link href={step.href} onClick={() => setOpen(false)}>
                      {step.linkLabel}
                    </Link>
                  </Button>
                )}
              </div>
            ))}
            <div className="space-y-1 rounded-lg border border-brand-gold/40 bg-brand-gold/10 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Good to know</p>
              <p>
                • <Badge variant="secondary" className="text-[10px]">Live voice</Badge> needs an
                OpenAI key; without one, calls run as a click-through script with the same results.
              </p>
              <p>• Outbound messages always wait for human approval, then sending is simulated.</p>
              <p>• Property data in the quote tool is simulated and labeled as such.</p>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
