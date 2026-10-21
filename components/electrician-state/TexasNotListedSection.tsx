const TDLR_OUT_OF_STATE = "https://www.tdlr.texas.gov/electricians/out-of-state.htm";

/**
 * Replaces the former /transfer/electrician/{california,florida}/texas pages
 * (308 here since 2026-10-21), which differed only in the origin state's name.
 * Every statement is TDLR's own out-of-state page, read in raw text 2026-10-21.
 */
export function TexasNotListedSection() {
  return (
    <section className="mt-10 rounded-xl border border-border p-6">
      <h2 className="mb-3 text-2xl font-bold tracking-tight">If your state isn&apos;t on TDLR&apos;s lists</h2>
      <div className="space-y-3 text-sm leading-relaxed">
        <p>
          TDLR&apos;s out-of-state page says &ldquo;Texas has reciprocal licensing agreements with the states listed below&rdquo; and gives one list
          for Master Electrician and one for Journeyman Electrician (shown in each section above). California and Florida, for example, are on
          neither list, so a California or Florida electrician license has no reciprocity route into Texas on that page.
        </p>
        <p>
          For every other license type, the page says: &ldquo;Currently there are no reciprocal licensing agreements for any other license
          types.&rdquo;
        </p>
        <p>
          The out-of-state page does not describe the route for a license from an unlisted state. TDLR&apos;s page invites questions about the
          application process by email or at (512) 463-6599.
        </p>
        <p className="text-xs text-muted-foreground">
          Source:{" "}
          <a href={TDLR_OUT_OF_STATE} target="_blank" rel="noopener noreferrer nofollow" className="text-primary hover:underline">
            TDLR, Transfer Your Out-of-State Electrician License to Texas
          </a>
        </p>
      </div>
    </section>
  );
}
