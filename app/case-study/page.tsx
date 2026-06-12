import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DemoGuideWidget } from "@/components/demo/DemoGuideWidget";
import { PublicHeader } from "@/components/public/PublicHeader";

export const metadata: Metadata = {
  title: "Case Study — Home Service AI Command Center",
};

const STACK = [
  "Next.js 15 (App Router)",
  "React 19",
  "TypeScript",
  "Tailwind CSS",
  "shadcn/ui",
  "Recharts",
  "React Hook Form + Zod",
  "Supabase (Postgres, Auth, RLS)",
  "OpenAI API (chat + Realtime/WebRTC)",
  "HubSpot CRM API",
  "Vercel",
];

const NEXT_STEPS = [
  "Real telephony (Twilio Voice + Media Streams) behind the same call pipeline",
  "Real SMS/email delivery through Twilio and Resend behind the existing approval gates",
  "Google Calendar free/busy and event sync (the provider seam is already in place)",
  "Realtime tool-calling for mid-call CRM lookups and live booking",
  "A live property-data provider behind the existing provider interface",
  "Role-based permissions, duplicate-lead detection, and lead source ROI",
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3 text-muted-foreground">{children}</div>
    </section>
  );
}

export default function CaseStudyPage() {
  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="mx-auto max-w-3xl space-y-10 px-4 py-12 sm:px-6">
        <div>
          <Badge variant="secondary">Portfolio case study</Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            AI Command Center for Home Service Sales, Calls, CRM Notes, Appointments, and Quote
            Intelligence
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">
            An AI communications and operations layer for residential contractors — its own CRM
            when you need one, an intelligence layer on top of your existing CRM when you
            don&apos;t.
          </p>
        </div>

        <Section title="The business problem">
          <p>
            Home service companies lose revenue in predictable places: leads sit untouched while
            crews are in the field, call details never make it into the CRM, follow-up depends on
            whoever remembers, appointment opportunities slip during the call, and quoting starts
            from a blank page. The first contractor to call a storm-damage lead usually wins the
            job — yet the median response time in the industry is measured in hours.
          </p>
        </Section>

        <Section title="Why CRMs fail in the real world">
          <p>
            Most contractors already own a CRM. The CRM isn&apos;t the problem — the work around
            it is. Notes don&apos;t get written, fields don&apos;t get filled, calls don&apos;t get
            logged, and the data decays until nobody trusts it. Replacing the CRM doesn&apos;t fix
            that; the gap is between the customer conversation and the record of it.
          </p>
        </Section>

        <Section title="The AI operations layer">
          <p>
            I built this system around that gap. It captures leads from forms, calls, texts, and
            emails; qualifies them with AI; books inspections against real availability; turns
            conversations into clean CRM-ready notes (with full transcripts stored separately);
            drafts every follow-up for human approval; and syncs structured updates into an
            external CRM. The goal was not to replace every CRM. The goal was to show how AI can
            sit around the CRM and improve the workflows that usually break: slow response time,
            incomplete notes, inconsistent follow-up, missed appointment opportunities, weak lead
            prioritization, and scattered customer communication.
          </p>
        </Section>

        <Section title="Speed-to-lead voice demo">
          <p>
            The flagship demo: a homeowner submits the website form, and seconds later a phone
            screen rings in the browser — the company&apos;s AI scheduling assistant calling back.
            With an OpenAI key it&apos;s a live voice conversation over WebRTC (real microphone,
            real AI speech, ephemeral tokens minted server-side); without one, a scripted
            click-through mode plays the same call. Either way, ending the call produces a hidden
            transcript, a CRM note on the timeline, an urgent task, a booked inspection, a stage
            change, and a confirmation draft waiting for approval. There is no real telephony —
            and the demo is honest about that — but the entire post-call pipeline is real.
          </p>
        </Section>

        <Section title="Call intelligence and CRM notes">
          <p>
            Transcripts are deliberately not front and center. The lead timeline gets a short,
            actionable AI note — what changed, what the customer needs, what to do next — and the
            full transcript lives behind a &ldquo;View Full Transcript&rdquo; modal, searchable
            but out of the way. The AI also recognizes existing customers by phone number, pulls
            their CRM context before answering, and logs second touchpoints without re-asking
            what it already knows.
          </p>
        </Section>

        <Section title="Existing CRM sync">
          <p>
            A HubSpot connector shows the integration story: each sync creates or updates the
            contact, creates a deal, and attaches the AI summary as a note. Without a token it
            runs as a dry run — the exact payloads are built, logged to an auditable sync-event
            table with mock IDs, and displayed in the UI — so the integration can be demonstrated
            without touching anyone&apos;s portal. With a private app token, the same code path
            calls the real HubSpot API.
          </p>
        </Section>

        <Section title="Appointment booking">
          <p>
            An internal availability calendar powers booking — no external calendar auth needed
            for the demo. The owner describes availability in plain English (&ldquo;Mon, Wed, Fri
            from 10 to 4, 90 minutes per appointment&rdquo;), AI converts it into structured
            windows, and the call assistant only ever offers genuinely open slots. Booked
            inspections move the lead&apos;s stage and generate a confirmation draft.
          </p>
        </Section>

        <Section title="Quote intelligence">
          <p>
            An internal-only ballpark tool for the sales team: demo property research by address
            (year built, square footage, estimated roof area), storm/weather context, and
            deterministic calculators per service line produce a low–high range with line items,
            assumptions, missing info, and inspection questions. Every output is labeled
            &ldquo;internal ballpark — requires inspection before final quote.&rdquo;
          </p>
        </Section>

        <Section title="Human approval for customer communication">
          <p>
            Nothing customer-facing sends automatically. Every AI-drafted SMS and email lands in
            an approval queue where a person can edit, approve, or discard it — and in demo mode,
            &ldquo;send&rdquo; is explicitly simulated. The AI is also constrained: it never
            promises insurance approval or final pricing, and it identifies itself as an AI
            assistant on outbound calls.
          </p>
        </Section>

        <Section title="Tech stack">
          <div className="flex flex-wrap gap-2">
            {STACK.map((item) => (
              <Badge key={item} variant="outline">
                {item}
              </Badge>
            ))}
          </div>
          <Card className="mt-4">
            <CardContent className="p-4 text-sm">
              All AI calls run server-side through a provider-abstracted layer with Zod-validated
              structured output and deterministic fallbacks, so no workflow dies when AI is
              unavailable. Realtime voice uses short-lived ephemeral tokens — the real API key
              never reaches the browser. Row Level Security separates anonymous lead intake from
              the authenticated internal app.
            </CardContent>
          </Card>
        </Section>

        <Section title="What I'd build next in production">
          <ul className="list-disc space-y-1.5 pl-5">
            {NEXT_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </Section>

        <div className="flex flex-wrap gap-3 border-t pt-8">
          <Button asChild>
            <Link href="/request">
              Try the speed-to-lead demo
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/login">Open the Command Center</Link>
          </Button>
        </div>
      </main>
      <DemoGuideWidget audience="public" />
    </div>
  );
}
