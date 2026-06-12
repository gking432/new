import { DemoCenterClient } from "@/components/demo/DemoCenterClient";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DemoCenterPage() {
  const supabase = await createClient();

  const [{ data: sarah }, { data: latest }] = await Promise.all([
    supabase
      .from("leads")
      .select("id, first_name, last_name, phone, stage, urgency, service_type")
      .eq("phone", "(414) 555-0188")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("leads")
      .select("id, first_name, last_name")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Demo Center</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Run every flagship scenario from one place: AI phone calls (live voice or scripted),
          omnichannel intake, CRM sync, quoting, and appointment booking. The event log shows the
          automation sequence as it happens.
        </p>
      </div>
      <DemoCenterClient sarahLead={sarah ?? null} latestLead={latest ?? null} />
    </div>
  );
}
