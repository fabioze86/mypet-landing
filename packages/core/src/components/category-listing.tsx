import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getCatalog, getCategories } from "../catalog";
import { parsePage, collectCategorySubtreeIds, getCategoryPath } from "../catalog-utils";
import { ProductCard } from "./product-card";
import type { Palette } from "../theme";
import { getBanners } from "../banners";
import type { Channel } from "../channels";
import { breadcrumbJsonLd } from "../seo";

export async function CategoryListing({
  slug,
  page: pageRaw,
  channel,
  palette,
  domain,
}: {
  slug: string;
  page?: string;
  channel: string;
  palette: Palette;
  domain: string;
}) {
  const page = parsePage(pageRaw);
  const categories = await getCategories();
  const node = categories.find((c) => c.slug === slug);

  if (!node) {
    notFound();
  }

  const path = getCategoryPath(categories, node.id);
  const breadcrumbItems = [
    { name: "Início", path: "/" },
    ...path.map((c) => ({ name: c.name, path: `/categoria/${c.slug}` })),
  ];
  const children = categories.filter((c) => c.parentId === node.id);
  const subtreeIds = collectCategorySubtreeIds(categories, node.id);
  const catalog = await getCatalog({ categoryId: subtreeIds, page, channel });
  const [categoryBanner] = await getBanners(channel as Channel, "categoria", node.id);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(breadcrumbItems, domain)) }}
      />
      <nav aria-label="Breadcrumb" style={{ marginBottom: 16 }}>
        <ol style={{ display: "flex", flexWrap: "wrap", gap: 6, listStyle: "none", margin: 0, padding: 0, fontSize: 13, color: palette.gray600 }}>
          <li>
            <Link href="/" style={{ color: palette.gray600, textDecoration: "none" }}>Início</Link>
          </li>
          {path.map((c, i) => (
            <li key={c.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span aria-hidden="true">/</span>
              {i === path.length - 1 ? (
                <span style={{ color: palette.navy, fontWeight: 700 }} aria-current="page">{c.name}</span>
              ) : (
                <Link href={`/categoria/${c.slug}`} style={{ color: palette.gray600, textDecoration: "none" }}>{c.name}</Link>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <h1 style={{ fontSize: 26, fontWeight: 900, color: palette.navy, marginBottom: 16 }}>{node.name}</h1>

      {categoryBanner && (
        <div style={{ marginBottom: 20 }}>
          {categoryBanner.linkUrl ? (
            <a href={categoryBanner.linkUrl} style={{ position: "relative", display: "block", width: "100%", aspectRatio: "3 / 1", borderRadius: 16, overflow: "hidden" }}>
              <Image
                src={categoryBanner.imageUrl}
                alt={categoryBanner.title ?? node.name}
                fill
                sizes="(max-width: 768px) 100vw, 1200px"
                style={{ objectFit: "cover" }}
              />
            </a>
          ) : (
            <div style={{ position: "relative", width: "100%", aspectRatio: "3 / 1", borderRadius: 16, overflow: "hidden" }}>
              <Image
                src={categoryBanner.imageUrl}
                alt={categoryBanner.title ?? node.name}
                fill
                sizes="(max-width: 768px) 100vw, 1200px"
                style={{ objectFit: "cover" }}
              />
            </div>
          )}
        </div>
      )}

      {children.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          {children.map((child) => (
            <Link key={child.id} href={`/categoria/${child.slug}`} className="cat-btn" style={{ textDecoration: "none" }}>
              {child.name}
            </Link>
          ))}
        </div>
      )}

      <p style={{ fontSize: 14, color: palette.gray600, marginBottom: 20 }}>
        {catalog.total} produtos em {node.name}
      </p>

      {catalog.items.length === 0 ? (
        <p style={{ fontSize: 15, color: palette.gray600, padding: "40px 0", textAlign: "center" }}>
          Nenhum produto encontrado nesta categoria.
        </p>
      ) : (
        <div className="products-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 22 }}>
          {catalog.items.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {catalog.totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 16, marginTop: 36 }}>
          {page > 1 ? (
            <Link href={`/categoria/${slug}?page=${page - 1}`} className="cat-btn">← Anterior</Link>
          ) : (
            <span className="cat-btn" style={{ opacity: 0.4, pointerEvents: "none" }} aria-disabled="true">← Anterior</span>
          )}
          <span style={{ fontSize: 14, color: palette.gray600 }}>Página {page} de {catalog.totalPages}</span>
          {page < catalog.totalPages ? (
            <Link href={`/categoria/${slug}?page=${page + 1}`} className="cat-btn">Próxima →</Link>
          ) : (
            <span className="cat-btn" style={{ opacity: 0.4, pointerEvents: "none" }} aria-disabled="true">Próxima →</span>
          )}
        </div>
      )}
    </>
  );
}
