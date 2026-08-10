# PHASE 3.2 — HUMAN REVIEW & PUBLICATION GATE

**Transfer rules: 5** (unchanged from Phase 3.1 — checksums verified byte-identical before/after this entire phase)
**Review packets: 5** (all generated — `data/_pipeline/reports/transfer-review-packets.md`)

---

## Review queue
**69 items** (`data/_pipeline/reports/transfer-review-queue.json`) — exactly matching Phase 3.1's 69 populated fields (0 were already Verified, so none are excluded).
- **High priority (critical fields): 36**
- **Medium priority (secondary-sourced supporting fields): 3**
- **Low priority (supporting fields): 30**

## Critical fields
Derived from actual user purpose (getting it wrong causes a wrong pathway, a missed legal step, or a real financial surprise) — **not** assumed blindly:

`transferMechanism`, `examRequirement`, `experienceRequirement`, `applicationFeeUsd`, `backgroundCheckRequirement`, `fingerprintingRequirement`, `licenseVerificationRequirement`, `goodStandingRequirement`, `disciplinaryDisclosureRequirement` — **9 of 18 fields.**

The other 9 (`endorsementProcess`, `reciprocityAgreementExists`, `universalRecognitionApplies`, `otherRequiredFees`, `documentsRequired`, `processingTime`, `temporaryPermitAvailability`, `compactStatus`, `exceptions`) are Supporting — useful, but wrong values there don't cause someone to follow the wrong legal process.

## Secondary-source fields
**5 fields** across the 5 real rules (matching Phase 3.1's own count): California→Texas's `examRequirement` + `applicationFeeUsd` (RenewRN.net), Texas→California's `processingTime` (CatSol), California→New York's `temporaryPermitAvailability` (TrustedHealth), Illinois→Georgia's `endorsementProcess` (Advantis Medical, a non-critical field). **Not deleted, not treated as authoritative** — the publication gate treats each differently based on whether the field is critical.

## Conflicting fields
**0** in the real 5-rule dataset (Phase 3.1 discovered no real conflicts this batch). The conflict-blocking logic (`isTransferRulePublishable` Rule: critical field + unresolved conflict → blocked) is implemented and tested against a synthetic fixture, ready for the moment a real conflict appears.

## Publishable now

| Transfer | Publishable | Coverage Class |
|---|---|---|
| California → New York | ✅ | partially_verified |
| **California → Texas** | **🔴 BLOCKED** | insufficient_evidence |
| Illinois → Georgia | ✅ | partially_verified |
| Texas → California | ✅ | partially_verified |
| Texas → Florida | ✅ | partially_verified |

**4 of 5 publishable** (with honest "pending human review" labeling on every field, per the Partial Data Policy below) — **0 of 5 "fully_verified"** (that would require a real human to have reviewed every critical field, which has not happened and cannot happen in this environment).

## Blocked
**California → Texas** — blocked specifically because `examRequirement` and `applicationFeeUsd`, both **critical** fields, currently rely *only* on a secondary source (RenewRN.net). This is the publication gate correctly catching the exact gap Phase 3.1's own research already flagged with deliberately low confidence. Not blocked for any other reason — all other structural/schema checks pass.

---

## Publication policy (documented, not invented ad hoc)

Two **deliberately separate** concepts, so the system can never conflate "an AI found evidence" with "a human confirmed it":

1. **`isTransferRulePublishable(rule)`** — can this rule exist on a live page at all, labeled honestly? Requires: valid identity (Rule 1–3), every populated field has real evidence (Rule 4), **no critical field relies solely on a secondary source**, **no critical field has an unresolved conflict**, no fabricated reviewer anywhere. Does **NOT** require any human review — an AI-researched, well-evidenced, honestly-labeled rule is allowed to publish with visible "pending human review" status on every field.
2. **`isTransferRuleFullyHumanVerified(rule)`** — true only when **every critical field** has `status: "verified"` **and** a real, non-fabricated reviewer name. This is the flag that would ever justify removing "pending review" UI messaging — and it is **0/5 today, by design**.

### Partial Data Policy
A rule with `Unknown` fields is not automatically rejected — `Unknown` never appears as a blocking reason by itself (tested). Coverage classifies into 4 states: `fully_verified` (all critical fields human-reviewed), `partially_verified` (publishable, not yet human-reviewed — today's actual state for 4/5 rules), `insufficient_evidence` (a critical field lacks authoritative evidence — California→Texas today), `blocked_by_conflict` (a critical field has an unresolved conflict — none today).

## Human reviewer model
Field-level review (`applyFieldReview()`) reuses `updateField()` (Phase 2.2) — approving one field never touches any other field on the same rule (tested directly: approving `applicationFeeUsd` leaves `examRequirement` byte-identical). A review requires a non-empty, non-fabricated reviewer name — `isDisallowedReviewerName()` (Phase 2.2) is reused, and **a real gap was found and fixed this phase**: the denylist had "automatic" but not "automated" — a test written for this phase caught it, the denylist was fixed, not the test.

## AI-vs-human separation
No code path anywhere sets `status: "verified"` without going through `applyFieldReview()` with `decision: "approve"` and a real reviewer name. Directly tested: an AI-researched field with `confidence: 0.9` and a fully authoritative source still has `status: "pending_verification"` until a named human approves it.

---

## Tests: **128/128 PASS** (109 prior + 19 new Phase 3.2 tests, including a synthetic-fixture-driven simulation of all 7 requested review scenarios, plus 3 tests run directly against the real 5-rule production data)
## Validation: **PASS** (`npm run validate-data`)
## Typecheck / Lint / Build: **NOT RUN** — no installed dependencies in this sandbox (same disclosed limitation as every prior phase)

---

## Data integrity confirmed
MD5 checksums of all 5 real transfer rule files were captured **before** any Phase 3.2 work began and re-verified identical at the end — zero bytes changed in `data/knowledge-base/transfer-rules/registered-nurse/*.json`. Every review/publication function built this phase is pure (rule/field in, decision in, updated object out) and was only ever invoked against synthetic fixtures or read-only report generation.

**STOP per instructions.** No human review was performed by me. No reviewer was invented. No real field was marked Verified. No public UI pages were created. No additional transfers were researched.
