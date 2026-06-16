import { NextResponse } from "next/server";
import { resetOperationalDemoData } from "@/lib/demo/reset";

export const dynamic = "force-dynamic";

function resetEnabled() {
  return process.env.DEMO_MODE !== "false" && process.env.DEMO_AUTO_RESET_ON_LOAD !== "false";
}

export async function POST() {
  if (!resetEnabled()) {
    return NextResponse.json({ success: true, reset: false, reason: "disabled" });
  }

  try {
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
