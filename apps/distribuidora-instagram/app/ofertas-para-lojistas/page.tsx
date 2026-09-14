import Link from "next/link";
import { getActiveCampaigns } from "@mypet/core/offers";
import { OfferCard } from "@mypet/core/components/offer-card";
import { CampaignCountdown } from "@mypet/core/components/campaign-countdown";
import { OffersErrorState } from "@mypet/core/components/offers-error-state";
import { clientConfig } from "@/client.config";

const { palette: PALETTE } = clientConfig;

export const metadata = {
  title: `Ofertas para lojistas — ${clientConfig.name}`,
  description: clientConfig.tagline,
};

export default async function OfertasParaLojistasPage() {
  let campaigns;
  try {
    campaigns = await getActiveCampaigns(clientConfig.catalogChannel);
  } catch (err) {
    console.error("[ofertas-para-lojistas] erro ao carregar campanhas:", err);
    return (
      <div style={{ background: PALETTE.gray50, minHeight: "100vh" }}>
        <OffersErrorState message="Não foi possível carregar as ofertas agora." />
      </div>
    );
  }

  const flashCampaigns = campaigns.filter((c) => c.flashOffer && c.endsAt);
  const regularCampaigns = campaigns.filter((c) => !c.flashOffer || !c.endsAt);

  return (
    <div style={{ background: PALETTE.gray50, minHeight: "100vh", color: PALETTE.gray800 }}>
      {/* BARRA DE CAMPANHA */}
      <div style={{ background: PALETTE.navy, color: PALETTE.white, textAlign: "center", padding: "8px 16px", fontSize: 13, fontWeight: 700 }}>
        Ofertas reais para lojistas — preço e vigência sempre atualizados
      </div>

      {/* HERO */}
      <section style={{ background: `linear-gradient(135deg, ${PALETTE.navy} 0%, ${PALETTE.navyDark} 100%)`, padding: "48px 24px", textAlign: "center" }}>
        <span style={{ fontSize: 32 }}>{clientConfig.logo.emoji}</span>
        <h1 style={{ fontSize: 30, fontWeight: 900, color: PALETTE.white, margin: "12px 0 6px", letterSpacing: "0.01em" }}>
          OFERTAS PARA LOJISTAS
        </h1>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.85)", marginBottom: 20 }}>{clientConfig.tagline}</p>
        {campaigns[0] && (
          <a
            href={`#${campaigns[0].slug}`}
            style={{
              display: "inline-block",
              background: PALETTE.pink,
              color: PALETTE.white,
              borderRadius: 100,
              padding: "14px 32px",
              fontSize: 15,
              fontWeight: 800,
              textDecoration: "none",
            }}
          >
            Ver ofertas
          </a>
        )}
      </section>

      {campaigns.length === 0 ? (
        <div style={{ padding: "60px 24px", textAlign: "center" }}>
          <p style={{ color: PALETTE.gray600 }}>Nenhuma oferta ativa no momento. Volte em breve.</p>
        </div>
      ) : (
        <>
          {flashCampaigns.length > 0 && (
            <section style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px 0" }}>
              <h2 style={{ fontSize: 20, fontWeight: 900, color: PALETTE.navy, marginBottom: 16 }}>⚡ Ofertas relâmpago</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
                {flashCampaigns.map((campaign) => (
                  <div key={campaign.id} id={campaign.slug}>
                    <div style={{ marginBottom: 8 }}>
                      <CampaignCountdown endsAt={campaign.endsAt} />
                    </div>
                    {campaign.items[0] && (
                      <OfferCard item={campaign.items[0]} campaignId={campaign.id} campaignSlug={campaign.slug} />
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px 80px" }}>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: PALETTE.navy, marginBottom: 16 }}>Ofertas em destaque</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
              {regularCampaigns.map((campaign) =>
                campaign.items[0] ? (
                  <div key={campaign.id} id={campaign.slug}>
                    <OfferCard item={campaign.items[0]} campaignId={campaign.id} campaignSlug={campaign.slug} />
                  </div>
                ) : null,
              )}
            </div>
          </section>
        </>
      )}

      <footer style={{ background: PALETTE.navyDark, padding: 24, textAlign: "center" }}>
        <Link href="/ofertas-para-lojistas" style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, textDecoration: "none" }}>
          {clientConfig.name} — {clientConfig.tagline}
        </Link>
      </footer>
    </div>
  );
}
