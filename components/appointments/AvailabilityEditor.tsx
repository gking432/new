"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
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
import type { AvailabilityWindow, Profile } from "@/types/app";

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

/**
 * Estimator availability: the schedule the AI call assistant books against.
 * Windows are set manually per estimator (the people who actually run
 * inspections); a plain-English shortcut is available but optional.
 */
export function AvailabilityEditor({
  windows,
  profiles,
}: {
  windows: AvailabilityWindow[];
  profiles: Pick<Profile, "id" | "full_name" | "role">[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Estimators = the team members who go on-site. Admins typically don't.
  const estimators = profiles.filter((p) => p.role !== "admin");
  const fallbackEstimators = estimators.length > 0 ? estimators : profiles;

  const [estimatorId, setEstimatorId] = useState<string>(fallbackEstimators[0]?.id ?? "");
  const [day, setDay] = useState("1");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [slotMinutes, setSlotMinutes] = useState("60");
  const [showText, setShowText] = useState(false);
  const [text, setText] = useState("");

  const nameById = new Map(profiles.map((p) => [p.id, p.full_name]));

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

  // Group windows by estimator for display.
  const grouped = new Map<string, AvailabilityWindow[]>();
  for (const win of windows) {
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
              <SelectTrigger>
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
            <Label>Day</Label>
            <Select value={day} onValueChange={setDay}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAYS.map((name, idx) => (
                  <SelectItem key={name} value={String(idx)}>
                    {name}
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
        <div className="space-y-3 border-t pt-4">
          {windows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No windows configured — the default Mon–Fri 9–5 schedule applies.
            </p>
          ) : (
            [...grouped.entries()].map(([key, wins]) => (
              <div key={key}>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {key === "company" ? "Company-wide" : (nameById.get(key) ?? "Team member")}
                </p>
                <div className="space-y-1.5">
                  {wins
                    .sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time))
                    .map((win) => (
                      <div
                        key={win.id}
                        className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm"
                      >
                        <span className="w-24 font-medium">{DAYS[win.day_of_week]}</span>
                        <span className="flex-1 text-muted-foreground">
                          {formatTime(win.start_time)} – {formatTime(win.end_time)}
                        </span>
                        <Badge variant="secondary" className="text-[10px]">
                          {win.slot_minutes} min
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
                    ))}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
