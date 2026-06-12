"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CATEGORY_LABELS } from "@/lib/utils/statuses";
import type { Feedback } from "@/types/app";

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "#15803d",
  neutral: "#8a928c",
  negative: "#b42318",
  mixed: "#b45309",
};

export function FeedbackCharts({ feedback }: { feedback: Feedback[] }) {
  const byCategory = new Map<string, number>();
  const bySentiment = new Map<string, number>();
  const byRating = new Map<number, number>();

  for (const item of feedback) {
    const category = item.operational_category ?? "unknown";
    byCategory.set(category, (byCategory.get(category) ?? 0) + 1);
    if (item.sentiment) bySentiment.set(item.sentiment, (bySentiment.get(item.sentiment) ?? 0) + 1);
    if (item.rating != null) byRating.set(item.rating, (byRating.get(item.rating) ?? 0) + 1);
  }

  const categoryData = [...byCategory.entries()].map(([category, count]) => ({
    name: CATEGORY_LABELS[category] ?? category,
    count,
  }));
  const sentimentData = [...bySentiment.entries()].map(([sentiment, count]) => ({
    name: sentiment,
    value: count,
  }));
  const ratingData = [5, 4, 3, 2, 1].map((stars) => ({
    name: `${stars}★`,
    count: byRating.get(stars) ?? 0,
  }));

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Feedback by category</CardTitle>
          <CardDescription>Where operational issues and praise cluster.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={categoryData} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} fontSize={12} />
              <YAxis type="category" dataKey="name" width={110} fontSize={12} />
              <Tooltip />
              <Bar dataKey="count" fill="#234e3a" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sentiment mix</CardTitle>
          <CardDescription>Overall tone of recent feedback.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={sentimentData}
                dataKey="value"
                nameKey="name"
                innerRadius={50}
                outerRadius={80}
                label={(entry) => entry.name}
              >
                {sentimentData.map((entry) => (
                  <Cell key={entry.name} fill={SENTIMENT_COLORS[entry.name] ?? "#8a928c"} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rating distribution</CardTitle>
          <CardDescription>Star ratings where provided.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={ratingData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis allowDecimals={false} fontSize={12} />
              <Tooltip />
              <Bar dataKey="count" fill="#c79a3b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
