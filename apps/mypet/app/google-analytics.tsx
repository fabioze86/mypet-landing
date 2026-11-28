import Script from "next/script";
import { GA_ID } from "@/lib/analytics";

// Só em produção: `next dev` e previews da Vercel não entram nos relatórios.
const enabled =
  process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview";

export function GoogleAnalytics() {
  if (!enabled) return null;
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${GA_ID}');

          // Links diretos para o WhatsApp (ex.: /campeoes, "falar com a gente").
          // O envio do pedido em si é medido à parte, como generate_lead (lib/analytics.ts).
          document.addEventListener('click', function (e) {
            var link = e.target instanceof Element ? e.target.closest('a[href]') : null;
            if (!link) return;
            var url = new URL(link.href, location.href);
            if (url.hostname !== 'wa.me' && url.hostname !== 'api.whatsapp.com') return;
            gtag('event', 'click_whatsapp', {
              page_path: location.pathname,
              transport_type: 'beacon'
            });
          });
        `}
      </Script>
    </>
  );
}
