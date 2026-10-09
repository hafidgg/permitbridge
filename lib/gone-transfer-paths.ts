import fs from "node:fs";
import path from "node:path";
import type { TransferRule } from "@/types";
import type { SourceRecord } from "@/types/knowledge-base";
import { isTradeTransferPublishable } from "@/lib/knowledge-base/trade-transfer-gate";

/**
 * /transfer/{profession}/{from}/{to} paths whose data/transfers record fails
 * the publish gate. Reads data/ and sources/ directly (no "server-only"
 * imports) so the prebuild script and tests can call it.
 */
export function computeGoneTransferPaths(root = process.cwd()): string[] {
  const sourcesDir = path.join(root, "data", "knowledge-base", "sources");
  const sources: SourceRecord[] = fs
    .readdirSync(sourcesDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(sourcesDir, f), "utf-8")));
  const resolve = (url: string) => sources.find((s) => s.website === url);
  const transfersDir = path.join(root, "data", "transfers");
  const gone: string[] = [];
  for (const profession of fs.readdirSync(transfersDir)) {
    const dir = path.join(transfersDir, profession);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json"))) {
      const rule: TransferRule = JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8"));
      if (!isTradeTransferPublishable(rule, resolve).publishable) {
        gone.push(`/transfer/${rule.profession}/${rule.fromState}/${rule.toState}`);
      }
    }
  }
  return gone.sort();
}
