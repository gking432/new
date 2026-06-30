"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Calculator,
  Cable,
  Compass,
  Inbox,
  Kanban,
  LayoutDashboard,
  ListChecks,
  Loader2,
  MessageSquareText,
  Phone,
  RotateCcw,
  Settings,
  Users,
  Workflow,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/utils/format";
import { ROLE_LABELS } from "@/lib/utils/statuses";
import type { Profile } from "@/types/app";

const NAV_ITEMS = [
  { href: "/app", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/app/inbox", label: "Inbox", icon: Inbox },
  { href: "/app/leads", label: "Leads", icon: Users },
  { href: "/app/calls", label: "Calls", icon: Phone },
  { href: "/app/pipeline", label: "Pipeline", icon: Kanban },
  { href: "/app/tasks", label: "Tasks", icon: ListChecks },
  { href: "/app/appointments", label: "Appointments", icon: CalendarDays },
  { href: "/app/quote-tool", label: "Quote Tool", icon: Calculator },
  { href: "/app/feedback", label: "Feedback", icon: MessageSquareText },
  { href: "/app/automations", label: "AI Automations", icon: Workflow },
  { href: "/app/reports", label: "Reports", icon: BarChart3 },
  { href: "/app/crm-sync", label: "CRM Sync", icon: Cable },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export function AppSidebar({
  profile,
  badges = {},
}: {
  profile: Profile | null;
  badges?: Record<string, number>;
}) {
  const pathname = usePathname();
  const [restarting, setRestarting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [liveBadges, setLiveBadges] = useState(badges);

  useEffect(() => {
    let cancelled = false;

    async function refreshBadges() {
      try {
        const res = await fetch("/api/app/badges", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { badges?: Record<string, number> };
        if (!cancelled && data.badges) setLiveBadges(data.badges);
      } catch {
        // Badge counts are helpful but not critical to loading the dashboard.
      }
    }

    void refreshBadges();

    const events = [
      "northstar-call-done",
      "northstar-comm-sent",
      "northstar-lead-saved",
      "northstar-task-completed",
    ];
    events.forEach((event) => window.addEventListener(event, refreshBadges));

    return () => {
      cancelled = true;
      events.forEach((event) => window.removeEventListener(event, refreshBadges));
    };
  }, [pathname]);

  async function restartDemo() {
    if (restarting) return;
    setRestarting(true);
    try {
      // Clear every demo-created lead/call/message/etc.
      await fetch("/api/demo/reset?manual=1", { method: "POST" });
    } catch {
      // Even if the clear fails, fall through to a fresh tour start.
    }
    // Reset the guided-tour progress, then hard-navigate to the welcome step so
    // the page reloads with the now-empty database.
    try {
      sessionStorage.removeItem("northstar-tutorial-completed");
      sessionStorage.removeItem("northstar-tutorial-index");
      sessionStorage.removeItem("northstar-tutorial-active");
    } catch {
      // sessionStorage can be unavailable in embedded browsers; ignore.
    }
    window.location.href = "/app?tour=welcome";
  }

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
      <div className="flex h-16 items-center gap-2 border-b border-white/10 px-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-gold/90 text-brand-dark">
          <Compass className="h-4 w-4" />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold">Northstar</p>
          <p className="text-[11px] text-sidebar-foreground/60">Command Center</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const tourId = item.href === "/app" ? "overview" : item.href.split("/").pop();
          return (
            <Link
              key={item.href}
              href={item.href}
              data-tour={`nav-${tourId}`}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-white/10 text-white"
                  : "text-sidebar-foreground/70 hover:bg-white/5 hover:text-white"
              )}
            >
              <item.icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              {(liveBadges[item.href] ?? 0) > 0 && (
                <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
                  {liveBadges[item.href]! > 9 ? "9+" : liveBadges[item.href]}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <Button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={restarting}
          className="mb-3 w-full border border-brand-gold/40 bg-brand-gold/15 text-brand-gold hover:bg-brand-gold/25 hover:text-brand-gold"
          title="Clear all demo data and start the tour over"
        >
          {restarting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="h-4 w-4" />
          )}
          {restarting ? "Restarting…" : "Restart Demo"}
        </Button>

        <Dialog open={confirmOpen} onOpenChange={(open) => !restarting && setConfirmOpen(open)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Are you sure?</DialogTitle>
              <DialogDescription>
                This clears all demo data — leads, calls, messages, appointments, and tasks —
                and restarts the guided tour from the beginning.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setConfirmOpen(false)}
                disabled={restarting}
              >
                Cancel
              </Button>
              <Button onClick={restartDemo} disabled={restarting}>
                {restarting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {restarting ? "Restarting…" : "Restart Demo"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-medium">
            {initials(profile?.full_name)}
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium">{profile?.full_name ?? "Team member"}</p>
            <p className="truncate text-[11px] text-sidebar-foreground/60">
              {profile ? ROLE_LABELS[profile.role] ?? profile.role : ""}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
