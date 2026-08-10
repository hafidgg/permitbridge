import Link from "next/link";
import { NAV_LINKS, SITE_NAME } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { MapPinned, Search } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg" aria-label={`${SITE_NAME} home`}>
          <MapPinned className="h-6 w-6 text-primary" aria-hidden="true" />
          <span>{SITE_NAME}</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6" aria-label="Primary navigation">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/search" aria-label="Search PermitBridge">
              <Search className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Search</span>
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
