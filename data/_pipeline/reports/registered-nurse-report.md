# Profession Report: Registered Nurse (RN)

**Status: Phase 1a complete (board identification + compact status). NOT yet
a "complete" profession per the coverage dashboard's definition — 11 of 15
fields remain unresearched for all 50 states.** Reported honestly per the
"never fabricate, mark Unknown" rule rather than rounded up.

## 1. Coverage Percentage
- **26.7%** of fields complete for this profession (4 of 15 tracked fields
  × 50 states = 200 of 750 possible fields)
- 0 / 50 states at "complete" status (all 15 fields verified)
- 50 / 50 states at "partial" status (4 of 15 fields verified)
- 0 / 50 states at "missing" or "needs manual review"

## 2. Missing Fields (all 50 states)
The following 11 of 15 fields are marked `"Unknown"` for every state and
still need individual research:
- `licenseTransferPage` (the specific endorsement/reciprocity sub-page, as opposed to the board's homepage)
- `reciprocityRules`
- `endorsementRules`
- `universalLicenseRecognitionStatus` (as a fallback path for non-compact applicants)
- `requiredExperience`
- `requiredEducation`
- `requiredDocuments`
- `processingTime`
- `initialFeeUsd`
- `renewalFeeUsd`
- `continuingEducationRequirements`

## 3. Sources Used
| Source | Used For | Fetched |
|---|---|---|
| [nurse.org State Boards of Nursing Directory](https://nurse.org/education/state-board-nursing-directory/) (cross-checked against NCSBN) | `licensingBoard`, `officialWebsite` — all 50 states | 2026-08-07 |
| [nursecompact.com](https://www.nursecompact.com/) (official NCSBN compact site), corroborated by nurse.org and trustedhealth.com | `compactMembership` — all 50 states | 2026-08-07 |
| [ncsbn.org/exams/nclex.page](https://www.ncsbn.org/exams/nclex.page) | `requiredExams` (NCLEX-RN, uniform nationally) — all 50 states | 2026-08-07 |

## 4. Validation Report
- Schema: all 50 fact files conform to the `ProfessionStateFacts` shape (`types/knowledge-base.ts`).
- Conflicts detected: **0** (no disagreement found between the sources used above).
- Business-rule check: compact membership (40 states) cross-referenced against three independent sources before being marked `confidence: 0.9`; no state was marked compact based on a single source.
- Every populated field carries a non-null `sourceUrl`, `verifiedAt` date, and numeric `confidence` — no field has a guessed value with `confidence > 0` and `sourceUrl: null` (checked programmatically, zero violations).

## 5. Pages Regenerated
**None.** Per this phase's explicit instruction ("do not redesign UI, do not add features, do not refactor"), knowledge-base facts are written to `data/knowledge-base/` only and do not feed the live site's pages yet. Promoting a verified fact into the live `/data` schema that actually regenerates a page is a separate, later, deliberate step per fact — not automatic just because it was verified here.

## 6. Changelog
- Created `types/knowledge-base.ts`, `lib/knowledge-base/fields.ts`, `lib/knowledge-base/coverage.ts` (new, isolated from the live site's code).
- Created `data/knowledge-base/states/*.json` — 50 files (name, abbreviation, region).
- Created `data/knowledge-base/professions/*.json` — 20 files, ranked by demand with documented rationale.
- Created `data/knowledge-base/facts/registered-nurse/*.json` — 50 files, 4/15 fields populated per state.
- Generated `data/_pipeline/reports/coverage.json` and `coverage.md` (the Coverage Dashboard).

**Correction made during this pass:** initially added two new sources to
the shared `data/_pipeline/sources/registry.json` for future automated
monitoring of the sources above. `scripts/validate-data.ts` correctly
rejected this — that registry is scoped to the live site's 5-profession
schema (slug `nurse`), which collides with this knowledge base's more
precise `registered-nurse` slug. Reverted rather than weakening the
validator. Automated monitoring of knowledge-base sources needs its own
registry (or a slug-reconciliation step) as a small follow-up piece of
infrastructure, not a live-registry entry.

## A note on methodology (pipeline vs. manual research)
The existing automated pipeline (`lib/pipeline/`) is a **change-detection**
system: it re-checks a known page for a known regex signal and flags
drift. It has no mechanism to autonomously discover and extract an
unfamiliar 50-row table (like the board directory used here) — that
requires human/LLM reading comprehension, not a regex rule. This phase's
bulk research was therefore done manually, with the same discipline the
pipeline enforces (source URL + date + confidence on every fact, logged in
a changelog). The two new registry entries above mean that *going
forward*, if either source page changes, the automated pipeline will
surface that as a signal for re-verification — the same "tripwire, not
guess" pattern already used elsewhere in the registry.

---

## Next Steps
At this rate (1 profession's board/compact-level facts per session), full
Phase 1 (20 professions × 50 states × 15 fields) will take many more
sessions. Recommended path forward — pick one:
1. **Breadth first**: repeat this same "board + compact/national-standard
   only" pass for the remaining 19 professions before going deeper on any one.
2. **Depth first**: finish registered-nurse's remaining 11 fields for all
   50 states before starting profession #2.
3. **Priority states first**: go deep (all 15 fields) on a handful of
   highest-population states across all 20 professions before expanding
   width.
