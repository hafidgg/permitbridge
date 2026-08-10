# PHASE 3.1 — RN TRANSFER PILOT

## Selected transfers
1. Texas → Florida
2. California → Texas
3. Texas → California
4. California → New York
5. Illinois → Georgia

## Selection rationale
Printed *before* any research began (see conversation record). All 5 source/destination states already had real, primary-sourced `licensingBoard`/`compactMembership` data from Phases 2.2–2.5 — no assumed demand, purely structural coverage:

| # | Category | Why |
|---|---|---|
| 1 | compact → compact | Both confirmed NLC members in existing data |
| 2 | non-compact → compact | Tests whether destination compact status alone helps (it doesn't) |
| 3 | compact → non-compact | Direct reverse of #2, real (not synthetic) data — directional independence |
| 4 | non-compact → non-compact | Neither state offers a compact shortcut |
| 5 | non-compact → compact | Georgia's endorsement rules were already known (Phase 2.2) to require practice hours — the deliberate conditional-requirement case |

---

## Per-transfer results

### 1. Texas → Florida
**Mechanism**: `compact_privilege` (confidence 0.95) — both NLC members. **Real nuance found and preserved**: a nurse who is *not* changing primary residence needs no Florida application at all; this rule specifically models the relocation scenario (which this whole site is about), where Florida's own "Multistate License Upgrade" application ($100, distinct from and cheaper than the $110 general endorsement fee) is still required.
**Official sources**: floridasnursing.gov (Licensing page, Fees page, Multistate Upgrade application PDF) — 3 pages, all `.gov`.
**Populated**: 11/18. **Unknown**: 7 (background check, fingerprinting, processing time, documents, disciplinary disclosure for this specific upgrade pathway — genuinely not found distinct from the full-endorsement pathway, left honest rather than reused/assumed).
**Conditional requirements**: none found for this pathway.
**Conflicts**: 0. **Status**: all fields `pending_verification`, 0 `verified`.

### 2. California → Texas
**Mechanism**: `endorsement` (0.95) — California has no multistate license for Texas's compact membership to interact with.
**Official sources**: bon.texas.gov (5 distinct pages: endorsement info, application forms, international-graduate instructions, six-month-permits page).
**Populated**: 15/18. **Unknown**: 3.
**Conditional requirement found**: the Six-Month Permit rule (217.5(c)) — required if licensed >4 years ago AND no US/Canada practice in the last 4 years.
**Secondary-source-derived fields, honestly downgraded**: `examRequirement` and `applicationFeeUsd` cite RenewRN.net (discovery only) — confidence capped at 0.55–0.6, `SourceRecord.authorityLevel = "supplementary"`, correctly counted as secondary evidence by the system, not authoritative. **These need direct TXBON re-confirmation before Phase 3.2.**
**Conflicts**: 0.

### 3. Texas → California
**Mechanism**: `endorsement` (0.95) — real, distinctive finding: California doesn't recognize compact privilege *at all*, even though Texas is a compact member. BRN's own page loosely says "endorsement (reciprocity)" in parentheses; classified `endorsement` per Phase 3.0's own documented distinction (BRN issues its own license; no bilateral agreement).
**Official sources**: rn.ca.gov (5 distinct pages: endorsement page, temporary-licenses page, fingerprint-info page, plus the CCR §1417 fee regulation already verified in Phase 2.5).
**Populated**: 15/18. **Unknown**: 3 (experience requirement — no CA-specific minimum found, unlike Texas's explicit rule; disciplinary disclosure detail; documents beyond what was found).
**Secondary-source-derived field**: `processingTime` (CatSol, discovery only, confidence 0.5) since BRN's own Processing Times page publishes rolling cohort dates, not a static range.
**Conflicts**: 0.

### 4. California → New York
**Mechanism**: `endorsement` (0.95) — neither state is a compact member.
**Official sources**: op.nysed.gov (2 distinct pages: endorsement page, license-requirements page).
**Populated**: 12/18. **Unknown**: 6 — most notably `backgroundCheckRequirement` and `fingerprintingRequirement`, deliberately left **Unknown despite finding a real, consistent signal** across 4 independent secondary sources ("NY doesn't require fingerprinting") because no direct official NYSED statement was found this session. This is the clearest demonstration in this batch of the system doing exactly what it's designed to do: real signal, correctly withheld from becoming a claim.
**Conflicts**: 0 (none discovered this session for this specific rule; the Phase 2.6 conflict machinery remains available and unmodified — see `temporaryPermitAvailability`, which is populated with a low-confidence secondary source explicitly flagged as needing official confirmation, the kind of field a future conflict could plausibly attach to).

### 5. Illinois → Georgia — the conditional-requirement case
**Mechanism**: `endorsement` (0.93) — Illinois isn't a compact member, so Georgia's compact membership provides no shortcut.
**Official sources**: sos.ga.gov (FAQ page, official fee schedule PDF already verified in Phase 2.5, the reentry-program PDF), plus regulation-text mirrors (Justia, Cornell Law) for the two specific numbered rules whose primary `rules.sos.georgia.gov` pages returned only table-of-contents content this session — classified `official-government` with a documented, slightly-reduced confidence to reflect the one-step remove from the primary host.
**Populated**: 16/18 — the most complete of the 5 rules. **Unknown**: 2.
**Conditional requirement — the strongest-sourced fact in the entire batch (confidence 0.95)**: directly quoted from Georgia's own regulation, **Ga. Comp. R. & Regs. 410-4-.03**: a Board-approved reentry program (40 hours didactic + 160 hours clinical) is required *if* the applicant has not documented **500 hours of licensed RN practice within the 4 years** immediately preceding the application.
**Conflicts**: 0.

---

## Overall transfer coverage

| | Before | After |
|---|---|---|
| Real transfer rules | 0 | **5** |
| Transfer-rule fields populated | 0 | 69 / 90 (76.7%) |
| Transfer-rule fields Unknown | 90 | 21 (23.3%) |
| Transfer-rule source records | 0 | 20 new (8 primary `.gov`/board-hosted, 3 regulation-text mirrors, 5 explicitly secondary/discovery-only, 4 additional page-specific board sources) |
| Total knowledge-base sources | 59 | **79** |
| RN `ProfessionStateFacts` (750 fields) | unchanged | **unchanged** (verified: California's fee still $350) |
| `Verified` status anywhere | 0 | **0** (unchanged — no human reviewer exists) |
| Conflicts recorded this phase | — | 0 (none discovered; Phase 2.6 machinery available, unused this batch) |

## Compact table

| Source | Destination | Mechanism | Populated Fields | Unknown Fields | Conflicts | Status |
|---|---|---|---|---|---|---|
| Texas | Florida | compact_privilege | 11/18 | 7 | 0 | pending_verification |
| California | Texas | endorsement | 15/18 | 3 | 0 | pending_verification |
| Texas | California | endorsement | 15/18 | 3 | 0 | pending_verification |
| California | New York | endorsement | 12/18 | 6 | 0 | pending_verification |
| Illinois | Georgia | endorsement | 16/18 | 2 | 0 | pending_verification |

---

## Tests: **109/109 PASS** (96 prior + 13 new Phase 3.1 tests against the real 5-rule dataset)
## Validation: **PASS** (`npm run validate-data`)
## Typecheck / Lint / Build: **NOT RUN** — no installed dependencies in this sandbox (same disclosed limitation as every prior phase)

---

## Honesty notes worth surfacing explicitly

1. **2 fields cite secondary sources for their primary value** (California→Texas's `examRequirement`/`applicationFeeUsd`, Texas→California's `processingTime`, California→New York's `temporaryPermitAvailability`) — all deliberately low-confidence, all correctly classified `authorityLevel: "supplementary"` by the system's own accounting, all flagged in `notes` as needing direct official re-confirmation before Phase 3.2. This is real, useful, discovery-stage information — not fabricated, not hidden, not disguised as authoritative.
2. **6 fields left genuinely Unknown after real research effort** (most notably NY's background-check/fingerprinting requirement, despite a real cross-source signal) rather than guessed — exactly the behavior this entire system exists to enforce.
3. **Zero conflicts were discovered** in this batch's research (unlike Phase 2.6's NY fee case) — not because the conflict system wasn't exercised, but because this session's sources happened to agree wherever both sides were checked. The Phase 2.6 machinery is fully wired into `validateTransferRule()` (Rule 9, tested) and ready the moment a real conflict appears in a future batch.

**STOP after exactly five real transfer rules, per instructions.** No sixth transfer started. No new profession added. No public UI pages created — all 5 records exist only in `data/knowledge-base/transfer-rules/registered-nurse/`, invisible to the live site. Awaiting explicit approval before Phase 3.2.
