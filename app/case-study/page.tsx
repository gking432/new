import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PublicHeader } from "@/components/public/PublicHeader";

export const metadata: Metadata = {
  title: "Case Study — Home Service AI Command Center",
};

const FEATURES = [
  "Public lead intake with validation and a realistic marketing landing page",
  "AI lead analysis: urgency, quality, value range, sales questions, and recommended next actions",
  "AI Priority Queue that ranks open leads by urgency and quality",
  "Kanban sales pipeline with stage tracking and automatic activity logging",
  "Task queue with priorities, due dates, snoozing, and per-rep views",
  "AI follow-up generator for SMS, email, call scripts, voicemails, and review responses",
  "Customer feedback analyzer with sentiment, risk level, and operational categorization",
  "Database-driven automation rules with an auditable run log and test runner",
  "KPI dashboard: booking rates, close rates, pipeline value, source performance, urgency mix",
  "Webhook integration point for Make/Zapier-style workflow tools",
];

const STACK = [
  "Next.js 15 (App Router)",
  "React 19",
  "TypeScript",
  "Tailwind CSS",
  "shadcn/ui",
  "Recharts",
  "React Hook Form + Zod",
  "Supabase (Postgres, Auth, RLS)",
  "OpenAI API (provider-abstracted)",
  "Vercel",
];

const NEXT_STEPS = [
  "Role-based permissions (the schema and UI labels are already in place)",
  "Drag-and-drop pipeline cards",
  "Photo upload with AI roof-damage triage",
  "Real SMS/email sending through Twilio and Resend with approval gates",
  "Speed-to-lead measurement from real contact timestamps",
  "Duplicate lead detection and lead source ROI calculation",
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
            Home Service AI Command Center
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">
            A working AI-powered sales, operations, and customer service system for a residential
            home improvement company.
          </p>
        </div>

        <Section title="The problem">
          <p>
            Home service companies often lose revenue through slow lead response, inconsistent
            follow-up, messy CRM data, and limited visibility into where sales opportunities
            stall. The first contractor to call a storm-damage lead usually wins the job — yet
            leads routinely sit untouched for hours while crews are in the field.
          </p>
        </Section>

        <Section title="The solution">
          <p>
            I built Home Service AI Command Center as a working prototype for a fictional
            residential contractor, Northstar Exterior &amp; Home. The system captures leads,
            classifies urgency and quality with AI, creates recommended tasks, generates customer
            follow-up drafts, tracks pipeline stages, analyzes customer feedback, and surfaces
            KPI dashboards.
          </p>
          <p>
            The goal was not to build a generic chatbot. The goal was to show how AI can fit into
            a real business workflow where speed, process discipline, and customer communication
            directly affect revenue.
          </p>
        </Section>

        <Section title="Demo workflow">
          <ol className="list-decimal space-y-2 pl-5">
            <li>A homeowner submits the public form: hail damage, missing shingles, a water spot on the ceiling, active leak.</li>
            <li>The lead is created and AI classifies it: emergency urgency, hot quality, estimated value range, &quot;call within 15 minutes.&quot;</li>
            <li>The &quot;Urgent Storm Damage Lead&quot; automation rule fires and creates an urgent call task.</li>
            <li>The lead appears at the top of the AI Priority Queue on the dashboard.</li>
            <li>A sales rep opens the lead, reviews the AI summary and suggested discovery questions, and generates an SMS draft.</li>
            <li>Every step is logged to the activity timeline, and the reports update in real time.</li>
          </ol>
        </Section>

        <Section title="Features built">
          <ul className="list-disc space-y-1.5 pl-5">
            {FEATURES.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
        </Section>

        <Section title="Business impact">
          <p>
            The system is designed around the operational levers that move revenue for a
            contractor: speed-to-lead (urgent leads get 15-minute call tasks), follow-up
            discipline (estimates that go quiet generate tasks automatically), reputation
            management (negative feedback reaches a manager within one business day), and
            visibility (stalled pipeline value is computed and surfaced, not guessed at).
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
              All AI calls run server-side through a provider-abstracted service layer with
              Zod-validated structured output. AI failures fall back to deterministic heuristics
              so lead capture never breaks. Row Level Security separates anonymous lead intake
              from the authenticated internal app.
            </CardContent>
          </Card>
        </Section>

        <Section title="What I'd add next">
          <ul className="list-disc space-y-1.5 pl-5">
            {NEXT_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </Section>

        <div className="flex flex-wrap gap-3 border-t pt-8">
          <Button asChild>
            <Link href="/request">
              Try the demo lead form
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/login">Open the Command Center</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
