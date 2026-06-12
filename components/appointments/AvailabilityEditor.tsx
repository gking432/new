"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { deleteAvailabilityWindow, setAvailabilityFromText } from "@/lib/actions/appointments";
import type { AvailabilityWindow } from "@/types/app";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

export function AvailabilityEditor({ windows }: { windows: AvailabilityWindow[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await setAvailabilityFromText(text);
      if (result.success) {
        toast.success(
          `Availability updated (${result.data.windows.length} window${result.data.windows.length === 1 ? "" : "s"})${
            result.data.usedAI ? "" : " — parsed with rules (AI not configured)"
          }`
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">This week&apos;s appointment availability</CardTitle>
        <CardDescription>
          Describe it in plain English — AI converts it into structured windows the call assistant
          books against.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          placeholder='e.g. "I can do inspections Monday, Wednesday, and Friday from 10 to 4, but not Tuesday. Leave 90 minutes per appointment."'
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
        />
        <Button size="sm" onClick={save} disabled={pending || !text.trim()}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Update availability
        </Button>

        <div className="space-y-1.5 border-t pt-3">
          {windows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No windows configured — the default Mon–Fri 9–5 schedule applies.
            </p>
          ) : (
            windows.map((win) => (
              <div key={win.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm">
                <span className="font-medium">{DAYS[win.day_of_week]}</span>
                <span className="text-muted-foreground">
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
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
