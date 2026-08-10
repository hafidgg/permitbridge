# Manual Research Correction — 2026-08-07

**This was NOT an automated pipeline run.** This was a manual fact-check pass
against real, live sources (web search) to correct errors in the original
placeholder/illustrative data, since the environment that originally built
this dataset had no internet access. Logged here for the same audit-trail
reason every automated run is logged: transparency about what changed, why,
and against which sources.

## Corrections Made

### 🔴 High-risk correction: Texas was NOT actually a ULR state
The original dataset marked Texas as `isUlrState: true` (enacted 2023). This
was **fabricated** during the offline build and was wrong. Real research
against TDLR's own published materials and multiple independent policy-
tracking organizations (Goldwater Institute, America First Policy Institute,
Institute for Justice, CSORWVU) confirms Texas is **not** on any list of
states with a broad, "shall issue" Universal License Recognition law. Texas's
only guaranteed out-of-state recognition is for military service members and
spouses (Occupations Code Ch. 55); recognition for the general public under
§51.4041 is discretionary ("may waive"), not guaranteed.

**Changed:** `data/states/texas.json` — `isUlrState: true → false`, removed
fabricated `ulrEnactedYear`, rewrote `licensingAuthorityNote` and FAQs to
reflect the real, narrower policy.

**Downstream effect:** all `electrician`, `plumber`, `hvac-technician`, and
`contractor` transfer rules INTO Texas changed from `reciprocity` to `none`
(full new application) after re-running `generate-transfers.ts`. `nurse`
rules into Texas were unaffected (compact-based logic, independent of ULR).

Sources:
- https://www.tdlr.texas.gov/media/pdf/removing-barriers-for-out-of-state-licensees-at-a-glance.pdf
- https://www.goldwaterinstitute.org/universalrecognition/
- https://www.americafirstpolicy.com/issues/issue-brief-state-approaches-to-universal-licensing-recognition
- https://www.archbridgeinstitute.org/state-occupational-licensing-index/

### 🟡 Medium-risk correction: Nurse Licensure Compact member list was incomplete/fictional
Replaced the original 38-state placeholder list with a real 40-state list
verified against the NLC's official site and corroborating sources. For our
5 tracked states this didn't change any answer (CA/NY were already correctly
excluded, TX/FL/OH were already correctly included) — but the full list
shown on `/profession/nurse` is now accurate.

Sources:
- https://www.nursecompact.com/
- https://nurse.org/articles/enhanced-compact-multi-state-license-eNLC/

### 🟡 Medium-risk correction: NASCLA-accepted states list was incomplete
Replaced a 12-state placeholder list with the real 16-state list (added
Arkansas, New Mexico, Oregon, West Virginia). For our 5 tracked states this
didn't change any answer (only Florida was and is on the list) — but the
full list shown on `/profession/contractor`, `/profession/electrician`, and
`/profession/hvac-technician` is now accurate.

Sources:
- https://www.nascla.org/nascla-commercial-exam-participating-state-agencies
- https://contractorslicenseexam.com/blog/states-that-accept-the-nascla-contractor-exam.html

### ✅ Confirmed correct (no change needed)
- California `isUlrState: false` — confirmed via Archbridge Institute 2025
  Occupational Licensing Index ("Universal Recognition: No") and America
  First Policy Institute (title: "California Workers Need Universal
  Licensing Recognition" — i.e., still advocating, not yet enacted).
- New York `isUlrState: false` — not present on any confirmed ULR-enacted
  state list across four independent trackers.
- Ohio `isUlrState: true, 2024` and Florida `isUlrState: true, 2024` — both
  independently confirmed via CSORWVU's 2024 policy brief, which names both
  as newly-enacted that year.

## What this does NOT cover
This pass only fact-checked the 5 states and profession-level lists (ULR
status, NLC compact membership, NASCLA acceptance) currently in the dataset.
It did **not** verify the per-transfer-rule computed fields (exact fees,
exact processing-day ranges, exact step text) against live state board
pages — those remain rule-engine estimates (see `generate-transfers.ts`) and
should still be spot-checked against the real board sites in
`data/_pipeline/sources/registry.json` before public launch, per the
disclaimer already on every page of the site.
