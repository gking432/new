import { MessageSquareText, Star, ThumbsDown, ThumbsUp, TimerOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { MetricCard } from "@/components/app/MetricCard";
import { getFeedbackList, getTasks } from "@/lib/db/queries";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils/format";
import {
  CATEGORY_LABELS,
  RISK_STYLES,
  SENTIMENT_STYLES,
  labelFor,
} from "@/lib/utils/statuses";

export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  const supabase = await createClient();
  const [feedback, tasks] = await Promise.all([getFeedbackList(supabase), getTasks(supabase)]);

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
  const openFeedbackTasks = tasks.filter(
    (task) => task.type === "manager_review" && (task.status === "open" || task.status === "in_progress")
  ).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
        <MetricCard label="Open Review Tasks" value={openFeedbackTasks} icon={TimerOff} />
      </div>

      <FeedbackAnalyzer />

      <FeedbackCharts feedback={feedback} />

      <Card>
        <CardHeader>
          <CardTitle>Feedback history</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {feedback.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No feedback analyzed yet. Paste a review above to get started.
            </p>
          ) : (
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
                    <TableCell className="text-muted-foreground">
                      {item.source?.replace(/_/g, " ") ?? "—"}
                    </TableCell>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
