import {
  MessageSquareText,
  Star,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FeedbackAnalyzer } from "@/components/app/FeedbackAnalyzer";
import { FeedbackCharts } from "@/components/app/FeedbackCharts";
import { FeedbackSourceSummary } from "@/components/app/FeedbackSourceSummary";
import { MetricCard } from "@/components/app/MetricCard";
import { getFeedbackList } from "@/lib/db/queries";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils/format";
import {
  CATEGORY_LABELS,
  RISK_STYLES,
  SENTIMENT_STYLES,
  labelFor,
} from "@/lib/utils/statuses";
import type { Feedback } from "@/types/app";
import { isLocalDemoMode } from "@/lib/demo/mode";
import { getLocalFeedback } from "@/lib/demo/localData";

export const dynamic = "force-dynamic";

const REVIEW_SOURCE_LABELS: Record<string, string> = {
  google_reviews: "Google Reviews",
  yelp: "Yelp",
  yellow_pages: "Yellow Pages",
  facebook: "Facebook",
  angi: "Angi",
  bbb: "Better Business Bureau",
  nextdoor: "Nextdoor",
};

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function sampleFeedback(
  id: string,
  feedback: Omit<Feedback, "id" | "raw_output" | "created_at">
): Feedback {
  return {
    id,
    raw_output: { sample: true },
    created_at: daysAgo(Number(id.replace("sample-review-", "")) || 1),
    ...feedback,
  };
}

const SAMPLE_FEEDBACK: Feedback[] = [
  sampleFeedback("sample-review-1", {
    customer_name: "Marissa K.",
    source: "google_reviews",
    rating: 5,
    feedback_text:
      "Northstar came out the same day after the storm and found where water was getting in. The estimator explained everything clearly and the office kept me updated.",
    sentiment: "positive",
    risk_level: "low",
    summary: "Same-day storm response, clear inspection, and strong communication.",
    key_praise: ["same-day response", "clear explanation", "office communication"],
    key_complaints: [],
    operational_category: "communication",
    suggested_internal_action: "Ask for permission to use this as a marketing quote.",
    suggested_customer_response:
      "Thank the customer for calling out the fast storm response and communication.",
    marketing_quote_opportunity: "Same-day storm response and clear explanation.",
    tags: ["storm_response", "communication", "marketing_quote"],
  }),
  sampleFeedback("sample-review-2", {
    customer_name: "Derek W.",
    source: "yelp",
    rating: 2,
    feedback_text:
      "The roof repair looks fine, but nobody called me before moving the appointment. I had to rearrange work twice and did not know who to call.",
    sentiment: "negative",
    risk_level: "high",
    summary: "Customer is upset about appointment changes and poor communication.",
    key_praise: ["repair quality"],
    key_complaints: ["reschedule communication", "unclear point of contact"],
    operational_category: "scheduling",
    suggested_internal_action:
      "Manager should call, apologize, confirm the final appointment history, and review reschedule workflow.",
    suggested_customer_response:
      "Acknowledge the missed communication, apologize, and offer a direct manager contact.",
    marketing_quote_opportunity: null,
    tags: ["manager_review", "scheduling", "service_recovery"],
  }),
  sampleFeedback("sample-review-3", {
    customer_name: "Angela P.",
    source: "yellow_pages",
    rating: 4,
    feedback_text:
      "The new gutters look great and the crew cleaned up well. I wish the invoice had explained the add-on leaf protection option more clearly.",
    sentiment: "mixed",
    risk_level: "medium",
    summary: "Good install and cleanup, with some confusion around add-on pricing.",
    key_praise: ["gutter installation", "cleanup"],
    key_complaints: ["pricing clarity", "leaf protection explanation"],
    operational_category: "pricing",
    suggested_internal_action:
      "Review proposal template language for optional leaf protection add-ons.",
    suggested_customer_response:
      "Thank the customer, clarify the add-on, and offer to answer any remaining invoice questions.",
    marketing_quote_opportunity: "The new gutters look great and the crew cleaned up well.",
    tags: ["pricing_clarity", "gutters", "leaf_protection"],
  }),
  sampleFeedback("sample-review-4", {
    customer_name: "Thomas R.",
    source: "facebook",
    rating: 5,
    feedback_text:
      "We replaced twelve windows and the house is quieter already. The sales rep was patient and the installers were careful around our landscaping.",
    sentiment: "positive",
    risk_level: "low",
    summary: "Strong window project review with praise for sales and installation care.",
    key_praise: ["sales experience", "installation care", "window quality"],
    key_complaints: [],
    operational_category: "installation_quality",
    suggested_internal_action: "Ask for before/after photos and referral permission.",
    suggested_customer_response:
      "Thank the customer and mention the crew will appreciate the note about the landscaping.",
    marketing_quote_opportunity:
      "The house is quieter already, and the installers were careful around our landscaping.",
    tags: ["windows", "sales_experience", "installation_quality"],
  }),
  sampleFeedback("sample-review-5", {
    customer_name: "Cynthia M.",
    source: "angi",
    rating: 3,
    feedback_text:
      "The bath looks nice now, but the job took longer than expected and I had to ask for updates more than once.",
    sentiment: "mixed",
    risk_level: "medium",
    summary: "Finished bath project is positive, but project communication felt too slow.",
    key_praise: ["finished bath quality"],
    key_complaints: ["project updates", "timeline communication"],
    operational_category: "communication",
    suggested_internal_action:
      "Add customer update checkpoints for bath projects that run past the planned timeline.",
    suggested_customer_response:
      "Acknowledge the delay, thank them for patience, and explain the update process being improved.",
    marketing_quote_opportunity: null,
    tags: ["bath", "communication", "project_updates"],
  }),
  sampleFeedback("sample-review-6", {
    customer_name: "Robert L.",
    source: "bbb",
    rating: 1,
    feedback_text:
      "I have called three times about a siding warranty question and still do not have an answer. I need someone from management to call me.",
    sentiment: "negative",
    risk_level: "urgent",
    summary: "Unresolved siding warranty concern needs immediate manager follow-up.",
    key_praise: [],
    key_complaints: ["unanswered warranty issue", "repeat calls", "manager escalation"],
    operational_category: "warranty",
    suggested_internal_action:
      "Assign urgent manager task, call customer today, and document the warranty resolution plan.",
    suggested_customer_response:
      "Apologize for the delay, confirm a manager is reviewing it, and provide a direct callback window.",
    marketing_quote_opportunity: null,
    tags: ["urgent", "warranty", "manager_review"],
  }),
  sampleFeedback("sample-review-7", {
    customer_name: "Nina S.",
    source: "nextdoor",
    rating: 5,
    feedback_text:
      "Several neighbors recommended them and now I see why. The siding quote was clear, fair, and easy to understand.",
    sentiment: "positive",
    risk_level: "low",
    summary: "Neighbor referral led to a positive siding sales experience.",
    key_praise: ["referral trust", "clear quote", "fair pricing"],
    key_complaints: [],
    operational_category: "sales_experience",
    suggested_internal_action: "Tag as referral source and ask for a neighborhood recommendation.",
    suggested_customer_response:
      "Thank the customer and invite them to reach out with any siding questions.",
    marketing_quote_opportunity: "The siding quote was clear, fair, and easy to understand.",
    tags: ["referral", "siding", "sales_experience"],
  }),
];

function sourceLabel(source: string | null) {
  if (!source) return "Unknown";
  return REVIEW_SOURCE_LABELS[source] ?? source.replace(/_/g, " ");
}

export default async function FeedbackPage() {
  const databaseFeedback = isLocalDemoMode()
    ? await getLocalFeedback()
    : await (async () => {
        const supabase = await createClient();
        return getFeedbackList(supabase);
      })();
  const sampleMode = databaseFeedback.length === 0;
  const feedback = sampleMode ? SAMPLE_FEEDBACK : databaseFeedback;

  const rated = feedback.filter((item) => item.rating != null);
  const averageRating =
    rated.length > 0
      ? (rated.reduce((sum, item) => sum + (item.rating ?? 0), 0) / rated.length).toFixed(1)
      : "—";
  const negativeCount = feedback.filter((item) => item.sentiment === "negative").length;

  const complaintCounts = new Map<string, number>();
  const praiseCounts = new Map<string, number>();
  for (const item of feedback) {
    if (item.sentiment === "negative" || item.sentiment === "mixed") {
      const category = item.operational_category ?? "unknown";
      complaintCounts.set(category, (complaintCounts.get(category) ?? 0) + 1);
    }
    if (item.sentiment === "positive") {
      const category = item.operational_category ?? "unknown";
      praiseCounts.set(category, (praiseCounts.get(category) ?? 0) + 1);
    }
  }
  const topComplaint = [...complaintCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const topPraise = [...praiseCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const sourceStats = [...feedback.reduce((map, item) => {
    const source = item.source ?? "unknown";
    const current = map.get(source) ?? { count: 0, ratingTotal: 0, rated: 0, risk: 0 };
    current.count += 1;
    if (item.rating != null) {
      current.ratingTotal += item.rating;
      current.rated += 1;
    }
    if (item.risk_level === "high" || item.risk_level === "urgent") current.risk += 1;
    map.set(source, current);
    return map;
  }, new Map<string, { count: number; ratingTotal: number; rated: number; risk: number }>()).entries()].map(
    ([source, stats]) => ({
      source,
      label: sourceLabel(source),
      count: stats.count,
      average: stats.rated > 0 ? (stats.ratingTotal / stats.rated).toFixed(1) : "—",
      risk: stats.risk,
    })
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Review Management</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Triage incoming reviews, understand customer risk, and approve AI-assisted public
            responses from one workspace.
          </p>
        </div>
        <Badge variant="secondary">{sampleMode ? "Sample review feed" : "Current reviews"}</Badge>
      </div>

      <FeedbackAnalyzer />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Average Rating" value={averageRating} icon={Star} />
        <MetricCard
          label="Negative Feedback"
          value={negativeCount}
          icon={ThumbsDown}
          tone={negativeCount > 0 ? "urgent" : "default"}
        />
        <MetricCard
          label="Top Complaint Area"
          value={labelFor(CATEGORY_LABELS, topComplaint)}
          icon={MessageSquareText}
        />
        <MetricCard
          label="Top Praise Area"
          value={labelFor(CATEGORY_LABELS, topPraise)}
          icon={ThumbsUp}
          tone="success"
        />
      </div>

      <FeedbackSourceSummary sources={sourceStats} />

      <FeedbackCharts feedback={feedback} />

      <Card>
        <CardHeader>
          <CardTitle>{sampleMode ? "Sample review feed" : "Feedback history"}</CardTitle>
          <CardDescription>
            Connected reviews and completed AI analyses appear here as an auditable history.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Sentiment</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Summary</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {feedback.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.customer_name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{sourceLabel(item.source)}</TableCell>
                  <TableCell>{item.rating != null ? `${item.rating}★` : "—"}</TableCell>
                  <TableCell>
                    {item.sentiment ? (
                      <Badge variant="outline" className={SENTIMENT_STYLES[item.sentiment].className}>
                        {SENTIMENT_STYLES[item.sentiment].label}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {item.risk_level ? (
                      <Badge variant="outline" className={RISK_STYLES[item.risk_level].className}>
                        {RISK_STYLES[item.risk_level].label}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {labelFor(CATEGORY_LABELS, item.operational_category)}
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <span className="line-clamp-2 text-sm text-muted-foreground">
                      {item.summary ?? item.feedback_text}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDate(item.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
