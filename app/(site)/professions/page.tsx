import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ProfessionIcon } from "@/components/profession/ProfessionIcon";
import { getAllProfessions } from "@/lib/data";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "All Professions — License Transfer Requirements by Trade",
  description:
    "Browse every profession covered by PermitBridge: electricians, nurses, plumbers, HVAC technicians, general contractors, and more. See state-by-state license transfer requirements.",
  path: "/professions",
});

export default function ProfessionsPage() {
  const professions = getAllProfessions();
  const categories = Array.from(new Set(professions.map((p) => p.category)));

  return (
    <div>
      <Breadcrumbs items={[{ name: "Professions", url: "/professions" }]} />

      <div className="container pb-16">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">All Professions</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Select your license type to see reciprocity, endorsement, exam, and fee requirements across every state we
          cover.
        </p>

        {categories.map((category) => (
          <section key={category} className="mt-10">
            <h2 className="mb-4 text-lg font-semibold">{category}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {professions
                .filter((p) => p.category === category)
                .map((profession) => (
                  <Link key={profession.slug} href={`/profession/${profession.slug}`}>
                    <Card className="h-full transition-shadow hover:shadow-md">
                      <CardHeader>
                        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <ProfessionIcon name={profession.icon} className="h-5 w-5 text-primary" />
                        </div>
                        <CardTitle>{profession.name}</CardTitle>
                        <CardDescription>{profession.description}</CardDescription>
                      </CardHeader>
                    </Card>
                  </Link>
                ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
