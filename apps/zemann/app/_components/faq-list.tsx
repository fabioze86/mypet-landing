import type { FaqItem } from "@/lib/content";
import { faqJsonLd } from "@/lib/jsonld";
import { JsonLd } from "./json-ld";

export function FaqList({
  items,
  headingLevel,
  withJsonLd = false,
}: {
  items: FaqItem[];
  headingLevel: 2 | 3;
  withJsonLd?: boolean;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <div className="divide-y divide-line">
      {withJsonLd && items.length > 0 ? <JsonLd data={faqJsonLd(items)} /> : null}
      {items.map((item) => (
        <div key={item.q} className="py-6">
          <Heading className="text-lg font-semibold text-ink">{item.q}</Heading>
          <p className="mt-2 leading-relaxed text-ink-soft">{item.a}</p>
        </div>
      ))}
    </div>
  );
}
