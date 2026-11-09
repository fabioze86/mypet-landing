import { cacheLife } from "next/cache";
import { BLOG_ORIGIN } from "./blog-origin";

export { BLOG_HREF, BLOG_ORIGIN } from "./blog-origin";

export type BlogPost = {
  url: string;
  title: string;
  excerpt: string;
  category: string;
  hero: string | null;
};

// O índice da busca do blog (/blog/busca.json) já vem ordenado do mais novo ao
// mais antigo; aproveitamos ele em vez de criar outro endpoint no Astro.
export function parseBlogIndex(data: unknown, limit: number): BlogPost[] {
  if (!Array.isArray(data)) return [];
  const posts: BlogPost[] = [];
  for (const item of data) {
    if (posts.length >= limit) break;
    if (!item || typeof item !== "object") continue;
    const { url, title, excerpt, category, hero } = item as Record<string, unknown>;
    if (typeof url !== "string" || !url.startsWith("/blog/") || typeof title !== "string") continue;
    posts.push({
      url,
      title,
      excerpt: typeof excerpt === "string" ? excerpt : "",
      category: typeof category === "string" ? category : "",
      hero: typeof hero === "string" && hero.startsWith("https://") ? hero : null,
    });
  }
  return posts;
}

// Lança em caso de falha para o erro não ficar em cache; quem chama decide o fallback.
async function fetchBlogIndex(): Promise<unknown> {
  "use cache";
  cacheLife("hours");
  const res = await fetch(`${BLOG_ORIGIN}/blog/busca.json`, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`blog index HTTP ${res.status}`);
  return res.json();
}

export async function getLatestBlogPosts(limit = 3): Promise<BlogPost[]> {
  try {
    return parseBlogIndex(await fetchBlogIndex(), limit);
  } catch (err) {
    console.error("[blog] falha ao ler os artigos recentes", err);
    return [];
  }
}
