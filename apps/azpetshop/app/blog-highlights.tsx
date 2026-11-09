import { clientConfig } from "@/client.config";
import { BLOG_HREF, getLatestBlogPosts } from "@/lib/blog";

const { palette: PALETTE } = clientConfig;

// Vitrine dos artigos mais recentes do blog na home. Se o blog não responder, a
// seção some em vez de quebrar a página. Links são <a>: o blog é rewrite externo.
export async function BlogHighlights() {
  const posts = await getLatestBlogPosts(3);
  if (posts.length === 0) return null;

  return (
    <section aria-labelledby="blog-highlights-title" style={{ maxWidth: 1200, margin: "0 auto", padding: "8px 24px 40px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
        <div>
          <span className="eyebrow">Do nosso blog</span>
          <h2 id="blog-highlights-title" style={{ fontFamily: "var(--font-baloo)", fontSize: 28, fontWeight: 800, color: PALETTE.navy }}>
            Dicas para cuidar do seu pet
          </h2>
        </div>
        <a href={BLOG_HREF} className="blog-all-link">
          Ver todos os artigos →
        </a>
      </div>
      <ul className="blog-grid">
        {posts.map((p) => (
          <li key={p.url}>
            <a href={p.url} className="blog-card">
              <div className="blog-card-img">
                {p.hero ? (
                  // eslint-disable-next-line @next/next/no-img-element -- capa vem do CDN do blog, fora do next/image
                  <img src={p.hero} alt="" loading="lazy" />
                ) : (
                  <span aria-hidden="true">🐾</span>
                )}
              </div>
              <div style={{ padding: 18 }}>
                {p.category && <span className="blog-card-cat">{p.category}</span>}
                <b className="blog-card-title">{p.title}</b>
                <span className="blog-card-excerpt">{p.excerpt}</span>
              </div>
            </a>
          </li>
        ))}
      </ul>
      <style>{`
        .blog-all-link { font-weight: 800; font-size: 15px; color: ${PALETTE.orange}; text-decoration: none; }
        .blog-all-link:hover { text-decoration: underline; }
        .blog-grid { list-style: none; display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        .blog-card {
          display: flex; flex-direction: column; height: 100%; background: ${PALETTE.white};
          border: 2px solid ${PALETTE.navy}; border-radius: 20px; overflow: hidden;
          text-decoration: none; color: inherit; transition: transform 0.2s, box-shadow 0.2s;
        }
        .blog-card:hover { transform: translateY(-4px); box-shadow: 5px 5px 0 ${PALETTE.navy}; }
        .blog-card:focus-visible { outline: 3px solid ${PALETTE.orange}; outline-offset: 3px; }
        .blog-card-img {
          aspect-ratio: 16 / 10; background: ${PALETTE.gray100}; display: flex;
          align-items: center; justify-content: center; font-size: 40px; overflow: hidden;
        }
        .blog-card-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .blog-card-cat {
          display: block; font-size: 11px; font-weight: 800; letter-spacing: 0.12em;
          text-transform: uppercase; color: ${PALETTE.pink}; margin-bottom: 6px;
        }
        .blog-card-title {
          display: block; font-family: var(--font-baloo), sans-serif; font-size: 18px;
          line-height: 1.2; color: ${PALETTE.navy};
        }
        .blog-card-excerpt {
          display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
          margin-top: 8px; font-size: 14px; line-height: 1.5; color: ${PALETTE.gray600};
        }
        @media (max-width: 900px) { .blog-grid { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  );
}
