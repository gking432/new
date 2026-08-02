import { NextResponse } from "next/server";
import { resetOperationalDemoData } from "@/lib/demo/reset";
import { isLocalDemoMode } from "@/lib/demo/mode";
import { resetDemoState } from "@/lib/demo/serverStore";

export const dynamic = "force-dynamic";

function resetEnabled(manual: boolean) {
  if (process.env.DEMO_MODE === "false") return false;
  // The explicit "Restart Demo" button works whenever the demo is on, even if
  // automatic reset-on-load was turned off.
  if (manual) return true;
  return process.env.DEMO_AUTO_RESET_ON_LOAD !== "false";
}

export async function POST(request: Request) {
  const manual = new URL(request.url).searchParams.get("manual") === "1";
  if (!resetEnabled(manual)) {
    return NextResponse.json({ success: true, reset: false, reason: "disabled" });
  }

  try {
    if (isLocalDemoMode()) {
      await resetDemoState();
      return NextResponse.json({
        success: true,
        reset: true,
        storage: "browser",
        cleared: ["leads", "calls", "messages", "appointments", "tasks"],
      });
    }
    const results = await resetOperationalDemoData();
    const failed = results.filter((r) => !r.ok);
    return NextResponse.json({
      success: failed.length === 0,
      reset: true,
      cleared: results.filter((r) => r.ok).map((r) => r.table),
      failed,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        reset: false,
        error: err instanceof Error ? err.message : "Demo reset failed",
      },
      { status: 500 }
    );
  }
}
