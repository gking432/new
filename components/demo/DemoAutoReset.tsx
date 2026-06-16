"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

const RESET_KEY = "northstar-demo-reset-complete";

function shouldResetOnPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/case-study" ||
    pathname === "/login" ||
    pathname.startsWith("/request") ||
    pathname.startsWith("/app")
  );
}

/**
 * Portfolio/demo guardrail: every new browser tab/session gets a clean demo
 * database before the visitor starts clicking. This intentionally clears only
 * operational demo data; app config and demo users remain intact.
 */
export function DemoAutoReset() {
  const pathname = usePathname();
  const router = useRouter();
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (!shouldResetOnPath(pathname)) return;
    if (sessionStorage.getItem(RESET_KEY) === "1") return;

    let cancelled = false;
    sessionStorage.setItem(RESET_KEY, "1");
    setResetting(true);

    fetch("/api/demo/reset", { method: "POST" })
      .then((res) => res.json())
      .then((data: { success?: boolean; reset?: boolean }) => {
        if (cancelled) return;
        if (!data.success) {
          sessionStorage.removeItem(RESET_KEY);
          return;
        }
        const currentPath = window.location.pathname;
        if (data.success && data.reset && (pathname.startsWith("/app") || currentPath.startsWith("/app"))) {
          router.refresh();
        }
      })
      .catch(() => {
        sessionStorage.removeItem(RESET_KEY);
      })
      .finally(() => {
        if (!cancelled) setResetting(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (!resetting) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90 backdrop-blur-sm">
      <div className="rounded-lg border bg-card px-5 py-4 text-center shadow-xl">
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
        <p className="mt-2 text-sm font-medium">Preparing a fresh demo…</p>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          Clearing prior leads, calls, messages, appointments, and CRM events.
        </p>
      </div>
    </div>
  );
}
