"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initials } from "@/lib/utils/format";
import type { Profile } from "@/types/app";

const PAGE_TITLES: Array<[string, string]> = [
  ["/app/leads/", "Lead Detail"],
  ["/app/leads", "Leads"],
  ["/app/pipeline", "Pipeline"],
  ["/app/tasks", "Tasks"],
  ["/app/feedback", "Customer Feedback"],
  ["/app/automations", "AI Automations"],
  ["/app/reports", "Reports"],
  ["/app/settings", "Settings"],
  ["/app", "Overview"],
];

export function AppHeader({ profile }: { profile: Profile | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const title = PAGE_TITLES.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? "Overview";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur sm:px-6">
      <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      <form
        className="relative ml-auto hidden w-full max-w-xs md:block"
        onSubmit={(event) => {
          event.preventDefault();
          const value = new FormData(event.currentTarget).get("search");
          router.push(`/app/leads?search=${encodeURIComponent(String(value ?? ""))}`);
        }}
      >
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          name="search"
          placeholder="Search leads…"
          className="pl-9"
        />
      </form>
      <Button asChild size="sm" className="ml-auto md:ml-0">
        <Link href="/app/leads/new">
          <Plus className="h-4 w-4" />
          New Lead
        </Link>
      </Button>
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
        {initials(profile?.full_name)}
      </span>
    </header>
  );
}
