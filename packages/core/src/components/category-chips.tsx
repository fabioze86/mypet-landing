import Link from "next/link";
import { topLevelCategories, type CategoryNode } from "../catalog-utils";

export function CategoryChips({ categories }: { categories: CategoryNode[] }) {
  const topLevel = topLevelCategories(categories);

  return (
    <div className="chip-row">
      <Link href="/" className="cat-btn active" style={{ textDecoration: "none" }}>
        Todas
      </Link>
      {topLevel.map((c) => (
        <Link key={c.id} href={`/categoria/${c.slug}`} className="cat-btn" style={{ textDecoration: "none" }}>
          {c.name}
        </Link>
      ))}
    </div>
  );
}
