import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { getCategoriesWithProducts } from "@mypet/core/catalog";
import { collectCategorySubtreeIds } from "@mypet/core/catalog-utils";
import { CatalogSection } from "@mypet/core/components/catalog-section";
import { CategoryChips } from "@mypet/core/components/category-chips";
import { LeadGateProvider } from "@mypet/core/components/lead-gate";
import { clientConfig } from "@/client.config";
import { requireBuyer } from "@/lib/require-buyer";
import { agendarLocalizacao } from "@/lib/localizacao";
import { zonaDoComprador } from "@/lib/zona";
import type { Vitrine } from "@/lib/vitrines";
import { BUYER_STYLES } from "../buyer-area/styles";
import { HubNav } from "../hub/hub-nav";
import { cadastroHref, viewerFromBuyer, type HubDoorId } from "../hub/doors";
import { FreteFaixa } from "../frete/frete-faixa";
import { VitrineCartBar } from "./vitrine-cart-bar";
import { VITRINE_STYLES } from "./vitrine-styles";

const { palette: PALETTE } = clientConfig;
const CHANNEL = clientConfig.catalogChannel;

export async function VitrinePageBody({
  vitrine,
  searchParams,
  categoriaSlug,
}: {
  vitrine: Vitrine;
  searchParams: Promise<{ q?: string; brand?: string; page?: string }>;
  categoriaSlug?: string;
}) {
  const buyer = await requireBuyer();
  if (!buyer) redirect(cadastroHref(vitrine.homePath));
  agendarLocalizacao(buyer);

  const categories = await getCategoriesWithProducts(CHANNEL, vitrine.alsoInChannel);
  let categoryId: string[] | undefined;
  let categoriaNome: string | undefined;
  if (categoriaSlug) {
    const categoria = categories.find((c) => c.slug === categoriaSlug);
    if (!categoria) notFound();
    categoryId = collectCategorySubtreeIds(categories, categoria.id);
    categoriaNome = categoria.name;
  }

  const zona = zonaDoComprador(buyer);
  const { q, brand, page } = await searchParams;
  const current: HubDoorId = vitrine.id === "fabrica" ? "fabrica" : "produtos";

  return (
    <div className="ba-page">
      <style>{BUYER_STYLES}</style>
      <style>{VITRINE_STYLES}</style>
      <LeadGateProvider>
        <HubNav viewer={viewerFromBuyer(buyer)} current={current} />
        <main className="ba-main">
          <h1 className="ba-h1">{categoriaNome ? `${vitrine.rotulo} · ${categoriaNome}` : vitrine.rotulo}</h1>
          <FreteFaixa regra={vitrine.regraFrete} zona={zona} palette={PALETTE} />
          <CategoryChips categories={categories} hrefBase={vitrine.basePath} allHref={vitrine.homePath} />
          <Suspense fallback={<p style={{ color: PALETTE.gray600 }}>Carregando produtos…</p>}>
            <CatalogSection
              q={q}
              brand={brand}
              page={page}
              channel={CHANNEL}
              alsoInChannel={vitrine.alsoInChannel}
              categoryId={categoryId}
              palette={PALETTE}
              addControl="stepper"
            />
          </Suspense>
        </main>
        <VitrineCartBar vitrine={vitrine} zona={zona} palette={PALETTE} />
      </LeadGateProvider>
    </div>
  );
}
