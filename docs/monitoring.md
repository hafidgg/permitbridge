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

`data/knowledge-base/monitoring/registry.json` holds the list of `MonitoredSource` records. As of this writing there is **exactly one**: the Florida Board of Nursing's fee page, mapped to `rnEndorsementFeeUsd`.

A source's `fieldMapping` (optional) connects it to a real fact:

```json
{
  "field": "rnEndorsementFeeUsd",
  "extractRule": { "field": "rnEndorsementFeeUsd", "pattern": "...", "transform": "number" }
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

## The cron endpoint

`GET /api/cron/source-monitor`, protected by the `CRON_SECRET` environment variable. The request must carry:

```
Authorization: Bearer <CRON_SECRET>
```

The endpoint **fails closed**: if `CRON_SECRET` isn't set on the server at all, every request is rejected (401) — there is no "open" fallback. It never echoes the secret, never logs it, and never returns filesystem paths or stack traces in its response body.

Responses:
- `200` — cycle ran; body includes `sourcesConsidered`, `sourcesChecked`, `changesDetected`, `failures`, `duration`.
- `401` — missing or wrong secret.
- `409` — a cycle is already in progress (the advisory lock is held); safe to retry later.
- `500` — an unexpected internal failure (details logged server-side only).

### Vercel Cron configuration

`vercel.json` schedules a daily trigger (`0 6 * * *`, 6am UTC) — compatible with Vercel's Hobby-plan once-per-day cron limit. The daily trigger is intentionally more frequent than any individual source's `checkFrequencyDays`; the scheduler's own due-check logic decides which sources actually get fetched on a given day, so a 30-day-interval source is still only fetched roughly once a month even though the endpoint itself is called daily.

**To enable in production**: set `CRON_SECRET` in the Vercel project's environment variables (Settings → Environment Variables). Vercel automatically sends it as the `Authorization: Bearer` header for its own scheduled invocations once the variable is set — no additional configuration needed.

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

- Currently monitors one source, one field (a deliberate, proven pilot — see the corresponding phase report before adding more).
- The advisory lock has no staleness/timeout recovery.
- `mark_unavailable` doesn't yet update the related `MonitoredSource.status`.
