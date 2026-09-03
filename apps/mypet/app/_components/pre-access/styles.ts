// Estilo da landing pública de pré-acesso (canal mypetbrasil). Um único bloco
// <style>, renderizado uma vez em page.tsx. Paleta: navy âncora + verde como
// único acento. Fonte Geist (layout.tsx, next/font: --font-geist /
// --font-geist-mono). Sem dependência de estilo nova.
export const LANDING_STYLES = `
  :root {
    --pa-navy: #1A3472; --pa-navy-dark: #0F1F45; --pa-navy-soft: #EDF0F8;
    --pa-green: #00A651; --pa-green-dark: #068A47; --pa-green-soft: #E3F5EC;
    --pa-ink: #0F1F45; --pa-muted: #5A6580; --pa-line: #DDE2EC;
    --pa-bg-soft: #F8F9FB;
    --pa-r-card: 16px; --pa-r-input: 10px; --pa-r-pill: 999px;
    --pa-geist: var(--font-geist), system-ui, sans-serif;
    --pa-mono: var(--font-geist-mono), ui-monospace, monospace;
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body { margin: 0; background: #fff; color: var(--pa-ink); font-family: var(--pa-geist); }
  main { display: block; }

  .pa-wrap { max-width: 1180px; margin: 0 auto; padding: 0 24px; }
  .pa-h2 { font-family: var(--pa-geist); font-weight: 700; letter-spacing: -0.02em; color: var(--pa-navy); font-size: clamp(26px, 3.4vw, 36px); line-height: 1.15; margin: 0 0 12px; }
  .pa-sec-lead { color: var(--pa-muted); font-size: 16px; line-height: 1.6; max-width: 60ch; margin: 0; }

  /* buttons */
  .pa-btn { display: inline-flex; align-items: center; justify-content: center; border-radius: var(--pa-r-pill); font-family: var(--pa-geist); font-weight: 600; font-size: 15px; padding: 12px 24px; cursor: pointer; text-decoration: none; border: 1.5px solid transparent; transition: background .18s ease, border-color .18s ease, color .18s ease, transform .12s ease; }
  .pa-btn-primary { background: var(--pa-green); color: #fff; }
  .pa-btn-primary:hover { background: var(--pa-green-dark); }
  .pa-btn-ghost { background: transparent; color: var(--pa-navy); border-color: var(--pa-line); }
  .pa-btn-ghost:hover { border-color: var(--pa-navy); }

  /* sections */
  .pa-section { padding: 96px 0; }
  .pa-section--soft { background: var(--pa-bg-soft); }

  /* metrics */
  .pa-metrics { background: var(--pa-bg-soft); border-bottom: 1px solid var(--pa-line); }
  .pa-metrics-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; padding: 28px 24px; }
  .pa-metric { padding: 4px 24px; border-left: 1px solid var(--pa-line); }
  .pa-metric:first-child { border-left: 0; padding-left: 0; }
  .pa-metric-value { display: block; font-family: var(--pa-mono); font-weight: 600; font-size: 24px; color: var(--pa-navy); letter-spacing: -0.02em; }
  .pa-metric-label { display: block; margin-top: 4px; font-size: 13px; line-height: 1.45; color: var(--pa-muted); }
  @media (max-width: 700px) {
    .pa-metrics-row { grid-template-columns: 1fr 1fr; gap: 20px 0; }
    .pa-metric:nth-child(odd) { border-left: 0; padding-left: 0; }
  }
  @media (max-width: 460px) {
    .pa-metrics-row { grid-template-columns: 1fr; }
    .pa-metric { border-left: 0; padding-left: 0; }
  }

  /* hero */
  .pa-hero { position: relative; isolation: isolate; background: var(--pa-navy-dark); padding: 88px 0 72px; overflow: hidden; }
  .pa-hero-media { object-fit: cover; opacity: .18; z-index: -2; }
  .pa-hero-overlay { position: absolute; inset: 0; z-index: -1; background: linear-gradient(180deg, rgba(15,31,69,.72), rgba(15,31,69,.94)); }
  .pa-hero-grid { display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 48px; align-items: start; }
  .pa-eyebrow { display: inline-block; font-family: var(--pa-geist); text-transform: uppercase; letter-spacing: 0.1em; font-weight: 600; font-size: 12px; color: #fff; background: var(--pa-green); padding: 6px 14px; border-radius: var(--pa-r-pill); margin: 0 0 18px; }
  .pa-hero h1 { font-family: var(--pa-geist); font-weight: 700; letter-spacing: -0.025em; color: #fff; font-size: clamp(30px, 4.2vw, 44px); line-height: 1.08; margin: 0 0 16px; max-width: 22ch; }
  .pa-hero h1 .pa-hl { color: #4ADE80; }
  .pa-hero-lead { color: rgba(255,255,255,0.82); font-size: 18px; line-height: 1.55; max-width: 46ch; margin: 0 0 24px; }
  .pa-hero-actions { display: flex; gap: 12px; flex-wrap: wrap; }
  .pa-btn-hero-ghost { background: transparent; color: #fff; border: 1.5px solid rgba(255,255,255,0.5); border-radius: var(--pa-r-pill); font-family: var(--pa-geist); font-weight: 600; font-size: 15px; padding: 12px 24px; text-decoration: none; display: inline-flex; align-items: center; transition: border-color .18s ease, background .18s ease; }
  .pa-btn-hero-ghost:hover { border-color: #fff; background: rgba(255,255,255,0.08); }

  /* access panel */
  .pa-panel { background: #fff; border-radius: var(--pa-r-card); padding: 26px 24px; box-shadow: 0 24px 60px rgba(15,31,69,0.35); }
  .pa-panel > h2 { font-family: var(--pa-geist); font-weight: 700; color: var(--pa-navy); font-size: 20px; margin: 0 0 4px; }
  .pa-panel-sub { color: var(--pa-muted); font-size: 13px; margin: 0 0 6px; }
  .pa-panel form label { display: block; font-family: var(--pa-geist); font-weight: 600; font-size: 13px; color: var(--pa-navy); margin: 14px 0 6px; }
  .pa-panel form input { width: 100%; padding: 12px 14px; border: 1.5px solid var(--pa-line); border-radius: var(--pa-r-input); font-size: 15px; font-family: inherit; color: var(--pa-ink); background: #fff; }
  .pa-panel form input:focus { outline: none; border-color: var(--pa-green); box-shadow: 0 0 0 3px var(--pa-green-soft); }
  .pa-panel form input[aria-invalid="true"] { border-color: #C0392B; }
  .pa-panel form input[aria-invalid="true"]:focus { box-shadow: 0 0 0 3px #F9DEDB; }
  .pa-panel form .pa-field-help { color: var(--pa-muted); font-size: 12px; line-height: 1.4; margin: 6px 0 0; }
  .pa-panel form p[role="alert"] { color: #C0392B; font-weight: 600; font-size: 13px; margin: 12px 0 0; }
  .pa-panel form > p:not([role]) { color: var(--pa-muted); font-size: 12px; line-height: 1.5; margin: 14px 0 0; }
  .pa-panel form button[type="submit"] { width: 100%; margin-top: 16px; padding: 13px; background: var(--pa-green); color: #fff; border: 0; border-radius: var(--pa-r-pill); font-family: var(--pa-geist); font-weight: 600; font-size: 15px; cursor: pointer; transition: background .18s ease; }
  .pa-panel form button[type="submit"]:hover { background: var(--pa-green-dark); }
  .pa-panel form button[type="submit"]:disabled { opacity: .6; cursor: default; }

  /* sections */
  .pa-section { padding: 52px 0; }
  .pa-section--soft { background: var(--pa-bg-soft); }

  /* condition cards */
  .pa-cond-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 28px; }
  .pa-card { background: #fff; border: 1px solid var(--pa-line); border-radius: var(--pa-r-card); padding: 24px; transition: transform .18s ease, box-shadow .18s ease; }
  .pa-cond-card { border-top: 3px solid var(--pa-green); }
  .pa-cond-icon { display: inline-flex; color: var(--pa-green-dark); margin-bottom: 12px; }
  .pa-cond-card h3 { font-family: var(--pa-geist); font-weight: 600; color: var(--pa-navy); font-size: 15px; margin: 0 0 6px; }
  .pa-cond-value { font-family: var(--pa-mono); font-weight: 600; color: var(--pa-green-dark); font-size: 17px; line-height: 1.3; margin: 0 0 8px; }
  .pa-cond-detail { color: var(--pa-muted); font-size: 13px; line-height: 1.55; margin: 0; }

  /* steps */
  .pa-steps { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; margin-top: 32px; position: relative; }
  .pa-steps::before { content: ""; position: absolute; top: 18px; left: 6%; right: 6%; height: 2px; background: var(--pa-line); z-index: 0; }
  .pa-step { position: relative; z-index: 1; }
  .pa-step-num { display: grid; place-items: center; width: 38px; height: 38px; border-radius: var(--pa-r-pill); background: var(--pa-navy); color: #fff; font-family: var(--pa-mono); font-weight: 600; font-size: 15px; }
  .pa-step-icon { display: inline-flex; color: var(--pa-green-dark); margin: 14px 0 8px; }
  .pa-step h3 { font-family: var(--pa-geist); font-weight: 600; color: var(--pa-navy); font-size: 15px; margin: 0 0 6px; }
  .pa-step p { color: var(--pa-muted); font-size: 13px; line-height: 1.55; margin: 0; }
  @media (max-width: 900px) {
    .pa-steps { grid-template-columns: 1fr; gap: 22px; }
    .pa-steps::before { top: 0; bottom: 0; left: 18px; right: auto; width: 2px; height: auto; }
  }

  /* catalog preview */
  .pa-cat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 16px; margin-top: 28px; }
  .pa-cat-tile { display: flex; flex-direction: column; border: 1px solid var(--pa-line); border-radius: var(--pa-r-card); overflow: hidden; text-decoration: none; background: #fff; transition: transform .18s ease, box-shadow .18s ease; }
  .pa-cat-tile:hover { transform: translateY(-3px); box-shadow: 0 12px 28px rgba(15,31,69,0.12); }
  .pa-cat-media { aspect-ratio: 4 / 3; background: var(--pa-navy-soft); display: flex; align-items: center; justify-content: center; }
  .pa-cat-media img { width: 100%; height: 100%; object-fit: cover; }
  .pa-cat-fallback { font-family: var(--pa-geist); font-weight: 700; font-size: 24px; color: var(--pa-navy); opacity: .4; }
  .pa-cat-name { padding: 12px 14px; font-family: var(--pa-geist); font-weight: 600; font-size: 13px; color: var(--pa-navy); }
  .pa-cat-note { margin: 22px 0 0; font-size: 13px; color: var(--pa-muted); }

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
