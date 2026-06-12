import { NextResponse } from "next/server";
import { submitLead } from "@/lib/actions";
import { leadFormSchema } from "@/lib/validations/lead";

/**
 * Public lead creation endpoint. The lead form uses the submitLead server
 * action directly; this route exposes the same pipeline for external
 * integrations (e.g. a Make/Zapier scenario posting leads in).
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = leadFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const result = await submitLead(parsed.data);
  if (!result.success) {
    return NextResponse.json(result, { status: 429 });
  }
  return NextResponse.json({ success: true, lead_id: result.data?.leadId, ai_status: "processed" });
}
