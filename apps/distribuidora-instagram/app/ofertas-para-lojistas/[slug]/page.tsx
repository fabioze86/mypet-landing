import { Suspense } from "react";
import Link from "next/link";
import { getCampaignBySlug } from "@mypet/core/offers";
import { OfferPrice } from "@mypet/core/components/offer-price";
import { CouponCard } from "@mypet/core/components/coupon-card";
import { CampaignCountdown } from "@mypet/core/components/campaign-countdown";
import { OffersErrorState } from "@mypet/core/components/offers-error-state";
import { AddToCartControl } from "@mypet/core/components/add-to-cart-control";
import { clientConfig } from "@/client.config";

const { palette: PALETTE } = clientConfig;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: `${slug} — ${clientConfig.name}` };
}

export default function CampanhaPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={<div style={{ background: PALETTE.gray50, minHeight: "100vh" }} />}>
      <CampanhaContent params={params} />
    </Suspense>
  );
}

async function CampanhaContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let campaign;
  try {
    campaign = await getCampaignBySlug(clientConfig.catalogChannel, slug);
  } catch (err) {
    console.error("[ofertas-para-lojistas/slug] erro ao carregar campanha:", err);
    return (
      <div style={{ background: PALETTE.gray50, minHeight: "100vh" }}>
        <OffersErrorState message="Não foi possível carregar esta oferta agora." />
      </div>
    );
  }

  if (campaign === null) {
    return (
      <div style={{ background: PALETTE.gray50, minHeight: "100vh", textAlign: "center", padding: "80px 24px" }}>
        <p style={{ fontSize: 18, fontWeight: 800, color: PALETTE.navy, marginBottom: 12 }}>Oferta indisponível</p>
        <p style={{ fontSize: 14, color: PALETTE.gray600, marginBottom: 24 }}>
          Essa oferta não existe mais ou não tem produtos disponíveis no momento.
        </p>
        <Link href="/ofertas-para-lojistas" style={{ color: PALETTE.pink, fontWeight: 700, textDecoration: "none" }}>
          Ver ofertas ativas →
        </Link>
      </div>
    );
  }

  const isPurchasable = campaign.status === "active";

  return (
    <div style={{ background: PALETTE.gray50, minHeight: "100vh", color: PALETTE.gray800, paddingBottom: 96 }}>
      {campaign.status === "expired" && (
        <div style={{ background: PALETTE.orange, color: PALETTE.white, textAlign: "center", padding: "10px 16px", fontSize: 13, fontWeight: 700 }}>
          Esta oferta encerrada. <Link href="/ofertas-para-lojistas" style={{ color: PALETTE.white, textDecoration: "underline" }}>Ver ofertas ativas</Link>
        </div>
      )}
      {campaign.status === "scheduled" && (
        <div style={{ background: PALETTE.cyanDark, color: PALETTE.white, textAlign: "center", padding: "10px 16px", fontSize: 13, fontWeight: 700 }}>
          Esta oferta ainda não começou.
        </div>
      )}

      <main style={{ maxWidth: 760, margin: "0 auto", padding: "24px 20px" }}>
        {campaign.badge && (
          <span
            style={{
              display: "inline-block",
              background: PALETTE.cyanLight,
              color: PALETTE.cyanDark,
              fontSize: 12,
              fontWeight: 800,
              padding: "4px 12px",
              borderRadius: 100,
              marginBottom: 12,
            }}
          >
            {campaign.badge}
          </span>
        )}

        <h1 style={{ fontSize: 24, fontWeight: 900, color: PALETTE.navy, marginBottom: 4 }}>
          {campaign.title ?? campaign.items[0]?.name}
        </h1>
        {campaign.subtitle && <p style={{ fontSize: 14, color: PALETTE.gray600, marginBottom: 16 }}>{campaign.subtitle}</p>}

        {campaign.flashOffer && campaign.endsAt && (
          <div style={{ marginBottom: 16 }}>
            <CampaignCountdown endsAt={campaign.endsAt} />
          </div>
        )}

        {campaign.items.map((item) => (
          <div key={item.id} style={{ background: PALETTE.white, border: `1px solid ${PALETTE.gray200}`, borderRadius: 16, padding: 20, marginBottom: 16 }}>
            <div style={{ position: "relative", width: "100%", aspectRatio: "4 / 3", marginBottom: 16, background: PALETTE.gray50, borderRadius: 12, overflow: "hidden" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.img} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: PALETTE.navy, marginBottom: 8 }}>{item.name}</h2>
            {item.shortDescription && <p style={{ fontSize: 13, color: PALETTE.gray600, marginBottom: 12 }}>{item.shortDescription}</p>}
            <OfferPrice listPrice={item.listPrice} promotionalPrice={item.promotionalPrice} discountPercentage={item.discountPercentage} />
            {campaign.freightMessage && (
              <p style={{ fontSize: 12, color: PALETTE.green, fontWeight: 700, margin: "8px 0" }}>{campaign.freightMessage}</p>
            )}
            {isPurchasable ? (
              <AddToCartControl
                product={{
                  id: item.productId,
                  name: item.name,
                  sku: item.cpro,
                  brand: null,
                  img: item.img,
                  campaignId: campaign.id,
                  campaignSlug: campaign.slug,
                  unitPrice: item.promotionalPrice,
                  listPrice: item.listPrice,
                }}
              />
            ) : (
              <p style={{ fontSize: 13, color: PALETTE.gray400, marginTop: 8 }}>Compra indisponível para esta oferta.</p>
            )}
          </div>
        ))}

        {campaign.coupon && <CouponCard coupon={campaign.coupon} />}

        {campaign.secondaryCtaLabel && (
          <p style={{ textAlign: "center", marginTop: 20 }}>
            <a href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? ""}`} style={{ fontSize: 13, color: PALETTE.gray600, textDecoration: "underline" }}>
              {campaign.secondaryCtaLabel}
            </a>
          </p>
        )}
      </main>

      {isPurchasable && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            background: PALETTE.white,
            borderTop: `1px solid ${PALETTE.gray200}`,
            padding: "12px 20px",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <Link
            href="/carrinho"
            style={{
              display: "block",
              width: "100%",
              maxWidth: 400,
              textAlign: "center",
              background: PALETTE.pink,
              color: PALETTE.white,
              borderRadius: 100,
              padding: "14px 0",
              fontWeight: 800,
              fontSize: 15,
              textDecoration: "none",
            }}
          >
            {campaign.primaryCtaLabel ?? "Ver carrinho"}
          </Link>
        </div>
      )}
    </div>
  );
}
