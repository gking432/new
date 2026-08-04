import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PublicHeader } from "@/components/public/PublicHeader";
import { SpeedToLeadDemo } from "@/components/public/SpeedToLeadDemo";
import { SpeedToLeadHandoff } from "@/components/public/SpeedToLeadHandoff";
import { SERVICE_LABELS, TIMEFRAME_LABELS, labelFor } from "@/lib/utils/statuses";

export const metadata: Metadata = {
  title: "Request Received",
};

export default async function RequestSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{
    name?: string;
    service?: string;
    timeframe?: string;
    lead?: string;
    phone?: string;
    demo?: string;
  }>;
}) {
  const params = await searchParams;
  const name = params.name?.slice(0, 60);
  const dashboardHandoff = params.demo === "dashboard" && Boolean(params.lead);

  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <div className="text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-7 w-7 text-status-success" />
          </span>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight">
            {name ? `Thank you, ${name}.` : "Thank you."} Your request is in.
          </h1>
          <p className="mt-3 text-muted-foreground">
            Our team will review this and follow up with the right next step.
            Storm and leak requests get priority handling.
          </p>
        </div>

        {(params.service || params.timeframe) && (
          <Card className="mt-8">
            <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Service requested</p>
                <p className="mt-1 font-medium">{labelFor(SERVICE_LABELS, params.service)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Timeframe</p>
                <p className="mt-1 font-medium">{labelFor(TIMEFRAME_LABELS, params.timeframe)}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {dashboardHandoff ? (
          <SpeedToLeadHandoff
            leadId={params.lead!}
            name={name ?? ""}
            serviceType={params.service}
          />
        ) : params.lead ? (
          <SpeedToLeadDemo leadId={params.lead} name={name ?? ""} />
        ) : null}

        <Alert className="mt-8">
          <AlertTitle>Demonstration app</AlertTitle>
          <AlertDescription>
            This is a demonstration app. No real service request has been
            submitted and no one will contact you.
          </AlertDescription>
        </Alert>

        <div className="mt-8 text-center">
          <Button asChild>
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
