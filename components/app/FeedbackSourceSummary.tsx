"use client";

import { useState } from "react";
import { AlertTriangle, MessageSquareText, Star } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface FeedbackSourceStat {
  source: string;
  label: string;
  count: number;
  average: string;
  risk: number;
}

export function FeedbackSourceSummary({ sources }: { sources: FeedbackSourceStat[] }) {
  const [selectedSource, setSelectedSource] = useState(sources[0]?.source ?? "");
  const selected = sources.find((source) => source.source === selectedSource) ?? sources[0];

  if (!selected) return null;

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Review source snapshot</CardTitle>
          <CardDescription>Choose a channel to inspect its current ratings and risk flags.</CardDescription>
        </div>
        <Select value={selected.source} onValueChange={setSelectedSource}>
          <SelectTrigger className="w-full sm:w-64" aria-label="Review source">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sources.map((source) => (
              <SelectItem key={source.source} value={source.source}>
                {source.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-lg border bg-secondary/20 p-3">
            <MessageSquareText className="h-4 w-4 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Review touchpoints</p>
              <p className="font-semibold">{selected.count}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border bg-secondary/20 p-3">
            <Star className="h-4 w-4 text-brand-gold" />
            <div>
              <p className="text-xs text-muted-foreground">Average rating</p>
              <p className="font-semibold">{selected.average}★</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border bg-secondary/20 p-3">
            <AlertTriangle className="h-4 w-4 text-status-urgent" />
            <div>
              <p className="text-xs text-muted-foreground">Risk flags</p>
              <p className="font-semibold">{selected.risk}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
