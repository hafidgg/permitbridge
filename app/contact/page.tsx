import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { buildMetadata } from "@/lib/seo";
import { SITE_NAME } from "@/lib/constants";
import { Mail, Flag, Handshake } from "lucide-react";

export const metadata: Metadata = buildMetadata({
  title: "Contact Us",
  description: `Get in touch with the ${SITE_NAME} team — corrections, partnerships, or general questions.`,
  path: "/contact",
});

const CONTACT_CHANNELS = [
  {
    icon: Flag,
    title: "Report an Error",
    description: "Spot outdated or incorrect licensing information? Tell us which page and what changed.",
    email: "corrections@permitbridge.com",
  },
  {
    icon: Handshake,
    title: "Partnerships",
    description: "Continuing-education providers, exam prep companies, and relocation services can reach our partnerships team here.",
    email: "partners@permitbridge.com",
  },
  {
    icon: Mail,
    title: "General Inquiries",
    description: "Anything else — press, feedback, or questions about how PermitBridge works.",
    email: "hello@permitbridge.com",
  },
];

export default function ContactPage() {
  return (
    <div>
      <Breadcrumbs items={[{ name: "Contact", url: "/contact" }]} />
      <div className="container max-w-3xl pb-16">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Contact Us</h1>
        <p className="mt-3 text-muted-foreground">
          We read every message, especially corrections — accuracy is the entire point of {SITE_NAME}.
        </p>

        <div className="mt-10 space-y-6">
          {CONTACT_CHANNELS.map((channel) => (
            <div key={channel.title} className="flex gap-4 rounded-lg border border-border p-6">
              <channel.icon className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <h2 className="font-semibold">{channel.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{channel.description}</p>
                <a href={`mailto:${channel.email}`} className="mt-2 inline-block text-sm font-medium text-primary hover:underline">
                  {channel.email}
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
