import { getCatalog, getBrands } from "../catalog";
import { parsePage } from "../catalog-utils";
import { buildCatalogQuery } from "../querystring";
import { ProductCard } from "./product-card";
import { PALETTE } from "../theme";

export async function CatalogSection({
  q,
  brand,
  page: pageRaw,
}: {
  q?: string;
  brand?: string;
  page?: string;
}) {
  const page = parsePage(pageRaw);
  const [catalog, brands] = await Promise.all([
    getCatalog({ q, brand, page, channel: "mypetbrasil" }),
    getBrands("mypetbrasil"),
  ]);

  return (
    <>
      {/* controles */}
      <form method="get" style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por nome..."
          aria-label="Buscar produtos por nome"
          style={{ flex: "1 1 220px", padding: "10px 14px", borderRadius: 10, border: `1px solid ${PALETTE.gray200}`, fontSize: 14 }}
        />
        <select
          name="brand"
          defaultValue={brand ?? ""}
          aria-label="Filtrar por marca"
          style={{ padding: "10px 14px", borderRadius: 10, border: `1px solid ${PALETTE.gray200}`, fontSize: 14, background: PALETTE.white }}
        >
          <option value="">Todas as marcas</option>
          {brands.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <button type="submit" className="cta-primary" style={{ padding: "10px 20px", fontSize: 14 }}>
          Filtrar
        </button>
      </form>

      <p style={{ fontSize: 14, color: PALETTE.gray600, marginBottom: 20 }}>
        {catalog.total} produtos{brand ? ` da marca ${brand}` : ""}{q ? ` para "${q}"` : ""}
      </p>

      {/* grade */}
      {catalog.items.length === 0 ? (
        <p style={{ fontSize: 15, color: PALETTE.gray600, padding: "40px 0", textAlign: "center" }}>
          Nenhum produto encontrado. Tente outra busca ou marca.
        </p>
      ) : (
        <div className="products-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 20 }}>
          {catalog.items.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {/* paginação */}
      {catalog.totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 16, marginTop: 36 }}>
          {page > 1 ? (
            <a href={buildCatalogQuery({ q, brand, page: page - 1 })} className="cat-btn">← Anterior</a>
          ) : (
            <span className="cat-btn" style={{ opacity: 0.4, pointerEvents: "none" }} aria-disabled="true">← Anterior</span>
          )}
          <span style={{ fontSize: 14, color: PALETTE.gray600 }}>Página {page} de {catalog.totalPages}</span>
          {page < catalog.totalPages ? (
            <a href={buildCatalogQuery({ q, brand, page: page + 1 })} className="cat-btn">Próxima →</a>
          ) : (
            <span className="cat-btn" style={{ opacity: 0.4, pointerEvents: "none" }} aria-disabled="true">Próxima →</span>
          )}
        </div>
      )}
    </>
  );
}
