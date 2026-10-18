import { getGuide, listGuides } from "@/lib/content";
import { OG_SIZE, renderOg } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Guia da Zemann";

// Gera uma imagem por guia no build (mesma fonte da página) e responde 404 para slug desconhecido.
export const dynamicParams = false;

export function generateStaticParams() {
  return listGuides().map((guide) => ({ slug: guide.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return renderOg(getGuide(slug)?.title ?? "Guias da Zemann", "Guia");
}
