# PermitBridge Data Pipeline

A self-updating data layer that keeps `/data` in sync with official licensing
sources — with validation, risk-scored diffing, an approval gate for
anything high-stakes, and an audit trail of every run. **It does not touch
`app/`, `components/`, or any UI code.** It only ever reads and writes
`/data`, `/public/data`, and its own bookkeeping under `data/_pipeline/`.

```
Fetch → Extract → Normalize → Validate → Diff → Gate → Update → Regenerate → Search Index → Changelog
```

---

## Why this design

Government licensing pages are inconsistent, redesign often, and carry real
legal weight — a wrong "no exam required" costs someone real time and money.
So the pipeline is built around one rule: **the riskier a change is, the
harder it should be to apply automatically.**

| Risk | Examples | What happens |
|---|---|---|
| 🟢 Low | `updatedAt`, `sourceUrl`, `notes`, prose fields | Auto-applied immediately |
| 🟡 Medium | Numeric fields with a small swing (fee, processing days) | Auto-applied, logged prominently |
| 🔴 High | `isUlrState`, `examRequired`, `pathway`, compact membership | **Never** auto-applied — queued for human approval |

This is enforced in [`lib/pipeline/diff.ts`](lib/pipeline/diff.ts) and gated
in [`lib/pipeline/update.ts`](lib/pipeline/update.ts).

---

## Architecture

```
data/_pipeline/
├── sources/
│   ├── registry.json          # every official source we track (edit this to add one)
│   └── registry.schema.json
├── overrides/transfers/       # source-verified overrides for a SPECIFIC transfer rule
│   └── {profession}/{from}--{to}.json
├── pending/                    # high-risk changes awaiting human approval
│   └── resolved/                # approved/rejected history
├── changelog/                  # one .md + .json report per run (audit trail)
├── reports/                     # reserved for future validation-only reports
└── cache/                       # ETag/content-hash cache for live fetches (gitignored)

lib/pipeline/
├── types.ts          # shared contracts for every stage
├── registry.ts        # loads + type-checks registry.json
├── fetcher.ts          # HTTP (live) or fixture (mock) fetch, with caching + retry
├── extract.ts           # regex-rule extraction from fetched text
├── normalize.ts          # merges extracted fields onto current profession/state JSON
├── validate.ts             # zod schema + business-rule validation
├── diff.ts                  # deep diff + risk classification
├── update.ts                  # the ONLY module allowed to write to /data
├── searchIndex.ts               # persists a search-index.json snapshot (see note below)
├── changelog.ts                   # writes the audit-trail report
└── run.ts                          # orchestrates all of the above

scripts/pipeline/
├── run.ts        # CLI: npm run pipeline / pipeline:dry-run / pipeline:mock
└── approve.ts      # CLI: npm run pipeline:approve (interactive review)
```

### Stage-by-stage

1. **Fetch** (`fetcher.ts`) — pulls each enabled source in
   `sources/registry.json`. Live mode does real HTTP with a polite
   User-Agent, ETag caching, and retry/backoff. Mock mode reads from
   `fixtures/pipeline/html/{sourceId}.html` instead — no network required,
   used for local testing, CI smoke checks, and any offline environment.

2. **Extract** (`extract.ts`) — runs each source's regex `extract` rules
   (from the registry) against the fetched page text. Regex-on-text was
   chosen over CSS-selector scraping deliberately: government sites rarely
   have stable markup, but they're consistent about *language*
   ("universal license recognition", "reciprocity by endorsement"...).

3. **Normalize** (`normalize.ts`) — merges extracted fields onto the
   *current* profession/state JSON. Two safety rules:
   - Only fields on an explicit per-entity allowlist can be written (e.g. a
     state source can update `isUlrState`, not `faqs`).
   - Anything extracted that *isn't* on that allowlist becomes a **signal**
     (e.g. `compactListPageChanged`) — logged for human research, never
     merged. This is what stops a presence-only "did this page change?"
     check from ever overwriting a curated list like `compactStates` with a
     bare `true`.

4. **Validate** (`validate.ts`) — zod schema validation plus business rules
   that span multiple fields (e.g. "a compact profession needs a non-empty
   member list"). Nothing invalid reaches disk.

5. **Diff** (`diff.ts`) — deep diff between current and proposed, every
   changed field tagged `low` / `medium` / `high` risk.

6. **Gate → Update** (`update.ts`) — low/medium risk writes straight to
   `/data`. High risk writes a `PendingChange` to `data/_pipeline/pending/`
   instead and stops there.

7. **Regenerate** — re-runs the existing `scripts/generate-transfers.ts`
   (unmodified logic, just re-invoked) so every transfer-rule page reflects
   the updated profession/state data.

8. **Validate data** — re-runs `scripts/validate-data.ts`, which now also
   checks the pipeline's own registry and override files.

9. **Search index** (`searchIndex.ts`) — rebuilds a *persisted snapshot* at
   `public/data/search-index.json`. **This does not change how the live
   site searches** — `components/home/SearchBox.tsx` still gets its index
   from `lib/search.ts` computed at request/build time, exactly as before
   this pipeline existed. The snapshot exists so CI can diff index size/
   contents between runs to catch pipeline bugs early, and as a ready-made
   artifact if the site ever wants fetch-based client search later.

10. **Changelog** — writes a dated `.md` + `.json` report to
    `data/_pipeline/changelog/` with every applied and pending change.

---

## The override layer (verified, per-transfer facts)

Transfer rules are *derived* — `scripts/generate-transfers.ts` computes
pathway/exam/fee/score from profession + state data via a rule engine. But
sometimes the pipeline (or a human) confirms a fact specific to one exact
`{profession, from, to}` combination that the general rule engine wouldn't
know — e.g. a state board page saying electricians specifically get a
faster queue than the general contractor timeline.

Drop a file at `data/_pipeline/overrides/transfers/{profession}/{from}--{to}.json`
with just the fields you want to override:

```json
{
  "feeUsd": 315,
  "estimatedProcessingDays": [10, 25],
  "sourceUrl": "https://www.myfloridalicense.com/",
  "verifiedAt": "2026-07-20"
}
```

`generate-transfers.ts` merges it on top of the computed default
automatically — see `data/_pipeline/overrides/transfers/electrician/texas--florida.json`
for a working example already in this repo. **No override files present =
byte-identical output to before this pipeline existed.**

---

## Running it

```bash
npm run pipeline:dry-run   # mock fixtures, computes everything, writes NOTHING — safe to run anytime
npm run pipeline:mock       # mock fixtures, writes for real — use this to test a new source's fixture
npm run pipeline             # LIVE — fetches real official sources, applies low/medium risk changes
npm run pipeline:approve      # interactive review of anything queued as high-risk
```

After any run that changed data:
```bash
npm run generate-transfers   # (the pipeline already does this automatically when NOT a dry run)
npm run validate-data
```

### This repo ships with a completed demo run

`data/_pipeline/changelog/` and `data/_pipeline/pending/resolved/` already
contain the output of one real `npm run pipeline:mock` execution against the
fixtures in `fixtures/pipeline/html/`, including a high-risk New York ULR
status change that was queued and then approved via `npm run
pipeline:approve`. This is here so you can see the full loop working without
running anything yourself first. **The fixture content is illustrative, not
verified real government text** — treat the resulting data exactly like the
rest of this repo's sample data: confirm against real official sources
before relying on it in production (see `/disclaimer`).

---

## Adding a new source

1. Add an entry to `data/_pipeline/sources/registry.json` — no code changes
   needed for a simple presence/boolean check.
2. (Optional, for local testing) Add
   `fixtures/pipeline/html/{your-source-id}.html` and run
   `npm run pipeline:mock` to see it flow through the whole pipeline before
   ever hitting the real URL.
3. Run `npm run pipeline` (live) or wait for the scheduled GitHub Action.

If your source needs something regex-on-text can't express (e.g. reading a
specific value out of an HTML table), add a dedicated function under
`lib/pipeline/extractors/` and branch to it from `extract.ts` — the rest of
the pipeline (validate/diff/gate/update) doesn't need to change.

---

## Scheduling (CI)

`.github/workflows/data-pipeline.yml` runs weekly (and on manual dispatch),
executes `npm run pipeline` in live mode, and — if anything changed — opens
a Pull Request rather than committing directly to `main`. High-risk changes
still land in `data/_pipeline/pending/` either way and need a local
`npm run pipeline:approve` before they'd ever appear in that PR's diff.

---

## What this pipeline deliberately does NOT do

- **It never touches `app/`, `components/`, `lib/data.ts`, `lib/search.ts`,
  or any file the live site's pages import.** The site keeps reading
  `/data` through the exact same `lib/data.ts` functions it always has —
  the pipeline just keeps what's in those files current.
- **It never auto-applies a change to what a person is legally told to do**
  (pathway type, exam requirement, compact/ULR status) without a human
  explicitly approving it.
- **It never invents a list from a presence check** — a tripwire source
  that detects "this compact page changed" surfaces that fact for a human
  to research, rather than guessing at the new member list.
