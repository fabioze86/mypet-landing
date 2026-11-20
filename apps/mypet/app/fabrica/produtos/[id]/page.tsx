import { Suspense } from "react";
import { notFound } from "next/navigation";
import { isProductInChannel } from "@mypet/core/catalog";
import { VITRINES } from "@/lib/vitrines";
import ProductPage, { generateMetadata as productMetadata } from "../../../produtos/[id]/page";

export async function generateMetadata(props: { params: Promise<{ id: string }> }) {
  const meta = await productMetadata(props);
  return { ...meta, robots: { index: false, follow: false } };
}

// exported for tests
export async function FabricaProdutoBody({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await isProductInChannel(id, VITRINES.fabrica.alsoInChannel!))) notFound();
  return <ProductPage params={params} vitrineId="fabrica" />;
}

export default function FabricaProdutoPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={null}>
      <FabricaProdutoBody params={params} />
    </Suspense>
  );
}
