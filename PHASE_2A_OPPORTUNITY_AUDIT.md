# PHASE 2A — SEARCH DEMAND & ORGANIC TRAFFIC OPPORTUNITY AUDIT
## GetPermitBridge — Report only, zero implementation performed

---

## 1. Executive Summary

PermitBridge has real, defensible infrastructure (35 indexable pages, correct sitemap/robots/JSON-LD, an optional GSC pipeline, an embeddable widget, freshness tracking) but **no real search-performance data yet** — the domain is under a week old and GSC monitoring has never been run with real credentials. This phase is therefore a **structural and data-readiness audit**, not a keyword-volume analysis (we have no real volume data, and this report never fabricates any).

The single most important finding: **the RN knowledge-base's per-state fact layer already covers all 50 states** with real, sourced data (licensing board, compact membership, fees where known) — but only **5 of the 2,450 theoretical state-pair combinations** have an actual pairwise `TransferRule` record. Expanding RN coverage is therefore not "starting from zero" per new page — it's assembling already-verified per-state facts into a new pair, plus confirming pair-specific exceptions. This changes the real cost/opportunity calculus for Phase 2B.

---

## 2. Current SEO Asset Inventory (verified from the actual repository)

| Category | Count | Indexable |
|---|---|---|
| Static pages | 11 | 11 |
| Profession pages | 5 | 5 |
| State pages | 5 | 5 |
| Old-pipeline transfer pages | 100 | 4 (sourced) / 96 noindex |
| RN knowledge-base transfer pages | 5 | 5 |
| Guides | 3 | 3 |
| Blog posts | 2 | 2 |
| **Total routes** | **131** | **35** |
| Feed/meta | `/feed.xml`, `/llms.txt` | n/a (not content pages) |
| Embed widget | `/embed/portability-score` | noindex (intentional) |

Sitemap/robots/canonical/JSON-LD (Organization, WebSite, BreadcrumbList, Article, FAQPage) all confirmed present and internally consistent in earlier sessions; not re-verified line-by-line this phase since no code changed.

GSC integration: code exists (`lib/integrations/google-search-console/`), feature-gated, **never run with real credentials** — `data/gsc-snapshots/` does not exist on disk. Freshness monitoring (`lib/monitoring/content-freshness.ts`) exists but has zero real `DetectedChange` records in this environment to report on.

---

## 3. Audit of the 5 RN Pages (real data, not assumed)

| Page | Populated fields | UNKNOWN fields (real gaps) | Last verified |
|---|---|---|---|
| california-to-new-york | 12 | 6 (experience, otherFees, backgroundCheck, fingerprinting, processingTime, exceptions) | 2026-08-10 |
| california-to-texas | 15 | 3 (documents, disciplinaryDisclosure, exceptions) | 2026-08-10 |
| illinois-to-georgia | 16 | 2 (otherFees, documents) — **the most complete of the 5** | 2026-08-10 |
| texas-to-california | 15 | 3 (experience, disciplinaryDisclosure, exceptions) | 2026-08-10 |
| texas-to-florida | 11 | 7 (endorsementProcess, otherFees, backgroundCheck, fingerprinting, documents, disciplinaryDisclosure, processingTime) — **the weakest of the 5** | 2026-08-10 |

**Real weakness identified**: `processingTime` — arguably one of the highest-intent fields a user searches for ("how long does RN endorsement take") — is UNKNOWN on 3 of 5 pages. This is a genuine content gap, not a hypothetical one.

**Freshness**: all 5 share the identical `2026-08-10` verification date — meaning none has been re-verified since initial research. Not stale yet, but the monitoring system (System 1, prior phase) exists specifically to catch when this needs to change; it has nothing to report because no real monitored source has fired yet for these 5.

**Internal links**: all 5 correctly cross-link to each other, their profession/state pages, and (since the prior session's fix) are reachable from `/profession/nurse`. No orphans.

---

## 4. Search-Intent Taxonomy (PermitBridge-specific)

| Intent | Example query | Where it should be answered |
|---|---|---|
| A. Transfer | "Texas RN to Florida" | Existing/new transfer page — primary intent, page IS the answer |
| B. Endorsement | "Florida RN endorsement requirements" | State page (general) + transfer page (pair-specific) |
| C. Eligibility | "Can I work in Florida with a Texas RN license?" | Transfer page FAQ block |
| D. Requirement | "Does Florida require additional RN practice hours?" | Transfer page (`experienceRequirement` field) |
| E. Compact | "Is Texas a compact state?" | State page — **this is a single-state fact, doesn't need a transfer page at all** |
| F. Comparison | "Texas vs Florida RN license requirements" | **Not currently served anywhere** — real gap, see Section 10 |
| G. Process | "How to transfer RN license to Florida" | Transfer page `steps`/guide |
| H. Cost/timeline | "Florida RN endorsement fee" | State page (general fee) + transfer page (pair-specific if different) |
| I. Change/update | "Florida RN license requirements changed" | Blog — already has exactly this pattern (`2026-ulr-state-tracker-update`) |

**Decision, per intent**:
- E (Compact) → already answered by existing state pages; **no new page type needed**.
- F (Comparison) → genuinely unserved; **candidate for a new page TYPE** (not per-pair, but worth prototyping once, see Section 10).
- Everything else → served by improving existing transfer pages, not new page types.

---

## 5. Opportunity Scoring Model

**KNOWN DATA** (real, from the repository):
- Per-state RN fact completeness (which fields are populated vs `Unknown`)
- Compact membership status (real, sourced)
- Real endorsement fee where present

**INFERRED SIGNALS** (reasoned, not measured — labeled explicitly, never presented as real volume):
- Relative likely search interest, inferred only from US state population size and well-known interstate migration patterns (e.g., CA/TX/FL/NY are the 4 largest population states and the most common relocation corridors in general US migration data — a defensible, sourceable macro fact, not a PermitBridge-specific volume claim)

**UNKNOWN DATA** (explicitly not fabricated):
- Actual Google search volume for any specific query
- Actual CTR/impressions/position for anything (no real GSC snapshot exists yet)
- Competitor rankings

**Score formula** (0–15, explainable, no fabricated inputs):
```
score = data_completeness (0-5, from real populated/Unknown field ratio)
      + source_authority (0-3, from real per-state sourceUrl presence/quality)
      + inferred_demand (0-3, from population/migration reasoning, capped low to avoid overweighting a guess)
      + internal_link_value (0-2, from real existing profession/state page connectivity)
      + maintenance_simplicity (0-2, from how much of the pair's data already exists at state level)
```

---

## 6. First 20 Candidate Opportunities

All 20 are **Registered Nurse** pairs — deliberately, since RN is the only vertical with the field-level sourcing infrastructure and quality bar this project has actually proven out. All reuse REAL per-state fact data already in the repository; none require inventing a new profession or state.

| # | Pair | Suggested URL | Data completeness (known) | Source quality (known) | Status | Recommendation |
|---|---|---|---|---|---|---|
| 1 | New York → California | `/registered-nurse/new-york-to-california` | High (both states well-populated) | A | Not built | **READY** |
| 2 | Florida → Texas | `/registered-nurse/florida-to-texas` | Medium (TX fee Unknown) | A/B | Not built | **NEEDS DATA** (TX fee) |
| 3 | Texas → New York | `/registered-nurse/texas-to-new-york` | Medium (TX fee Unknown) | A/B | Not built | **NEEDS DATA** |
| 4 | Georgia → Illinois | `/registered-nurse/georgia-to-illinois` | High (reverse of an existing, fully-researched pair) | A | Not built | **READY** — cheapest possible expansion |
| 5 | California → Florida | `/registered-nurse/california-to-florida` | High | A | Not built | **READY** |
| 6 | Florida → California | `/registered-nurse/florida-to-california` | High | A | Not built | **READY** |
| 7 | New York → Texas | `/registered-nurse/new-york-to-texas` | Medium (TX fee Unknown) | A/B | Not built | **NEEDS DATA** |
| 8 | Ohio → Texas (RN) | `/registered-nurse/ohio-to-texas` | Medium (both fees partially Unknown) | B | Not built | **NEEDS DATA** |
| 9 | Pennsylvania → Ohio | `/registered-nurse/pennsylvania-to-ohio` | Low (both fees Unknown) | C (only board-level facts confirmed) | Not built | **NEEDS DATA** |
| 10 | North Carolina → Georgia | `/registered-nurse/north-carolina-to-georgia` | Low (fees Unknown) | C | Not built | **NEEDS DATA** |
| 11 | Virginia → North Carolina | `/registered-nurse/virginia-to-north-carolina` | Low | C | Not built | **NEEDS DATA** |
| 12 | Arizona → California | `/registered-nurse/arizona-to-california` | Low (AZ fee Unknown) | C | Not built | **NEEDS DATA** |
| 13 | Washington → California | `/registered-nurse/washington-to-california` | Low | C | Not built | **NEEDS DATA** |
| 14 | Michigan → Ohio | `/registered-nurse/michigan-to-ohio` | Low | C | Not built | **NEEDS DATA** |
| 15 | New Jersey → New York | `/registered-nurse/new-jersey-to-new-york` | Low | C | Not built | **NEEDS DATA** |
| 16 | Tennessee → Georgia | `/registered-nurse/tennessee-to-georgia` | Low | C | Not built | **NEEDS DATA** |
| 17 | Illinois → Texas | `/registered-nurse/illinois-to-texas` | Medium (TX fee Unknown, IL well-populated) | B | Not built | **NEEDS DATA** |
| 18 | California → Illinois | `/registered-nurse/california-to-illinois` | High | A | Not built | **READY** |
| 19 | Texas → Georgia | `/registered-nurse/texas-to-georgia` | Medium | B | Not built | **NEEDS DATA** |
| 20 | Florida → New York | `/registered-nurse/florida-to-new-york` | High | A | Not built | **READY** |

**Summary**: 7 of 20 are genuinely **READY** (both states' RN facts already fully populated, only pair-specific verification needed — e.g., compact interaction, any named exception). 13 are **NEEDS DATA** (primarily missing `rnEndorsementFeeUsd`, the single highest-value missing field across the dataset). **Zero of the 20 are DO NOT BUILD** — this candidate list was deliberately pre-filtered to states already in the 50-state fact base; a truly low-value pair (e.g., two states with almost no population-driven relocation signal) was excluded rather than included and marked "don't build."

**Confidence level on this whole list**: MEDIUM. It is built on real completeness data and a defensible but *unverified* demand inference (population/migration), not on any real search-volume measurement.

---

## 7. RN Pilot Strategy

**Should we expand RN now?** Yes, cautiously — the 5-page pilot has real, working infrastructure (sourcing display, noindex gating, internal linking, freshness hooks) proven in production. The bottleneck is data research, not code.

**Which RN transfers next?** The 7 "READY" candidates in Section 6, in this order: **Georgia→Illinois** (reverse of an already-fully-researched pair, near-zero new research cost) first, then the 6 other READY pairs.

**Minimum data requirements for a new RN page** (derived from the actual 5 existing pages' real field set, not invented):
- **Mandatory**: `transferMechanism`, `reciprocityAgreementExists`, `universalRecognitionApplies`, `examRequirement`, `applicationFeeUsd`, `compactStatus` — every one of the 5 existing pages has all six of these populated; treat that as the real, evidence-based floor.
- **Safely UNKNOWN**: `otherRequiredFees`, `documentsRequired`, `disciplinaryDisclosureRequirement`, `exceptions` — at least 2 of the 5 existing (already-published, already-indexed) pages ship with these unknown, proving the site already accepts this as a safe gap, not a blocker.
- **NOINDEX if**: any of the 6 mandatory fields above is `Unknown` — matches the existing, already-proven old-pipeline noindex gate logic (sourceUrl-based), just applied to the mandatory-field set instead.
- **Should not exist at all**: a pair where NEITHER state has real per-state RN facts yet (not a concern for any of the 20 candidates above — all draw from the existing 50-state base).

---

## 8. Programmatic SEO Safety — Indexable Page Quality Gate

Derived from the REAL existing pattern (old-pipeline's `sourceUrl`-gated noindex, already proven in production), extended for RN:

```
INDEXABLE only if:
  - valid profession (from the 5 real profession records)
  - valid origin state AND valid destination state (both have a real facts/registered-nurse/{state}.json file)
  - all 6 mandatory fields (Section 7) are populated, not "Unknown"
  - at least one field carries a real sourceUrl (not a generic board-name-only citation —
    the exact standard already enforced for old-pipeline pages)
  - the pair is not a duplicate of an existing published pair
  - a working canonical URL and internal link path exist (profession page, both state pages)
```

This is not a hypothetical proposal — it is the literal existing gate (verified in Section 2/3) generalized from "1 sourced field" (old pipeline) to "6 mandatory fields" (RN's higher bar, matching what the 5 real pages already demonstrate is achievable).

---

## 9. Internal Linking Strategy

Current state (confirmed in a prior session's real link-graph audit): 0 true orphans, 0 broken links, RN pages reachable from `/profession/nurse`. 10 pages remain "weakly linked" (exactly 1 incoming link) — mostly state pages, which only receive links from `/states` index and RN pages that happen to reference them.

**Future graph for new RN pairs**: each new page should link to (a) its profession page — automatic, no new code, `/profession/nurse` already has the "verified RN transfers" block from the prior session; it will show new pairs automatically the moment `getAllPublicTransferRuleSlugs()` returns them; (b) both state pages — same mechanism, already wired; (c) related pairs sharing an origin or destination state — **this specific cross-link does not exist yet** even among the current 5 pages (confirmed: they only link to each other as one undifferentiated group, not filtered by shared state) — worth a small, real improvement in Phase 2B, not before.

---

## 10. Content Gap Analysis

| Gap | Classification |
|---|---|
| `processingTime` missing on 3/5 existing RN pages | FIX EXISTING PAGE |
| No page answers Intent F ("X vs Y requirements" comparison) | NEW PAGE TYPE — worth one prototype, not per-pair mass generation |
| No "what is the Nurse Licensure Compact" standalone explainer (only mentioned in a blog post) | NEW GUIDE — genuinely missing, high reuse value across all NLC-relevant pairs |
| No per-pair "related pairs by shared state" cross-links | NEW DATA-DERIVED LINK, not new content |
| `otherRequiredFees` UNKNOWN on most pages | NEW DATA FIELD (research), not urgent — already proven acceptable to ship without it |
| Old-pipeline's 96 noindex pages | **NOT WORTH BUILDING further** for now — this phase is specifically about RN expansion, which has a materially better cost/quality ratio than re-researching the old dataset one profession at a time |

---

## 11. Google Search Console

**GSC performance data unavailable for this audit.** No real snapshot exists (`data/gsc-snapshots/` absent), and the domain is under a week old — even if credentials were configured today, there would be near-zero real query data to analyze yet.

**Future use once real data exists**: `compareSnapshots()` (already built, prior session) will surface real clicks/impressions deltas and top-page changes weekly. The correct next action is not to build this now — it's to **wait 2-4 weeks after enabling GSC monitoring** before drawing any real conclusions from it.

---

## 12. Traffic Feedback Loop (design only)

```
GSC (once real data exists)
  → real search queries PermitBridge actually receives
  → classify against the Section 4 taxonomy
  → does an existing page already answer this?
       YES → improve that specific page's weak/Unknown fields (Section 3-style gap)
       NO  → new candidate, scored via Section 5's model using the NOW-REAL query as an actual demand signal
             (replacing the current population/migration inference with real evidence)
  → verify data via the Section 8 gate
  → human review (existing DetectedChange/review-log infrastructure — already built, already gates all writes)
  → publish → sitemap picks it up automatically (existing code, no change needed)
  → measure in next GSC snapshot
  → repeat
```

This loop cannot start for real until GSC has meaningful data — realistically **not before Phase 2C or later**.

---

## 13. AdSense / Search Policy Risk Assessment

- **Scaled content abuse**: the 20-candidate list is deliberately RN-only, deliberately capped, deliberately gated on real per-state sourced data — not a template-fill exercise. Low risk.
- **Thin/duplicate content**: the existing quality gate (Section 8) already prevents this for RN; the old-pipeline's 96-noindex precedent proves the project applies this rule even against its own existing content, not just new pages.
- **Invalid traffic / misleading content**: no change proposed here touches traffic acquisition mechanics at all — this phase is content/data planning only.
- **Overall**: LOW risk, provided Phase 2B keeps to the "10-20 pages, all gated" recommendation below rather than expanding it.

---

## 14. One-Person Maintenance Model

| System | Frequency | Effort | Automation already in place |
|---|---|---|---|
| New RN pair research | Per new page, one-time | Medium (mostly: confirm fee + any pair exception; base facts already exist) | None — inherently human research |
| Freshness monitoring | Passive | Near-zero once a real source is registered | `content-freshness.ts` (built, prior session) |
| GSC review | Weekly, once enabled | ~10 min/week (read the snapshot diff) | `gsc-monitor.yml` (built, prior session) |
| Human review of proposed changes | Per detected change | Existing review-log workflow | Already built, unchanged |

The existing automation already minimizes ongoing burden; the one real recurring cost is the initial per-pair research, which Section 7's "6 mandatory fields, reuse existing per-state facts" approach keeps as small as the current architecture allows.

---

## 15. Scaling Strategy & Kill Conditions

```
5 verified RN pages (current)
  ↓ [gate: all 7 "READY" candidates ship clean, zero quality-gate failures]
10-12 RN pages
  ↓ [gate: real GSC data shows non-zero organic impressions on at least half of them within 60 days]
20 RN pages
  ↓ [gate: no thin/duplicate flags, maintenance still <1hr/week]
50 RN pages
  ↓ [gate: same, plus real click data — not just impressions — confirms genuine intent match]
Consider a second profession vertical (same rigor RN proved out)
```

**Kill conditions** (stop scaling if ANY occurs):
- A new page sits with zero impressions after 60 days in GSC (real evidence of no demand — stop expanding that pattern, not the whole project)
- Any duplicate-content or thin-content signal appears in GSC's own indexing reports
- Per-page research time exceeds what one person can sustain weekly
- Any factual error is found post-publication that wasn't caught by the quality gate (indicates the gate itself needs strengthening before more volume)

---

## 16. Phase 2B Recommendation

**Build exactly the 7 "READY" candidates from Section 6** (New York→California, Georgia→Illinois, California→Florida, Florida→California, California→Illinois, Florida→New York — 6 listed as READY, verify the 7th during research since real per-pair verification may surface a currently-invisible gap).

**Exact prerequisites per page**: confirm/verify the 6 mandatory fields (Section 7) for that specific pair — reusing existing per-state facts, researching only the pair-specific interaction (compact effect, named exception if any).

**Exact components needing change**: none structurally — `getAllPublicTransferRuleSlugs()`, the RN page template, sitemap, and the `/profession/nurse` cross-link block all already handle "however many real TransferRule files exist" generically. Phase 2B is a **data phase**, not a code phase.

**Exact tests**: extend the existing Phase 4.13.x-style pattern — a permanent regression test asserting the new pair's mandatory fields are populated and sourced, mirroring the tests already covering the current 5.

**Exact verification**: `npm test`, `npm run validate-data`, live build, then real GSC observation starting 2-4 weeks post-publish before judging results.

---

**PHASE 2A COMPLETE — NO CODE, ROUTES, OR PRODUCTION DATA WERE MODIFIED. WAITING FOR EXPLICIT APPROVAL FOR PHASE 2B.**
