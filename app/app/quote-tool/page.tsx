import { QuoteToolClient } from "@/components/quote/QuoteToolClient";
import { getPropertyResearch, getQuotesForLead } from "@/lib/db/queries-phase2";
import { createClient } from "@/lib/supabase/server";
import { isLocalDemoMode } from "@/lib/demo/mode";
import { getLocalLeads, getLocalPropertyResearch, getLocalQuotesForLead } from "@/lib/demo/localData";
import type { PropertyResearch, QuoteEstimate } from "@/types/app";

export const dynamic = "force-dynamic";

export default async function QuoteToolPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string }>;
}) {
  const params = await searchParams;
  let leadList;
  let property: PropertyResearch | null = null;
  let quotes: QuoteEstimate[] = [];
  if (isLocalDemoMode()) {
    leadList = (await getLocalLeads()).map(({ id, first_name, last_name, service_type, stage, city, urgency }) => ({
      id, first_name, last_name, service_type, stage, city, urgency,
    }));
  } else {
    const supabase = await createClient();
    const { data: leads } = await supabase
      .from("leads")
      .select("id, first_name, last_name, service_type, stage, city, urgency")
      .order("created_at", { ascending: false })
      .limit(100);
    leadList = leads ?? [];
  }
  const selectedLead = params.lead
    ? (leadList.find((l) => l.id === params.lead) ?? null)
    : null;

  if (selectedLead) {
    if (isLocalDemoMode()) {
      [property, quotes] = await Promise.all([
        getLocalPropertyResearch(selectedLead.id),
        getLocalQuotesForLead(selectedLead.id),
      ]);
    } else {
      const supabase = await createClient();
      [property, quotes] = await Promise.all([
        getPropertyResearch(supabase, selectedLead.id),
        getQuotesForLead(supabase, selectedLead.id),
      ]);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Quote Intelligence</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Internal ballpark estimates for the sales team — built from property research, job
          inputs, and storm context. Never customer-facing: every output is labeled
          &ldquo;requires inspection before final quote.&rdquo;
        </p>
      </div>
      <QuoteToolClient
        leads={leadList}
        selectedLead={selectedLead}
        property={property}
        previousQuote={quotes[0] ?? null}
      />
    </div>
  );
}
