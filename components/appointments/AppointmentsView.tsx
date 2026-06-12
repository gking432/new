"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarCheck, CalendarPlus, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createAppointment, updateAppointmentStatus } from "@/lib/actions/appointments";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/utils/format";
import type { AppointmentWithLead } from "@/types/app";

interface SlotOption {
  start: string;
  end: string;
  label: string;
}

interface LeadOption {
  id: string;
  first_name: string;
  last_name: string;
  service_type: string;
  stage: string;
}

const STATUS_STYLES: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-800",
  confirmed: "bg-green-100 text-green-800",
  rescheduled: "bg-amber-100 text-amber-800",
  cancelled: "bg-secondary text-muted-foreground",
  completed: "bg-green-100 text-green-800",
  suggested: "bg-secondary text-secondary-foreground",
};

export function AppointmentsView({
  appointments,
  slots,
  leads,
}: {
  appointments: AppointmentWithLead[];
  slots: SlotOption[];
  leads: LeadOption[];
}) {
  const router = useRouter();
  const [leadId, setLeadId] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<SlotOption | null>(null);
  const [pending, startTransition] = useTransition();

  const upcoming = appointments.filter(
    (a) => a.status !== "cancelled" && new Date(a.end_time) >= new Date()
  );
  const past = appointments.filter(
    (a) => a.status === "cancelled" || new Date(a.end_time) < new Date()
  );

  function book() {
    if (!leadId || !selectedSlot) {
      toast.error("Pick a lead and a time slot first");
      return;
    }
    startTransition(async () => {
      const result = await createAppointment({
        lead_id: leadId,
        start_time: selectedSlot.start,
        end_time: selectedSlot.end,
      });
      if (result.success) {
        toast.success("Inspection booked — confirmation draft is in the Inbox for approval");
        setSelectedSlot(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function setStatus(id: string, status: "confirmed" | "cancelled" | "completed") {
    startTransition(async () => {
      const result = await updateAppointmentStatus(id, status);
      if (result.success) router.refresh();
      else toast.error(result.error);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarCheck className="h-4 w-4 text-primary" />
              Upcoming inspections
            </CardTitle>
            <CardDescription>
              Booked internally, by the AI call assistant, or manually. Google Calendar sync is a
              planned connector — the internal calendar powers the demo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcoming.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nothing booked yet — book one on the right, or let an AI call do it.
              </p>
            ) : (
              upcoming.map((appt) => (
                <div key={appt.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium capitalize">{appt.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDateTime(appt.start_time)}
                      {appt.location ? ` · ${appt.location}` : ""}
                      {appt.source === "ai_call" ? " · booked by AI call" : ""}
                    </p>
                  </div>
                  <Badge className={STATUS_STYLES[appt.status]} variant="secondary">
                    {appt.status}
                  </Badge>
                  {appt.lead && (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/app/leads/${appt.lead.id}`}>Lead</Link>
                    </Button>
                  )}
                  {appt.status === "scheduled" && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => setStatus(appt.id, "confirmed")}
                    >
                      <Check className="h-3.5 w-3.5" />
                      Confirm
                    </Button>
                  )}
                  {(appt.status === "scheduled" || appt.status === "confirmed") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => setStatus(appt.id, "cancelled")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {past.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Past & cancelled</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {past.slice(0, 8).map((appt) => (
                <div key={appt.id} className="flex items-center gap-3 rounded-lg border p-3 opacity-70">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium capitalize">{appt.title}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(appt.start_time)}</p>
                  </div>
                  <Badge className={STATUS_STYLES[appt.status]} variant="secondary">
                    {appt.status}
                  </Badge>
                  {(appt.status === "scheduled" || appt.status === "confirmed") && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => setStatus(appt.id, "completed")}
                    >
                      Mark complete
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarPlus className="h-4 w-4 text-primary" />
            Book an inspection
          </CardTitle>
          <CardDescription>Pick a lead, then an open slot from the availability below.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={leadId} onValueChange={setLeadId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a lead…" />
            </SelectTrigger>
            <SelectContent>
              {leads.map((lead) => (
                <SelectItem key={lead.id} value={lead.id}>
                  {lead.first_name} {lead.last_name} — {lead.service_type.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="grid grid-cols-2 gap-1.5">
            {slots.length === 0 ? (
              <p className="col-span-2 text-sm text-muted-foreground">
                No open slots this week — adjust availability below.
              </p>
            ) : (
              slots.map((slot) => (
                <button
                  key={slot.start}
                  type="button"
                  onClick={() => setSelectedSlot(slot)}
                  className={cn(
                    "rounded-md border px-2 py-1.5 text-xs transition-colors hover:border-primary",
                    selectedSlot?.start === slot.start &&
                      "border-primary bg-primary/10 font-medium text-primary"
                  )}
                >
                  {slot.label}
                </button>
              ))
            )}
          </div>

          <Button className="w-full" onClick={book} disabled={pending || !leadId || !selectedSlot}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />}
            Book inspection
          </Button>
          <p className="text-xs text-muted-foreground">
            Booking moves the lead to Appointment Scheduled and drafts a confirmation message for
            approval.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
