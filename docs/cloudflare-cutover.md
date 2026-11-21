# Cloudflare cutover runbook: getpermitbridge.com

Moves production from Vercel to Cloudflare Workers (OpenNext). Covers getpermitbridge.com only; the other
Vercel projects on the same team are out of scope. Status: **draft, not started.** Nothing in this file has
been run. Decisions so far: `public/_headers` is kept out of Vercel's build output (9.2).

Verified so far (preview, 2026-11-21, commit 8e5517b on `cloudflare-preview`): 125-row status baseline with
0 mismatches; all 60 pages' visible text and metadata identical to production; /search, unknown-param 404s,
robots.txt, sitemap (60 URLs), feed.xml and llms.txt identical; one hourly ISR cycle STALE -> HIT through R2;
no 1102 errors in 50 requests on the Free plan.

## 1. Preconditions (all must be true; otherwise do not start)

- [ ] **Workers Paid** is active on the Cloudflare account. No cutover on the Free plan.
- [ ] **No pending AdSense review.** No cutover while a review or re-application is open.
- [ ] **No content push within 48 hours** before or after the cutover, and no Search Console changes in that window.
- [ ] Production code is on `main` and Vercel has served it for at least 48 hours with a clean baseline (section 8).
- [ ] The production Worker has been deployed to workers.dev from `main` and passed section 5's checks.
- [ ] Bundle size recorded from the run page ("Total Upload / gzip") and within the plan limit.
- [ ] Worker logs checked: CPU time per request on heavy pages, and no errors on ISR regeneration.
- [ ] The **current DNS record list exported from Namecheap** (section 3.1), saved outside the repo.
- [ ] **contact@ email forwarding:** Namecheap has confirmed in writing (support ticket or chat transcript, saved)
      that forwarding for contact@getpermitbridge.com keeps working after the nameservers move to Cloudflare, **or**
      Cloudflare Email Routing has been set up and tested end to end before the switch (section 3.2).
- [ ] Someone can watch the site and the inbox for 2 hours after the switch.

## 2. Production Worker setup (before any DNS change)

1. Production config on `main` (separate from the preview): Worker name `permitbridge` (not `permitbridge-preview`),
   its own R2 bucket (e.g. `permitbridge-inc-cache`) and Durable Object queue, `PREVIEW_NOINDEX` **unset**.
   `scripts/check-preview-noindex.ts` fails the build if the noindex header leaks into a default build.
2. A production deploy workflow that runs only on manual dispatch from `main` (same steps as the preview
   workflow, without the noindex step), with the Cloudflare secrets scoped to the deploy steps only.
3. Deploy to `permitbridge.<account>.workers.dev` first and run section 5's checks there (without the noindex
   expectation).
4. Do **not** add routes or custom domains yet.

## 3. DNS plan (Namecheap -> Cloudflare nameservers)

A Worker custom domain needs the zone on Cloudflare, so the nameservers move from Namecheap to Cloudflare. The
domain stays registered at Namecheap.

### 3.1 Save the current records first

- Export every record from Namecheap (Advanced DNS) and from Namecheap's mail settings: A, AAAA, CNAME, MX, TXT,
  CAA, SRV, and any URL-redirect or email-forwarding entries. Keep a copy with the date.
- Record the current TTLs.
- Identify, from that list (do not guess):
  - Web records for the apex and `www` (today they point to Vercel).
  - **Email forwarding for contact@getpermitbridge.com**: its MX records and SPF/other TXT records.
  - **Google Search Console** verification TXT record (needed if the property is a Domain property).
  - Any **Google/AdSense** site-verification TXT records.
  - DKIM, DMARC, CAA, and records for any other service.

### 3.2 Email forwarding (contact@) must keep working

- Namecheap's free email forwarding may depend on Namecheap's own DNS. **Confirm with Namecheap** whether it keeps
  working once nameservers move away. If it does not, set up Cloudflare Email Routing (forward contact@ to the
  same destination) and test it **before** the nameserver switch.
- Recreate MX and TXT records in Cloudflare exactly as the chosen forwarding method requires.
- Test: send a message to contact@ from an outside account before the switch and again right after.

### 3.3 Build the Cloudflare zone (no traffic yet)

1. Add the zone getpermitbridge.com in Cloudflare (free zone plan is enough for DNS; the Worker plan is separate).
2. Recreate **every** saved record. Web records stay pointed at Vercel, **DNS only (grey cloud)**, for now.
3. Check each record against Cloudflare's assigned nameservers before switching, e.g.
   `dig @<cloudflare-ns> getpermitbridge.com TXT`, `... MX`, `... www CNAME`. Compare with the saved list.
4. Lower TTLs on the Namecheap side to 300 seconds at least 24 hours before the switch.

## 4. Cloudflare settings (before attaching the Worker)

1. **SSL/TLS: Full (strict).**
2. **Always Use HTTPS: on.**
3. **HSTS:** `max-age=63072000` (matches Vercel today). Do not add `includeSubDomains` or `preload` unless Vercel
   sends them today (it doesn't).
4. **Apex -> www redirect:** a Redirect Rule `getpermitbridge.com/*` -> `https://www.getpermitbridge.com/$1`,
   status **308**, keep query string. Vercel does this today; test with `curl -I https://getpermitbridge.com/`.
5. **Response header rule (Transform Rules -> Modify Response Header)** on `www.getpermitbridge.com`, all
   responses **including 308 and 410** (on Workers, next.config headers() does not reach redirect or middleware
   responses):
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: DENY`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
   - `Strict-Transport-Security: max-age=63072000`
   - Use "set" (not "add") so pages that already send them don't get duplicates.
   - Production must **not** send `X-Robots-Tag: noindex, nofollow`. Only the 410 responses send
     `x-robots-tag: noindex` (from middleware), as today.

## 5. Cache-Control re-check list (behind the zone)

Compare each against production on Vercel (values read 2026-11-21). No HTML or 410 may be cached longer than today.

| Route | Vercel today | Check on Cloudflare |
|---|---|---|
| HTML pages (/, guides, state, profession, transfer) | `public, max-age=0, must-revalidate` | Browser must revalidate; `s-maxage` alone is acceptable only if no zone Cache Rule caches HTML |
| Hourly-refresh pages (RN pairs, electrician/HVAC/plumber states) | `public, max-age=0, must-revalidate` | Same; content refreshes hourly (STALE -> HIT) |
| /search | `private, no-cache, no-store, max-age=0, must-revalidate` | Must stay private/no-store and never be cached |
| 410 Gone | `public, max-age=0, must-revalidate`, `X-Robots-Tag: noindex` | Same status and noindex; not cached |
| 308 redirects | `public, max-age=0, must-revalidate` | Correct target; security headers via the rule in 4.5 |
| /sitemap.xml | `public, max-age=0, must-revalidate`, `application/xml` | 60 URLs, floors unchanged |
| /robots.txt | `public, max-age=0, must-revalidate`, `text/plain` | Byte-identical (app/robots.ts content) |
| /feed.xml | `public, max-age=3600` | Body identical |
| /llms.txt | `public, max-age=3600, s-maxage=3600` | Body identical |
| /_next/static/* | immutable | `public,max-age=31536000,immutable` |

Do not add a "cache everything" rule. If any HTML response is served from the zone cache (`cf-cache-status: HIT`)
longer than Vercel would, stop and fix before continuing.

## 6. Cutover steps (exact order)

1. Re-confirm section 1 on the day.
2. Attach the custom domains to the production Worker: `www.getpermitbridge.com`, then the apex (which only
   redirects, per 4.4).
3. Switch the nameservers at Namecheap to the two Cloudflare nameservers.
4. Watch propagation: `dig NS getpermitbridge.com`, then `dig www.getpermitbridge.com`.
5. As soon as www resolves to Cloudflare, run section 7 immediately.
6. Send the contact@ test email.
7. Check the Search Console and AdSense verification status (they should stay verified if the TXT records were
   copied).

## 7. Post-cutover checks

Immediately after the switch, and again after 24 hours:

- [ ] `scripts/monitoring/status-baseline.tsv`, all 125 rows, about 1 request/second, browser user agent, abort on
      403: 0 mismatches (60 x 200, 40 x 410, 25 x 308 with correct targets).
- [ ] Response headers: the four security headers and HSTS on pages, 308s and 410s; no `noindex, nofollow`
      anywhere; `x-robots-tag: noindex` on 410s only.
- [ ] /sitemap.xml: 60 URLs, floors unchanged (`npm run check:sitemap:live`).
- [ ] /robots.txt identical; /feed.xml and /llms.txt identical.
- [ ] Visible text of all 60 pages identical to the last Vercel copy.
- [ ] /search with several queries; four unknown-param 404s show the site's not-found page.
- [ ] GTM-MQ78NGXJ and the Consent Mode default on every page; the `google-adsense-account` meta tag present;
      no direct gtag.js tag (matches Vercel).
- [ ] Apex redirects to www with 308.
- [ ] Search Console: domain still verified; URL Inspection on 3 pages; no new crawl errors after 24 hours.
- [ ] contact@ receives mail.
- [ ] Worker dashboard: no 5xx, no CPU-limit errors, ISR regenerations succeeding.

## 8. Rollback plan

- **Vercel stays live and unchanged for 14 days** after a clean cutover: do not remove the domain from the
  Vercel project, do not delete the project, do not change its settings.
- Old DNS records are saved before anything changes (3.1).
- Fast rollback (zone on Cloudflare): change the `www` and apex records back to the saved Vercel values,
  DNS only, TTL 300. Detach the Worker custom domains.
- Full rollback: switch the nameservers at Namecheap back to Namecheap's and restore the saved records.
- Rollback triggers: any baseline mismatch that can't be fixed within 1 hour, any 5xx or 1102 errors on
  production pages, lost email forwarding, lost Search Console verification, or noindex on a production page.
- After rollback, re-run the 125-row baseline against Vercel.

## 9. Getting production code onto `main` (proposal)

All of this happens **before** the cutover, so Vercel and Cloudflare run the same code for a while.

### 9.1 What to merge

From `cloudflare-preview`:

| Commit | What | Effect on the Vercel build |
|---|---|---|
| `360cd24` | Next 15.5.28, @opennextjs/cloudflare, wrangler | Next minor bump (15.5.23 -> 15.5.28); dev tools not in the site build |
| `834fb7d` | OpenNext config, `public/_headers`, noindex check, workflow | Would add a public file at `/_headers` on Vercel (today 404). **Decided: keep it out of Vercel's output** (9.2, step 3) |
| `5357f59` | Search index built at prebuild | Same output (50 documents, identical to production's /search) |
| `c18d17b` + `8e5517b` | Route guard (8e5517b reverts c18d17b's dynamicParams) | Unknown params keep the site's not-found page and 404; prebuilt pages unchanged |
| `e9c70de` | Remove unused `public/robots.txt` | None (Vercel already serves app/robots.ts) |
| `10a2b66` | Preview workflow no longer passes the GA variable | Workflow only |

Then, as new commits on `main` (not on the preview branch):

- Production `wrangler.jsonc` / environment (Worker name `permitbridge`, production bucket, no noindex).
- A manual-dispatch production deploy workflow (section 2).

### 9.2 Keeping the Vercel build identical

1. Merge through a pull request from `cloudflare-preview` to `main`, not a direct push, so Vercel builds a branch
   preview of the exact merge result.
2. On that Vercel branch preview, before merging: the 125-row baseline (0 mismatches), visible text and metadata
   of all 60 pages compared with production (0 differences), sitemap 60 URLs, robots.txt identical, unknown-param
   404s showing the site's not-found page, /search identical.
3. **`/_headers` stays out of Vercel's build output** (decided 2026-11-21: no production change before cutover).
   Simplest mechanism (a proposed commit on `cloudflare-preview`, made and verified before the merge):
   - Move the file from `public/_headers` to `cloudflare/_headers` (outside `public/`, so `next build` on Vercel
     never ships it).
   - In the Cloudflare workflows only, add a step before `opennextjs-cloudflare build`:
     `cp cloudflare/_headers public/_headers` (the preview workflow then appends its noindex line as today).
   - `scripts/check-preview-noindex.ts` keeps working: a default build has no `public/_headers`, and the preview
     build has the copied file with the noindex line.
   - Verify on the Vercel branch preview that `/_headers` still returns 404, and on the workers.dev preview that
     the security headers and `/_next/static` immutable caching are still present.
4. After merging, re-run the baseline and the 60-page comparison against production on Vercel.
5. Leave at least 48 hours between this merge and the DNS cutover (section 1).

## 10. Leftovers after a clean cutover

- After 14 days: remove the domain from the Vercel project (do not delete the project without a separate decision).
- Delete the preview Worker and its R2 bucket only after a separate decision.
- The scratchpad worktree `headtree`: remove only with explicit approval, using the junction-safe steps (verify
  `node_modules` there is a junction, remove the link with `cmd /c rmdir`, confirm the real `node_modules` is
  intact, then remove the worktree).
