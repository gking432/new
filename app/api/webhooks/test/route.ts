import { NextResponse } from "next/server";

/**
 * Webhook test endpoint. Demonstrates the shape of events this system sends
 * to Make/Zapier-style automation platforms. If WEBHOOK_SECRET is set,
 * requests must include it in the X-Webhook-Secret header.
 */
export async function POST(request: Request) {
  const secret = process.env.WEBHOOK_SECRET;
  if (secret && request.headers.get("x-webhook-secret") !== secret) {
    return NextResponse.json({ success: false, error: "Invalid webhook secret" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    received_at: new Date().toISOString(),
    demo_mode: process.env.DEMO_MODE !== "false",
    echo: payload,
  });
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Webhook test endpoint is live. POST a JSON payload to echo it back.",
    example_payload: {
      event: "lead.created",
      lead: {
        name: "Sarah Mitchell",
        service_type: "storm_damage",
        urgency: "emergency",
      },
    },
  });
}
