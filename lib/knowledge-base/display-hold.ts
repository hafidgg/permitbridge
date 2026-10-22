/**
 * Fields carrying a displayHold are never shown: the loader replaces their value with "Unknown" (so no page,
 * table, FAQ or JSON-LD can render it) and reports which fields were held, so pages can say "being re-checked"
 * instead of "not published by the board". The stored value stays in data/ as the research record.
 */
import type { VerifiedField } from "@/types/knowledge-base";

function isField(v: unknown): v is VerifiedField<unknown> {
  return typeof v === "object" && v !== null && "value" in v && "sourceUrl" in v;
}

export function applyDisplayHolds<T extends object>(record: T): { record: T; held: string[] } {
  const held: string[] = [];
  const out: Record<string, unknown> = { ...(record as Record<string, unknown>) };
  for (const [key, value] of Object.entries(out)) {
    if (isField(value) && value.displayHold && value.value !== "Unknown") {
      out[key] = { ...value, value: "Unknown" };
      held.push(key);
    }
  }
  return { record: out as T, held };
}
