import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import {
  buildDemoReportEmail,
  REPORT_DAYS,
  REPORT_SECTIONS,
  REPORT_TIMEZONES,
  type DemoReportRequest,
} from "@/lib/reports/demoEmail";

export const dynamic = "force-dynamic";

const sectionIds = REPORT_SECTIONS.map((section) => section.id) as [string, ...string[]];
const dayNames = [...REPORT_DAYS] as [string, ...string[]];
const timezoneIds = REPORT_TIMEZONES.map((zone) => zone.value) as [string, ...string[]];

const requestSchema = z.object({
  email: z.string().trim().email().max(254),
  recipientName: z.string().trim().max(80).optional().default(""),
  reportName: z.string().trim().min(3).max(90),
  day: z.enum(dayNames),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  timezone: z.enum(timezoneIds),
  sections: z.array(z.enum(sectionIds)).min(1).max(REPORT_SECTIONS.length),
  website: z.string().max(0).optional().default(""),
});

const rateLimit = new Map<string, { count: number; resetAt: number }>();
const LIMIT = 3;
const WINDOW_MS = 60 * 60 * 1000;

function allowRequest(ip: string) {
  const now = Date.now();
  const current = rateLimit.get(ip);
  if (!current || current.resetAt <= now) {
    rateLimit.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (current.count >= LIMIT) return false;
  current.count += 1;
  return true;
}

export async function GET() {
  return NextResponse.json({ configured: Boolean(env("RESEND_API_KEY") && env("REPORT_EMAIL_FROM")) });
}

export async function POST(request: NextRequest) {
  const apiKey = env("RESEND_API_KEY");
  const from = env("REPORT_EMAIL_FROM");
  if (!apiKey || !from) {
    return NextResponse.json(
      { error: "Live email delivery is not configured yet.", code: "EMAIL_NOT_CONFIGURED" },
      { status: 503 }
    );
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!allowRequest(ip)) {
    return NextResponse.json(
      { error: "This demo can send up to three reports per hour. Please try again later." },
      { status: 429 }
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "The report request was not valid JSON." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Check the email, schedule, and report sections, then try again." },
      { status: 400 }
    );
  }

  const input = {
    email: parsed.data.email,
    recipientName: parsed.data.recipientName,
    reportName: parsed.data.reportName,
    day: parsed.data.day,
    time: parsed.data.time,
    timezone: parsed.data.timezone,
    sections: parsed.data.sections,
  };
  const message = buildDemoReportEmail(input as DemoReportRequest);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.email],
        reply_to: env("REPORT_EMAIL_REPLY_TO") || undefined,
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });
    const result = (await response.json()) as { id?: string; message?: string; name?: string };
    if (!response.ok) {
      return NextResponse.json(
        { error: "The email provider could not deliver this report. Please try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      delivered: true,
      id: result.id,
      schedule: message.schedule,
      sections: input.sections.length,
    });
  } catch {
    return NextResponse.json(
      { error: "The email service could not be reached. Please try again." },
      { status: 502 }
    );
  }
}
