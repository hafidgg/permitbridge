import Link from "next/link";
import { FOOTER_LINKS, SITE_NAME, SITE_TAGLINE } from "@/lib/constants";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="container py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <p className="font-bold text-lg">{SITE_NAME}</p>
            <p className="mt-2 text-sm text-muted-foreground">{SITE_TAGLINE}</p>
          </div>

          {Object.entries(FOOTER_LINKS).map(([section, links]) => (
            <div key={section}>
              <p className="text-sm font-semibold">{section}</p>
              <ul className="mt-3 space-y-2">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-muted-foreground hover:text-foreground">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 border-t border-border pt-6 text-xs text-muted-foreground">
          <p>
            © {year} {SITE_NAME}. All rights reserved. {SITE_NAME} is an independent reference site and is not
            affiliated with any state licensing board or government agency. Always confirm requirements with the
            official licensing authority before applying.
          </p>
        </div>
      </div>
    </footer>
  );
}
