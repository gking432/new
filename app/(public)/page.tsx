import Link from "next/link";
import {
  ArrowRight,
  Bath,
  CalendarCheck,
  ClipboardList,
  CloudLightning,
  DoorOpen,
  Droplets,
  Home,
  Layers,
  PhoneCall,
  Ruler,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicHeader } from "@/components/public/PublicHeader";
import { ServiceCard } from "@/components/public/ServiceCard";

const SERVICES = [
  { icon: Home, title: "Roofing", description: "Repair, replacement, and honest assessments of remaining roof life." },
  { icon: Layers, title: "Siding", description: "Storm repair and full replacement in vinyl, steel, and fiber cement." },
  { icon: DoorOpen, title: "Windows & Doors", description: "Energy-efficient replacements installed by our own crews." },
  { icon: Bath, title: "Baths", description: "Tub-to-shower conversions and accessible bathing updates." },
  { icon: Droplets, title: "Gutters & Leaf Protection", description: "New gutters, downspouts, and guards that end ladder weekends." },
  { icon: CloudLightning, title: "Storm Damage", description: "Fast inspections, photo documentation, and insurance claim support." },
];

const PROCESS = [
  { icon: ClipboardList, title: "Submit a request", description: "Tell us what is going on with your home. Two minutes, no obligation." },
  { icon: PhoneCall, title: "Get a call", description: "Our team reviews your request and calls with the right next step." },
  { icon: CalendarCheck, title: "Schedule an inspection", description: "We come out, look at everything, and document what we find." },
  { icon: Ruler, title: "Receive your estimate", description: "A clear written estimate — what we recommend and what it costs." },
  { icon: Sparkles, title: "Complete the project", description: "Our crew does the work, cleans up, and walks it with you." },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b bg-gradient-to-b from-background to-secondary/40">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
            <p className="mb-4 text-sm font-medium uppercase tracking-widest text-primary">
              Locally owned · Licensed &amp; insured
            </p>
            <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Roofing, windows, siding, and exterior work handled with clarity
              from first call to final cleanup.
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
              Tell us what is going on with your home. Our team will review your
              request and follow up with the right next step.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link href="/request">
                  Request Free Inspection
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="#services">View Services</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Services */}
        <section id="services" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">What we do</h2>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Exterior and home improvement work for homeowners across the metro.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((service) => (
              <ServiceCard key={service.title} {...service} />
            ))}
          </div>
        </section>

        {/* Trust strip */}
        <section id="storm" className="border-y bg-brand-dark text-white">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
            {[
              { icon: Home, label: "Locally owned", detail: "Your neighbors, not a call center" },
              { icon: ShieldCheck, label: "Licensed & insured", detail: "Full coverage on every job" },
              { icon: CloudLightning, label: "Fast storm response", detail: "Inspections within 24–48 hours" },
              { icon: ClipboardList, label: "Financing available", detail: "Options to fit the project (demo copy)" },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-3">
                <item.icon className="mt-0.5 h-6 w-6 shrink-0 text-brand-gold" />
                <div>
                  <p className="font-medium">{item.label}</p>
                  <p className="text-sm text-white/70">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Process */}
        <section id="process" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
          <p className="mt-2 max-w-xl text-muted-foreground">
            A clear process from your first request to a finished project.
          </p>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {PROCESS.map((step, index) => (
              <div key={step.title} className="relative">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {index + 1}
                  </span>
                  <step.icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <h3 className="mt-3 font-medium">{step.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="border-t bg-secondary/40">
          <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6">
            <h2 className="text-3xl font-semibold tracking-tight">
              Start with a quick request.
            </h2>
            <p className="mx-auto mt-3 max-w-md text-muted-foreground">
              No pressure, no obligation. Tell us what is going on and we will
              follow up with the right next step.
            </p>
            <Button size="lg" className="mt-6" asChild>
              <Link href="/request">Request Estimate</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <p>Northstar Exterior &amp; Home — a fictional company for a portfolio demonstration.</p>
          <div className="flex gap-4">
            <Link href="/case-study" className="hover:text-foreground">Case Study</Link>
            <Link href="/login" className="hover:text-foreground">Team Login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
