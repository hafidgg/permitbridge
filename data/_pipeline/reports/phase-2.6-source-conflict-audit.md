# PHASE 2.6 — SOURCE CONFLICT AUDIT

## New York conflict

**Source A** (general, lower specificity):
- URL: `https://www.op.nysed.gov/sites/op/files/documents/opfeechart.pdf`
- Agency: New York State Education Department, Office of the Professions
- Title: "Office of the Professions Fees Chart" (all professions)
- Jurisdiction: New York
- Field: `initialFeeUsd`
- Value: **$50** (labeled "Endorsement (Relocation)", no visible profession attribution in context)
- Authority level: authoritative (genuinely an official NYSED document)
- **Specificity: `jurisdiction-general`** — covers every profession NYSED licenses (nursing, dentistry, medicine, acupuncture, and dozens more) in one chart.

**Source B** (specific, higher specificity):
- URL: `https://www.op.nysed.gov/professions/registered-professional-nursing/endorsement-nursing-licenses`
- Agency: New York State Education Department, Office of the Professions
- Title: "Endorsement of Nursing Licenses - RPN"
- Jurisdiction: New York
- Field: `initialFeeUsd`
- Value: **$143** (explicitly: "Form 1 - Application for Licensure* along with the $143 fee" for an RN/LPN licensed elsewhere)
- Authority level: authoritative
- **Specificity: `profession-specific`** — a page dedicated entirely to nursing endorsement.

**Why Source B is more relevant** (not "official source wins" — both are official): Source A and Source B are issued by the *same agency*, so authority level alone cannot distinguish them. What distinguishes them is **specificity**: Source A is one line in a chart covering every licensed profession in New York, with no visible confirmation that the "$50 Endorsement (Relocation)" line even refers to nursing. Source B is a page that exists *specifically* to describe how a nurse — not any other profession — transfers a license into New York, and states the fee in that exact context. A profession-specific document is inherently less likely to have a scope/attribution error than a line item in a 4-page, dozens-of-professions chart.

## Resolution
**$143 (Source B) — matches the value already stored; no data change required.**

## Reason
Deterministic policy (`lib/knowledge-base/conflict.ts`, `resolveSourceConflict()`), applied in this exact order:
1. **Specificity tier comparison** (this alone decided it): Source B (`profession-specific`, rank 3) outranks Source A (`jurisdiction-general`, rank 2). Steps 4 (explicitness) and 5 (recency) were not needed as tiebreakers.

The full reasoning string is stored verbatim in the conflict record itself — not summarized away.

## Conflict preserved: **YES**
Both sources' full provenance (value, URL, agency, title, jurisdiction, authority level, specificity, observation date) is stored in `data/knowledge-base/facts/registered-nurse/new-york.json` → `conflicts[]`, permanently, regardless of which side "won." Nothing was discarded.

---

## Field semantics
`initialFeeUsd` = **"the fee an already-licensed nurse pays to obtain RN licensure in this state BY ENDORSEMENT"** — audited across every code path that touches it:

| Location | Status |
|---|---|
| `lib/knowledge-base/rn-core-fields.ts` (purpose text) | ✅ Explicit — states endorsement fee, explicitly excludes exam/renewal fees |
| `types/knowledge-base.ts` | Bare type declaration (`VerifiedField<number>`) — no semantic claim to audit; the authoritative definition lives in `rn-core-fields.ts`, referenced from here |
| `lib/knowledge-base/coverage.ts` / `rn-core-audit.ts` | Only computes counts (populated/authoritative/secondary/missing) — never interprets the *meaning* of the value, so no risk of misinterpretation here |
| `lib/knowledge-base/policy.ts` / `authority-mapping.ts` | Field-authority mapping only (which source TIER is required) — does not encode fee semantics, correctly separate concern |
| `lib/knowledge-base/human-review.ts` | `shortEvidence()` for `initialFeeUsd` was not yet field-specific (fell through to the generic "Confirmed via {agency}" case) — **found and left as a documented gap**, not a semantic error (it doesn't misstate what the fee is, it's just less descriptive than it could be for this field) |
| Stored field `notes` (all 5 populated states) | ✅ Explicit — every one of the 5 fee values' `notes` documents the endorsement-fee distinction inline, verified by an existing Phase 2.5 test |

**No code path interprets `initialFeeUsd` as an exam, renewal, fingerprint, or temporary-permit fee.** Confirmed by grep across the full `lib/knowledge-base/` and `scripts/knowledge-base/` trees.

## Authority model
Extended (Phase 2.6) with a new `specificity: SourceSpecificity` field on every `SourceRecord` (`field-specific` | `profession-specific` | `jurisdiction-general` | `national-general`). All 58 pre-existing source records were backfilled with a classified value; 1 new source record was added (`new-york-fees-chart-general`) to properly represent Source A, which had never been registered before. **59 total source records** as of this phase.

## Jurisdiction enforcement
`checkCanMarkVerified()` now accepts an optional `jurisdiction` parameter and rejects any state-specific source whose `jurisdiction` doesn't match the field being checked (`source_jurisdiction_mismatch`), while correctly treating `national`/`federal`-scoped sources as jurisdiction-agnostic. Directly tested: a California source is proven unable to verify a New York fact.

## Profession-specific authority
Expressed via `SourceRecord.professionsCovered[]` (already existed) combined with the new `specificity` field — a source can be official, jurisdiction-correct, AND still lose a conflict if a more profession-specific official source exists for the same fact.

## Field-specific authority
Expressed via the existing `authority-mapping.ts` (`isAuthoritativeForField()`, from Phase 2.2) combined with the new `specificity: "field-specific"` tier (the highest rank in conflict resolution) — directly tested with a synthetic field-specific-vs-profession-specific fixture.

---

## New regression tests: 11 (Phase 2.6) + 3 pre-existing tests updated to reflect the new deterministic-resolution behavior (previously expected `"unresolved"`, now correctly expect a real resolution)
## Total tests: **71/71 PASS**
## Validation: **PASS** (`npm run validate-data`)
## Typecheck / Lint / Build: **NOT RUN** — no installed dependencies in this sandbox (same limitation as every prior phase; genuinely executed commands are reported above, nothing else is claimed)

## Data values changed: **0** (the NY fee remains $143 — confirmed correct, not corrected)
## Production fields added: **0** (no new profession/state/RN-field values — per strict scope)
## Production *metadata* added: 1 `ConflictRecord` (New York, `initialFeeUsd`), 1 new `SourceRecord` (`new-york-fees-chart-general`), `specificity` backfilled on 58 existing `SourceRecord`s

---

## Recommendation: should `initialFeeUsd` be renamed?

**Yes, recommended — but not executed in this phase, per instructions.**

`initialFeeUsd` is a genuinely misleading name: "initial" naturally reads as "the fee for a brand-new nurse's *first* license" (i.e., the examination pathway), which is the *opposite* of what this field actually tracks. This ambiguity is exactly what caused the need for this phase's audit trail in the first place — a future contributor (human or AI) reading only the field name, without finding `rn-core-fields.ts`'s purpose text, could reasonably populate it with exam fees instead.

**Suggested name: `rnEndorsementFeeUsd`** — precise, matches the site's actual "portability for already-licensed nurses" scope, and avoids "initial" entirely.

A safe migration would be: (1) add the new field name as an alias in the type, (2) dual-write both names for one phase, (3) update all 5 populated states + all code references, (4) remove the old name only after confirming nothing else depends on it. This is real, multi-file work — correctly out of scope for an audit-only phase, but flagged now rather than left implicit.

**STOP per instructions — no Phase 2.7 started.**
