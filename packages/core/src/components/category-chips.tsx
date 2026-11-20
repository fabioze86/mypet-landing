import Link from "next/link";
import { topLevelCategories, type CategoryNode } from "../catalog-utils";

export function CategoryChips({
  categories,
  hrefBase = "",
  allHref = "/",
}: {
  categories: CategoryNode[];
  hrefBase?: string;
  allHref?: string;
}) {
  const topLevel = topLevelCategories(categories);

  if (topLevel.length === 0) return null;

  return (
    <div className="chip-row">
      <Link href={allHref} className="cat-btn active" style={{ textDecoration: "none" }}>
        Todas
      </Link>
      {topLevel.map((c) => (
        <Link key={c.id} href={`${hrefBase}/categoria/${c.slug}`} className="cat-btn" style={{ textDecoration: "none" }}>
          {c.name}
        </Link>
      ))}
    </div>
  );
}
