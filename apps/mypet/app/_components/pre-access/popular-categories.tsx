// Server component. Recebe as categorias e um mapa opcional de imagens
// (id -> url) montado em page.tsx via getCategoryThumbs. Só nome + foto de
// categoria — nenhum preço, nenhum ProductCard.

type Category = { id: string; slug: string; name: string };

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function PopularCategories({
  categories,
  thumbs = {},
}: {
  categories: readonly Category[];
  thumbs?: Record<string, string>;
}) {
  return (
    <section id="categorias" className="pa-section" aria-labelledby="categorias-title">
      <div className="pa-wrap">
        <h2 id="categorias-title" className="pa-h2">Categorias mais procuradas</h2>
        <p className="pa-sec-lead">
          Reconheça o mix da sua loja. O catálogo completo abre depois do acesso.
        </p>
        <ul className="pa-cat-grid" style={{ listStyle: "none", padding: 0 }}>
          {categories.map((category) => {
            const src = thumbs[category.id];
            return (
              <li key={category.id}>
                <a className="pa-cat-tile" href="#acesso">
                  <span className="pa-cat-media">
                    {src ? (
                      <img src={src} alt="" loading="lazy" decoding="async" />
                    ) : (
                      <span className="pa-cat-fallback" aria-hidden>
                        {initials(category.name)}
                      </span>
                    )}
                  </span>
                  <span className="pa-cat-name">{category.name}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
