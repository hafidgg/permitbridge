import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAllStates } from "@/lib/data";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "All States — Professional License Reciprocity by State",
  description:
    "Browse every US state covered by PermitBridge and see whether it has Universal License Recognition, which professions it licenses, and how transfers work.",
  path: "/states",
});

export default function StatesPage() {
  const states = getAllStates();
  const regions = Array.from(new Set(states.map((s) => s.region)));

  return (
    <div>
      <Breadcrumbs items={[{ name: "States", url: "/states" }]} />

      <div className="container pb-16">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">All States</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Select a state to see its licensing authority, Universal License Recognition status, and transfer rules by
          profession.
        </p>

        {regions.map((region) => (
          <section key={region} className="mt-10">
            <h2 className="mb-4 text-lg font-semibold">{region}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {states
                .filter((s) => s.region === region)
                .map((state) => (
                  <Link key={state.slug} href={`/state/${state.slug}`}>
                    <Card className="h-full transition-shadow hover:shadow-md">
                      <CardHeader>
                        <div className="mb-2 flex items-center justify-between">
                          <CardTitle>{state.name}</CardTitle>
                          {state.isUlrState && <Badge variant="success">ULR State</Badge>}
                        </div>
                        <CardDescription>{state.licensingAuthorityNote}</CardDescription>
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
