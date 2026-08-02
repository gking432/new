import Link from "next/link";
import { Inbox } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LeadFilters } from "@/components/app/LeadFilters";
import { LeadStageBadge } from "@/components/app/LeadStageBadge";
import { QualityBadge } from "@/components/app/QualityBadge";
import { UrgencyBadge } from "@/components/app/UrgencyBadge";
import { getLeads, getProfiles } from "@/lib/db/queries";
import { createClient } from "@/lib/supabase/server";
import { formatMoneyRange, formatRelative, fullName } from "@/lib/utils/format";
import { SERVICE_LABELS, SOURCE_LABELS, labelFor } from "@/lib/utils/statuses";
import { isLocalDemoMode } from "@/lib/demo/mode";
import { getLocalLeads, getLocalProfiles } from "@/lib/demo/localData";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const filters = {
      search: params.search,
      service_type: params.service_type,
      urgency: params.urgency,
      quality: params.quality,
      stage: params.stage,
      source: params.source,
      assigned_to: params.assigned_to,
  };
  const [leads, profiles] = isLocalDemoMode()
    ? await Promise.all([getLocalLeads(filters), getLocalProfiles()])
    : await (async () => {
        const supabase = await createClient();
        return Promise.all([getLeads(supabase, filters), getProfiles(supabase)]);
      })();

  return (
    <div className="space-y-4">
      <LeadFilters profiles={profiles} />

      <Card>
        <CardContent className="p-0">
          {leads.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <Inbox className="h-8 w-8 text-muted-foreground" />
              <p className="font-medium">No leads match these filters</p>
              <p className="text-sm text-muted-foreground">
                Try clearing filters, or submit a test request through the public form.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Urgency</TableHead>
                  <TableHead>Quality</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Est. Value</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead, i) => (
                  <TableRow
                    key={lead.id}
                    className="cursor-pointer"
                    data-tour={i === 0 ? "leads-first-row" : undefined}
                  >
                    <TableCell>
                      <Link
                        href={`/app/leads/${lead.id}`}
                        className="block font-medium hover:underline"
                      >
                        {fullName(lead.first_name, lead.last_name)}
                        <span className="block text-xs font-normal text-muted-foreground">
                          {lead.city ? `${lead.city}, ${lead.state}` : lead.email}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>{SERVICE_LABELS[lead.service_type]}</TableCell>
                    <TableCell>
                      <UrgencyBadge urgency={lead.urgency} />
                    </TableCell>
                    <TableCell>
                      <QualityBadge quality={lead.lead_quality} />
                    </TableCell>
                    <TableCell>
                      <LeadStageBadge stage={lead.stage} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {labelFor(SOURCE_LABELS, lead.source)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {lead.assigned_profile?.full_name ?? "Unassigned"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatMoneyRange(lead.estimated_value_min, lead.estimated_value_max)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatRelative(lead.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        {leads.length} lead{leads.length === 1 ? "" : "s"}
      </p>
    </div>
  );
}
