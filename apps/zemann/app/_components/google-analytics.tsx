import Script from "next/script";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

// Só em produção: `next dev` e previews da Vercel não entram nos relatórios.
const enabled = Boolean(GA_ID) && process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview";

export function GoogleAnalytics() {
  if (!enabled) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${GA_ID}');

          // Todo link com data-cta vira o evento click_cta (nome do CTA no parâmetro cta).
          document.addEventListener('click', function (e) {
            var el = e.target && e.target.closest ? e.target.closest('[data-cta]') : null;
            if (el) gtag('event', 'click_cta', { cta: el.getAttribute('data-cta') });
          });
        `}
      </Script>
    </>
  );
}
