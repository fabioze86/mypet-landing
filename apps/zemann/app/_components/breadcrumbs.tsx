import Link from "next/link";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { JsonLd } from "./json-ld";

export function Breadcrumbs({ items }: { items: { name: string; path: string }[] }) {
  return (
    <nav aria-label="Você está em" className="text-sm text-muted">
      <JsonLd data={breadcrumbJsonLd(items)} />
      <ol className="flex flex-wrap gap-2">
        {items.map((item, index) => (
          <li key={item.path} className="flex gap-2">
            {index > 0 ? <span aria-hidden>/</span> : null}
            {index === items.length - 1 ? (
              <span aria-current="page">{item.name}</span>
            ) : (
              <Link href={item.path} className="hover:text-accent">{item.name}</Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
