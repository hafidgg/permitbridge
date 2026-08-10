import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd } from "@/lib/seo";

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  const fullItems = [{ name: "Home", url: "/" }, ...items];

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(fullItems)} />
      <nav aria-label="Breadcrumb" className="container py-4">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          {fullItems.map((item, index) => {
            const isLast = index === fullItems.length - 1;
            return (
              <li key={item.url} className="flex items-center gap-1.5">
                {index === 0 ? (
                  <Link href={item.url} className="flex items-center hover:text-foreground" aria-label="Home">
                    <Home className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                ) : isLast ? (
                  <span className="font-medium text-foreground" aria-current="page">
                    {item.name}
                  </span>
                ) : (
                  <Link href={item.url} className="hover:text-foreground">
                    {item.name}
                  </Link>
                )}
                {!isLast && <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
