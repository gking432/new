import { DemoCenterClient } from "@/components/demo/DemoCenterClient";
import { createClient } from "@/lib/supabase/server";
import { isLocalDemoMode } from "@/lib/demo/mode";
import { getLocalLeads } from "@/lib/demo/localData";

export const dynamic = "force-dynamic";

export default async function DemoCenterPage() {
  if (isLocalDemoMode()) {
    const latest = (await getLocalLeads())[0] ?? null;
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Demo Center</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Run every flagship scenario from one place. This visitor&apos;s demo data stays isolated in
            their browser and can be reset at any time.
          </p>
        </div>
        <DemoCenterClient latestLead={latest ? {
          id: latest.id, first_name: latest.first_name, last_name: latest.last_name, phone: latest.phone,
          stage: latest.stage, urgency: latest.urgency, service_type: latest.service_type,
        } : null} />
      </div>
    );
  }
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
          Run every flagship scenario from one place: AI automations, phone calls (live voice or
          scripted), omnichannel intake, CRM sync, quoting, and appointment booking. The dashboard
          starts as a blank slate — the only leads are the ones you create here.
        </p>
      </div>
      <DemoCenterClient latestLead={latest ?? null} />
    </div>
  );
}
