import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteNav } from "@mypet/core/components/site-nav";
import { getCategories } from "@mypet/core/catalog";
import { getBalcaoEligibleProducts } from "@mypet/core/balcao";
import type { Channel } from "@mypet/core/channels";
import { clientConfig } from "@/client.config";
import { requireBuyer } from "@/lib/require-buyer";
import { BalcaoContent } from "./balcao-content";

const { palette: PALETTE } = clientConfig;

export const metadata: Metadata = {
  title: "Balcão de Negócios | My Pet Brasil",
  robots: { index: false, follow: false },
};

export default function BalcaoPage() {
  return (
    <Suspense fallback={null}>
      <BalcaoPageBody />
    </Suspense>
  );
}

// exported for tests
export async function BalcaoPageBody() {
  const buyer = await requireBuyer();
  if (!buyer) redirect("/entrar");

  const channel = clientConfig.catalogChannel as Channel;
  const [categories, products] = await Promise.all([
    getCategories(),
    getBalcaoEligibleProducts(channel),
  ]);

  const serializable = products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    brand: p.brand,
    img: p.img,
    categoryId: p.categoryId,
    basePrice: p.basePrice,
    rule: p.rule,
  }));

  return (
    <div style={{ background: PALETTE.gray50, minHeight: "100vh", color: PALETTE.gray800 }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { margin: 0; }

        .cta-primary {
          background: ${PALETTE.pink};
          color: ${PALETTE.white};
          border: none;
          border-radius: 100px;
          padding: 12px 24px;
          font-family: var(--font-nunito), sans-serif;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
          transition: background 0.2s;
        }
        .cta-primary:hover:not(:disabled) { background: ${PALETTE.pinkDark}; }
        .cta-primary:disabled {
          background: ${PALETTE.gray200};
          color: ${PALETTE.gray400};
          cursor: not-allowed;
        }
      `}</style>

      {/* TODO(task-9): balcaoHref — SiteNav ainda não aceita essa prop */}
      <SiteNav categories={categories} />

      <main style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px 80px" }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: PALETTE.navy, marginBottom: 6 }}>
          Balcão de Negócios
        </h1>
        <p style={{ fontSize: 14, color: PALETTE.gray600, marginBottom: 24, maxWidth: 640 }}>
          Condições diferenciadas por quantidade em produtos selecionados. Escolha os itens,
          informe as quantidades e envie a solicitação — nossa equipe valida e retorna com a
          condição confirmada.
        </p>
        {serializable.length === 0 ? (
          <div
            style={{
              background: PALETTE.white,
              border: `1px solid ${PALETTE.gray200}`,
              borderRadius: 16,
              padding: 32,
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: 15, fontWeight: 700, color: PALETTE.navy }}>
              Nenhum produto no Balcão de Negócios no momento.
            </p>
          </div>
        ) : (
          <BalcaoContent products={serializable} palette={PALETTE} />
        )}
      </main>
    </div>
  );
}
