import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ProfessionIcon } from "@/components/profession/ProfessionIcon";
import type { ProfessionSummary } from "@/types";

export function PopularProfessions({ professions }: { professions: ProfessionSummary[] }) {
  return (
    <section className="container py-16">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Popular Professions</h2>
          <p className="mt-2 text-muted-foreground">Start with your license type to see every state's rules.</p>
        </div>
        <Link href="/professions" className="text-sm font-medium text-primary hover:underline">
          View all professions →
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {professions.map((profession) => (
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
  );
}
