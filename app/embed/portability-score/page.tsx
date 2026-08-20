import type { Metadata } from "next";
import { getTransferRule, getAllProfessions, getAllStates } from "@/lib/data";
import { portabilityLabel, formatDayRange, formatUsd, SITE_URL } from "@/lib/utils";
import { SITE_NAME } from "@/lib/constants";

/**
 * System 4 — Embeddable Portability Score widget.
 *
 * Reuses getTransferRule() — the exact same data-access function the
 * real /transfer/[profession]/[from]/[to] page uses — and the exact same
 * portabilityLabel() scoring/labeling logic already used by
 * PortabilityScoreCard. This file deliberately does NOT recompute or
 * duplicate the score; it only looks up and re-renders it in a minimal
 * layout suitable for a small iframe.
 *
 * noindex: this is a utility view of data that already has a canonical,
 * fully-indexed page — it should never compete with or duplicate that
 * page in search results. It's meant to be seen embedded on OTHER sites,
 * not found directly via search.
 */
export const metadata: Metadata = {
  title: `Portability Score Widget | ${SITE_NAME}`,
  robots: { index: false, follow: false },
};

function MissingParams() {
  const professions = getAllProfessions();
  const states = getAllStates();
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: "16px", fontSize: "14px", color: "#374151" }}>
      <p style={{ margin: 0, fontWeight: 600 }}>PermitBridge Portability Score widget</p>
      <p style={{ margin: "8px 0" }}>
        Add <code>profession</code>, <code>from</code>, and <code>to</code> query parameters to embed a specific score.
      </p>
      <p style={{ margin: "8px 0", fontSize: "12px", color: "#6b7280" }}>
        Professions: {professions.map((p) => p.slug).join(", ")}
        <br />
        States: {states.map((s) => s.slug).join(", ")}
      </p>
    </div>
  );
}

export default async function PortabilityScoreEmbed({
  searchParams,
}: {
  searchParams: Promise<{ profession?: string; from?: string; to?: string }>;
}) {
  const { profession, from, to } = await searchParams;

  if (!profession || !from || !to) {
    return <MissingParams />;
  }

  const rule = getTransferRule(profession, from, to);

  if (!rule) {
    return (
      <div style={{ fontFamily: "system-ui, sans-serif", padding: "16px", fontSize: "14px", color: "#374151" }}>
        <p style={{ margin: 0 }}>No data found for this combination on PermitBridge.</p>
      </div>
    );
  }

  const { label, tone } = portabilityLabel(rule.portabilityScore);
  const toneColor = tone === "success" ? "#16a34a" : tone === "warning" ? "#d97706" : "#dc2626";
  const fullPageUrl = `${SITE_URL}/transfer/${rule.profession}/${rule.fromState}/${rule.toState}`;

  return (
    <div
      style={{
        fontFamily: "system-ui, sans-serif",
        border: "1px solid #e5e7eb",
        borderRadius: "12px",
        padding: "16px",
        maxWidth: "360px",
        color: "#111827",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span style={{ fontSize: "32px", fontWeight: 700 }}>{rule.portabilityScore}</span>
        <span style={{ fontSize: "12px", fontWeight: 600, color: toneColor, textTransform: "uppercase" }}>{label}</span>
      </div>
      <p style={{ margin: "4px 0 12px", fontSize: "13px", color: "#6b7280" }}>
        {profession} license: {from} &rarr; {to}
      </p>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", fontSize: "13px", lineHeight: 1.7 }}>
        <li>Fee: {formatUsd(rule.feeUsd)}</li>
        <li>Exam required: {rule.examRequired ? "Yes" : "No"}</li>
        <li>Est. processing: {formatDayRange(rule.estimatedProcessingDays)}</li>
      </ul>
      <a
        href={fullPageUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: "block", marginTop: "12px", fontSize: "12px", color: "#2563eb", textDecoration: "none" }}
      >
        Full details &amp; sources on {SITE_NAME} &rarr;
      </a>
    </div>
  );
}
