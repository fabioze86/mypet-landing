import { Suspense } from "react";
import { notFound } from "next/navigation";
import { isProductInChannel } from "@mypet/core/catalog";
import { VITRINES } from "@/lib/vitrines";
import ProductPage from "../../../produtos/[id]/page";

export const metadata = { robots: { index: false, follow: false } };

// exported for tests
export async function FabricaProdutoBody({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await isProductInChannel(id, VITRINES.fabrica.alsoInChannel!))) notFound();
  return <ProductPage params={params} />;
}

export default function FabricaProdutoPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={null}>
      <FabricaProdutoBody params={params} />
    </Suspense>
  );
}
