"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange, ChevronDown, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  addAvailabilityWindow,
  deleteAvailabilityWindow,
  setAvailabilityFromText,
} from "@/lib/actions/appointments";
import type { AppointmentWithLead, AvailabilityWindow, Profile } from "@/types/app";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TIME_OPTIONS = Array.from({ length: 25 }, (_, i) => {
  const h = 6 + Math.floor(i / 2);
  const m = i % 2 === 0 ? "00" : "30";
  return `${String(h).padStart(2, "0")}:${m}`;
}).filter((t) => t <= "18:00");

function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

function nextDateForDay(dayOfWeek: number) {
  const date = new Date();
  const daysAhead = (dayOfWeek - date.getDay() + 7) % 7;
  date.setDate(date.getDate() + daysAhead);
  return date;
}

function formatAvailabilityDate(dayOfWeek: number) {
  const date = nextDateForDay(dayOfWeek);
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

function demoDate(daysAhead: number, hour: number, minute = 0) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function fallbackDemoAppointments(estimatorId: string, estimatorName: string): AppointmentWithLead[] {
  if (!estimatorId) return [];
  const seed = estimatorName.length % 3;
  const starts = [
    demoDate(0, 10 + seed, 30),
    demoDate(1, 13 + seed, 0),
    demoDate(3, 9 + seed, 0),
  ];
  return starts.map((start, index) => {
    const end = new Date(start.getTime() + 60 * 60_000);
    const service = index === 0 ? "roofing" : index === 1 ? "windows" : "siding";
    const firstName = index === 0 ? "Marta" : index === 1 ? "Eli" : "Nora";
    const lastName = index === 0 ? "Fields" : index === 1 ? "Bennett" : "Klein";
    return {
      id: `demo-${estimatorId}-${index}`,
      lead_id: null,
      contact_id: null,
      title: `${service} inspection — ${firstName} ${lastName}`,
      appointment_type: "inspection",
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      status: "scheduled",
      location: null,
      assigned_to: estimatorId,
      source: "manual",
      external_calendar_id: null,
      created_at: start.toISOString(),
      updated_at: start.toISOString(),
      lead: {
        id: `demo-lead-${index}`,
        first_name: firstName,
        last_name: lastName,
        service_type: service,
        urgency: index === 0 ? "high" : "medium",
      },
      assigned_profile: {
        id: estimatorId,
        full_name: estimatorName,
        role: "sales_rep",
      },
    } as AppointmentWithLead;
  });
}

/**
 * Estimator availability: the schedule the AI call assistant books against.
 * Windows are set manually per estimator (the people who actually run
 * inspections); a plain-English shortcut is available but optional.
 */
export function AvailabilityEditor({
  windows,
  profiles,
  appointments,
  initialEstimatorId,
  highlightedSlotStart,
}: {
  windows: AvailabilityWindow[];
  profiles: Pick<Profile, "id" | "full_name" | "role">[];
  appointments: AppointmentWithLead[];
  initialEstimatorId?: string | null;
  highlightedSlotStart?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Estimators = the team members who go on-site. Admins typically don't.
  const estimators = profiles.filter((p) => p.role !== "admin");
  const fallbackEstimators = estimators.length > 0 ? estimators : profiles;

  const [estimatorId, setEstimatorId] = useState<string>(
    initialEstimatorId ?? fallbackEstimators[0]?.id ?? ""
  );
  const [day, setDay] = useState("1");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [slotMinutes, setSlotMinutes] = useState("60");
  const [showText, setShowText] = useState(false);
  const [text, setText] = useState("");

  const nameById = new Map(profiles.map((p) => [p.id, p.full_name]));
  const selectedEstimatorName = nameById.get(estimatorId) ?? "selected estimator";
  const highlightedSlot = highlightedSlotStart ? new Date(highlightedSlotStart) : null;
  const estimatorAppointments = appointments
    .filter(
      (appointment) =>
        appointment.assigned_to === estimatorId &&
        appointment.status !== "cancelled" &&
        new Date(appointment.end_time) >= new Date()
    )
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  const demoCalendarAppointments =
    estimatorAppointments.length > 0
      ? estimatorAppointments
      : fallbackDemoAppointments(estimatorId, selectedEstimatorName);

  function windowStart(win: AvailabilityWindow) {
    const start = nextDateForDay(win.day_of_week);
    const [hours, minutes] = win.start_time.split(":").map(Number);
    start.setHours(hours, minutes ?? 0, 0, 0);
    return start;
  }

  function windowEnd(win: AvailabilityWindow) {
    const end = nextDateForDay(win.day_of_week);
    const [hours, minutes] = win.end_time.split(":").map(Number);
    end.setHours(hours, minutes ?? 0, 0, 0);
    return end;
  }

  function isBookedWindow(win: AvailabilityWindow) {
    const start = windowStart(win).getTime();
    const end = windowEnd(win).getTime();
    return estimatorAppointments.some((appointment) => {
      const apptStart = new Date(appointment.start_time).getTime();
      const apptEnd = new Date(appointment.end_time).getTime();
      return apptStart < end && apptEnd > start;
    });
  }

  function isHighlightedWindow(win: AvailabilityWindow) {
    if (!highlightedSlot || Number.isNaN(highlightedSlot.getTime())) return false;
    return Math.abs(windowStart(win).getTime() - highlightedSlot.getTime()) < 15 * 60_000;
  }

  function addWindow() {
    startTransition(async () => {
      const result = await addAvailabilityWindow({
        estimator_id: estimatorId || null,
        day_of_week: Number(day),
        start_time: startTime,
        end_time: endTime,
        slot_minutes: Number(slotMinutes),
      });
      if (result.success) {
        toast.success("Availability window added");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function applyText() {
    startTransition(async () => {
      const result = await setAvailabilityFromText(text, estimatorId || null);
      if (result.success) {
        toast.success(
          `Schedule updated for ${nameById.get(estimatorId) ?? "estimator"} (${result.data.windows.length} window${result.data.windows.length === 1 ? "" : "s"})${result.data.usedAI ? "" : " — parsed with rules (AI not configured)"}`
        );
        setText("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteAvailabilityWindow(id);
      if (result.success) router.refresh();
      else toast.error(result.error);
    });
  }

  // Group windows by estimator for display. The selected estimator also acts
  // as the quick filter the tour uses when checking Jess Romero.
  const grouped = new Map<string, AvailabilityWindow[]>();
  for (const win of windows.filter((win) => (!estimatorId || win.user_id === estimatorId) && !isBookedWindow(win))) {
    const key = win.user_id ?? "company";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(win);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Estimator availability</CardTitle>
        <CardDescription>
          The weekly schedule the AI call assistant books inspections against — set per estimator
          (the team members who actually go on-site).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Manual add */}
        <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="space-y-1.5 lg:col-span-2">
            <Label>Estimator</Label>
            <Select value={estimatorId} onValueChange={setEstimatorId}>
              <SelectTrigger data-tour="appointments-estimator-filter">
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {fallbackEstimators.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Select value={day} onValueChange={setDay}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAYS.map((name, idx) => (
                  <SelectItem key={name} value={String(idx)}>
                    {formatAvailabilityDate(idx)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>From</Label>
            <Select value={startTime} onValueChange={setStartTime}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {formatTime(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>To</Label>
            <Select value={endTime} onValueChange={setEndTime}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {formatTime(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Length</Label>
            <Select value={slotMinutes} onValueChange={setSlotMinutes}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["60", "90", "120"].map((m) => (
                  <SelectItem key={m} value={m}>
                    {m} min
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button size="sm" onClick={addWindow} disabled={pending || !estimatorId}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Add window
        </Button>

        {/* Plain-English shortcut */}
        <div className="rounded-lg border bg-secondary/30 p-3">
          <button
            type="button"
            className="flex w-full items-center gap-1.5 text-left text-sm font-medium"
            onClick={() => setShowText((v) => !v)}
          >
            <Sparkles className="h-3.5 w-3.5 text-brand-gold" />
            Or describe a week in plain English
            <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${showText ? "rotate-180" : ""}`} />
          </button>
          {showText && (
            <div className="mt-3 space-y-2">
              <Textarea
                placeholder='e.g. "Monday, Wednesday, and Friday from 10 to 4, but not Tuesday. 90 minutes per appointment."'
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={2}
                className="bg-background"
              />
              <p className="text-xs text-muted-foreground">
                Replaces the selected estimator&apos;s current schedule.
              </p>
              <Button size="sm" variant="outline" onClick={applyText} disabled={pending || !text.trim()}>
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Convert &amp; apply
              </Button>
            </div>
          )}
        </div>

        {/* Current windows, grouped by estimator */}
        <div className="grid gap-4 border-t pt-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">Open availability windows</p>
              <p className="text-xs text-muted-foreground">
                Recurring windows the AI can book against. Booked appointments are blocked on the
                calendar view.
              </p>
            </div>
          {grouped.size === 0 ? (
            <p className="text-sm text-muted-foreground">
              No windows configured for this estimator yet.
            </p>
          ) : (
            [...grouped.entries()].map(([key, wins]) => (
              <div key={key}>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {key === "company" ? "Company-wide" : (nameById.get(key) ?? "Team member")}
                </p>
                <div className="space-y-1.5">
                  {wins
                    .sort(
                      (a, b) =>
                        nextDateForDay(a.day_of_week).getTime() -
                          nextDateForDay(b.day_of_week).getTime() ||
                        a.start_time.localeCompare(b.start_time)
                    )
                    .map((win) => {
                      const highlighted = isHighlightedWindow(win);
                      return (
                        <div
                          key={win.id}
                          data-tour={highlighted ? "appointments-suggested-slot" : undefined}
                          className={`flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm ${
                            highlighted
                              ? "border-brand-gold bg-brand-gold/10 shadow-[0_0_0_3px_rgba(217,167,65,0.25)]"
                              : ""
                          }`}
                        >
                          <span className="w-16 font-medium">{formatAvailabilityDate(win.day_of_week)}</span>
                          <span className="flex-1 text-muted-foreground">
                            {formatTime(win.start_time)} – {formatTime(win.end_time)}
                          </span>
                          <Badge variant="secondary" className="text-[10px]">
                            {highlighted ? "AI found" : `${win.slot_minutes} min`}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={pending}
                            onClick={() => remove(win.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))
          )}
          </div>

          <div className="space-y-3 rounded-lg border bg-secondary/20 p-3" data-tour="appointments-estimator-calendar">
            <div className="flex items-start gap-2">
              <CalendarRange className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-medium">Estimator calendar</p>
                <p className="text-xs text-muted-foreground">
                  Booked inspections for {selectedEstimatorName}. When the AI books a slot, it
                  appears here and is no longer offered as open time.
                </p>
              </div>
            </div>
            {demoCalendarAppointments.length === 0 ? (
              <p className="rounded-md border bg-background px-3 py-6 text-center text-sm text-muted-foreground">
                No booked inspections for this estimator yet.
              </p>
            ) : (
              <div className="space-y-2">
                {demoCalendarAppointments.slice(0, 6).map((appointment) => (
                  <div key={appointment.id} className="rounded-md border bg-background px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {new Date(appointment.start_time).toLocaleDateString("en-US", {
                          month: "2-digit",
                          day: "2-digit",
                        })}
                        {" · "}
                        {new Date(appointment.start_time).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                      <Badge variant="secondary" className="capitalize">
                        {appointment.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {appointment.lead
                        ? `${appointment.lead.first_name} ${appointment.lead.last_name} · ${appointment.lead.service_type.replace(/_/g, " ")}`
                        : appointment.title}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
