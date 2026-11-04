import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getCatalog, getCategories, getChannelCategories, queryCatalogByChannelCategory, type PhotoFilter } from "../catalog";
import type { CatalogProduct } from "../catalog-utils";
import { parsePage, collectCategorySubtreeIds, getCategoryPath } from "../catalog-utils";
import { ProductCard } from "./product-card";
import type { Palette } from "../theme";
import { getBanners } from "../banners";
import type { Channel } from "../channels";
import { breadcrumbJsonLd, jsonLdScript } from "../seo";

/** Teto da lista "Conheça também"; hoje a maior categoria tem bem menos que isso. */
const WITHOUT_PHOTO_LIMIT = 200;

export async function CategoryListing({
  slug,
  page: pageRaw,
  channel,
  palette,
  domain,
  useChannelCategories = false,
  addControl = "default",
}: {
  slug: string;
  page?: string;
  channel: string;
  palette: Palette;
  domain: string;
  useChannelCategories?: boolean;
  /** "stepper": card com − N + e "Ver opções" para produto com variações. */
  addControl?: "default" | "stepper";
}) {
  const page = parsePage(pageRaw);
  const categories = useChannelCategories ? await getChannelCategories(channel) : await getCategories();
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
  const fetchCatalog = (photo: PhotoFilter, pageNumber: number, pageSize?: number) =>
    useChannelCategories
      ? queryCatalogByChannelCategory({ channel, categoryId: node.id, page: pageNumber, photo, pageSize })
      : getCatalog({ categoryId: subtreeIds, page: pageNumber, channel, photo, pageSize });
  // A grade paginada só mostra produto com foto. Os sem foto vão para a lista
  // "Conheça também" no fim da categoria (última página da grade).
  const [catalog, withoutPhoto, [categoryBanner]] = await Promise.all([
    fetchCatalog("with", page),
    fetchCatalog("without", 1, WITHOUT_PHOTO_LIMIT),
    getBanners(channel as Channel, "categoria", node.id),
  ]);
  const totalProducts = catalog.total + withoutPhoto.total;
  const showMoreList = withoutPhoto.items.length > 0 && page >= catalog.totalPages;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbJsonLd(breadcrumbItems, domain)) }}
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
                style={{ objectFit: "contain" }}
              />
            </a>
          ) : (
            <div style={{ position: "relative", width: "100%", aspectRatio: "3 / 1", borderRadius: 16, overflow: "hidden" }}>
              <Image
                src={categoryBanner.imageUrl}
                alt={categoryBanner.title ?? node.name}
                fill
                sizes="(max-width: 768px) 100vw, 1200px"
                style={{ objectFit: "contain" }}
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
        {totalProducts} produtos em {node.name}
      </p>

      {catalog.items.length === 0 && withoutPhoto.items.length === 0 ? (
        <p style={{ fontSize: 15, color: palette.gray600, padding: "40px 0", textAlign: "center" }}>
          Nenhum produto encontrado nesta categoria.
        </p>
      ) : catalog.items.length === 0 ? null : (
        <div className="products-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 22 }}>
          {catalog.items.map((product) => (
            <ProductCard key={product.id} product={product} addControl={addControl} />
          ))}
        </div>
      )}

      {showMoreList && (
        <MoreProductsList items={withoutPhoto.items} categoryName={node.name} palette={palette} spaced={catalog.items.length > 0} />
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

function MoreProductsList({
  items,
  categoryName,
  palette,
  spaced,
}: {
  items: CatalogProduct[];
  categoryName: string;
  palette: Palette;
  spaced: boolean;
}) {
  return (
    <section aria-labelledby="conheca-tambem" style={{ marginTop: spaced ? 48 : 0 }}>
      <h2 id="conheca-tambem" style={{ fontSize: 20, fontWeight: 900, color: palette.navy, marginBottom: 4 }}>
        Conheça também
      </h2>
      <p style={{ fontSize: 14, color: palette.gray600, marginBottom: 14 }}>
        Mais itens de {categoryName}. Toque em um item para ver os detalhes.
      </p>
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          background: palette.white,
          border: `1px solid ${palette.gray200}`,
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        {items.map((product, i) => {
          const meta = [product.brand, product.sku ? `Ref. ${product.sku}` : null].filter(Boolean).join(" · ");
          return (
            <li key={product.id} style={{ borderTop: i === 0 ? "none" : `1px solid ${palette.gray200}` }}>
              <Link
                href={`/produtos/${product.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "12px 16px",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: palette.navy, overflowWrap: "anywhere" }}>
                    {product.name}
                  </span>
                  {meta && (
                    <span style={{ display: "block", fontSize: 12, color: palette.gray600, marginTop: 2 }}>{meta}</span>
                  )}
                </span>
                <span aria-hidden="true" style={{ flexShrink: 0, fontSize: 13, fontWeight: 700, color: palette.pink }}>
                  Ver →
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
