import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeadIntakeForm } from "@/components/app/LeadIntakeForm";

export const dynamic = "force-dynamic";

export default function NewLeadPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/app/leads">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">New lead</h2>
          <p className="text-sm text-muted-foreground">
            A blank CRM record — fill it in yourself, or let an AI call fill it live.
          </p>
        </div>
      </div>
      <LeadIntakeForm />
    </div>
  );
}
