"use client";

import { useEffect, useRef } from "react";
import { Activity } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export interface DemoEvent {
  at: Date;
  label: string;
}

/** Live event stream that makes the automation sequence visible during demos. */
export function DemoEventLog({ events }: { events: DemoEvent[] }) {
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    boxRef.current?.scrollTo({ top: 99999, behavior: "smooth" });
  }, [events.length]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-primary" />
          Live demo event log
        </CardTitle>
        <CardDescription>Watch what the system does behind the scenes as you run scenarios.</CardDescription>
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
                  {event.at.toLocaleTimeString("en-US", {
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
