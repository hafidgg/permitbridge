/**
 * lib/monitoring/cron-auth.ts
 *
 * Phase 4.8, Step 8: the authorization check extracted as a plain,
 * framework-independent function — testable without needing a real
 * Next.js NextRequest instance (this sandbox has no "next" package
 * installed for direct testing). app/api/cron/source-monitor/route.ts
 * calls this with exactly the two real values it has: the raw
 * Authorization header string and process.env.CRON_SECRET.
 *
 * Fails CLOSED: an unset expectedSecret always returns false, regardless
 * of what the request sent — there is no "open" state.
 */
export function checkCronAuthorization(authorizationHeader: string | null | undefined, expectedSecret: string | undefined): boolean {
  if (!expectedSecret) return false;
  if (!authorizationHeader) return false;
  return authorizationHeader === `Bearer ${expectedSecret}`;
}
