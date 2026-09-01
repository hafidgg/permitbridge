# PermitBridge Monitoring — Operations Guide

This documents the automated source-monitoring system built across Phases 4.1–4.8. It watches official government sources for changes and proposes updates for human review — it never publishes anything automatically.

## Architecture

```
MonitoredSource (registry)
    │  checkFrequencyDays, fieldMapping, status
    ▼
Scheduler (lib/monitoring/scheduler.ts)
    │  getDueSources() / runSourceCheck() / runMonitoringCycle()
    ▼
Fetch (lib/monitoring/fetch.ts → lib/pipeline/fetcher.ts)
    │  HTTP GET, retry/backoff, ETag caching, SHA-256 hash
    ▼
Detect (lib/monitoring/detect.ts)
    │  hash comparison + field-level extraction (if fieldMapping present)
    ▼
DetectedChange (lib/monitoring/change-record.ts)
    │  status: pending_verification — ALWAYS, never auto-approved
    ▼
Human Review (lib/monitoring/review-integration.ts + persistence.ts)
    │  approve/reject/request_research/mark_unavailable/defer
    │  ONLY "approve" writes to a real fact/rule file, via applyFieldReview()
    ▼
Production knowledge-base (data/knowledge-base/facts/, transfer-rules/)
```

No module upstream of "Human Review" can ever write to `data/knowledge-base/facts/` or `data/knowledge-base/transfer-rules/`. This is structurally enforced (verified by tests that check for the *absence* of `applyFieldReview`/`applyAndPersistReview` imports in every monitoring/detection module) — not just a convention.

## Sources and field mappings

`data/knowledge-base/monitoring/registry.json` holds the list of `MonitoredSource` records. As of this writing there are **four**, all Registered Nurse fee pages:

| Source ID | Jurisdiction | Field |
|---|---|---|
| `florida-fee-schedule-monitor` | Florida | `endorsementFeeUsd` |
| `ny-endorsement-fee-monitor` | New York | `endorsementFeeUsd` |
| `ny-transfer-fee-monitor` | California | `applicationFeeUsd` |
| `florida-multistate-fee-monitor` | Texas | `applicationFeeUsd` |

A source's `fieldMapping` (optional) connects it to a real fact:

```json
{
  "field": "endorsementFeeUsd",
  "extractRule": { "field": "endorsementFeeUsd", "pattern": "...", "transform": "number" }
}
```

A source with no `fieldMapping` is monitored at the content level only (any change to the page is flagged generically, with no proposed value).

## Check intervals

Each source has `checkFrequencyDays`. A source becomes "due" when:
- it has never been checked (`lastCheckedAt` is null), or
- `now - lastCheckedAt >= checkFrequencyDays` (computed in UTC).

`lib/monitoring/health.ts`'s `computeNextCheckAt()` derives the next check date from `lastSuccessfulFetchAt + checkFrequencyDays` — this is a *computed* value, not stored, so it's always consistent with the source's actual history.

## Failure handling (3-strike rule)

| Consecutive failures | Stored `status` | Computed health classification |
|---|---|---|
| 0 | `active` | `healthy` |
| 1–2 | `active` | `warning` |
| 3+ | `failed` | `failed` |

A **failed** source remains eligible for its next scheduled check (it can recover automatically). A **paused** source (a deliberate human choice) is never auto-selected and is never auto-reactivated by any fetch outcome, success or failure.

A fetch failure never overwrites `lastContentHash` or `lastSuccessfulFetchAt` — the last known-good state survives untouched, and the failure is recorded separately (`lastError`, `lastHttpStatus`, `failedChecks`).

## Idempotency

A `DetectedChange`'s id is derived deterministically from `sourceId + contentHash (+ field)`. Re-running detection against unchanged content always resolves to `NO_CHANGE` before an id is even computed; even if it were computed, `saveDetectedChange()` refuses to overwrite an existing record. Running the same cycle twice never creates duplicate review items.

## Concurrency

A non-dry-run cycle acquires an advisory lock file (`data/knowledge-base/monitoring/.lock`) before doing any work and releases it in a `finally` block. A second concurrent invocation fails fast with `MonitoringCycleInProgressError` rather than racing the first. This is a simple file lock, not a distributed lock — a hard crash can leave a stale lock file that needs manual removal (`rm data/knowledge-base/monitoring/.lock`). Dry-run never touches the lock at all.

## Running manually

```bash
npm run monitor              # a real cycle against the real registry (mode=live)
npm run monitor:dry-run       # computes everything, writes nothing
npm run monitor:health        # read-only health summary
npm run monitor:changes       # list all persisted DetectedChange records
npm run monitor:review        # interactive: walk pending changes, approve/reject/etc.
npm run monitor:rollback -- --id <changeId> --reviewer "<name>" --reason "<reason>"
```

## The scheduled workflow (GitHub Actions)

`.github/workflows/source-monitor.yml` runs the real monitoring cycle on a schedule (Monday 10:00 UTC) and via manual `workflow_dispatch`. This is the actual production trigger — `vercel.json`'s `crons` array is deliberately empty; no Vercel Cron / `/api/cron` endpoint is in use for this pipeline.

The workflow has `permissions: contents: write` (it needs to commit new `DetectedChange` records to `data/knowledge-base/monitoring/`), but a strict path-allowlist step refuses to commit — and fails the whole job (`exit 1`) — if the run touched anything outside `data/knowledge-base/monitoring/*`. This is a real, tested safety boundary, not just a convention: it's what currently stands between this pipeline and ever accidentally committing a change to `data/knowledge-base/facts/`.

## Investigating a failed source

```bash
npm run monitor:health
```

Shows `lastError`, `lastHttpStatus`, and `failedChecks` per source. If a source has been `failed` for a long time, check whether the URL still resolves manually (browser or `curl`) before assuming it's a transient issue — a real structural change to the page may require updating its `extractRule`.

## Review workflow

Every `DetectedChange` starts `pending_verification`. A human reviewer (never an automated process — enforced by `isDisallowedReviewerName()`, which rejects names like "AI", "Claude", "system", "automated") takes one of five actions:

- **approve** — applies the proposed value via `applyFieldReview()`/`updateField()`, the same mutation path used by every other part of the knowledge base. Refused if the source has changed again since detection (staleness guard).
- **reject** — field's status becomes `needs_review`; no value change.
- **request_research** — field stays `pending_verification`; the decision is logged.
- **mark_unavailable** — no value is guessed; the change is marked `source_unavailable`.
- **defer** — status stays exactly as-is; logged for audit, revisit later.

All five are non-mutating with respect to production facts except `approve`.

## Known limitations

- The advisory lock has no staleness/timeout recovery.
- `mark_unavailable` doesn't yet update the related `MonitoredSource.status`.
- The optional automated-approval path (below) is field-agnostic and pre-validated but is not wired into this production cycle — it remains a deliberately separate, unactivated system.

## Read-only official-source watch (Phase 3.3–3.6)

A second, structurally simpler monitoring mechanism exists alongside the review-workflow pipeline above: `lib/monitoring/read-only-watch.ts`'s `watchOfficialSource()`. It imports *only* `fetchSource()` and `applyRule()` — pure read/extract functions with zero knowledge of `DetectedChange`, the review queue, or any fact file. It returns exactly one of three results: `NO_CHANGE`, `CHANGE_DETECTED`, or `SOURCE_UNAVAILABLE`.

Currently watches one source: Washington's WAC 296-46B-909 (electrical/telecommunications contractor license fee), confirmed live at $353.90 as of this writing. Run via `.github/workflows/read-only-source-watch.yml` (daily 11:00 UTC + manual `workflow_dispatch`), which has **only** `permissions: contents: read` — it cannot commit or push anything, structurally, regardless of what the script itself does.

```bash
npm run watch:washington              # live fetch against the real source
npm run watch:washington -- --mode=mock  # fixture-based, for local testing without network access
```

On `CHANGE_DETECTED`, the script prints the old value, new value, and evidence to the workflow log and exits `0` — it takes no further action. A human must then run the existing review workflow (`npm run monitor:review`) manually to investigate and, if warranted, approve a real update through the normal `applyFieldReview()` path above. This mechanism cannot itself change any file in `data/knowledge-base/`.

## Automated-approval path (built, not activated)

A third, more capable subsystem exists in `lib/monitoring/` and `lib/monitoring/poc/`: a full evidence → decision → safety-gate → automated-persistence chain (`decision-engine.ts`, `safety-gate.ts`, `value-validation.ts`, `automated-persistence.ts`, `poc/auto-update-orchestrator.ts`) capable of writing a genuinely `auto_verified` field update with **no human reviewer** — for cases meeting a strict bar: an explicit, non-conflicting, non-stale, type-and-shape-validated value from an authoritative source. It reuses `updateField()` (never duplicates it) and produces `status: "auto_verified"` — a status deliberately distinct from `"verified"` (human sign-off) and still eligible for later human review, never silently treated as equivalent.

This path is real, tested end-to-end (including against the real Washington source, in an isolated synthetic namespace), and gated by an explicit kill switch (`lib/monitoring/poc/kill-switch.ts`'s `isAutomaticPersistenceEnabled()`, default `OFF`, fail-closed on any missing or invalid `AUTO_UPDATE_ENABLED` value). **It is not wired into `run.ts`, the scheduler, or any GitHub Actions workflow as of this writing** — activating it is a deliberate, separate decision, not a side effect of anything documented above. See the Phase 3.2 series of reports for the complete safety audit.
