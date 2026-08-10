/**
 * lib/pipeline/normalize.ts
 *
 * Merges an ExtractedRecord on top of the current profession/state JSON
 * to produce a *proposed* record in the exact same shape the site already
 * reads (types/index.ts). Only fields the extractor actually populated are
 * overridden — everything else passes through unchanged, so a source with
 * a single extraction rule can never accidentally wipe out unrelated data.
 */
import fs from "node:fs";
import path from "node:path";
import type { ExtractedRecord } from "./types";
import type { Profession, State } from "@/types";

const DATA_DIR = path.join(process.cwd(), "data");

function loadCurrentEntity<T>(kind: "professions" | "states", slug: string): T | null {
  const filePath = path.join(DATA_DIR, kind, `${slug}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

export interface NormalizedProposal {
  entityKind: "profession" | "state";
  entitySlug: string;
  sourceId: string;
  sourceUrl: string;
  current: Record<string, unknown> | null;
  proposed: Record<string, unknown> | null;
  /**
   * Fields the extractor found that are NOT part of the entity's real
   * schema (see the "tripwire" sources in the registry, e.g.
   * compactListPageChanged). These are never merged into `proposed` and
   * never diffed — they're surfaced as human-readable notes only, so a
   * presence-only signal can never silently overwrite a curated array
   * like compactStates with a bare boolean.
   */
  signals: Record<string, unknown>;
}

/** The only fields a pipeline source is allowed to write directly onto a Profession record. */
const PROFESSION_WRITABLE_FIELDS = new Set([
  "description",
  "longDescription",
  "averageTransferDays",
  "hasNationalCompact",
  "compactName",
  "compactStates",
  "commonExam",
  "commonExamAcceptedStates",
]);

/** The only fields a pipeline source is allowed to write directly onto a State record. */
const STATE_WRITABLE_FIELDS = new Set(["licensingAuthorityNote", "isUlrState", "ulrEnactedYear"]);

export function normalizeRecord(record: ExtractedRecord, sourceUrl: string): NormalizedProposal | null {
  if (record.entityKind === "transfer") return null; // transfer rules are derived, not sourced directly (see generate-transfers.ts)

  const dirName = record.entityKind === "profession" ? "professions" : "states";
  const current = loadCurrentEntity<Profession | State>(dirName, record.entitySlug);

  if (!current) {
    return {
      entityKind: record.entityKind,
      entitySlug: record.entitySlug,
      sourceId: record.sourceId,
      sourceUrl,
      current: null,
      proposed: null, // unknown entity — surfaced as a validation error downstream, not silently created
      signals: {},
    };
  }

  const writableFields = record.entityKind === "profession" ? PROFESSION_WRITABLE_FIELDS : STATE_WRITABLE_FIELDS;

  // Only merge fields that (a) actually extracted a defined, non-null value
  // and (b) are on the entity's schema-backed writable allowlist. Anything
  // else — like a presence-only "this page changed" tripwire — is captured
  // as a signal instead, never merged into the written record.
  const meaningfulFields: Record<string, unknown> = {};
  const signals: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record.fields)) {
    if (value === undefined || value === null) continue;
    if (writableFields.has(key)) {
      meaningfulFields[key] = value;
    } else {
      signals[key] = value;
    }
  }

  const proposed: Record<string, unknown> = {
    ...(current as unknown as Record<string, unknown>),
    ...meaningfulFields,
    sourceUrl,
    verifiedAt: record.extractedAt.slice(0, 10),
    updatedAt: Object.keys(meaningfulFields).length > 0 ? record.extractedAt.slice(0, 10) : (current as any).updatedAt,
  };

  return {
    entityKind: record.entityKind,
    entitySlug: record.entitySlug,
    sourceId: record.sourceId,
    sourceUrl,
    current: current as unknown as Record<string, unknown>,
    proposed,
    signals,
  };
}
