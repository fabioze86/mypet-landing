import Script from "next/script";

// Mesma propriedade GA4 do blog (www.azpetshop.com.br). Como blog e loja são
// subdomínios de azpetshop.com.br, o cookie do GA é compartilhado e a jornada
// blog → loja fica numa sessão só, sem configurar domínio cruzado.
const GA_ID = "G-7JR087027T";

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

          // O pedido é fechado no WhatsApp: o clique vira "click_whatsapp",
          // para marcar como evento-chave (conversão) no GA4.
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
