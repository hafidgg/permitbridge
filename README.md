# PermitBridge

The global reference for transferring professional and trade licenses between US states — reciprocity, endorsement, exams, fees, and step-by-step timelines, with no login required.

Built with **Next.js 15 (App Router)**, **TypeScript**, **Tailwind CSS**, and a **hand-rolled shadcn/ui-style component set** — no database, no paid APIs, fully static-generatable.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router, Static Site Generation) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS + CSS variables (design tokens) |
| UI Kit | Local shadcn/ui-style primitives (`components/ui`) — no CLI dependency |
| Data | JSON files in `/data` (professions, states, transfer rules) |
| Search | In-memory client-side scoring over a server-built index — no backend, no third-party search API |
| Hosting | Optimized for Vercel or Cloudflare Pages (static export compatible) |

No database. No paid APIs. No login/accounts/dashboard — this is a content + search engine, not a SaaS product.

---

## Project Structure

```
permitbridge/
├── app/                        # Next.js App Router routes
│   ├── page.tsx                 # Home
│   ├── layout.tsx               # Root layout (metadata, JSON-LD, header/footer)
│   ├── sitemap.ts               # Dynamic XML sitemap
│   ├── robots.ts                # Dynamic robots.txt
│   ├── not-found.tsx            # Custom 404
│   ├── error.tsx                # Custom 500 / error boundary
│   ├── professions/page.tsx     # /professions index
│   ├── profession/[slug]/       # /profession/electrician etc.
│   ├── states/page.tsx          # /states index
│   ├── state/[slug]/            # /state/texas etc.
│   ├── transfer/[profession]/[from]/[to]/  # core money page
│   ├── search/page.tsx          # /search
│   ├── guides/, guides/[slug]/  # long-form explainers
│   ├── blog/, blog/[slug]/      # policy update posts
│   └── about, contact, privacy, terms, disclaimer/
├── components/
│   ├── ui/                      # Button, Card, Badge, Input, Separator, Slot
│   ├── layout/                  # Header, Footer, Breadcrumbs
│   ├── home/                    # Hero, SearchBox, PopularProfessions, ...
│   ├── profession/               # ProfessionIcon
│   ├── transfer/                 # PortabilityScoreCard, StepsList, OtherStatesTable
│   ├── content/                  # MarkdownBlock (renders content/*.md)
│   └── seo/                      # JsonLd
├── lib/
│   ├── data.ts                  # Data-access layer over /data (swap for a DB later)
│   ├── search.ts                # Builds the in-memory search index
│   ├── seo.ts                   # Metadata + JSON-LD helpers
│   ├── constants.ts             # Site-wide constants (nav, footer links)
│   └── utils.ts                 # cn(), formatters, portability label mapping
├── types/index.ts               # Shared domain types
├── data/
│   ├── professions/*.json       # One file per profession
│   ├── states/*.json            # One file per state
│   └── transfers/{profession}/{from}--{to}.json  # One file per directed transfer rule
├── content/
│   ├── guides/*.md              # Guide bodies (simple ## + paragraph markdown)
│   └── blog/*.md                # Blog post bodies
├── scripts/
│   ├── generate-transfers.ts    # Regenerates /data/transfers (now override-aware, see PIPELINE.md)
│   ├── validate-data.ts         # CI-friendly data integrity check (now also validates pipeline config)
│   └── pipeline/                 # CLI entry points: run.ts, approve.ts
├── lib/pipeline/                 # Fetch → extract → normalize → validate → diff → update (see PIPELINE.md)
├── data/_pipeline/                # Source registry, overrides, pending changes, changelog — see PIPELINE.md
├── fixtures/pipeline/html/         # Mock HTML fixtures for offline pipeline testing
└── public/                      # robots.txt fallback, manifest, icons, data/search-index.json snapshot
```

**→ See [PIPELINE.md](./PIPELINE.md) for the full data pipeline architecture.**

---

## Getting Started

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`.

### Troubleshooting a fresh install

If you're installing into a folder that was used for an earlier attempt (or
copied from another project), stale files can cause confusing errors that
have nothing to do with this codebase. Start clean:

```bash
# Windows (cmd)
rmdir /s /q node_modules & del package-lock.json
# macOS/Linux
rm -rf node_modules package-lock.json

npm install
```

**"ERESOLVE unable to resolve dependency tree" (React/Next.js peer conflict)**
`package.json` pins `next` to `^15.1.0` specifically because that's the
first Next.js 15 release with React 19 as a fully supported (non-RC) peer
dependency. If you still hit this after a clean install, your npm registry
resolved a `next` version outside that range for some other reason — as a
last resort, `npm install --legacy-peer-deps` will unblock you, but a clean
install per above should not need it.

**Build shows a Next.js major version you didn't expect (e.g. 16.x)**
That means `node_modules/next` predates this `package.json` — almost always
a leftover from a previous partial/failed install in the same folder. Do
the clean-install steps above; `npm install` should then resolve to a
`next` version inside the `^15.1.0` range and nothing higher.

**`next lint` fails with "Invalid project directory"**
Next.js 16 removed the built-in `next lint` command. This repo's `lint`
script already calls `eslint .` directly instead (see `eslint.config.mjs`,
ESLint v9 flat config) — make sure you're on the version of `package.json`
that ships with this note; older copies still say `next lint`.

**`'tsx' is not recognized as an internal or external command`**
`tsx` is a `devDependency`, not a global tool — this means `npm install`
did not complete successfully. Fix the install first; every `pipeline:*`
and `generate-transfers`/`validate-data` script depends on it.

### Other scripts

```bash
npm run build              # Production build (SSG)
npm run start              # Serve the production build
npm run lint                # ESLint (next/core-web-vitals ruleset)
npm run typecheck           # tsc --noEmit
npm run validate-data       # Sanity-check every JSON file in /data
npm run generate-transfers  # Regenerate all transfer-rule JSON from professions + states

npm run pipeline:dry-run    # Data pipeline: compute-only against mock fixtures, writes nothing
npm run pipeline             # Data pipeline: LIVE — fetch real sources, auto-apply low/medium-risk changes
npm run pipeline:approve      # Review and resolve high-risk changes queued by the pipeline
```

> **The site now has a full self-updating data pipeline** — fetch, validate,
> diff, risk-gated update, and search-index rebuild, all without touching any
> UI code. See **[PIPELINE.md](./PIPELINE.md)** for the complete architecture,
> and `data/_pipeline/changelog/` for a real sample run already included in
> this repo.

Run `npm run validate-data` before every deploy — it checks that every transfer rule points to a profession/state that actually exists, and that no file is missing required fields.

---

## Content Model

**Professions** (`data/professions/*.json`) and **States** (`data/states/*.json`) are the source of truth. **Transfer rules** (`data/transfers/{profession}/{from}--{to}.json`) are a *derived* dataset — see `scripts/generate-transfers.ts` for the rule engine that computes pathway type, exam requirements, fees, and the Portability Score from the profession + state data.

To add a 6th profession or state:
1. Add a new JSON file to `data/professions/` or `data/states/` following the existing shape (see `types/index.ts`).
2. Run `npm run generate-transfers` to create every new transfer-rule combination automatically.
3. Run `npm run validate-data` to confirm everything is consistent.
4. `generateStaticParams()` in the dynamic route files will automatically pick up the new pages on the next build — no route code changes needed.

This is intentionally still JSON files, not a database, per the v1 scope — but every read goes through `lib/data.ts`, so swapping in Postgres/SQLite later only requires changing that one file.

---

## SEO Implementation Checklist

- ✅ Per-page `generateMetadata` (title, description, canonical) via `lib/seo.ts`
- ✅ Dynamic `sitemap.xml` (`app/sitemap.ts`) covering every static + dynamic route
- ✅ Dynamic `robots.txt` (`app/robots.ts`) + static fallback in `/public`
- ✅ JSON-LD: `Organization`, `WebSite` (site-wide), `Article` (profession/state/transfer/guide/blog pages), `FAQPage` (every FAQ block), `BreadcrumbList` (every page with breadcrumbs)
- ✅ Breadcrumb UI + schema on every non-home page
- ✅ Open Graph + Twitter Card metadata on every page
- ✅ Custom `not-found.tsx` (404) and `error.tsx` (500)
- ✅ Heavy internal linking: profession ↔ state ↔ transfer pages cross-link throughout
- ✅ Semantic HTML (`<nav>`, `<article>`, `<aside>`, `<dl>`, proper heading hierarchy)

---

## Accessibility

- Skip-to-content link in `app/layout.tsx`
- Visible focus rings (`:focus-visible`) defined in `app/globals.css`
- All icons marked `aria-hidden="true"` with adjacent text labels (no icon-only buttons without `aria-label`)
- Color is never the only signal — Portability Score badges pair color with text labels ("Easy Transfer", not just green)
- Semantic table markup with `<th scope="col">` on the transfer comparison table
- `<details>/<summary>` used for FAQ accordions — fully keyboard-operable without custom JS

---

## Performance Notes

- 100% static generation: every profession, state, and transfer page is pre-rendered at build time via `generateStaticParams()` — zero server compute per request.
- No client JavaScript on any page except the interactive search box (`components/home/SearchBox.tsx`), which is a small, dependency-free client island.
- `next/font` (Inter, self-hosted, `display: swap`) — no external font requests.
- No layout-shifting ads or embeds in the v1 scope.
- Tailwind's JIT compiler ships only the CSS actually used.

To validate Lighthouse scores locally after `npm run build && npm run start`, run Chrome DevTools → Lighthouse, or `npx lighthouse http://localhost:3000 --view`.

---

## Deployment

### Vercel (recommended)
1. Push this repo to GitHub.
2. Import it in Vercel — no environment variables are required for v1.
3. Vercel auto-detects Next.js and deploys on every push.

### Cloudflare Pages
1. Build command: `npm run build`
2. Output directory: `.next` (with the Cloudflare Next.js adapter) or run `next export`-style static output if you convert dynamic routes to fully static (they already use `generateStaticParams`, so this project is static-export-friendly).

---

## Roadmap (Post-v1)

- Expand from 5 professions × 5 states to full 50-state × 20-profession coverage.
- Optional free "watch this transfer" email alerts (still no login — magic-link only) when a state's rules change.
- Migrate `/data` to a real database once content volume makes JSON-file management impractical.
- Add Canada (interprovincial) and EU (mutual recognition of professional qualifications) coverage.

---

## License

Proprietary — all rights reserved. This codebase is provided as a production starting point; licensing data must be independently verified before public launch (see `/disclaimer`).
