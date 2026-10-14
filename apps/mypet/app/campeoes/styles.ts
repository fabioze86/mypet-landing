// Estilo de /campeoes: visual "pop" dos criativos da campanha (céu claro,
// título condensado em itálico, faixas inclinadas, produtos no pedestal).
// Fontes Barlow / Barlow Condensed vêm de next/font em page.tsx
// (--font-cp-body / --font-cp-display). Tudo prefixado com cp- para não
// colidir com a landing principal.
export const CHAMPIONS_STYLES = `
  :root {
    --cp-bg: #f3f8fd; --cp-surface: #ffffff; --cp-fg: #0d2347; --cp-muted: #4d5f7d;
    --cp-line: #d5e2f1; --cp-azul: #073f95; --cp-azul-dark: #052e6e; --cp-laranja: #ff6817;
    --cp-laranja-dark: #e2550a; --cp-ceu: #63bdf8; --cp-tag: #e3f0fc; --cp-erro: #b3261e;
    --cp-display: var(--font-cp-display), "Arial Narrow", Arial, sans-serif;
    --cp-body: var(--font-cp-body), "Segoe UI", Arial, sans-serif;
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body { margin: 0; background: var(--cp-bg); color: var(--cp-fg); font-family: var(--cp-body); }
  .cp { font-family: var(--cp-body); font-size: 16px; line-height: 1.55; padding-bottom: 72px; overflow-x: clip; }
  .cp-wrap { max-width: 1120px; margin: 0 auto; padding: 0 16px; }
  .cp p { margin: 0; }
  .cp a { color: inherit; }

  /* títulos e faixas */
  .cp-kicker { display: inline-block; align-self: flex-start; font-family: var(--cp-display); font-style: italic; font-weight: 800; font-size: 18px; letter-spacing: .04em; text-transform: uppercase; color: #fff; background: var(--cp-laranja); padding: 3px 14px 5px; transform: rotate(-1.5deg); }
  .cp-h2 { margin: 0; align-self: flex-start; font-family: var(--cp-display); font-style: italic; font-weight: 800; font-size: clamp(26px, 4vw, 34px); line-height: 1.1; text-transform: uppercase; color: #fff; background: var(--cp-azul); padding: 4px 16px 6px; transform: rotate(-1.2deg); }
  .cp-h2--laranja { background: var(--cp-laranja); }
  .cp-lead { color: var(--cp-muted); font-size: 18px; max-width: 60ch; }
  .cp-sec { padding: 64px 0; }
  .cp-sec-head { display: flex; flex-direction: column; gap: 14px; margin-bottom: 28px; }

  /* botões */
  .cp-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 52px; padding: 12px 26px; border-radius: 6px; border: 0; font-family: var(--cp-display); font-style: italic; font-weight: 800; font-size: 21px; letter-spacing: .03em; text-transform: uppercase; text-decoration: none; cursor: pointer; transition: background .15s ease, transform .12s ease; }
  .cp-btn:active { transform: translateY(1px); }
  .cp-btn:focus-visible { outline: 3px solid var(--cp-ceu); outline-offset: 2px; }
  .cp-btn-primary { background: var(--cp-laranja); color: #fff !important; box-shadow: 0 6px 0 var(--cp-laranja-dark); }
  .cp-btn-primary:hover { background: var(--cp-laranja-dark); }
  .cp-btn-ghost { background: #fff; color: var(--cp-azul) !important; border: 2px solid var(--cp-azul); }
  .cp-btn-ghost:hover { background: var(--cp-tag); }

  /* header */
  .cp-header { position: sticky; top: 0; z-index: 30; background: rgba(255,255,255,.94); backdrop-filter: blur(8px); border-bottom: 1px solid var(--cp-line); }
  .cp-header-row { display: flex; align-items: center; justify-content: space-between; height: 60px; gap: 12px; }
  .cp-brand { display: flex; align-items: center; gap: 8px; font-family: var(--cp-display); font-style: italic; font-weight: 900; font-size: 22px; text-transform: uppercase; color: var(--cp-azul); text-decoration: none; }
  .cp-header .cp-btn { min-height: 40px; padding: 6px 16px; font-size: 17px; box-shadow: none; }
  .cp-sticky .cp-btn { font-size: 19px; white-space: nowrap; }

  /* hero */
  .cp-hero { position: relative; overflow: hidden; background: linear-gradient(180deg, var(--cp-ceu) 0%, #a9dbfb 55%, var(--cp-bg) 100%); }
  .cp-hero::before { content: ""; position: absolute; inset: auto -10% -40px -10%; height: 140px; background: #fff; transform: rotate(-3deg); opacity: .55; }
  .cp-hero-grid { position: relative; display: grid; grid-template-columns: 1.05fr 1fr; gap: 32px; align-items: center; padding-block: 56px 72px; }
  .cp-hero-copy { display: flex; flex-direction: column; gap: 18px; }
  .cp-hero h1 { margin: 0; font-family: var(--cp-display); font-style: italic; font-weight: 900; font-size: clamp(46px, 8vw, 84px); line-height: .92; text-transform: uppercase; color: var(--cp-azul); text-wrap: balance; }
  .cp-hero h1 em { font-style: italic; color: #fff; background: var(--cp-azul); padding: 0 10px; display: inline-block; transform: rotate(-1.5deg); margin-top: 6px; }
  .cp-hero .cp-lead { color: var(--cp-fg); }
  .cp-hero-actions { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 6px; }
  .cp-trust { display: flex; flex-wrap: wrap; gap: 8px 18px; list-style: none; padding: 0; margin: 4px 0 0; font-weight: 600; font-size: 14.5px; color: var(--cp-fg); }
  .cp-trust li { display: flex; align-items: center; gap: 6px; }
  .cp-trust svg { color: var(--cp-azul); flex: none; }

  .cp-podium { display: grid; grid-template-columns: 1fr 1.2fr 1fr; align-items: end; gap: 10px; }
  .cp-podium-item { display: flex; flex-direction: column; align-items: center; gap: 0; min-width: 0; }
  .cp-podium-img { width: 100%; aspect-ratio: 1; border-radius: 50%; background: #fff; display: grid; place-items: center; padding: 12%; box-shadow: 0 14px 30px rgba(7,63,149,.18); }
  .cp-podium-img img { width: 100%; height: 100%; object-fit: contain; }
  .cp-podium-base { width: 86%; margin-top: -14px; background: var(--cp-azul); color: #fff; text-align: center; font-family: var(--cp-display); font-style: italic; font-weight: 900; font-size: 30px; line-height: 1; padding: 22px 0 10px; border-radius: 4px 4px 0 0; }
  .cp-podium-item:nth-child(2) .cp-podium-base { background: var(--cp-laranja); padding-top: 30px; font-size: 38px; }
  .cp-podium-item:nth-child(3) .cp-podium-base { padding-top: 16px; }

  /* faixa de marquee estática */
  .cp-strip { background: var(--cp-azul); color: #fff; transform: rotate(-1deg); margin: -18px -12px 0; position: relative; z-index: 2; }
  .cp-strip ul { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 28px; list-style: none; margin: 0; padding: 12px 16px; font-family: var(--cp-display); font-style: italic; font-weight: 800; font-size: 19px; letter-spacing: .04em; text-transform: uppercase; }
  .cp-strip li::before { content: "★ "; color: var(--cp-laranja); }

  /* grade de campeões */
  .cp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 16px; list-style: none; padding: 0; margin: 0; }
  .cp-card { position: relative; height: 100%; display: flex; flex-direction: column; background: var(--cp-surface); border: 1px solid var(--cp-line); border-radius: 8px; overflow: hidden; text-decoration: none; color: var(--cp-fg); transition: border-color .15s ease, transform .15s ease, box-shadow .15s ease; }
  .cp-card:hover { border-color: var(--cp-azul); transform: translateY(-2px); box-shadow: 0 10px 24px rgba(7,63,149,.12); }
  .cp-card:focus-visible { outline: 3px solid var(--cp-ceu); outline-offset: 2px; }
  .cp-card-rank { position: absolute; top: 10px; left: -4px; z-index: 1; background: var(--cp-laranja); color: #fff; font-family: var(--cp-display); font-style: italic; font-weight: 900; font-size: 20px; line-height: 1; padding: 5px 12px 6px; transform: rotate(-3deg); }
  .cp-card-media { aspect-ratio: 1; background: linear-gradient(180deg, #e9f5fe 0%, #fff 100%); display: grid; place-items: center; padding: 18px; }
  .cp-card-media img { width: 100%; height: 100%; object-fit: contain; }
  .cp-card-body { display: flex; flex-direction: column; gap: 6px; padding: 12px 14px 14px; flex: 1; }
  .cp-card-group { align-self: flex-start; font-size: 11.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--cp-azul); background: var(--cp-tag); padding: 2px 8px; border-radius: 999px; }
  .cp-card-name { font-weight: 700; font-size: 15px; line-height: 1.3; text-transform: capitalize; }
  .cp-card-brand { font-size: 13px; color: var(--cp-muted); text-transform: uppercase; letter-spacing: .03em; }
  .cp-card-lock { margin-top: auto; padding-top: 10px; display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 14px; color: var(--cp-laranja-dark); border-top: 1px dashed var(--cp-line); }
  .cp-grid-cta { display: flex; justify-content: center; margin-top: 32px; }

  /* por que */
  .cp-why { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; }
  .cp-box { background: var(--cp-surface); border: 1px solid var(--cp-line); border-radius: 8px; padding: 20px; display: flex; flex-direction: column; gap: 8px; }
  .cp-box svg { color: var(--cp-laranja); }
  .cp-box h3 { margin: 0; font-family: var(--cp-display); font-style: italic; font-weight: 800; font-size: 22px; text-transform: uppercase; color: var(--cp-azul); line-height: 1.1; }
  .cp-box p { color: var(--cp-muted); font-size: 15px; }

  /* passos */
  .cp-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; list-style: none; padding: 0; margin: 0; counter-reset: passo; }
  .cp-steps li { counter-increment: passo; background: var(--cp-surface); border: 1px solid var(--cp-line); border-radius: 8px; padding: 20px; display: flex; flex-direction: column; gap: 6px; }
  .cp-steps li::before { content: counter(passo, decimal-leading-zero); font-family: var(--cp-display); font-style: italic; font-weight: 900; font-size: 40px; line-height: 1; color: var(--cp-laranja); }
  .cp-steps b { font-family: var(--cp-display); font-style: italic; font-weight: 800; font-size: 21px; text-transform: uppercase; color: var(--cp-azul); }
  .cp-steps span { color: var(--cp-muted); font-size: 15px; }

  /* condições */
  .cp-conds { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; border: 1px solid var(--cp-line); border-radius: 8px; background: var(--cp-surface); }
  .cp-cond { padding: 18px 20px; border-left: 1px solid var(--cp-line); display: flex; flex-direction: column; gap: 4px; }
  .cp-cond:first-child { border-left: 0; }
  .cp-cond small { font-family: var(--cp-display); font-style: italic; font-weight: 800; font-size: 15px; letter-spacing: .04em; text-transform: uppercase; color: var(--cp-muted); }
  .cp-cond strong { font-size: 16px; color: var(--cp-fg); }

  /* formulário */
  .cp-cta-sec { background: var(--cp-azul); color: #fff; position: relative; overflow: hidden; }
  .cp-cta-grid { display: grid; grid-template-columns: 1fr minmax(0, 440px); gap: 40px; align-items: center; padding-block: 64px; }
  .cp-cta-copy { display: flex; flex-direction: column; gap: 16px; }
  .cp-cta-copy h2 { margin: 0; font-family: var(--cp-display); font-style: italic; font-weight: 900; font-size: clamp(40px, 6vw, 64px); line-height: .95; text-transform: uppercase; }
  .cp-cta-copy h2 em { color: var(--cp-laranja); font-style: italic; }
  .cp-cta-copy p { color: #d9e6fb; font-size: 17px; max-width: 46ch; }
  .cp-cta-copy ul { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; font-weight: 600; }
  .cp-cta-copy li { display: flex; gap: 8px; align-items: center; }
  .cp-cta-copy li svg { color: var(--cp-ceu); flex: none; }
  .cp-form-card { background: #fff; color: var(--cp-fg); border-radius: 10px; padding: 24px; box-shadow: 0 20px 50px rgba(0,0,0,.25); }
  .cp-form-card h3 { margin: 0 0 4px; font-family: var(--cp-display); font-style: italic; font-weight: 900; font-size: 28px; text-transform: uppercase; color: var(--cp-azul); line-height: 1.05; }
  .cp-form-card > p { color: var(--cp-muted); font-size: 14.5px; }
  .cp-form-card form label { display: block; font-weight: 700; font-size: 14px; color: var(--cp-azul); margin: 14px 0 6px; }
  .cp-form-card form input { width: 100%; min-height: 48px; padding: 12px 14px; border: 1.5px solid var(--cp-line); border-radius: 6px; font-size: 16px; font-family: inherit; color: var(--cp-fg); background: #fff; }
  .cp-form-card form input:focus { outline: none; border-color: var(--cp-azul); box-shadow: 0 0 0 3px var(--cp-tag); }
  .cp-form-card form input[aria-invalid="true"] { border-color: var(--cp-erro); }
  .cp-form-card form .pa-field-help { color: var(--cp-muted); font-size: 12.5px; margin-top: 6px; }
  .cp-form-card form p[role="alert"] { color: var(--cp-erro); font-weight: 700; font-size: 13.5px; margin-top: 10px; }
  .cp-form-card form > p:not([role]):not(.pa-field-help) { color: var(--cp-muted); font-size: 12.5px; line-height: 1.5; margin-top: 14px; }
  .cp-form-card form button[type="submit"] { width: 100%; margin-top: 16px; min-height: 54px; background: var(--cp-laranja); color: #fff; border: 0; border-radius: 6px; font-family: var(--cp-display); font-style: italic; font-weight: 800; font-size: 22px; letter-spacing: .03em; text-transform: uppercase; cursor: pointer; box-shadow: 0 5px 0 var(--cp-laranja-dark); }
  .cp-form-card form button[type="submit"]:hover { background: var(--cp-laranja-dark); }
  .cp-form-card form button[type="submit"]:disabled { opacity: .7; cursor: progress; }
  .cp-form-alt { margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--cp-line); font-size: 14px; color: var(--cp-muted); text-align: center; }
  .cp-form-alt a { color: var(--cp-azul); font-weight: 700; }

  /* faq */
  .cp-faq { display: flex; flex-direction: column; gap: 10px; max-width: 780px; }
  .cp-faq details { background: var(--cp-surface); border: 1px solid var(--cp-line); border-radius: 8px; padding: 14px 18px; }
  .cp-faq summary { cursor: pointer; font-weight: 700; color: var(--cp-azul); font-size: 16.5px; }
  .cp-faq details p { margin-top: 8px; color: var(--cp-muted); }

  /* rodapé e barra fixa no celular */
  .cp-footer { border-top: 1px solid var(--cp-line); padding: 24px 0; color: var(--cp-muted); font-size: 13px; }
  .cp-footer a { color: inherit; }
  .cp-sticky { display: none; }

  @media (max-width: 860px) {
    .cp-hero-grid { grid-template-columns: 1fr; padding-block: 36px 56px; }
    .cp-podium { max-width: 420px; width: 100%; margin: 0 auto; }
    .cp-cta-grid { grid-template-columns: 1fr; }
    .cp-steps, .cp-conds { grid-template-columns: 1fr; }
    .cp-cond { border-left: 0; border-top: 1px solid var(--cp-line); }
    .cp-cond:first-child { border-top: 0; }
  }
  @media (max-width: 640px) {
    .cp-header .cp-btn { display: none; }
    .cp-sec { padding: 48px 0; }
    .cp-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
    .cp-card-media { padding: 10px; }
    .cp-card-body { padding: 10px; }
    .cp-card-name { font-size: 14px; }
    .cp-card-lock { font-size: 12.5px; }
    .cp-card-rank { font-size: 17px; }
    .cp-hero-actions .cp-btn { width: 100%; }
    .cp-sticky { display: block; position: fixed; left: 0; right: 0; bottom: 0; z-index: 40; padding: 10px 16px calc(10px + env(safe-area-inset-bottom, 0px)); background: rgba(255,255,255,.96); border-top: 1px solid var(--cp-line); backdrop-filter: blur(8px); }
    .cp-sticky .cp-btn { width: 100%; box-shadow: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    html { scroll-behavior: auto; }
    .cp * { transition: none !important; }
  }
`;
