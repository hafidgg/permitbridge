import { JsonLd } from "@/components/seo/JsonLd";
import { faqJsonLd } from "@/lib/seo";
import type { FAQ as FAQType } from "@/types";

export function FAQSection({ faqs, title = "Frequently Asked Questions" }: { faqs: FAQType[]; title?: string }) {
  if (faqs.length === 0) return null;

  return (
    <section className="container py-16">
      <JsonLd data={faqJsonLd(faqs)} />
      <h2 className="mb-8 text-2xl font-bold tracking-tight md:text-3xl">{title}</h2>
      <div className="mx-auto max-w-3xl divide-y divide-border rounded-lg border border-border">
        {faqs.map((faq) => (
          <details key={faq.question} className="group p-6">
            <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
              {faq.question}
              <span className="ml-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{faq.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
