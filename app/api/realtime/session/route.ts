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
 * response switches to scripted fallback mode — and includes the reason in
 * `realtime_error` so the UI can show exactly why live voice didn't start.
 *
 * GET runs a diagnostic mint and returns the raw outcome (used by the Demo
 * Center "Test AI voice" button).
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

interface MintResult {
  ok: true;
  clientSecret: string;
  webrtcUrl: string;
  api: "ga" | "beta";
  model: string;
}
interface MintFailure {
  ok: false;
  error: string;
}

async function tryGaMint(
  apiKey: string,
  model: string,
  instructions: string,
  minimal: boolean
): Promise<MintResult | MintFailure> {
  try {
    const session: Record<string, unknown> = { type: "realtime", model, instructions };
    if (!minimal) {
      session.audio = {
        input: { transcription: { model: "gpt-4o-mini-transcribe" } },
        output: { voice: "marin" },
      };
    }
    const res = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ session }),
    });
    const text = await res.text();
    if (res.ok) {
      const data = JSON.parse(text);
      const value = data?.value ?? data?.client_secret?.value;
      if (value) {
        return {
          ok: true,
          clientSecret: value,
          webrtcUrl: `https://api.openai.com/v1/realtime/calls?model=${encodeURIComponent(model)}`,
          api: "ga",
          model,
        };
      }
      return { ok: false, error: "GA mint returned no client secret" };
    }
    return { ok: false, error: `GA ${res.status}: ${text.slice(0, 300)}` };
  } catch (err) {
    return { ok: false, error: `GA request error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

async function tryBetaMint(
  apiKey: string,
  model: string,
  instructions: string
): Promise<MintResult | MintFailure> {
  try {
    const res = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": "realtime=v1",
      },
      body: JSON.stringify({
        model,
        instructions,
        voice: "verse",
        input_audio_transcription: { model: "whisper-1" },
      }),
    });
    const text = await res.text();
    if (res.ok) {
      const data = JSON.parse(text);
      const value = data?.client_secret?.value;
      if (value) {
        return {
          ok: true,
          clientSecret: value,
          webrtcUrl: `https://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`,
          api: "beta",
          model,
        };
      }
      return { ok: false, error: "Beta mint returned no client secret" };
    }
    return { ok: false, error: `Beta ${res.status}: ${text.slice(0, 300)}` };
  } catch (err) {
    return {
      ok: false,
      error: `Beta request error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Tries the GA endpoint (full config, then minimal config), then the beta
 * endpoint with a beta-era model name. Returns the mint or every error
 * collected along the way.
 */
async function mintRealtimeSecret(args: {
  apiKey: string;
  model: string;
  instructions: string;
}): Promise<MintResult | { ok: false; errors: string[] }> {
  const errors: string[] = [];

  const ga = await tryGaMint(args.apiKey, args.model, args.instructions, false);
  if (ga.ok) return ga;
  errors.push(ga.error);
  console.error("Realtime GA mint failed:", ga.error);

  const gaMinimal = await tryGaMint(args.apiKey, args.model, args.instructions, true);
  if (gaMinimal.ok) return gaMinimal;
  errors.push(gaMinimal.error);

  const betaModel = args.model.startsWith("gpt-4o-realtime")
    ? args.model
    : "gpt-4o-realtime-preview";
  const beta = await tryBetaMint(args.apiKey, betaModel, args.instructions);
  if (beta.ok) return beta;
  errors.push(beta.error);
  console.error("Realtime beta mint failed:", beta.error);

  return { ok: false, errors };
}

/** Diagnostics: attempts a real mint and reports the outcome. */
export async function GET() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      reason: "OPENAI_API_KEY is not set (restart `npm run dev` after editing .env.local)",
    });
  }
  if (process.env.ENABLE_REALTIME_CALLS === "false") {
    return NextResponse.json({ ok: false, reason: "ENABLE_REALTIME_CALLS is set to false" });
  }
  const model = process.env.REALTIME_MODEL || "gpt-realtime";
  const minted = await mintRealtimeSecret({
    apiKey,
    model,
    instructions: "Diagnostics test session.",
  });
  if (minted.ok) {
    return NextResponse.json({ ok: true, api: minted.api, model: minted.model });
  }
  return NextResponse.json({ ok: false, reason: minted.errors.join(" | "), model });
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
        direction === "inbound"
          ? (callerName ?? leadName ?? "Unknown Caller")
          : "Northstar AI Assistant",
      caller_phone: direction === "inbound" ? (callerPhone ?? lead?.phone ?? null) : null,
      callee_name:
        direction === "outbound" ? (leadName ?? callerName ?? "Homeowner") : "Northstar AI Assistant",
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
    return NextResponse.json({
      ...base,
      mode: "scripted_fallback",
      realtime_error: forceScripted
        ? undefined
        : !apiKey
          ? "OPENAI_API_KEY is not set (restart the dev server after editing .env.local)"
          : "ENABLE_REALTIME_CALLS is false",
    });
  }

  const model = process.env.REALTIME_MODEL || "gpt-realtime";
  const instructions = buildRealtimeInstructions({ scenario, lead, slots: slotLabels, maxSeconds });
  const minted = await mintRealtimeSecret({ apiKey, model, instructions });
  if (!minted.ok) {
    return NextResponse.json({
      ...base,
      mode: "scripted_fallback",
      realtime_error: minted.errors[minted.errors.length - 1],
    });
  }

  await supabase.from("calls").update({ ai_model: minted.model }).eq("id", call.id);

  return NextResponse.json({
    ...base,
    mode: "realtime",
    client_secret: minted.clientSecret,
    webrtc_url: minted.webrtcUrl,
    realtime_api: minted.api,
    model: minted.model,
    instructions,
  });
}
