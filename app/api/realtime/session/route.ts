import { NextResponse } from "next/server";
import { z } from "zod";
import { getScriptedScenario } from "@/lib/calls/scriptedScenarios";
import { getAvailableSlots } from "@/lib/integrations/calendar/internalCalendar";
import { buildRealtimeInstructions } from "@/lib/realtime/prompts";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Lead } from "@/types/app";

/**
 * Creates a call record and (when configured) an ephemeral OpenAI Realtime
 * session token for the browser. The real API key never leaves the server —
 * the browser only ever sees a short-lived client secret.
 *
 * When Realtime is unavailable (no key, disabled, or the mint fails) the
 * response switches to scripted fallback mode so the demo always works. The
 * scripted scenario is returned in every response so the client can also fall
 * back mid-call if the live connection drops.
 */

const requestSchema = z.object({
  scenario: z.enum(["new_inbound_call", "existing_customer_call", "speed_to_lead_outbound"]),
  leadId: z.string().uuid().optional(),
  callerName: z.string().max(120).optional(),
  callerPhone: z.string().max(40).optional(),
  forceScripted: z.boolean().optional(),
});

// In-memory rate limit: this endpoint is reachable from the public
// speed-to-lead page, and each realtime session costs real money.
const sessionTimestamps: number[] = [];
function rateLimited() {
  const now = Date.now();
  while (sessionTimestamps.length && sessionTimestamps[0] < now - 60_000) {
    sessionTimestamps.shift();
  }
  if (sessionTimestamps.length >= 10) return true;
  sessionTimestamps.push(now);
  return false;
}

async function mintRealtimeSecret(args: {
  apiKey: string;
  model: string;
  instructions: string;
}): Promise<{ clientSecret: string; webrtcUrl: string; api: "ga" | "beta" } | null> {
  // GA endpoint first.
  try {
    const res = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model: args.model,
          instructions: args.instructions,
          audio: {
            input: { transcription: { model: "gpt-4o-mini-transcribe" } },
            output: { voice: "marin" },
          },
        },
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const value = data?.value ?? data?.client_secret?.value;
      if (value) {
        return {
          clientSecret: value,
          webrtcUrl: `https://api.openai.com/v1/realtime/calls?model=${encodeURIComponent(args.model)}`,
          api: "ga",
        };
      }
    } else {
      console.error("Realtime GA session mint failed:", res.status, await res.text());
    }
  } catch (err) {
    console.error("Realtime GA session mint error:", err);
  }

  // Beta endpoint fallback.
  try {
    const res = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.apiKey}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": "realtime=v1",
      },
      body: JSON.stringify({
        model: args.model,
        instructions: args.instructions,
        voice: "verse",
        input_audio_transcription: { model: "whisper-1" },
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const value = data?.client_secret?.value;
      if (value) {
        return {
          clientSecret: value,
          webrtcUrl: `https://api.openai.com/v1/realtime?model=${encodeURIComponent(args.model)}`,
          api: "beta",
        };
      }
    } else {
      console.error("Realtime beta session mint failed:", res.status, await res.text());
    }
  } catch (err) {
    console.error("Realtime beta session mint error:", err);
  }
  return null;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (rateLimited()) {
    return NextResponse.json({ error: "Too many call sessions right now" }, { status: 429 });
  }

  let supabase;
  try {
    supabase = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Backend is not configured" }, { status: 503 });
  }

  const { scenario, leadId, callerName, callerPhone, forceScripted } = parsed.data;

  let lead: Lead | null = null;
  if (leadId) {
    const { data } = await supabase.from("leads").select("*").eq("id", leadId).maybeSingle();
    lead = (data as Lead | null) ?? null;
  }

  const direction = scenario === "speed_to_lead_outbound" ? "outbound" : "inbound";
  const leadName = lead ? `${lead.first_name} ${lead.last_name}` : null;
  const { data: call, error: callError } = await supabase
    .from("calls")
    .insert({
      lead_id: lead?.id ?? null,
      scenario,
      direction,
      caller_name:
        direction === "inbound" ? (callerName ?? leadName ?? "Unknown Caller") : "Northstar AI Assistant",
      caller_phone: direction === "inbound" ? (callerPhone ?? lead?.phone ?? null) : null,
      callee_name: direction === "outbound" ? (leadName ?? callerName ?? "Homeowner") : "Northstar AI Assistant",
      callee_phone: direction === "outbound" ? (lead?.phone ?? callerPhone ?? null) : null,
      status: "ringing",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (callError || !call) {
    console.error("Call record insert failed:", callError);
    return NextResponse.json({ error: "Could not create call record" }, { status: 500 });
  }

  const slots = await getAvailableSlots(supabase, 7, 8);
  const slotLabels = slots.map((s) => s.label);
  const maxSeconds = Number(process.env.REALTIME_MAX_CALL_SECONDS || 180);
  const scripted = getScriptedScenario(scenario, lead);

  const base = {
    call_id: call.id,
    scenario,
    max_seconds: maxSeconds,
    scripted,
    lead: lead
      ? { id: lead.id, first_name: lead.first_name, last_name: lead.last_name, phone: lead.phone }
      : null,
  };

  const apiKey = process.env.OPENAI_API_KEY;
  const realtimeEnabled = process.env.ENABLE_REALTIME_CALLS !== "false";
  if (!apiKey || !realtimeEnabled || forceScripted) {
    return NextResponse.json({ ...base, mode: "scripted_fallback" });
  }

  const model = process.env.REALTIME_MODEL || "gpt-realtime";
  const instructions = buildRealtimeInstructions({ scenario, lead, slots: slotLabels, maxSeconds });
  const minted = await mintRealtimeSecret({ apiKey, model, instructions });
  if (!minted) {
    return NextResponse.json({ ...base, mode: "scripted_fallback" });
  }

  await supabase.from("calls").update({ ai_model: model }).eq("id", call.id);

  return NextResponse.json({
    ...base,
    mode: "realtime",
    client_secret: minted.clientSecret,
    webrtc_url: minted.webrtcUrl,
    realtime_api: minted.api,
    model,
    instructions,
  });
}
