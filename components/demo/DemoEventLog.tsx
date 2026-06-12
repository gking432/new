"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  clearDemoEvents,
  readDemoEvents,
  subscribeDemoEvents,
  type DemoLogEntry,
} from "@/lib/demo-log";

/**
 * Live event stream that makes the automation sequence visible during demos.
 * Backed by sessionStorage so it survives navigation, and fed by every demo
 * surface (Demo Center actions, the floating call window, etc.).
 */
export function DemoEventLog() {
  const [events, setEvents] = useState<DemoLogEntry[]>([]);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setEvents(readDemoEvents());
    return subscribeDemoEvents(() => setEvents(readDemoEvents()));
  }, []);

  useEffect(() => {
    boxRef.current?.scrollTo({ top: 99999, behavior: "smooth" });
  }, [events.length]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Live demo event log
          </span>
          {events.length > 0 && (
            <Button variant="ghost" size="sm" className="h-7" onClick={clearDemoEvents}>
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </Button>
          )}
        </CardTitle>
        <CardDescription>
          What the system is doing behind the scenes — persists as you navigate.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          ref={boxRef}
          className="max-h-72 space-y-1.5 overflow-y-auto rounded-lg bg-brand-dark p-3 font-mono text-xs text-emerald-200/90"
        >
          {events.length === 0 ? (
            <p className="text-white/40">Run a scenario to see the event stream…</p>
          ) : (
            events.map((event, i) => (
              <p key={i} className="leading-relaxed">
                <span className="text-white/40">
                  {new Date(event.at).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>{" "}
                — {event.label}
              </p>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
