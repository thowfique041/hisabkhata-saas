import { ChevronDown } from 'lucide-react';

/**
 * Accordion built on <details>: keyboard and screen-reader support for free, works without JS.
 * Also emits FAQPage structured data so answers can show in search results.
 */
export function Faq({
  items,
  title,
  id,
}: {
  items: { q: string; a: string }[];
  title: string;
  id: string;
}) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((i) => ({
      '@type': 'Question',
      name: i.q,
      acceptedAnswer: { '@type': 'Answer', text: i.a },
    })),
  };
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-2xl font-semibold tracking-tight">
        {title}
      </h2>
      <div className="mt-8 divide-y border-y">
        {items.map((i) => (
          <details key={i.q} className="group py-1 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-6 rounded-sm py-4 font-medium transition-colors hover:text-foreground/80">
              {i.q}
              <ChevronDown
                className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <p className="max-w-3xl pb-5 text-muted-foreground">{i.a}</p>
          </details>
        ))}
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </section>
  );
}
