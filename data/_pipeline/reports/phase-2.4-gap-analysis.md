# PHASE 2.4 — RN CORE GAP ANALYSIS

**Analytical audit only. Zero production data was modified to produce this report** — every number below was read directly from `data/knowledge-base/facts/registered-nurse/*.json` and `data/knowledge-base/sources/*.json`, not from memory of prior phases.

---

## 1. The Exact 15 Fields (read from schema, not memory)

| Field | Classification | Description | Authority Type Required | Populated | Authoritative | Secondary | Unknown |
|---|---|---|---|---|---|---|---|
| `licensingBoard` | Core | Which body issues/regulates the license | Tier 1 (State Board) | 50 | 10 | 40 | 0 |
| `officialWebsite` | Core | Where to actually apply / find current info | Tier 1 (State Board) | 50 | 10 | 40 | 0 |
| `licenseTransferPage` | Core | The specific page describing how to transfer in | Tier 1 (State Board) | 0 | 0 | 0 | 50 |
| `reciprocityRules` | Core | Whether/how this state recognizes an out-of-state license | Tier 1 (State Board) | 0 | 0 | 0 | 50 |
| `endorsementRules` | Core | The procedure for licensure-by-endorsement | Tier 1 (State Board) | 0 | 0 | 0 | 50 |
| `universalLicenseRecognitionStatus` | Core | Whether a broad state ULR law applies as a fallback | Tier 1 (State Board) | 0 | 0 | 0 | 50 |
| `compactMembership` | Core | NLC membership — the single biggest portability factor for nursing | Tier 2 (Compact) | 50 | 50 | 0 | 0 |
| `requiredExams` | Core | Whether the nurse must retake an exam | Tier 3 (NCSBN) or Tier 1 | 50 | 50 | 0 | 0 |
| `requiredExperience` | Core | Minimum active-practice requirements for endorsement | Tier 1 (State Board) | 0 | 0 | 0 | 50 |
| `processingTime` | Core | How long until the nurse can legally work | Tier 1 (State Board) | 0 | 0 | 0 | 50 |
| `initialFeeUsd` | Core | Direct cost of the transfer | Tier 1 (State Board) | 0 | 0 | 0 | 50 |
| `requiredEducation` | Supporting | Baseline education standard (doesn't vary for an already-licensed nurse) | Tier 1 or Tier 3 | 0 | 0 | 0 | 50 |
| `requiredDocuments` | Supporting | Administrative checklist | Tier 1 (State Board) | 0 | 0 | 0 | 50 |
| `renewalFeeUsd` | Supporting | Ongoing cost after relocating (not the transfer itself) | Tier 1 (State Board) | 0 | 0 | 0 | 50 |
| `continuingEducationRequirements` | Supporting | Ongoing maintenance after relocating | Tier 1 (State Board) | 0 | 0 | 0 | 50 |

**15 total fields: 11 Core, 4 Supporting.** ✅ matches the stated current state exactly.

---

## 2. Core Field Coverage (all 50 states, per field)

| Field | Authoritative | Secondary | Unknown | Coverage (populated/50) |
|---|---|---|---|---|
| `licensingBoard` | 10 | 40 | 0 | 100% |
| `officialWebsite` | 10 | 40 | 0 | 100% |
| `compactMembership` | 50 | 0 | 0 | 100% |
| `requiredExams` | 50 | 0 | 0 | 100% |
| `licenseTransferPage` | 0 | 0 | 50 | 0% |
| `reciprocityRules` | 0 | 0 | 50 | 0% |
| `endorsementRules` | 0 | 0 | 50 | 0% |
| `universalLicenseRecognitionStatus` | 0 | 0 | 50 | 0% |
| `requiredExperience` | 0 | 0 | 50 | 0% |
| `processingTime` | 0 | 0 | 50 | 0% |
| `initialFeeUsd` | 0 | 0 | 50 | 0% |

**Sum check**: 4 fields at 100% + 7 fields at 0% = 11 core fields. ✅

---

## 3. The 7 Fully-Missing Core Fields

### `licenseTransferPage`
- **Why it matters**: The single most directly-useful fact for a relocating nurse — the exact page to act on, not just the board's homepage.
- **Expected authoritative source**: The state board's own site (a specific sub-page, not the homepage already captured in `officialWebsite`).
- **Source type**: Tier 1 (State Licensing Authority)
- **State-specific or national**: State-specific — every state structures this differently (some have a dedicated "Endorsement" page, some bury it in a general FAQ).
- **Can it be verified from official sources?**: Yes, in principle, for every state — but requires locating the specific sub-page per state, not a single lookup.
- **Estimated verification complexity**: Medium. Not hard to find per state, but genuinely 50 separate lookups with no shortcut (no single consolidated directory of "endorsement pages" the way `nurse.org`'s board directory covered `officialWebsite`).

### `reciprocityRules`
- **Why it matters**: Directly answers "will this state recognize my existing license at all."
- **Expected authoritative source**: State board's own published rules/regulations.
- **Source type**: Tier 1 (State Licensing Authority)
- **State-specific or national**: State-specific, though the underlying *concept* (endorsement vs. true reciprocity) is fairly consistent nationally per Phase 1 research.
- **Can it be verified from official sources?**: Yes, but often requires synthesizing regulation text rather than reading one clear sentence — some boards state this plainly, others require inferring it from application-process pages.
- **Estimated verification complexity**: High. Genuine legal/regulatory language interpretation is needed per state, not just a fact lookup.

### `endorsementRules`
- **Why it matters**: The actual step-by-step procedure most relocating nurses will use.
- **Expected authoritative source**: State board's own endorsement-application page.
- **Source type**: Tier 1 (State Licensing Authority)
- **State-specific or national**: State-specific procedure, but built on the nationally-standard concept of "verification via Nursys + application."
- **Can it be verified from official sources?**: Yes — most boards have a page explicitly titled around "endorsement" or "licensure for nurses licensed elsewhere."
- **Estimated verification complexity**: Medium — similar shape across states (Nursys verification is nearly universal per Phase 1/2 research), but 50 individual confirmations are still required.

### `universalLicenseRecognitionStatus`
- **Why it matters**: For the ~10 non-compact states, this is the fallback mechanism that might still allow easier transfer.
- **Expected authoritative source**: State ULR statute or the state board's own page referencing it (note: this is the *nursing-specific application* of a state's general ULR law, not the general ULR fact itself, which the separate `data/states/*.json` file already tracks for the live site's 5 tracked states).
- **Source type**: Tier 1 (State Licensing Authority), secondarily state legislative text
- **State-specific or national**: State-specific, and only meaningfully relevant for the ~10 non-compact states — for the 40 compact states, compact membership already answers portability, making this field lower practical priority for most of the 50-state set.
- **Can it be verified from official sources?**: Yes, for the subset of non-compact states where it matters most.
- **Estimated verification complexity**: Medium — but the *effective* scope is closer to 10 states than 50, since it's largely moot for compact members.

### `requiredExperience`
- **Why it matters**: Some states impose a minimum active-practice period for endorsement — can silently disqualify an otherwise-eligible nurse.
- **Expected authoritative source**: State board's endorsement requirements page.
- **Source type**: Tier 1 (State Licensing Authority)
- **State-specific or national**: State-specific; likely "no requirement" for many states and a specific threshold for others — genuinely variable, not a formality.
- **Can it be verified from official sources?**: Yes.
- **Estimated verification complexity**: Medium — the fact itself is usually a single clear sentence per state's endorsement page once located.

### `processingTime`
- **Why it matters**: Per the RN Core Fields definition (Phase 2.3), often the single most practically important number for someone planning a move.
- **Expected authoritative source**: State board's own published processing-time estimate (many boards publish this; some don't).
- **Source type**: Tier 1 (State Licensing Authority)
- **State-specific or national**: State-specific, and volatile — boards frequently update these estimates based on current backlog, meaning this field will need more frequent re-verification than most others once populated.
- **Can it be verified from official sources?**: Partially — some boards publish a clear number/range; others do not publish this at all, which would legitimately require staying `Unknown` rather than guessed.
- **Estimated verification complexity**: High — not just for finding it, but because it is the field most likely to become stale fastest (see Phase 2.1's staleness tracking), raising ongoing maintenance cost, not just initial verification cost.

### `initialFeeUsd`
- **Why it matters**: A concrete number nurses use to budget a move.
- **Expected authoritative source**: State board's fee schedule.
- **Source type**: Tier 1 (State Licensing Authority)
- **State-specific or national**: State-specific; fee schedules are usually published as a clear, structured table.
- **Can it be verified from official sources?**: Yes — this is the most straightforward of the 7 to verify, since fee schedules are typically published as unambiguous numbers rather than prose to interpret (contrast with `reciprocityRules`).
- **Estimated verification complexity**: Low-Medium — clear numeric fact, but 50 individual lookups, and fee schedules do change periodically (moderate staleness risk, though less volatile than `processingTime`).

---

## 4. Prioritization of the 11 Core Fields

Ranked using three dimensions: **user impact** (how much this changes a real decision), **verification feasibility** (how reliably it can be confirmed from an official source), **portability relevance** (how directly it's about *moving*, not just licensing in general).

| Priority | Field | Rationale |
|---|---|---|
| 1 | `compactMembership` | Already 100% authoritative. Highest possible user impact (determines whether *any* other step is even needed) and already the cheapest to maintain (single national source, short check interval already configured in the pipeline registry). |
| 2 | `requiredExams` | Already 100% authoritative. High impact (retesting is a major cost/time factor), nationally uniform, essentially zero ongoing verification cost. |
| 3 | `initialFeeUsd` | Not yet populated, but the most feasible of the 7 gaps (clear numeric fact, low interpretation risk) and directly answers "what will this cost me." |
| 4 | `endorsementRules` | High user impact (the actual how-to) and moderately feasible — most states publish this in a fairly standard shape. |
| 5 | `licenseTransferPage` | High practical value (a direct link, not just a fact) but lower feasibility than #3/#4 since there's no shortcut directory the way `officialWebsite` had. |
| 6 | `processingTime` | High user impact, but lower priority than #3-#5 due to elevated staleness/maintenance risk and inconsistent publication across states. |
| 7 | `requiredExperience` | Real impact for the subset of states that impose a threshold, but only conditionally relevant (many states likely have no requirement at all). |
| 8 | `reciprocityRules` | Genuinely useful, but the hardest to verify cleanly (requires regulatory interpretation, not fact lookup) — high cost relative to the incremental value beyond what `endorsementRules` already conveys. |
| 9 | `universalLicenseRecognitionStatus` | Real but narrower relevance — meaningfully actionable for roughly 10 non-compact states only; largely redundant with `compactMembership` for the other 40. |
| 10 | `licensingBoard` (remaining 40 states) | Already 100% populated; remaining work is a source-authority *upgrade* (secondary → authoritative), not new information — real value, but lower marginal user impact than populating a currently-Unknown field. |
| 11 | `officialWebsite` (remaining 40 states) | Same reasoning as #10 — already fully populated, upgrade-only remaining work. |

---

## 5. State Prioritization (data-completeness only — no invented demand ranking)

Per-state core-field gap, all 50 states:

| State | Core Fields | Authoritative | Secondary | Missing | Gap % (Missing/11) |
|---|---|---|---|---|---|
| California | 11 | 4 | 0 | 7 | 63.6% |
| Florida | 11 | 4 | 0 | 7 | 63.6% |
| Georgia | 11 | 4 | 0 | 7 | 63.6% |
| Illinois | 11 | 4 | 0 | 7 | 63.6% |
| Michigan | 11 | 4 | 0 | 7 | 63.6% |
| New York | 11 | 4 | 0 | 7 | 63.6% |
| North Carolina | 11 | 4 | 0 | 7 | 63.6% |
| Ohio | 11 | 4 | 0 | 7 | 63.6% |
| Pennsylvania | 11 | 4 | 0 | 7 | 63.6% |
| Texas | 11 | 4 | 0 | 7 | 63.6% |
| *(all other 40 states)* | 11 | 2 | 2 | 7 | 63.6% |

**Honest finding**: every one of the 50 states currently has an identical `Missing` count (7 — the same 7 core fields are Unknown everywhere, since no state-specific research into those 7 fields has happened yet for *any* state). This means **ranking by "smallest gap" produces a complete tie across all 50 states** — the gap metric alone cannot differentiate them yet.

The only real differentiator in the current data is **existing authoritative coverage**: the 10 states verified in Phase 2.2/2.3 Batches (36.4% authoritative) rank ahead of the other 40 (18.2% authoritative each, also tied among themselves).

Per the instruction "do not invent a demand ranking," the 40 tied states are **not** further ordered here — any ordering beyond this point (population, search volume, etc.) would be a demand-based judgment call, which this audit is explicitly not authorized to make. If further differentiation is wanted, that would need to be an explicit, separate decision criterion approved before the next batch — not inferred by this audit.

---

## 6. Source Gap Analysis (per missing Core field)

| Field | Classification | Reasoning |
|---|---|---|
| `licenseTransferPage` | **D** — requires state-specific official research | No existing repository data addresses this; must be found per state. |
| `reciprocityRules` | **D** — requires state-specific official research | Same; additionally often requires interpreting regulatory text, not just locating a page. |
| `endorsementRules` | **D** — requires state-specific official research | Same pattern as above. |
| `universalLicenseRecognitionStatus` | **A** (partially) — already present elsewhere, not mapped | The live site's `data/states/*.json` already tracks a general `isUlrState` boolean for the 5 originally-tracked states (CA, TX, FL, NY, OH) — but that's the live-site schema, not this knowledge base, and covers only 5 of 50 states. For those 5, this is closer to **A**; for the other 45, it is **D**. |
| `requiredExperience` | **D** — requires state-specific official research | No existing repository data addresses this for any state. |
| `processingTime` | **D** — requires state-specific official research | No existing repository data addresses this; additionally see the staleness concern noted in Section 3. |
| `initialFeeUsd` | **D** — requires state-specific official research | No existing repository data addresses this for any state. |

**None of the 7 gaps are classified B or C** — meaning no gap is "secondary-source-only" or "not present anywhere in principle." All 7 are either genuinely findable via state-specific research (D) or partially cross-referenceable against existing live-site data (A, for a 5-state subset only).

---

## 7. Verification Cost Estimate

| Field | Cost | Basis |
|---|---|---|
| `initialFeeUsd` | **Low-Medium** | Structured numeric fact, usually a clear published fee table; moderate staleness risk. |
| `endorsementRules` | **Medium** | Fairly standard shape across states (Nursys-based verification is near-universal), but still 50 individual confirmations. |
| `licenseTransferPage` | **Medium** | Findable, but no shortcut directory exists (unlike `officialWebsite`, which had `nurse.org`'s consolidated table as a starting point). |
| `requiredExperience` | **Medium** | Usually one clear sentence once the right page is located; the challenge is locating it consistently. |
| `universalLicenseRecognitionStatus` | **Medium** | Real work per state, but effective scope is closer to ~10 states (non-compact) than 50. |
| `reciprocityRules` | **High** | Requires regulatory interpretation, not fact lookup; highest risk of ambiguity/disagreement between sources. |
| `processingTime` | **High** | Findable for some states but not others (inconsistent publication), and the highest ongoing maintenance/staleness cost of the 7. |

---

## 8. Recommended Next Batch (recommendation only — not executed)

**Next field to verify: `initialFeeUsd`**
**Reason**: Lowest verification cost of the 7 missing core fields (Section 7), highest feasibility (Section 3), and ranks #3 in the priority order (Section 4) — the best available combination of "high value, low cost, low ambiguity risk" among fields that currently have zero coverage. Populating it would also be the first Core field besides the already-complete `compactMembership`/`requiredExams` to reach non-zero coverage, meaningfully diversifying what the dataset can answer rather than only deepening two already-complete fields.

**Next 5 states: continuing with the highest-authoritative-coverage tier is not applicable here** (that tier — the 10 already-verified states — is about `licensingBoard`/`officialWebsite`, a different field). Since Section 5 found all 50 states tied on the fields actually being recommended next, and this audit is not authorized to invent a demand ranking, **no specific 5 states can be data-drivenly recommended over any other 40 at this time.** The honest options are: (a) continue with the same 10 already-verified states to also gain `initialFeeUsd` coverage for them (deepens existing states further), or (b) pick 5 new states to widen `licensingBoard`/`officialWebsite` coverage instead (breadth). This is a genuine strategic choice, not a data-computable answer — recommend deferring the specific 5-state selection to an explicit decision when the next batch is authorized.

---

## 9. Trust Dashboard Impact (explanatory only — dashboard not changed)

- **Authoritative coverage**: Populating `initialFeeUsd` for even 5 states would raise `fieldsUsingAuthoritativeSources` from 120 toward 125 (assuming all 5 sourced authoritatively) — a small absolute change, but the *first* increase driven by new-fact discovery rather than source-upgrade of already-known facts.
- **Human review queue**: Currently 120 items, all from `compactMembership`/`requiredExams`/`licensingBoard`/`officialWebsite`. Populating any of the 7 missing fields with authoritative evidence would be the first time the queue includes a *different kind* of fact, giving a human reviewer more representative coverage to sign off on rather than repeatedly reviewing the same 4 field types.
- **Verification coverage**: Currently 26.7% (200/750). Fully populating one more field across all 50 states would raise this by roughly 6.7 percentage points (50/750) per field, regardless of which field is chosen — this metric doesn't distinguish field importance, only presence.
- **User usefulness**: Not uniform per field — per Section 4's ranking, populating `initialFeeUsd` or `endorsementRules` would materially improve what a user can actually decide with the site, while populating the remaining 40 states' `licensingBoard`/`officialWebsite` (already-known facts, just secondary-sourced) would improve trust/provenance quality without changing what a user learns that they didn't already effectively know.

---

## 10. Tests & Validation (actually executed)

```
npm test           → 49 passed, 0 failed  (49/49) ✅
npm run validate-data → ✅ Data OK — 5 professions, 5 states validated.
```

No regressions. No production data was modified during this audit — confirmed by re-running the full suite before and after report generation with identical results.

---

## Summary

| | |
|---|---|
| 15 total fields | 11 Core, 4 Supporting |
| 7 fully-missing Core fields | licenseTransferPage, reciprocityRules, endorsementRules, universalLicenseRecognitionStatus, requiredExperience, processingTime, initialFeeUsd |
| Top priority field | `initialFeeUsd` (already-complete fields `compactMembership`/`requiredExams` excluded as "already done") |
| State ranking | All 50 tied on gap; 10 states lead only on the *unrelated* licensingBoard/officialWebsite dimension |
| Source gap classification | 6 fields = D (state-specific research required); 1 field (`universalLicenseRecognitionStatus`) = A/D split (partial cross-reference exists for 5 states only) |
| Highest verification cost | `reciprocityRules` and `processingTime` (High) |
| Lowest verification cost | `initialFeeUsd` (Low-Medium) |
| Tests | 49/49 PASS |
| Validation | PASS |

**STOP per instructions — no data modified, no batch executed, awaiting separate approval for next steps.**
