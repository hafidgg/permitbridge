# PHASE 3.0 — TRANSFER RULE SCHEMA

**Schema and domain-model design only. Zero production data added or changed** — confirmed by re-running the full test suite and `validate-data` before and after, and by directly inspecting `california.json`/`new-york.json` post-phase (unchanged).

---

## Existing models reused

Read directly from the repository (not memory) before designing anything:

| Existing model | File | Reused as |
|---|---|---|
| `VerifiedField<T>` (value/source/date/confidence/method/reviewer/status/history) | `types/knowledge-base.ts` | Wrapped around every fact-shaped field in the new `TransferRule` — zero reinvention |
| `SourceRecord` (authority/jurisdiction/specificity/profession scope) | `types/knowledge-base.ts` | Reused as-is for source resolution; validation Rule 7 calls the caller-supplied resolver against this exact type |
| `ConflictRecord` / `ConflictSourceSnapshot` | `types/knowledge-base.ts` | Reused verbatim — `TransferRule.conflicts: ConflictRecord[]`, same shape `ProfessionStateFacts` already uses |
| `resolveSourceConflict()` (Phase 2.6 deterministic policy) | `lib/knowledge-base/conflict.ts` | Called directly against synthetic `TransferRule` field data with **zero modification** — proven by test |
| `isDisallowedReviewerName()` | `lib/knowledge-base/policy.ts` | Reused for the new schema's Rule 10 (no fabricated reviewer) |
| `verifiedField()` / `unknownField()` | `lib/knowledge-base/fields.ts` | Used to build every field in both synthetic fixtures |
| Live site's `TransferRule` (simple, `pathway`/`portabilityScore`/etc.) | `types/index.ts` | **Not reused** — deliberately a different type in a different module; the live site's schema answers "how good is this transfer" with one computed score, this phase's schema answers "what exactly does this transfer require," fact-by-fact and independently verified. Explained further under Portability Score Compatibility below. |
| Existing state/profession slug conventions | `data/knowledge-base/states/`, `data/knowledge-base/professions/` | Reused for `sourceState`/`destinationState`/`profession` — same slugs, no new identifier scheme |

**Nothing was recreated that already existed.**

---

## New types

- `types/transfer-rule.ts` — `TransferMechanism`, `RequirementStatus`, `RequirementCondition`, `RequirementValue`, `VerifiedRequirement`, `TransferRuleIdentity`, `TransferRule`
- `lib/knowledge-base/transfer-rule-schema.ts` — `buildTransferRuleSlug()`, `parseTransferRuleSlug()`, `validateTransferRule()`, `isTransferRuleValid()`
- `fixtures/knowledge-base/transfer-rules/synthetic-ca-tx.ts` — 2 synthetic `TransferRule` fixtures + 3 synthetic `SourceRecord`s (explicitly marked, never read by any report)

---

## TransferRule structure

24 fields total: 4 identity fields (`profession`, `sourceState`, `destinationState`, `licenseType`) + 18 fact fields (each `VerifiedField<T>` or `VerifiedRequirement`) + `conflicts[]` + `lastFullReviewAt`. Full field list and rationale is in the type file itself (`types/transfer-rule.ts`) with inline documentation — not duplicated here to avoid drift between two descriptions of the same thing.

**No single `verificationStatus` field stands in for the whole rule** — every one of the 18 fact fields carries its own independent status/source/history, per the explicit Step 5 instruction.

## Directional model

`sourceState` and `destinationState` are two independent required string fields on every record; there is no bidirectional/symmetric structure anywhere in the type. Proven, not just declared: the two synthetic fixtures (`SYNTHETIC_TRANSFER_CA_TO_TX`, `SYNTHETIC_TRANSFER_TX_TO_CA`) have genuinely different values throughout (different fee, different exam requirement, different processing time, and — critically — CA→TX leaves `temporaryPermitAvailability` genuinely `Unknown` while TX→CA has it populated), directly testing that directional independence extends to *verification completeness itself*, not just fact values.

## Conditional requirement model

`RequirementValue = { status: RequirementStatus; conditions?: RequirementCondition[] }`. `conditions` is populated only when `status === "conditional"`, each with a human-readable `description` and a `category` (`license_status` | `disciplinary_history` | `practice_gap` | `education_location` | `other`). Not booleans anywhere — validation Rule 5 actively rejects a raw boolean on any requirement field.

## Unknown / N/A model

Five distinguishable states, achieved with **zero new sentinel values** — reused exactly what `VerifiedField<T>` already does:
- **Unknown** = the field's outer `value` is the literal string `"Unknown"` (unresearched)
- **Not Applicable / Required / Not Required / Conditional** = the field's `value` is a real, evidenced `RequirementValue` object with that `status`

This is the same pattern `ProfessionStateFacts` has used since Phase 1 — Phase 3.0 didn't invent a new "N/A" concept, it recognized that `RequirementValue.status` already needed a 4-way enum and let `VerifiedField`'s existing "Unknown" sentinel supply the 5th state for free, avoiding two competing "unknown" concepts.

## Verification integration

Every fact field is `VerifiedField<T>` (or the `VerifiedRequirement` alias for requirement-shaped facts) — value/sourceUrl/sourceTitle/sourceName/verifiedAt/verificationMethod/reviewer/status/confidence/history, identical to `ProfessionStateFacts`. No new verification concept introduced.

## Source integration

`SourceRecord` reused without modification. **New documented nuance**: because a transfer rule is inherently about two states, "jurisdiction" for authority-checking purposes defaults to `destinationState` (the state whose requirements the rule is actually describing) — made explicit in `validateTransferRule()`'s Rule 7, not left implicit. `sourceState`-jurisdiction sources are not expected to appear on populated fact fields under this model (documented, not silently assumed).

## Conflict integration

`TransferRule.conflicts: ConflictRecord[]` — the exact Phase 2.6 type, no new conflict system. Directly tested: `resolveSourceConflict()` (unmodified) correctly resolves a synthetic field-specific-vs-profession-specific conflict using `TransferRule` field names, proving the Phase 2.6 policy generalizes beyond `ProfessionStateFacts` without any change.

## Portability Score compatibility

**Inspected `scripts/generate-transfers.ts`'s `computeRule()` in full.** Finding: it is **not compatible today, and does not need to be** — it operates entirely on the live site's simple `Profession`/`State`/`TransferRule` types (`types/index.ts`), reading plain fields like `profession.compactStates.has(to.name)` and `to.isUlrState` (booleans/arrays, not `VerifiedField`-wrapped). This phase's new `TransferRule` (`types/transfer-rule.ts`) is a completely separate module the live scoring code has never heard of and doesn't import.

**If a future phase wants the rich `TransferRule` data to eventually drive `portabilityScore`**, the adapter would need to:
1. Read a knowledge-base `TransferRule` for a given profession/source/destination
2. **Unwrap every `VerifiedField`** — decide what a genuinely `"Unknown"` fact means for scoring (probably: exclude from the score, or apply a documented penalty for incompleteness — not silently treated as "false"/0, which Rule 5's whole purpose is to prevent)
3. **Map `RequirementValue.status` to the existing boolean-shaped fields** `computeRule()` expects (e.g., `examRequirement.value.status === "required"` → the old `examRequired: boolean`) — a real, non-trivial mapping since `"not_applicable"` and `"conditional"` have no equivalent in the old boolean model
4. Decide how `confidence` (0-1 per field, now available) should affect a score that previously had no confidence concept at all

**Not done in this phase** — correctly out of scope per the explicit instruction not to modify scoring logic. Documented so a future phase doesn't have to re-derive this analysis.

## Slug strategy

`{profession}/{sourceState}-to-{destinationState}` — e.g. `registered-nurse/california-to-texas`, `registered-nurse/new-york-to-florida`, exactly matching the two examples given. Implemented as `buildTransferRuleSlug()` (deterministic, pure function) with a matching `parseTransferRuleSlug()` for the reverse direction, both tested including round-trip and malformed-input cases. `licenseType` is deliberately excluded from the slug (documented in the code: would only matter once a second license type exists for the same profession — not true today).

## Validation rules

All 10 implemented in `validateTransferRule()`, each independently tested with a deliberately-broken fixture proving the validator actually catches it (not just declared and untested):

1. `sourceState != destinationState` — tested
2. profession must exist — tested (against a caller-supplied known-profession set, reusing existing profession slugs, not inventing a new registry)
3. direction explicit — checked (non-empty state slugs)
4. every populated field must have evidence — checked (a populated value with no `sourceUrl` is an error)
5. Unknown must not become false — tested (raw boolean on a requirement field is rejected)
6. Not Applicable must not be treated as Unknown — checked (a `"not_applicable"` status still requires its own evidence)
7. official sources must match jurisdiction — tested (mismatched jurisdiction rejected)
8. field-specific authority must be respected — **documented as a no-op in this phase**: full enforcement requires extending `FIELD_AUTHORITY_MAP` (Phase 2.2) with `TransferRule`'s 18 field names, which is real, additional work correctly deferred rather than done partially/silently
9. conflicting evidence cannot become Verified automatically — tested
10. reviewer must not be fabricated — tested (reuses `isDisallowedReviewerName()` unmodified)

---

## Production data changed: **NO**

Confirmed: `data/knowledge-base/facts/registered-nurse/california.json`'s `rnEndorsementFeeUsd.value` is still `350`, its `conflicts` array is still empty; `new-york.json`'s `conflicts` array still has exactly its 1 Phase 2.6 record. Nothing in `data/knowledge-base/` was written to in this phase — only `types/`, `lib/knowledge-base/`, `fixtures/`, `scripts/knowledge-base/tests.ts`, and this report.

## Tests: **96/96 PASS** (81 prior + 15 new Phase 3.0 schema tests, covering directional independence, field-level verification, Unknown-vs-N/A, conditional requirements, jurisdiction validation, conflict-system reuse, slug generation + parsing, full schema validation of both fixtures, and all 10 validation rules with deliberately-broken counter-fixtures)

## Validation: **PASS** (`npm run validate-data`)

## Typecheck / Lint / Build: **NOT RUN** — no installed dependencies in this sandbox (same disclosed limitation as every prior phase; genuinely executed commands are `npm test` and `npm run validate-data` above, nothing else is claimed)

---

**STOP per instructions.** No real transfer rules populated. No state research performed. No professions added. Awaiting explicit approval before Phase 3.1.
