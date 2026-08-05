"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Clock3, Eye, Loader2, Mail, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  buildDemoReportEmail,
  REPORT_DAYS,
  REPORT_SECTIONS,
  REPORT_TIMEZONES,
  type ReportDay,
  type ReportSectionId,
} from "@/lib/reports/demoEmail";
import { cn } from "@/lib/utils";

export function ScheduledReportDemo() {
  const [email, setEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [reportName, setReportName] = useState("Weekly AI Operations Brief");
  const [day, setDay] = useState<ReportDay>("Friday");
  const [time, setTime] = useState("08:00");
  const [timezone, setTimezone] = useState("America/Chicago");
  const [sections, setSections] = useState<ReportSectionId[]>([
    "open_quotes",
    "reviews_reputation",
    "customer_service",
  ]);
  const [deliveryConfigured, setDeliveryConfigured] = useState<boolean | null>(null);
  const [sending, setSending] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sentSchedule, setSentSchedule] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/demo/report-email", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { configured?: boolean }) => {
        if (!cancelled) setDeliveryConfigured(Boolean(data.configured));
      })
      .catch(() => {
        if (!cancelled) setDeliveryConfigured(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const preview = useMemo(
    () =>
      buildDemoReportEmail({
        email: email || "you@example.com",
        recipientName,
        reportName,
        day,
        time,
        timezone,
        sections,
      }),
    [day, email, recipientName, reportName, sections, time, timezone]
  );

  function toggleSection(section: ReportSectionId) {
    setSections((current) =>
      current.includes(section)
        ? current.length === 1
          ? current
          : current.filter((item) => item !== section)
        : [...current, section]
    );
  }

  async function sendReport() {
    if (!email.trim() || !email.includes("@")) {
      toast.error("Enter the email address that should receive the demo report.");
      return;
    }
    setSending(true);
    try {
      const response = await fetch("/api/demo/report-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          recipientName,
          reportName,
          day,
          time,
          timezone,
          sections,
          website: "",
        }),
      });
      const result = (await response.json()) as { error?: string; schedule?: string };
      if (!response.ok) throw new Error(result.error || "The report could not be sent.");
      setSentSchedule(result.schedule || preview.schedule);
      toast.success("The one-time demo report was sent.");
      window.dispatchEvent(new CustomEvent("northstar-demo-report-sent"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The report could not be sent.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Card data-tour="scheduled-report-demo" className="overflow-hidden border-primary/25">
      <CardHeader className="border-b bg-primary/[0.04]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4 text-primary" />
              Scheduled email report demo
            </CardTitle>
            <CardDescription className="mt-1 max-w-3xl">
              Choose what a manager wants to know and when they want it. The production workflow
              could gather data from connected systems, have AI explain what changed, and deliver
              the brief automatically.
            </CardDescription>
          </div>
          <Badge variant="outline" className="border-green-200 bg-green-50 text-green-800">
            <ShieldCheck className="mr-1 h-3 w-3" /> One email only
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-5">
        <div className="mb-5 rounded-lg border border-brand-gold/50 bg-brand-gold/10 px-4 py-3 text-sm text-foreground">
          <strong>This will not start a weekly report.</strong> It sends one demo email now using
          the schedule and information you select. You will not be subscribed and no future emails
          will be sent.
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="report-recipient-name">Your name <span className="text-muted-foreground">(optional)</span></Label>
                <Input id="report-recipient-name" value={recipientName} onChange={(event) => setRecipientName(event.target.value)} placeholder="Alex Morgan" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="report-recipient-email">Email address</Label>
                <Input id="report-recipient-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="alex@company.com" autoComplete="email" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="report-name">Report name</Label>
              <Input id="report-name" value={reportName} onChange={(event) => setReportName(event.target.value)} maxLength={90} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Day</Label>
                <Select value={day} onValueChange={(value) => setDay(value as ReportDay)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{REPORT_DAYS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="report-time">Time</Label>
                <Input id="report-time" type="time" value={time} onChange={(event) => setTime(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Time zone</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{REPORT_TIMEZONES.map((zone) => <SelectItem key={zone.value} value={zone.value}>{zone.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="rounded-lg border bg-secondary/25 p-3 text-sm">
              <div className="flex items-center gap-2 font-medium"><Clock3 className="h-4 w-4 text-primary" /> Requested production schedule</div>
              <p className="mt-1 text-muted-foreground">{preview.schedule}</p>
            </div>
          </div>

          <div>
            <Label>Information to include</Label>
            <p className="mt-1 text-xs text-muted-foreground">Select one or more. Every section includes an AI-recommended next action.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {REPORT_SECTIONS.map((section) => {
                const selected = sections.includes(section.id);
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => toggleSection(section.id)}
                    aria-pressed={selected}
                    className={cn(
                      "flex min-h-[92px] items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                      selected ? "border-primary bg-primary/[0.06]" : "bg-card hover:bg-secondary/40"
                    )}
                  >
                    <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border", selected ? "border-primary bg-primary text-primary-foreground" : "bg-card")}>
                      {selected ? <Check className="h-3.5 w-3.5" /> : null}
                    </span>
                    <span>
                      <span className="block text-sm font-medium">{section.label}</span>
                      <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{section.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-5">
          <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">
            Demo figures are sample data. The email address is used for this delivery only and is
            not saved by the application.
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setPreviewOpen(true)}>
              <Eye className="h-4 w-4" /> Preview email
            </Button>
            <Button type="button" onClick={sendReport} disabled={sending || deliveryConfigured !== true}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sending ? "Sending…" : "Send one-time demo"}
            </Button>
          </div>
        </div>

        {deliveryConfigured === false ? (
          <p className="mt-3 text-right text-xs text-amber-700">
            Live delivery is being connected. The complete email is available in Preview.
          </p>
        ) : null}
        {sentSchedule ? (
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900">
            <Check className="mt-0.5 h-4 w-4 shrink-0" />
            <p><strong>Email sent.</strong> It demonstrates a report scheduled {sentSchedule}, but no recurring schedule was created.</p>
          </div>
        ) : null}
      </CardContent>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[86vh] max-w-3xl overflow-y-auto p-0">
          <DialogHeader className="border-b p-5 pr-12">
            <DialogTitle>Email preview</DialogTitle>
            <DialogDescription>This is the exact report body the one-time delivery uses.</DialogDescription>
          </DialogHeader>
          <iframe title="Demo report email preview" srcDoc={preview.html} className="h-[66vh] w-full border-0 bg-secondary" />
        </DialogContent>
      </Dialog>
    </Card>
  );
}
