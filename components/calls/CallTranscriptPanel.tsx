"use client";

import { useState } from "react";
import { Bot, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { CallTranscript, TranscriptTurn } from "@/types/app";

/**
 * Full transcripts stay out of the CRM timeline — they open in this modal
 * only when someone clicks "View Full Transcript".
 */
export function CallTranscriptPanel({
  transcript,
  triggerLabel = "View Full Transcript",
}: {
  transcript: CallTranscript;
  triggerLabel?: string;
}) {
  const [search, setSearch] = useState("");
  const turns: TranscriptTurn[] = Array.isArray(transcript.transcript_json)
    ? transcript.transcript_json
    : [];

  const filtered = search.trim()
    ? turns.filter((t) => t.text.toLowerCase().includes(search.toLowerCase()))
    : turns;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText className="h-3.5 w-3.5" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>Call transcript</DialogTitle>
          <DialogDescription>
            Stored for reference — the CRM timeline only carries the short AI note.
          </DialogDescription>
        </DialogHeader>
        <Input
          placeholder="Search the transcript…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
          {filtered.length === 0 && turns.length > 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No matching lines.</p>
          ) : filtered.length > 0 ? (
            filtered.map((turn, i) => (
              <div key={i} className={cn("flex", turn.speaker === "ai" ? "justify-start" : "justify-end")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                    turn.speaker === "ai" ? "bg-primary/10" : "bg-secondary"
                  )}
                >
                  <p className="mb-0.5 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {turn.speaker === "ai" && <Bot className="h-3 w-3" />}
                    {turn.speaker === "ai" ? "AI assistant" : "Customer"}
                    {typeof turn.at === "number" && (
                      <span className="font-normal normal-case">
                        · {Math.floor(turn.at / 60)}:{String(turn.at % 60).padStart(2, "0")}
                      </span>
                    )}
                  </p>
                  {turn.text}
                </div>
              </div>
            ))
          ) : (
            <pre className="whitespace-pre-wrap rounded-md bg-secondary p-3 text-sm">
              {transcript.transcript_text}
            </pre>
          )}
        </div>
        <Badge variant="secondary" className="w-fit text-[10px]">
          Transcript stored for reference
        </Badge>
      </DialogContent>
    </Dialog>
  );
}
