import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { runAiWorkflowModule } from "@/lib/ai-workflows/runModule";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Lead, ServiceType } from "@/types/app";

export const dynamic = "force-dynamic";

const SERVICE_TYPES = new Set<ServiceType>([
  "roofing",
  "siding",
  "windows",
  "doors",
  "bath",
  "gutters",
  "leaf_protection",
  "storm_damage",
  "not_sure",
]);

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function serviceType(value: unknown): ServiceType {
  const normalized = text(value).toLowerCase().replace(/\s+/g, "_") as ServiceType;
  return SERVICE_TYPES.has(normalized) ? normalized : "not_sure";
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first_name: "Demo", last_name: "Lead" };
  if (parts.length === 1) return { first_name: parts[0], last_name: "Lead" };
  return {
    first_name: parts.slice(0, -1).join(" "),
    last_name: parts[parts.length - 1],
  };
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const event = body as {
    eventType?: unknown;
    source?: unknown;
    payload?: Record<string, unknown>;
  };
  if (event.eventType !== "lead.created" || !event.payload) {
    return NextResponse.json(
      { error: "Expected eventType lead.created with a payload object" },
      { status: 400 }
    );
  }

  const payload = event.payload;
  const name = text(payload.name) || "Demo Lead";
  const { first_name, last_name } = splitName(name);
  const description =
    text(payload.message) ||
    text(payload.description) ||
    "External CRM webhook demo lead with no message supplied.";

  try {
    const supabase = createAdminClient();
    const { data: lead, error } = await supabase
      .from("leads")
      .insert({
        first_name,
        last_name,
        email: text(payload.email) || null,
        phone: text(payload.phone) || null,
        preferred_contact_method: text(payload.email) ? "email" : "phone",
        service_type: serviceType(payload.serviceType),
        description,
        source: text(event.source) || "external_crm_webhook",
        stage: "new",
        ai_status: "pending",
      })
      .select("*")
      .single();

    if (error || !lead) {
      return NextResponse.json(
        { error: error?.message ?? "Lead insert failed" },
        { status: 500 }
      );
    }

    await supabase.from("activities").insert({
      lead_id: lead.id,
      type: "webhook",
      title: "Demo webhook received: lead.created",
      description: "External CRM/Zapier/n8n-style payload created this lead.",
      metadata: {
        eventType: event.eventType,
        source: event.source ?? "external_crm",
        payload,
        demo_only: true,
      },
    });

    const output = await runAiWorkflowModule(supabase, {
      moduleId: "lead_intake_analysis",
      lead: lead as Lead,
      userId: null,
    });

    revalidatePath("/app/automations");
    revalidatePath("/app/leads");

    return NextResponse.json({
      ok: true,
      mode: "demo",
      notice: "Lead created and AI workflow logged. No external messages were sent.",
      leadId: lead.id,
      workflowOutput: output,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook demo failed" },
      { status: 500 }
    );
  }
}
