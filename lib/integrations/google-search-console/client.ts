import crypto from "node:crypto";
import type { GscServiceAccountCredentials, GscSearchAnalyticsQuery, GscSearchAnalyticsResponse } from "./types";

/**
 * Minimal, dependency-free Google Search Console API client.
 *
 * Deliberately does NOT add `googleapis` or `google-auth-library` as a
 * dependency — the only thing actually needed is a signed JWT exchanged
 * for a short-lived OAuth2 access token, which Node's built-in `crypto`
 * module can do directly (RS256 signing) via two plain `fetch` calls.
 * Adding a ~200KB+ dependency for this would be unjustified.
 *
 * FEATURE-GATED: every exported function here either requires explicit
 * credentials to be passed in, or (via isGscMonitoringEnabled()) checks
 * an env var before doing anything. The rest of the application must
 * continue working with zero configuration here — nothing in this file
 * is imported by any page, only by the optional GitHub Actions workflow
 * script.
 */

const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SEARCH_ANALYTICS_URL_TEMPLATE = "https://www.googleapis.com/webmasters/v3/sites/{siteUrl}/searchAnalytics/query";

export function isGscMonitoringEnabled(): boolean {
  return process.env.GSC_MONITORING_ENABLED === "true";
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Builds and signs a service-account JWT assertion (RFC 7523), then
 * exchanges it for a short-lived OAuth2 access token. Never logs,
 * persists, or returns the private key itself — only the resulting
 * bearer token, which the caller should treat as a secret with a ~1hr
 * lifetime.
 */
async function getAccessToken(credentials: GscServiceAccountCredentials): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: credentials.client_email,
    scope: GSC_SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };

  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const signature = crypto.sign("RSA-SHA256", Buffer.from(unsigned), credentials.private_key);
  const jwt = `${unsigned}.${base64url(signature)}`;

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    throw new Error(`GSC auth failed: HTTP ${response.status} — ${await response.text()}`);
  }

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

/**
 * Runs a single Search Analytics query. Read-only — the GSC API this
 * integration uses has no write/mutation endpoints at all, so there is
 * no risk of this accidentally modifying anything in Search Console.
 */
export async function querySearchAnalytics(
  credentials: GscServiceAccountCredentials,
  siteUrl: string,
  query: GscSearchAnalyticsQuery
): Promise<GscSearchAnalyticsResponse> {
  const accessToken = await getAccessToken(credentials);
  const endpoint = SEARCH_ANALYTICS_URL_TEMPLATE.replace("{siteUrl}", encodeURIComponent(siteUrl));

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(query),
  });

  if (!response.ok) {
    throw new Error(`GSC query failed: HTTP ${response.status} — ${await response.text()}`);
  }

  return (await response.json()) as GscSearchAnalyticsResponse;
}

/**
 * Reads and parses GSC_SERVICE_ACCOUNT_JSON from the environment. Never
 * hard-coded, never committed — expected to be set as a GitHub Actions
 * secret / Vercel env var containing the full service-account JSON key
 * as a single-line string.
 */
export function loadCredentialsFromEnv(): GscServiceAccountCredentials | null {
  const raw = process.env.GSC_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.client_email || !parsed.private_key) return null;
    return { client_email: parsed.client_email, private_key: parsed.private_key };
  } catch {
    return null;
  }
}
