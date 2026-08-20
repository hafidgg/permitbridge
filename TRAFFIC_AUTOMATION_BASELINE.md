# TRAFFIC_AUTOMATION_BASELINE.md

Baseline audit performed before implementing the 5 discovery/syndication systems. Read-only inspection — no changes made while producing this document.

## Repository architecture

- **Framework**: Next.js `^15.1.0`, App Router, no `output: 'export'` (server deployment, API routes work)
- **Package manager**: npm (`package-lock.json` present)
- **Deployment**: Vercel, production domain `https://www.getpermitbridge.com`
- **Two parallel data systems**:
  1. Old pipeline (`data/professions/`, `data/states/`, `data/transfers/`) — 100 transfer records (5 professions × 20 state-pairs), `portabilityScore` **pre-computed at data-generation time** in `scripts/generate-transfers.ts`, not calculated live. Only 4 of 100 currently carry a real, verified `sourceUrl` (electrician → Texas) and are indexed; the other 96 are `noindex` + excluded from sitemap (established in a prior hardening pass).
  2. Knowledge-base (`data/knowledge-base/`) — 5 real, field-level-sourced Registered Nurse transfer pages under `/[profession]/[transfer]`, the site's highest-trust content.

## Current routes (confirmed via direct file listing, not estimated)

```
Static: /, /about, /blog, /contact, /disclaimer, /guides, /privacy,
        /professions, /search, /states, /terms
Dynamic: /profession/[slug] (5), /state/[slug] (5),
         /transfer/[profession]/[from]/[to] (100, 4 indexed),
         /[profession]/[transfer] (5, RN, all indexed),
         /guides/[slug] (3), /blog/[slug] (2)
API: /api/cron/source-monitor (POST-only, CRON_SECRET-gated, fails closed)
Feeds/meta: /feed.xml, /llms.txt (both already implemented, prior session)
```
Total: 131 routes, 35 indexable/in-sitemap, 96 intentionally noindex.

## Current SEO infrastructure

- `app/sitemap.ts` — dynamic, derives from real data functions, filters old-transfer routes by `sourceUrl` presence
- `app/robots.ts` — disallows `/api/`, points to sitemap, uses `SITE_URL`
- `lib/seo.ts` — `buildMetadata()` (canonical/OG/Twitter/noIndex), plus JSON-LD builders already covering: **Organization, WebSite (with SearchAction), BreadcrumbList, FAQPage, Article** — this is already fairly comprehensive; System 2B should audit for gaps, not assume none exist
- `SITE_URL` — single source of truth (`lib/utils.ts`), env-var-driven with a real-domain fallback

## Current monitoring system

`lib/monitoring/` — full fetch → normalize → hash → detect → `DetectedChange` → human-review pipeline, already production-proven (4 real monitored sources, GitHub Actions-scheduled, `data/knowledge-base/monitoring/registry.json`). `DetectedChange` records carry `detectedAt`, `status` (`pending_verification` → reviewed), and are the only legitimate trigger for a real content update — this is the correct foundation for System 1, not something to duplicate.

## Current RSS / AEO status

`/feed.xml` and `/llms.txt` **already exist** (added in the immediately prior session) — both generated from real data functions (`getAllBlogPosts`, `getAllGuides`, `getAllProfessions`, `getAllStates`, `getAllPublicTransferRuleSlugs`), not hand-maintained lists. This satisfies System 2A and System 5's core deliverables already; this session's work should verify/harden them, not duplicate them.

## Current GSC integration status

**None.** No `lib/integrations/` directory exists. No GSC API client, no credentials handling, no workflow. System 3 is genuinely new work.

## Current environment variables (confirmed via grep, not assumed)

```
NEXT_PUBLIC_SITE_URL       — canonical domain (lib/utils.ts)
NEXT_PUBLIC_GA_MEASUREMENT_ID — Google Analytics 4 (components/seo/GoogleAnalytics.tsx), optional
CRON_SECRET                — gates /api/cron/source-monitor, fails closed if unset
```

## Baseline command results (this session, real execution)

```
npm test:            PASS (exit 0, 324/324)
npm run validate-data: PASS (exit 0)
npm run pipeline:dry-run: PASS (exit 0)
npm run build:        NOT RUN — exit 127, `next` not installed in this sandbox (no network to npm registry; confirmed working on the user's real machine in prior sessions)
npm run lint:          NOT RUN — exit 127, `eslint` not installed, same reason
npx tsc --noEmit:      exit 2, 1295 errors — same pre-existing @types/node / @types/react absence noise confirmed and documented in every prior session; not claimed as a genuine failure
```

This is the honest baseline. All 5 systems below are additive to this architecture — no existing route, URL, data model, or index/noindex decision is changed without a concrete, stated reason.
