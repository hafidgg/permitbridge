import { ShieldCheck } from "lucide-react";

/**
 * Static, factual explanation of the actual verification system — no
 * exaggerated claims. Every sentence here corresponds to a real,
 * implemented rule in lib/knowledge-base/ (Phases 2.1-3.2), not aspirational language.
 */
export function TrustMethodologySection() {
  return (
    <section className="rounded-xl border border-border p-6">
      <div className="mb-3 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
        <h2 className="text-lg font-bold">How PermitBridge Verifies Information</h2>
      </div>
      <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
        <li>Official government and licensing-board sources are preferred and are labeled distinctly from other sources.</li>
        <li>When only a secondary (non-official) source could be found, it is explicitly labeled "Secondary Source" rather than presented as official.</li>
        <li>When two official sources disagree, both are preserved and a documented, deterministic rule — not a guess — decides which is more specific to the exact fact in question.</li>
        <li>Anything we could not find on the board's own pages is listed under "Not published by the board" — it is never guessed, estimated, or copied from another state.</li>
        <li>
          Each requirement shows the source it came from and the date it was last researched. Research is not the same as a person reviewing and
          confirming a field, so no field on this page is labeled &quot;verified&quot;.
        </li>
      </ol>
    </section>
  );
}
