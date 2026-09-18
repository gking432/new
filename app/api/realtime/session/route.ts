import { reserveVoiceMint, liveVoiceConfigured } from "@/lib/realtime/quota";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getScriptedScenario } from "@/lib/calls/scriptedScenarios";
import { getAvailableSlots } from "@/lib/integrations/calendar/internalCalendar";
import { buildAiCustomerInstructions, buildRealtimeInstructions } from "@/lib/realtime/prompts";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Lead } from "@/types/app";
import { isLocalDemoMode } from "@/lib/demo/mode";
import { createLocalCallSession } from "@/lib/demo/localWorkflows";
import { getLocalAvailableSlots } from "@/lib/demo/localData";

// Keep the configured Realtime model; audio tuning does not require a model change.
const DEFAULT_REALTIME_MODEL = "gpt-realtime";

/**
 * Creates a call record and (when configured) an ephemeral OpenAI Realtime
 * session token for the browser. The real API key never leaves the server —
 * the browser only ever sees a short-lived client secret.
 *
 * When Realtime is unavailable (no key, disabled, or the mint fails) the
 * response switches to scripted fallback mode — and includes the reason in
 * `realtime_error` so the UI can show exactly why live voice didn't start.
 *
 * GET checks configuration without contacting the paid provider.
 */

const requestSchema = z.object({
  scenario: z.enum(["new_inbound_call", "existing_customer_call", "speed_to_lead_outbound"]),
  leadId: z.string().uuid().optional(),
  callerName: z.string().max(120).optional(),
  callerPhone: z.string().max(40).nullable().optional(),
  seedFields: z.record(z.string(), z.string().nullable()).optional(),
  // "agent" = our AI answers/calls the human. "customer" = the AI plays the
  // homeowner and the human is the company rep (you-answer-an-AI-customer mode).
  persona: z.enum(["agent", "customer"]).optional(),
  forceScripted: z.boolean().optional(),
});

interface MintResult {
  ok: true;
  clientSecret: string;
  webrtcUrl: string;
  api: "ga" | "beta";
  model: string;
  mintPath: "ga_full" | "ga_minimal" | "beta";
}
interface MintFailure {
  ok: false;
  error: string;
}

function voiceTurnDetection(interruptResponse: boolean) {
  return {
    type: "server_vad",
    // Reduce false speech triggers from speaker bleed while preserving barge-in
    // for the interviewer. Leave the AI-homeowner turn policy unchanged.
    threshold: interruptResponse ? 0.7 : 0.65,
    prefix_padding_ms: 300,
    silence_duration_ms: interruptResponse ? 800 : 950,
    create_response: true,
    interrupt_response: interruptResponse,
  };
}

async function tryGaMint(
  apiKey: string,
  model: string,
  instructions: string,
  minimal: boolean,
  voice: string,
  interruptResponse: boolean
): Promise<MintResult | MintFailure> {
  if (!(await reserveVoiceMint())) return { ok: false, error: "Live voice quota unavailable. Use the silent simulation." };
  try {
    const session = {
      type: "realtime", model, instructions,
      audio: {
        input: {
          ...(!minimal ? { transcription: { model: "gpt-4o-mini-transcribe" } } : {}),
          // The compatibility retry may drop voice/transcription options, but
          // must not silently revert the speech threshold or interruption policy.
          turn_detection: voiceTurnDetection(interruptResponse),
        },
        ...(!minimal ? { output: { voice } } : {}),
      },
    };
    const res = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ session, expires_after: { anchor: "created_at", seconds: 30 } }),
      signal: AbortSignal.timeout(10000),
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
          mintPath: minimal ? "ga_minimal" : "ga_full",
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
  instructions: string,
  voice: string,
  interruptResponse: boolean
): Promise<MintResult | MintFailure> {
  if (!(await reserveVoiceMint())) return { ok: false, error: "Live voice quota unavailable. Use the silent simulation." };
  // cedar/marin are GA-only; map to a beta-supported voice on the fallback path.
  const betaVoice = ["cedar", "marin"].includes(voice) ? "sage" : voice;
  voice = betaVoice;
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
        voice,
        input_audio_transcription: { model: "whisper-1" },
        turn_detection: voiceTurnDetection(interruptResponse),
      }),
      signal: AbortSignal.timeout(10000),
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
          mintPath: "beta",
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
  voice?: string;
  interruptResponse?: boolean;
}): Promise<MintResult | { ok: false; errors: string[] }> {
  const errors: string[] = [];
  const voice = args.voice ?? "cedar";
  const interruptResponse = args.interruptResponse ?? true;

  const ga = await tryGaMint(
    args.apiKey,
    args.model,
    args.instructions,
    false,
    voice,
    interruptResponse
  );
  if (ga.ok) return ga;
  errors.push(ga.error);
  console.error("Realtime GA mint failed:", ga.error);

  const gaMinimal = await tryGaMint(
    args.apiKey,
    args.model,
    args.instructions,
    true,
    voice,
    interruptResponse
  );
  if (gaMinimal.ok) return gaMinimal;
  errors.push(gaMinimal.error);

  const betaModel = args.model.startsWith("gpt-4o") ? args.model : "gpt-4o-realtime-preview";
  const beta = await tryBetaMint(args.apiKey, betaModel, args.instructions, voice, interruptResponse);
  if (beta.ok) return beta;
  errors.push(beta.error);
  console.error("Realtime beta mint failed:", beta.error);

  return { ok: false, errors };
}

/** Read-only configuration check. Never mints a paid-provider token. */
export async function GET() {
  const configured = liveVoiceConfigured();
  return NextResponse.json({
    ok: configured,
    model: process.env.REALTIME_MODEL || DEFAULT_REALTIME_MODEL,
    reason: configured
      ? "Voice is configured. Provider connectivity and quota are checked when a call starts."
      : "Live voice needs OPENAI_API_KEY and ENABLE_REALTIME_CALLS must not be false.",
  }, { headers: { "Cache-Control": "no-store" } });
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

  const {
    scenario,
    leadId,
    callerName,
    callerPhone,
    seedFields,
    persona = "agent",
    forceScripted,
  } = parsed.data;

  let supabase: ReturnType<typeof createAdminClient> | null = null;
  let lead: Lead | null = null;
  let call: { id: string };
  let scripted;
  let slots;

  if (isLocalDemoMode()) {
    const local = await createLocalCallSession({ scenario, leadId, callerName, callerPhone });
    lead = local.lead;
    call = { id: local.call.id };
    scripted = local.scripted;
    slots = await getLocalAvailableSlots(14, 6);
  } else {
    try {
      supabase = createAdminClient();
    } catch {
      return NextResponse.json({ error: "Backend is not configured" }, { status: 503 });
    }
    if (leadId) {
      const { data } = await supabase.from("leads").select("*").eq("id", leadId).maybeSingle();
      lead = (data as Lead | null) ?? null;
    }
    const direction = scenario === "speed_to_lead_outbound" ? "outbound" : "inbound";
    const leadName = lead ? `${lead.first_name} ${lead.last_name}` : null;
    const result = await supabase
      .from("calls")
      .insert({
        lead_id: lead?.id ?? null,
        scenario,
        direction,
        caller_name: direction === "inbound" ? callerName ?? leadName ?? "Unknown Caller" : "Northstar AI Assistant",
        caller_phone: direction === "inbound" ? callerPhone ?? lead?.phone ?? null : null,
        callee_name: direction === "outbound" ? leadName ?? callerName ?? "Homeowner" : "Northstar AI Assistant",
        callee_phone: direction === "outbound" ? lead?.phone ?? callerPhone ?? null : null,
        status: "ringing",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (result.error || !result.data) {
      return NextResponse.json({ error: "Could not create call record" }, { status: 500 });
    }
    call = result.data;
    slots = await getAvailableSlots(supabase, 14, 6);
    scripted = getScriptedScenario(scenario, lead);
  }

  // The soonest few concrete openings, for the "offer the soonest slot" case on
  // urgent calls. General availability (which days/times can be booked) is
  // conveyed to the assistant via the fixed start-time grid in the prompt.
  const slotLabels = slots.map((s) => s.label);
  const configuredSeconds = Number(process.env.REALTIME_MAX_CALL_SECONDS || 180);
  const maxSeconds = Number.isFinite(configuredSeconds) ? Math.max(30, Math.min(180, configuredSeconds)) : 180;

  const base = {
    call_id: call.id,
    scenario,
    max_seconds: maxSeconds,
    scripted,
    seedFields,
    lead: lead
      ? { id: lead.id, first_name: lead.first_name, last_name: lead.last_name, phone: lead.phone }
      : null,
  };

  const apiKey = process.env.OPENAI_API_KEY;
  const realtimeEnabled = liveVoiceConfigured();
  if (!apiKey || !realtimeEnabled || forceScripted) {
    return NextResponse.json({
      ...base,
      mode: "scripted_fallback",
      realtime_error: forceScripted
        ? undefined
        : !apiKey
          ? "OPENAI_API_KEY is not set (restart the dev server after editing .env.local)"
          : "Live voice is disabled by ENABLE_REALTIME_CALLS=false.",
    });
  }

  const model = process.env.REALTIME_MODEL || DEFAULT_REALTIME_MODEL;
  // persona "customer" = the AI plays the homeowner and the human is the rep.
  const instructions =
    persona === "customer"
      ? buildAiCustomerInstructions()
      : buildRealtimeInstructions({ scenario, lead, slots: slotLabels, maxSeconds });
  // Agent voice is configurable (REALTIME_VOICE). marin/cedar are gpt-realtime's
  // most natural (ChatGPT-like) voices; the AI-customer gets a different one.
  const agentVoice = process.env.REALTIME_VOICE || "cedar";
  const voice = persona === "customer" ? "marin" : agentVoice;
  const minted = await mintRealtimeSecret({
    apiKey,
    model,
    instructions,
    voice,
    // In the rep-assisted demo, speaker echo on phones can look like a user
    // interruption and truncate the AI homeowner mid-sentence. Let each short
    // homeowner response finish; the rep can speak immediately afterward.
    interruptResponse: persona !== "customer",
  });
  if (!minted.ok) {
    return NextResponse.json({
      ...base,
      mode: "scripted_fallback",
      realtime_error: "Live voice is unavailable right now. Continue with the silent simulation.",
    });
  }

  if (supabase) await supabase.from("calls").update({ ai_model: minted.model }).eq("id", call.id);

  // Correlates device reports with session setup, without credentials or prompts.
  console.info("realtime.session.ready", {
    callId: call.id, model: minted.model, api: minted.api, mintPath: minted.mintPath, persona, scenario,
  });

  return NextResponse.json({
    ...base,
    mode: "realtime",
    client_secret: minted.clientSecret,
    webrtc_url: minted.webrtcUrl,
    realtime_api: minted.api,
    model: minted.model,
    mint_path: minted.mintPath,
    instructions,
  });
}
