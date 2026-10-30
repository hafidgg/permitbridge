import Link from "next/link";
import { getGuidesLinkedFrom } from "@/lib/data";

/** Links to the guides whose linkedFrom names this page. Renders nothing when there are none. */
export function RelatedGuides({ pagePath, className = "mt-12" }: { pagePath: string; className?: string }) {
  const guides = getGuidesLinkedFrom(pagePath);
  if (guides.length === 0) return null;
  return (
    <section className={`${className} rounded-xl border border-border bg-muted/20 p-6`}>
      <h2 className="mb-3 text-xl font-bold tracking-tight">Related guides</h2>
      <ul className="space-y-3">
        {guides.map((g) => (
          <li key={g.slug}>
            <Link href={`/guides/${g.slug}`} className="font-medium underline underline-offset-4">
              {g.title}
            </Link>
            <p className="mt-1 text-sm text-muted-foreground">{g.description}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
