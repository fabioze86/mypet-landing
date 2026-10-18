import { getCase, listCases } from "@/lib/content";
import { OG_SIZE, renderOg } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Case da Zemann";

// Gera uma imagem por case no build (mesma fonte da página) e responde 404 para slug desconhecido.
export const dynamicParams = false;

export function generateStaticParams() {
  return listCases().map((item) => ({ slug: item.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = getCase(slug);
  return renderOg(item?.title ?? "Cases da Zemann", item ? `Case · ${item.client}` : "Case");
}
