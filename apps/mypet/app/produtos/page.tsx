import { Suspense } from "react";
import type { Metadata } from "next";
import { VITRINES } from "@/lib/vitrines";
import { VitrinePageBody } from "../_components/vitrine/vitrine-page";

export const metadata: Metadata = {
  title: "Produtos | My Pet Brasil",
  robots: { index: false, follow: false },
};

export default function ProdutosPage({ searchParams }: { searchParams: Promise<{ q?: string; brand?: string; page?: string }> }) {
  return (
    <Suspense fallback={null}>
      <VitrinePageBody vitrine={VITRINES.completo} searchParams={searchParams} />
    </Suspense>
  );
}
