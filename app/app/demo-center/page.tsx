import { DemoCenterClient } from "@/components/demo/DemoCenterClient";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DemoCenterPage() {
  const supabase = await createClient();

  const { data: latest } = await supabase
    .from("leads")
    .select("id, first_name, last_name, phone, stage, urgency, service_type")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Demo Center</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Run every flagship scenario from one place: AI phone calls (live voice or scripted),
          omnichannel intake, CRM sync, quoting, and appointment booking. The dashboard starts as a
          blank slate — the only leads are the ones you create here.
        </p>
      </div>
      <DemoCenterClient latestLead={latest ?? null} />
    </div>
  );
}
