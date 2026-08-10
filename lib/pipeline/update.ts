/**
 * lib/pipeline/update.ts
 *
 * The only module in the pipeline allowed to write to /data. Applies a
 * validated, normalized proposal to disk if — and only if — its highest
 * risk field change is "low" or "medium". "high" risk changes (pathway
 * type flips, compact membership changes, exam-requirement flips, ULR
 * status flips) are never auto-applied: they're written to
 * data/_pipeline/pending/ instead and require `npm run pipeline:approve`
 * or a reviewed PR in CI.
 */
import fs from "node:fs";
import path from "node:path";
import type { DiffResult, PendingChange } from "./types";
import type { NormalizedProposal } from "./normalize";

const DATA_DIR = path.join(process.cwd(), "data");
const PENDING_DIR = path.join(process.cwd(), "data", "_pipeline", "pending");

function entityFilePath(entityKind: "profession" | "state", slug: string): string {
  const dirName = entityKind === "profession" ? "professions" : "states";
  return path.join(DATA_DIR, dirName, `${slug}.json`);
}

/** Writes the proposed record directly to its source-of-truth JSON file. */
export function applyProposal(proposal: NormalizedProposal): void {
  if (!proposal.proposed) return;
  const filePath = entityFilePath(proposal.entityKind, proposal.entitySlug);
  fs.writeFileSync(filePath, JSON.stringify(proposal.proposed, null, 2) + "\n");
}

/** Queues a high-risk change for human review instead of writing it. */
export function queuePendingChange(diff: DiffResult, proposal: NormalizedProposal): PendingChange {
  fs.mkdirSync(PENDING_DIR, { recursive: true });

  const id = `${diff.entityKind}-${diff.entitySlug}-${Date.now()}`;
  const pending: PendingChange = {
    id,
    createdAt: new Date().toISOString(),
    diff,
    proposedRecord: proposal.proposed ?? {},
    status: "pending",
  };

  fs.writeFileSync(path.join(PENDING_DIR, `${id}.json`), JSON.stringify(pending, null, 2));
  return pending;
}

export function listPendingChanges(): PendingChange[] {
  if (!fs.existsSync(PENDING_DIR)) return [];
  return fs
    .readdirSync(PENDING_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(PENDING_DIR, f), "utf-8")) as PendingChange)
    .filter((p) => p.status === "pending");
}

export function resolvePendingChange(id: string, decision: "approved" | "rejected"): void {
  const filePath = path.join(PENDING_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) throw new Error(`No pending change found with id ${id}`);

  const pending = JSON.parse(fs.readFileSync(filePath, "utf-8")) as PendingChange;
  pending.status = decision;

  if (decision === "approved") {
    const filePathForEntity = entityFilePath(pending.diff.entityKind as "profession" | "state", pending.diff.entitySlug);
    fs.writeFileSync(filePathForEntity, JSON.stringify(pending.proposedRecord, null, 2) + "\n");
  }

  // Move resolved items out of the active pending queue.
  const resolvedDir = path.join(PENDING_DIR, "resolved");
  fs.mkdirSync(resolvedDir, { recursive: true });
  fs.writeFileSync(path.join(resolvedDir, `${id}.json`), JSON.stringify(pending, null, 2));
  fs.unlinkSync(filePath);
}
