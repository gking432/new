"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { analyzeFeedback } from "@/lib/actions";
import type { FeedbackAnalysisOutput } from "@/lib/ai/schemas";
import { CATEGORY_LABELS, RISK_STYLES, SENTIMENT_STYLES } from "@/lib/utils/statuses";

const SOURCE_OPTIONS = [
  ["google_review", "Google review"],
  ["survey", "Survey"],
  ["call_note", "Call note"],
  ["email", "Email"],
  ["other", "Other"],
] as const;

const NONE = "__none__";

export function FeedbackAnalyzer() {
  const [source, setSource] = useState("google_review");
  const [customerName, setCustomerName] = useState("");
  const [rating, setRating] = useState<string>(NONE);
  const [text, setText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<{ analysis: FeedbackAnalysisOutput; aiUsed: boolean } | null>(
    null
  );

  async function analyze() {
    setAnalyzing(true);
    const response = await analyzeFeedback({
      source: source as "google_review",
      customer_name: customerName,
      rating: rating === NONE ? null : Number(rating),
      feedback_text: text,
    });
    setAnalyzing(false);
    if (response.success && response.data) {
      setResult({
        analysis: response.data.feedback.raw_output as FeedbackAnalysisOutput,
        aiUsed: response.data.aiUsed,
      });
      window.dispatchEvent(new CustomEvent("northstar-feedback-analyzed"));
      window.dispatchEvent(new CustomEvent("northstar-task-created"));
      toast.success("Review analyzed - manager action and response draft prepared");
    } else if (!response.success) {
      toast.error(response.error);
    }
  }

  const analysis = result?.analysis;

  function loadDemoReview() {
    setSource("google_review");
    setCustomerName("Melissa Grant");
    setRating("2");
    setText(
      "The roof repair looks fine, but our appointment was moved twice and nobody called us back. I had to leave three messages before I got an answer. I would like a manager to explain what happened."
    );
    setResult(null);
    window.dispatchEvent(new CustomEvent("northstar-feedback-loaded"));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card data-tour="feedback-analyzer">
        <CardHeader>
          <CardTitle>Analyze feedback</CardTitle>
          <CardDescription>
            Paste a review, survey response, or call note. High-risk feedback automatically
            creates a manager review task.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={loadDemoReview}
            data-tour="feedback-load-demo"
          >
            <Sparkles className="h-4 w-4" />
            Load a new 2-star review
          </Button>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Rating (optional)</Label>
              <Select value={rating} onValueChange={setRating}>
                <SelectTrigger>
                  <SelectValue placeholder="No rating" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No rating</SelectItem>
                  {[5, 4, 3, 2, 1].map((stars) => (
                    <SelectItem key={stars} value={String(stars)}>
                      {stars} star{stars === 1 ? "" : "s"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="customer-name">Customer name (optional)</Label>
            <Input
              id="customer-name"
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="feedback-text">Feedback text</Label>
            <Textarea
              id="feedback-text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={6}
              placeholder="The crew was professional, but I had to call twice to confirm the appointment…"
            />
          </div>
          <Button
            onClick={analyze}
            disabled={analyzing || text.trim().length < 10}
            className="w-full"
            data-tour="feedback-analyze"
          >
            {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Analyze Feedback
          </Button>
        </CardContent>
      </Card>

      <Card data-tour="feedback-analysis-result">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Analysis</CardTitle>
            {result ? (
              <Badge variant="outline" className="text-xs">
                {result.aiUsed ? "AI analysis" : "Keyword heuristics (AI offline)"}
              </Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!analysis ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              The analysis will appear here.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className={SENTIMENT_STYLES[analysis.sentiment].className}>
                  {SENTIMENT_STYLES[analysis.sentiment].label}
                </Badge>
                <Badge variant="outline" className={RISK_STYLES[analysis.risk_level].className}>
                  {RISK_STYLES[analysis.risk_level].label}
                </Badge>
                <Badge variant="secondary">
                  {CATEGORY_LABELS[analysis.operational_category]}
                </Badge>
              </div>
              <p className="text-sm">{analysis.summary}</p>
              {analysis.key_praise.length > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-status-success">
                    Key praise
                  </p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
                    {analysis.key_praise.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {analysis.key_complaints.length > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-status-urgent">
                    Key complaints
                  </p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
                    {analysis.key_complaints.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="rounded-lg border bg-secondary/30 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Suggested internal action
                </p>
                <p className="mt-1 text-sm">{analysis.suggested_internal_action}</p>
              </div>
              <div className="rounded-lg border bg-secondary/30 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Suggested customer response (AI draft — edit before posting)
                </p>
                <p className="mt-1 text-sm">{analysis.suggested_customer_response}</p>
              </div>
              {analysis.marketing_quote_opportunity ? (
                <div className="rounded-lg border border-brand-gold/40 bg-brand-gold/10 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-brand-gold">
                    Marketing quote opportunity
                  </p>
                  <p className="mt-1 text-sm">{analysis.marketing_quote_opportunity}</p>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
