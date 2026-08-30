// Estilo da landing pública. Paleta da campanha atual (arte anexada): amarelo-ouro
// + navy + verde + creme + branco. Fonte Nunito (layout.tsx, next/font:
// --font-nunito / --font-nunito-sans). Um único bloco <style>, renderizado uma
// vez em page.tsx. Sem dependência nova.
export const LANDING_STYLES = `
  :root {
    --pa-yellow: #FBC01D; --pa-yellow-deep: #EFAE12;
    --pa-navy: #12296B; --pa-navy-dark: #0E2050; --pa-navy-soft: #E7EBF5;
    --pa-green: #4CAF3E; --pa-green-dark: #3E9433; --pa-green-soft: #E7F3E4;
    --pa-cream: #F6E7A6; --pa-cream-line: #E6D28A;
    --pa-ink: #12296B; --pa-muted: #4C5578; --pa-line: #E2E4EC;
    --pa-bg-soft: #FBFBF8;
    --pa-r-card: 18px; --pa-r-input: 10px; --pa-r-pill: 999px;
    --pa-nunito: var(--font-nunito), "Nunito", system-ui, sans-serif;
    --pa-sans: var(--font-nunito-sans), "Nunito Sans", system-ui, sans-serif;
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body { margin: 0; background: #fff; color: var(--pa-ink); font-family: var(--pa-sans); }
  main { display: block; }

  .pa-wrap { max-width: 1120px; margin: 0 auto; padding: 0 24px; }
  .pa-h2 { font-family: var(--pa-nunito); font-weight: 900; letter-spacing: -0.02em; color: var(--pa-navy); font-size: clamp(25px, 3.4vw, 33px); margin: 0 0 10px; }
  .pa-sec-lead { color: var(--pa-muted); font-size: 15px; line-height: 1.6; max-width: 58ch; margin: 0; }

  /* header */
  .pa-header { position: sticky; top: 0; z-index: 20; background: rgba(255,255,255,0.92); backdrop-filter: saturate(180%) blur(8px); border-bottom: 1px solid var(--pa-line); }
  .pa-header-row { display: flex; align-items: center; justify-content: space-between; height: 64px; }
  .pa-brand { display: flex; align-items: center; gap: 8px; font-family: var(--pa-nunito); font-weight: 900; color: var(--pa-navy); font-size: 17px; }
  .pa-brand span:first-child { font-size: 20px; }
  .pa-nav { display: flex; align-items: center; gap: 22px; }
  .pa-nav a { color: var(--pa-muted); text-decoration: none; font-weight: 700; font-size: 14px; }
  .pa-nav a:hover { color: var(--pa-navy); }
  .pa-nav a.pa-nav-cta { color: var(--pa-green-dark); }

  /* buttons */
  .pa-btn { display: inline-flex; align-items: center; justify-content: center; border-radius: var(--pa-r-pill); font-family: var(--pa-nunito); font-weight: 800; font-size: 15px; padding: 12px 26px; cursor: pointer; text-decoration: none; border: 2px solid transparent; transition: background .18s ease, border-color .18s ease, color .18s ease, transform .12s ease; }
  .pa-btn-primary { background: var(--pa-navy); color: #fff; }
  .pa-btn-primary:hover { background: var(--pa-navy-dark); }
  .pa-btn-ghost { background: transparent; color: var(--pa-navy); border-color: var(--pa-navy); }
  .pa-btn-ghost:hover { background: var(--pa-navy); color: #fff; }
  /* on the yellow hero band, the primary CTA is the white pill from the campaign art */
  .pa-hero .pa-btn-primary { background: #fff; color: var(--pa-navy); }
  .pa-hero .pa-btn-primary:hover { background: var(--pa-navy); color: #fff; }

  /* hero */
  .pa-hero { background: var(--pa-yellow); padding: 52px 0 44px; }
  .pa-hero-grid { display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 48px; align-items: start; }
  .pa-eyebrow { display: inline-block; font-family: var(--pa-nunito); text-transform: uppercase; letter-spacing: 0.1em; font-weight: 800; font-size: 12px; color: #fff; background: var(--pa-green); padding: 7px 16px; border-radius: var(--pa-r-pill); margin: 0 0 16px; }
  .pa-hero h1 { font-family: var(--pa-nunito); font-weight: 900; letter-spacing: -0.03em; color: var(--pa-navy); font-size: clamp(33px, 4.8vw, 50px); line-height: 1.05; margin: 0 0 16px; }
  .pa-hero-lead { color: var(--pa-navy); font-size: 18px; line-height: 1.55; max-width: 44ch; margin: 0 0 24px; }
  .pa-hero-actions { display: flex; gap: 12px; flex-wrap: wrap; }

  /* access panel */
  .pa-panel { background: #fff; border: 1px solid var(--pa-line); border-radius: var(--pa-r-card); padding: 26px 24px; box-shadow: 0 20px 46px rgba(18,41,107,0.18); }
  .pa-panel > h2 { font-family: var(--pa-nunito); font-weight: 900; color: var(--pa-navy); font-size: 20px; margin: 0 0 4px; }
  .pa-panel-sub { color: var(--pa-muted); font-size: 13px; margin: 0 0 6px; }
  .pa-panel form label { display: block; font-family: var(--pa-nunito); font-weight: 700; font-size: 13px; color: var(--pa-navy); margin: 14px 0 6px; }
  .pa-panel form input { width: 100%; padding: 12px 14px; border: 1.5px solid var(--pa-line); border-radius: var(--pa-r-input); font-size: 15px; font-family: inherit; color: var(--pa-ink); background: #fff; }
  .pa-panel form input:focus { outline: none; border-color: var(--pa-green); box-shadow: 0 0 0 3px var(--pa-green-soft); }
  .pa-panel form input[aria-invalid="true"] { border-color: #C0392B; }
  .pa-panel form input[aria-invalid="true"]:focus { box-shadow: 0 0 0 3px #F9DEDB; }
  .pa-panel form .pa-field-help { color: var(--pa-muted); font-size: 12px; line-height: 1.4; margin: 6px 0 0; }
  .pa-panel form p[role="alert"] { color: #C0392B; font-weight: 700; font-size: 13px; margin: 12px 0 0; }
  .pa-panel form > p:not([role]) { color: var(--pa-muted); font-size: 12px; line-height: 1.5; margin: 14px 0 0; }
  .pa-panel form button[type="submit"] { width: 100%; margin-top: 16px; padding: 13px; background: var(--pa-navy); color: #fff; border: 0; border-radius: var(--pa-r-pill); font-family: var(--pa-nunito); font-weight: 800; font-size: 15px; cursor: pointer; transition: background .18s ease; }
  .pa-panel form button[type="submit"]:hover { background: var(--pa-navy-dark); }
  .pa-panel form button[type="submit"]:disabled { opacity: .6; cursor: default; }

  /* sections */
  .pa-section { padding: 52px 0; }
  .pa-section--soft { background: var(--pa-bg-soft); }

  /* condition cards */
  .pa-cond-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 24px; }
  .pa-card { background: #fff; border: 1px solid var(--pa-line); border-radius: var(--pa-r-card); padding: 22px; transition: transform .18s ease, box-shadow .18s ease; }
  .pa-cond-card { border-top: 3px solid var(--pa-green); }
  .pa-cond-card h3 { font-family: var(--pa-nunito); color: var(--pa-navy); font-size: 15px; margin: 0 0 6px; }
  .pa-cond-value { font-family: var(--pa-nunito); font-weight: 900; color: var(--pa-green-dark); font-size: 18px; line-height: 1.28; margin: 0 0 8px; }
  .pa-cond-detail { color: var(--pa-muted); font-size: 13px; line-height: 1.55; margin: 0; }

  /* education scroller */
  .pa-edu-row { display: flex; gap: 14px; overflow-x: auto; padding: 22px 0 8px; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
  .pa-edu-row::-webkit-scrollbar { display: none; }
  .pa-edu-card { scroll-snap-align: start; flex: 0 0 260px; text-decoration: none; }
  .pa-edu-card h3 { font-family: var(--pa-nunito); color: var(--pa-navy); font-size: 16px; margin: 0 0 6px; }
  .pa-edu-card p { color: var(--pa-muted); font-size: 13px; line-height: 1.55; margin: 0; }
  .pa-edu-mark { display: block; width: 34px; height: 34px; border-radius: 10px; background: var(--pa-green-soft); margin-bottom: 12px; }

  /* category tiles */
  .pa-cat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 14px; margin-top: 22px; }
  .pa-cat-tile { display: flex; flex-direction: column; border: 1px solid var(--pa-line); border-radius: var(--pa-r-card); overflow: hidden; text-decoration: none; background: #fff; transition: transform .18s ease, box-shadow .18s ease; }
  .pa-cat-tile:hover { transform: translateY(-3px); box-shadow: 0 12px 28px rgba(18,41,107,0.14); }
  .pa-cat-media { aspect-ratio: 4 / 3; background: var(--pa-navy-soft); display: flex; align-items: center; justify-content: center; }
  .pa-cat-media img { width: 100%; height: 100%; object-fit: cover; }
  .pa-cat-fallback { font-family: var(--pa-nunito); font-weight: 900; font-size: 26px; color: var(--pa-navy); opacity: .45; }
  .pa-cat-name { padding: 12px 14px; font-family: var(--pa-nunito); font-weight: 700; font-size: 13px; color: var(--pa-navy); }

  /* faq */
  .pa-faq { background: var(--pa-cream); }
  .pa-faq-list { margin-top: 20px; border-top: 1px solid var(--pa-cream-line); }
  .pa-faq details { border-bottom: 1px solid var(--pa-cream-line); }
  .pa-faq summary { list-style: none; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 4px; font-family: var(--pa-nunito); font-weight: 700; font-size: 15px; color: var(--pa-navy); }
  .pa-faq summary::-webkit-details-marker { display: none; }
  .pa-faq summary::after { content: "+"; flex: 0 0 auto; width: 26px; height: 26px; border-radius: var(--pa-r-pill); background: var(--pa-green); color: #fff; font-weight: 800; display: grid; place-items: center; font-size: 16px; line-height: 1; }
  .pa-faq details[open] summary::after { content: "\\2212"; }
  .pa-faq details p { margin: 0; padding: 0 4px 18px; color: #5B5330; font-size: 14px; line-height: 1.6; }

  /* institutional */
  .pa-inst-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; margin-top: 20px; }
  .pa-inst-item { padding: 20px 20px 20px 0; border-top: 2px solid var(--pa-navy); }
  .pa-inst-item strong { display: block; font-family: var(--pa-nunito); color: var(--pa-navy); font-size: 15px; margin-bottom: 6px; }
  .pa-inst-item p { margin: 0; color: var(--pa-ink); font-size: 14px; line-height: 1.55; }

  /* footer */
  .pa-footer { background: var(--pa-navy-dark); color: rgba(255,255,255,0.82); padding: 28px 0 calc(28px + env(safe-area-inset-bottom)); }
  .pa-footer-row { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px; }
  .pa-footer-brand { display: flex; align-items: center; gap: 8px; font-family: var(--pa-nunito); font-weight: 800; font-size: 14px; color: #fff; }
  .pa-footer small { color: rgba(255,255,255,0.5); font-size: 12px; max-width: 52ch; }

  @media (prefers-reduced-motion: no-preference) {
    .pa-btn:active { transform: translateY(1px); }
    .pa-card:hover { transform: translateY(-3px); box-shadow: 0 14px 32px rgba(18,41,107,0.16); }
  }
  @media (max-width: 900px) {
    .pa-hero-grid { grid-template-columns: 1fr; gap: 30px; }
    .pa-cond-grid { grid-template-columns: 1fr; }
    .pa-inst-grid { grid-template-columns: 1fr; }
    .pa-inst-item { padding-right: 0; }
  }
  @media (max-width: 560px) {
    .pa-nav { gap: 14px; }
    .pa-nav a:not(.pa-nav-cta) { display: none; }
  }
`;
