# PermitBridge Knowledge Base — Verification Policy

This is the human-readable version of the rules enforced in code by
`lib/knowledge-base/policy.ts` (`checkCanMarkVerified`). If the two ever
disagree, the code is the source of truth for what the system actually
does — this document explains *why* each rule exists.

## When can a field be marked `"verified"`?

**All seven** of the following must be true. If any one is missing, the
field must be `"pending_verification"` (value exists, nothing else
confirmed yet) or `"needs_review"` (something about it is specifically
uncertain, contradictory-adjacent, or low-confidence) — never `"verified"`.

1. **The value exists.** `"Unknown"` can never be marked verified — there
   is nothing to verify.
2. **The source is authoritative.** See Source Authority Model below. A
   `"secondary"` source can never, by itself, satisfy this condition —
   full stop, regardless of how reliable it has otherwise proven to be.
3. **The source URL is valid** (well-formed, and — for automated
   re-checks — actually reachable; see the pipeline's fetch layer).
4. **The source actually supports the specific value.** Citing an
   authoritative domain isn't enough if the specific page doesn't
   actually state the specific fact. This requires reading comprehension
   and cannot be fully automated — a field must carry a
   `verificationMethod` that reflects real engagement with the source
   (not merely "the URL is on our list").
5. **A verification date exists.**
6. **A verification method exists** (`ai_assisted_manual_research`,
   `automated_pipeline_extraction`, `manual-review`,
   `official_document_review`, or `cross_referenced_multiple_sources`).
7. **A real, named reviewer exists whenever manual review is required.**
   `reviewer: null` is always valid and honest when no human has reviewed
   a field yet — what is never valid is populating `reviewer` with a
   placeholder like `"Claude"`, `"AI"`, `"System"`, `"Automatic"`, or
   similar. `lib/knowledge-base/policy.ts` maintains an explicit
   denylist of these strings and treats them as a policy violation, not
   a valid reviewer.

## Source Authority Model

| `sourceType` | `official` | `authorityLevel` | Example |
|---|---|---|---|
| `official-board` | true | authoritative | A state's own nursing/contractor/etc. licensing board |
| `official-government` | true | authoritative | A state or federal government page that isn't a board itself |
| `official-compact` | true | authoritative | The organization that actually operates a named interstate compact |
| `official-national-organization` | true | authoritative **only for facts it actually governs** | NCSBN is authoritative for the NCLEX exam requirement (it administers the exam) but would NOT automatically be authoritative for a specific state's fee schedule |
| `secondary` | false | supplementary | Aggregators, commercial career-advice sites, blogs, prep-course marketing pages |

A `secondary` source is useful — it's often the fastest way to find *where
to look next* (exactly how `nurse-org-board-directory` was used in Phase
1: it pointed us at all 50 official board URLs in one pass) — but it can
never independently promote a field to `"verified"`. At best, a
well-corroborated secondary-sourced field is `"pending_verification"`
with a reasonably high confidence score; it is never `"verified"`.

## What "Conflicting Sources" means

If **two authoritative sources** disagree on the same fact, the system
must never silently pick one. `lib/knowledge-base/policy.ts`'s
`detectConflict()` records both values, both URLs, and marks the field
`"conflicting_sources"` with `resolution: "unresolved"` in the
`ConflictRecord`. Resolving a conflict (choosing which source was right,
or that both were, in different senses) is a deliberate human decision,
logged with a reason — never an automatic tie-breaker.

Note: two sources disagreeing where **at least one is secondary** is not
a "conflict" in this formal sense — the secondary source simply isn't
authoritative enough to compete. Only authoritative-vs-authoritative
disagreement triggers this status.

## Why `reviewer: null` is the correct default, not a gap to hide

Every field created during Phase 1/Phase 2 research in this knowledge
base was found and transcribed by an AI research assistant reading real
official and semi-official sources. That is real, source-backed research
— but it is explicitly **not** the same trust level as a named human
licensing-policy reviewer confirming the same fact, and this system is
built to never blur that distinction. `verificationMethod:
"ai_assisted_manual_research"` combined with `reviewer: null` and
`status: "pending_verification"` is the honest, correct state for all
750 Registered Nurse fields as of Phase 2.1 — not a bug, not a TODO to
quietly paper over, the actual current trust state of the data.
