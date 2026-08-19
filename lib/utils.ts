import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes safely, resolving conflicts (last one wins). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format an ISO date string (YYYY-MM-DD) as a human-readable date. */
export function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Format a USD amount with no decimals. */
export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Human label for a day range, e.g. "14–45 days". */
export function formatDayRange(range: [number, number]): string {
  return `${range[0]}–${range[1]} days`;
}

/** Map a 0-100 portability score to a qualitative label + color token. */
export function portabilityLabel(score: number): { label: string; tone: "success" | "warning" | "destructive" } {
  if (score >= 70) return { label: "Easy Transfer", tone: "success" };
  if (score >= 40) return { label: "Moderate Effort", tone: "warning" };
  return { label: "Difficult Transfer", tone: "destructive" };
}

/**
 * PRODUCTION_DOMAIN_REQUIRED: this remains the same placeholder domain
 * used since the project's earliest phase — it has never been confirmed
 * as a real, owned production domain (see the final production audit
 * report for the full trace of every file this value reaches). This was
 * previously hardcoded with NO connection to the NEXT_PUBLIC_SITE_URL
 * variable already documented in .env.example — meaning setting that
 * variable in Vercel would have silently done nothing. Fixed to actually
 * read it, with today's placeholder as the fallback so behavior is
 * unchanged until a real domain is set as an environment variable.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.getpermitbridge.com";
