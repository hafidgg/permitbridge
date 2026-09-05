/**
 * lib/monitoring/alerting.ts
 *
 * Phase 3.2U — STEP 6/7: minimal alerting for automated-persistence
 * failures.
 *
 * HONEST SCOPE: no real external alert channel (Slack, email, PagerDuty)
 * is wired up here — none of those integrations' secrets exist in this
 * project yet, and inventing a fake webhook call would be worse than no
 * alert at all. What this DOES provide: a single, clearly-named,
 * clearly-formatted function that writes a loud, greppable error line
 * to stderr — which GitHub Actions already surfaces prominently in its
 * run summary and (if configured) email notifications on job failure.
 * A future real integration (Slack webhook, etc.) has exactly one
 * function to extend, not a dozen scattered console.error calls.
 */

export interface AutomatedPersistenceFailure {
  stage: "commit" | "push" | "build" | "persistence";
  sourceId: string;
  changeId?: string;
  reason: string;
}

export function alertAutomatedPersistenceFailure(failure: AutomatedPersistenceFailure): void {
  console.error(`::error::[AUTO-UPDATE FAILURE] stage=${failure.stage} source=${failure.sourceId}${failure.changeId ? ` changeId=${failure.changeId}` : ""} reason="${failure.reason}"`);
}

/**
 * Phase 3.7 follow-up — STEP 3: alert for the READ-ONLY watch's
 * CHANGE_DETECTED result specifically. Deliberately a separate
 * function from alertAutomatedPersistenceFailure() above — that one is
 * shaped for the automated-persistence pipeline's failure stages
 * (commit/push/build/persistence), a genuinely different concept from
 * "a real official source value changed and a human should look at
 * it". Reusing that function here would misuse its stage/changeId
 * fields for a case they were never designed to describe.
 */
export interface ReadOnlyChangeDetected {
  sourceId: string;
  sourceUrl: string;
  oldValue: string | number;
  newValue: string | number;
  detectedAt: string;
  evidence?: string;
}

export function alertChangeDetected(change: ReadOnlyChangeDetected): void {
  console.error(`::warning::[CHANGE_DETECTED] source=${change.sourceId} oldValue=${change.oldValue} newValue=${change.newValue} detectedAt=${change.detectedAt} url=${change.sourceUrl}`);
}