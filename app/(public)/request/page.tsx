import type { Metadata } from "next";
import { Suspense } from "react";
import { PublicHeader } from "@/components/public/PublicHeader";
import { LeadForm } from "@/components/public/LeadForm";

export const metadata: Metadata = {
  title: "Request a Free Inspection",
};

export default function RequestPage() {
  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">
          Request a free inspection
        </h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Tell us what is going on with your home. Our team will review your
          request and follow up with the right next step — usually within the
          hour during business hours.
        </p>
        <div className="mt-8">
          <Suspense>
            <LeadForm />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
