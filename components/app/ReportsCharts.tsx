"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
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

export interface NamedCount {
  name: string;
  value: number;
}

export interface ReportsChartsData {
  leadsByService: NamedCount[];
  pipelineByStage: NamedCount[];
  leadsBySource: NamedCount[];
  revenueByService: NamedCount[];
  bookingRateBySource: NamedCount[];
  overdueByRep: NamedCount[];
  leadVolumeOverTime: NamedCount[];
  urgencyMix: NamedCount[];
}

const PALETTE = ["#234e3a", "#c79a3b", "#2563eb", "#b45309", "#8a928c", "#15803d", "#b42318"];

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function SimpleBarChart({
  data,
  color = "#234e3a",
  horizontal = false,
  percent = false,
}: {
  data: NamedCount[];
  color?: string;
  horizontal?: boolean;
  percent?: boolean;
}) {
  const formatter = percent ? (value: unknown) => `${value}%` : undefined;
  if (horizontal) {
    return (
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} layout="vertical" margin={{ left: 50 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" allowDecimals={false} fontSize={12} tickFormatter={formatter} />
          <YAxis type="category" dataKey="name" width={130} fontSize={12} />
          <Tooltip formatter={formatter} />
          <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" fontSize={11} interval={0} angle={-20} textAnchor="end" height={50} />
        <YAxis allowDecimals={false} fontSize={12} tickFormatter={formatter} />
        <Tooltip formatter={formatter} />
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ReportsCharts({ data }: { data: ReportsChartsData }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ChartCard
        title="Leads by Service Type"
        description="Where demand is coming from across service lines."
      >
        <SimpleBarChart data={data.leadsByService} />
      </ChartCard>

      <ChartCard
        title="Pipeline by Stage"
        description="How leads are distributed through the sales funnel — wide tops and narrow bottoms are normal; bulges show where deals stall."
      >
        <SimpleBarChart data={data.pipelineByStage} horizontal color="#2563eb" />
      </ChartCard>

      <ChartCard
        title="Lead Source Performance"
        description="Which marketing channels are driving the most lead volume."
      >
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={data.leadsBySource}
              dataKey="value"
              nameKey="name"
              innerRadius={55}
              outerRadius={90}
              label={(entry) => entry.name}
            >
              {data.leadsBySource.map((entry, index) => (
                <Cell key={entry.name} fill={PALETTE[index % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Revenue by Service Line"
        description="Estimated value of won work by service — shows which lines carry the business."
      >
        <SimpleBarChart data={data.revenueByService} color="#c79a3b" />
      </ChartCard>

      <ChartCard
        title="Appointment Booking Rate by Source"
        description="Share of each channel's leads that reached the appointment stage or beyond."
      >
        <SimpleBarChart data={data.bookingRateBySource} color="#15803d" percent />
      </ChartCard>

      <ChartCard
        title="Overdue Follow-Ups by Rep"
        description="Open tasks past their due date, by owner — a coaching signal, not a scoreboard."
      >
        <SimpleBarChart data={data.overdueByRep} horizontal color="#b45309" />
      </ChartCard>

      <ChartCard
        title="Lead Volume Over Time"
        description="Daily lead submissions over the last 30 days."
      >
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data.leadVolumeOverTime}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" fontSize={11} />
            <YAxis allowDecimals={false} fontSize={12} />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="#234e3a" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="AI Urgency Mix"
        description="How incoming leads are being classified — a spike in emergencies usually follows storms."
      >
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={data.urgencyMix}
              dataKey="value"
              nameKey="name"
              innerRadius={55}
              outerRadius={90}
              label={(entry) => entry.name}
            >
              {data.urgencyMix.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={
                    { Emergency: "#b42318", High: "#b45309", Medium: "#2563eb", Low: "#8a928c" }[
                      entry.name
                    ] ?? "#8a928c"
                  }
                />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
