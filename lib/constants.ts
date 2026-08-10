export const SITE_NAME = "PermitBridge";
export const SITE_TAGLINE = "Know exactly what it takes to move your license.";
export const SITE_DESCRIPTION =
  "PermitBridge is the free, independent reference for transferring professional and trade licenses between US states — reciprocity, endorsement, exams, fees, and step-by-step timelines.";

export const NAV_LINKS = [
  { href: "/professions", label: "Professions" },
  { href: "/states", label: "States" },
  { href: "/guides", label: "Guides" },
  { href: "/blog", label: "Blog" },
  { href: "/about", label: "About" },
] as const;

export const FOOTER_LINKS = {
  Company: [
    { href: "/about", label: "About Us" },
    { href: "/contact", label: "Contact" },
    { href: "/blog", label: "Blog" },
  ],
  Resources: [
    { href: "/professions", label: "All Professions" },
    { href: "/states", label: "All States" },
    { href: "/guides", label: "Guides" },
    { href: "/search", label: "Search" },
  ],
  Legal: [
    { href: "/privacy", label: "Privacy Policy" },
    { href: "/terms", label: "Terms of Service" },
    { href: "/disclaimer", label: "Disclaimer" },
  ],
} as const;
