"use client";

import { useState } from "react";
import { CheckCircle2, ChevronRight, Loader2, Send, Sparkles, Star } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { analyzeFeedback, publishFeedbackResponse } from "@/lib/actions";
import type { FeedbackAnalysisOutput } from "@/lib/ai/schemas";
import { CATEGORY_LABELS, RISK_STYLES, SENTIMENT_STYLES } from "@/lib/utils/statuses";

const INCOMING_REVIEW = {
  source: "google_review" as const,
  customer_name: "Melissa Grant",
  rating: 2,
  feedback_text:
    "The roof repair looks fine, but our appointment was moved twice and nobody called us back. I had to leave three messages before I got an answer. I would like a manager to explain what happened.",
};

export function FeedbackAnalyzer() {
  const [reviewOpen, setReviewOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [posting, setPosting] = useState(false);
  const [result, setResult] = useState<{
    analysis: FeedbackAnalysisOutput;
    aiUsed: boolean;
    feedbackId: string;
    responsePosted: boolean;
  } | null>(null);
  const [responseDraft, setResponseDraft] = useState("");

  function openIncomingReview() {
    setReviewOpen(true);
    window.dispatchEvent(new CustomEvent("northstar-feedback-opened"));
  }

  async function analyze() {
    setAnalyzing(true);
    const response = await analyzeFeedback(INCOMING_REVIEW);
    setAnalyzing(false);
    if (response.success && response.data) {
      setResult({
        analysis: response.data.feedback.raw_output as FeedbackAnalysisOutput,
        aiUsed: response.data.aiUsed,
        feedbackId: response.data.feedback.id,
        responsePosted: false,
      });
      setResponseDraft(response.data.feedback.suggested_customer_response ?? "");
      window.dispatchEvent(new CustomEvent("northstar-feedback-analyzed"));
      toast.success("Review analyzed and response draft prepared");
    } else if (!response.success) {
      toast.error(response.error);
    }
  }

  async function postResponse() {
    if (!result?.feedbackId) return;
    setPosting(true);
    const response = await publishFeedbackResponse(result.feedbackId, responseDraft);
    setPosting(false);
    if (!response.success) {
      toast.error(response.error);
      return;
    }
    setResult((current) => (current ? { ...current, responsePosted: true } : current));
    window.dispatchEvent(new CustomEvent("northstar-feedback-response-posted"));
    toast.success("Response posted to Google (simulated)");
  }

  const analysis = result?.analysis;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card data-tour="feedback-analyzer">
        <CardHeader>
          <CardTitle>Review inbox</CardTitle>
          <CardDescription>
            New public reviews arrive here from connected reputation channels.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!reviewOpen ? (
            <button
              type="button"
              onClick={openIncomingReview}
              data-tour="feedback-new-review"
              className="group w-full rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-left shadow-sm transition-colors hover:border-blue-400 hover:bg-blue-50"
            >
              <span className="flex items-start gap-3">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                  2★
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-blue-950">New Google review</span>
                    <Badge className="bg-blue-600 text-white">New</Badge>
                  </span>
                  <span className="mt-1 block text-sm font-medium text-blue-950/80">
                    Melissa Grant · Appointment moved twice
                  </span>
                  <span className="mt-2 block text-sm text-blue-950/65">
                    Open the original review before taking action.
                  </span>
                </span>
                <ChevronRight className="mt-2 h-5 w-5 shrink-0 text-blue-700 transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>
          ) : (
            <div className="rounded-xl border bg-card p-4 shadow-sm" data-tour="feedback-open-review">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Melissa Grant</span>
                    <Badge variant="outline">Google</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Received just now</p>
                </div>
                <div className="flex items-center gap-0.5" aria-label="2 out of 5 stars">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-4 w-4 ${
                        star <= 2 ? "fill-amber-400 text-amber-400" : "text-zinc-300"
                      }`}
                    />
                  ))}
                </div>
              </div>
              <blockquote className="py-5 text-sm leading-6 text-foreground">
                “{INCOMING_REVIEW.feedback_text}”
              </blockquote>
              <Button
                onClick={analyze}
                disabled={analyzing || Boolean(result)}
                className="w-full"
                data-tour="feedback-analyze"
              >
                {analyzing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {result ? "Analysis complete" : "Have AI analyze it"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-tour="feedback-analysis-result">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Recommended response</CardTitle>
            {result ? (
              <Badge variant="outline" className="text-xs">
                {result.aiUsed ? "Schema-validated AI analysis" : "Rule-based fallback"}
              </Badge>
            ) : null}
          </div>
          <CardDescription>
            AI structures the risk and drafts the reply; a human approves what gets posted.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!analysis ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Open the new review and ask AI to analyze it.
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
              {analysis.key_complaints.length > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-status-urgent">
                    Complaint themes
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
                  Recommended recovery action
                </p>
                <p className="mt-1 text-sm">{analysis.suggested_internal_action}</p>
              </div>
              <div className="rounded-lg border bg-secondary/30 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Public response draft (editable)
                </p>
                <Textarea
                  className="mt-2 bg-background"
                  rows={5}
                  value={responseDraft}
                  onChange={(event) => setResponseDraft(event.target.value)}
                  disabled={result.responsePosted}
                  aria-label="Public response draft"
                />
                {result.responsePosted ? (
                  <div
                    className="mt-3 flex items-center gap-2 rounded-md bg-status-success/10 px-3 py-2 text-sm font-medium text-status-success"
                    data-tour="feedback-response-status"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Posted to Google (simulated)
                  </div>
                ) : (
                  <Button
                    className="mt-3 w-full"
                    onClick={postResponse}
                    disabled={posting || responseDraft.trim().length < 20}
                    data-tour="feedback-post-response"
                  >
                    {posting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Approve & post to Google (simulated)
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
