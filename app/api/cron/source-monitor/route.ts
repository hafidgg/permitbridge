/**
 * app/api/cron/source-monitor/route.ts
 *
 * Phase 4.9 UPDATE: this endpoint is NO LONGER the scheduled executor.
 * GitHub Actions (.github/workflows/source-monitor.yml) now owns that role
 * — confirmed necessary the hard way: the first authenticated live
 * invocation of this endpoint returned 500, because runMonitoringCycle()
 * tries to write data/knowledge-base/monitoring/registry.json and
 * .../changes/*.json, and Vercel's deployed Serverless Functions have a
 * READ-ONLY filesystem (only /tmp is writable, and it's ephemeral —
 * confirmed against Vercel's own documentation, not guessed).
 *
 * vercel.json's `crons` array is now empty — nothing triggers this route
 * automatically anymore, so it can never become a second competing
 * scheduler alongside GitHub Actions (Step 8's explicit requirement).
 * It's kept, not deleted, as a manually-invokable diagnostic: still fully
 * authenticated, and now specifically detects the exact read-only-
 * filesystem failure and explains it, instead of a bare "internal_error".
 */
import { NextRequest, NextResponse } from "next/server";
import { runMonitoringCycle, MonitoringCycleInProgressError } from "@/lib/monitoring/scheduler";
import { checkCronAuthorization } from "@/lib/monitoring/cron-auth";

// A cron trigger must never be served from a cache — always execute fresh.
export const dynamic = "force-dynamic";

function isReadOnlyFilesystemError(err: unknown): boolean {
  const code = (err as NodeJS.ErrnoException | undefined)?.code;
  return code === "EROFS" || code === "EACCES";
}

export async function GET(request: NextRequest) {
  if (!checkCronAuthorization(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();

  try {
    const summary = await runMonitoringCycle({ mode: "live" });
    const durationMs = Date.now() - startedAt.getTime();
    const failures = summary.results.filter((r) => r.fetchStatus === "error").length;

    return NextResponse.json(
      {
        started: startedAt.toISOString(),
        sourcesConsidered: summary.sourcesConsidered,
        sourcesChecked: summary.sourcesChecked,
        changesDetected: summary.changesDetected,
        failures,
        duration: durationMs,
      },
      { status: 200 }
    );
  } catch (err) {
    if (err instanceof MonitoringCycleInProgressError) {
      return NextResponse.json({ error: "cycle_in_progress" }, { status: 409 });
    }
    if (isReadOnlyFilesystemError(err)) {
      console.error("[monitor] cron cycle failed: read-only filesystem (expected on Vercel — use GitHub Actions instead)");
      return NextResponse.json(
        {
          error: "vercel_readonly_filesystem",
          message:
            "This endpoint cannot persist monitoring state on Vercel's read-only deployed filesystem. The scheduled monitoring run is now handled by GitHub Actions (.github/workflows/source-monitor.yml) instead.",
        },
        { status: 500 }
      );
    }
    console.error("[monitor] cron cycle failed:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
