import { Suspense } from "react";
import type { Metadata } from "next";
import { VITRINES } from "@/lib/vitrines";
import { VitrinePageBody } from "../../../_components/vitrine/vitrine-page";

export const metadata: Metadata = { title: "Linha de Fábrica | My Pet Brasil", robots: { index: false, follow: false } };

async function Body({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> }) {
  const { slug } = await params;
  return <VitrinePageBody vitrine={VITRINES.fabrica} searchParams={searchParams} categoriaSlug={slug} />;
}

export default function FabricaCategoriaPage(props: { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> }) {
  return (
    <Suspense fallback={null}>
      <Body {...props} />
    </Suspense>
  );
}
