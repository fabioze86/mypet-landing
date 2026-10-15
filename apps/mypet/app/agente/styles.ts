export const AGENT_STYLES = `
  .ag-page { min-height: 100vh; display: flex; flex-direction: column; background: var(--pa-bg-soft); }
  .ag-header-links { display: flex; align-items: center; gap: 18px; }
  .ag-header-links a { color: var(--pa-muted); text-decoration: none; font-weight: 500; font-size: 14px; }
  .ag-header-links a:hover { color: var(--pa-navy); }

  .ag-main { flex: 1; width: 100%; max-width: 1180px; margin: 0 auto; padding: 24px; display: grid; gap: 24px; align-items: start; }
  .ag-main--split { grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.9fr); }

  .ag-chat { background: #fff; border: 1px solid var(--pa-line); border-radius: var(--pa-r-card); display: flex; flex-direction: column; height: calc(100vh - 68px - 96px); min-height: 520px; overflow: hidden; }
  .ag-chat-head { display: flex; align-items: center; gap: 10px; padding: 16px 20px; border-bottom: 1px solid var(--pa-line); }
  .ag-chat-head h1 { margin: 0; font-family: var(--pa-geist); font-weight: 700; font-size: 17px; color: var(--pa-navy); }
  .ag-spark { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 10px; background: var(--pa-navy); color: #fff; font-size: 16px; }
  .ag-log { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 12px; }

  .ag-welcome h2 { margin: 8px 0 6px; font-family: var(--pa-geist); font-weight: 700; font-size: 22px; color: var(--pa-ink); }
  .ag-welcome > p { margin: 0 0 16px; color: var(--pa-muted); font-size: 14px; line-height: 1.5; }
  .ag-intents { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .ag-intent { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; background: #fff; border: 1px solid var(--pa-line); border-radius: 12px; font: inherit; font-size: 15px; color: var(--pa-ink); text-align: left; cursor: pointer; transition: border-color .15s ease, background .15s ease; }
  .ag-intent:hover { border-color: var(--pa-navy); }
  .ag-intent:disabled { opacity: .6; cursor: default; }
  .ag-intent--locked { background: var(--pa-bg-soft); color: var(--pa-muted); }
  .ag-intents-sep { margin: 18px 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: var(--pa-muted); }

  .ag-turn { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
  .ag-msg { margin: 0; max-width: 85%; padding: 10px 14px; border-radius: 14px; background: var(--pa-bg-soft); color: var(--pa-ink); font-size: 15px; line-height: 1.55; overflow-wrap: anywhere; }
  .ag-msg a { color: var(--pa-green-dark); font-weight: 600; }
  .ag-msg--user { align-self: flex-end; background: var(--pa-navy); color: #fff; }
  .ag-msg--muted { color: var(--pa-muted); }
  .ag-notice { margin: 0; padding: 10px 14px; border-radius: 12px; background: var(--pa-green-soft); color: var(--pa-green-dark); font-size: 14px; }

  .ag-products { list-style: none; margin: 0; padding: 0; align-self: stretch; display: flex; flex-direction: column; gap: 8px; }
  .ag-product { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border: 1px solid var(--pa-line); border-radius: 12px; background: #fff; }
  .ag-product-img { width: 48px; height: 48px; object-fit: contain; border-radius: 8px; background: var(--pa-bg-soft); flex: 0 0 auto; }
  .ag-product-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .ag-product-name { font-weight: 600; color: var(--pa-ink); font-size: 14px; overflow-wrap: anywhere; }
  .ag-product-brand { color: var(--pa-muted); font-size: 13px; }
  .ag-product-side { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex: 0 0 auto; }
  .ag-product-price { font-weight: 700; color: var(--pa-navy); font-size: 15px; }
  .ag-product-link { color: var(--pa-green-dark); font-weight: 600; font-size: 13px; text-decoration: none; }
  .ag-product-lock { flex: 0 0 auto; background: none; border: 0; padding: 0; font: inherit; font-size: 13px; font-weight: 600; color: var(--pa-green-dark); cursor: pointer; text-align: right; }

  .ag-error { margin: 0 20px 8px; color: #B42318; font-size: 14px; }
  .ag-form { display: flex; gap: 8px; margin: 0 16px; padding: 6px; border: 1.5px solid var(--pa-navy); border-radius: 14px; background: #fff; }
  .ag-form input { flex: 1; min-width: 0; border: 0; padding: 10px; font: inherit; font-size: 16px; color: var(--pa-ink); background: transparent; }
  .ag-form input:focus { outline: none; }
  .ag-form:focus-within { box-shadow: 0 0 0 3px var(--pa-green-soft); border-color: var(--pa-green); }
  .ag-form button:focus-visible, .ag-intent:focus-visible, .ag-product-lock:focus-visible, .ag-product-link:focus-visible { outline: 2px solid var(--pa-green); outline-offset: 2px; }
  .ag-form button { width: 40px; height: 40px; border: 0; border-radius: 10px; background: var(--pa-green); color: #fff; font-size: 18px; font-weight: 700; cursor: pointer; }
  .ag-form button:disabled { background: var(--pa-line); color: var(--pa-muted); cursor: default; }
  .ag-disclaimer { margin: 8px 16px 14px; text-align: center; color: var(--pa-muted); font-size: 12px; }

  .ag-access { position: sticky; top: 92px; }
  .ag-access h2 { font-family: var(--pa-geist); font-weight: 700; color: var(--pa-navy); font-size: 22px; margin: 0 0 8px; }
  .ag-access-lead { color: var(--pa-muted); font-size: 14px; line-height: 1.55; margin: 0 0 12px; }
  .ag-access-reason { margin: 0 0 12px; padding: 10px 12px; border-radius: 10px; background: var(--pa-green-soft); color: var(--pa-green-dark); font-weight: 600; font-size: 14px; }
  .ag-benefits { list-style: none; margin: 0 0 6px; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .ag-benefits li { font-size: 14px; color: var(--pa-ink); }
  .ag-benefits li::before { content: "✓ "; color: var(--pa-green); font-weight: 700; }
  .ag-access-reason:empty { min-height: 0; padding: 0; margin: 0; background: none; }
  .ag-access form input { font-size: 16px; }
  .ag-chat-wrap { min-width: 0; }
  .ag-access-close { display: none; }
  .ag-unlock-bar { display: none; }

  .ag-footer { padding: 16px 24px 24px; text-align: center; color: var(--pa-muted); font-size: 12px; line-height: 1.5; }

  @media (max-width: 900px) {
    .ag-main, .ag-main--split { grid-template-columns: 1fr; padding: 12px 12px 88px; }
    .ag-chat { height: calc(100dvh - 68px - 100px); min-height: 420px; }
    .ag-access { display: none; position: fixed; top: auto; left: 0; right: 0; bottom: 0; z-index: 60; max-height: 88dvh; overflow-y: auto; border-radius: 20px 20px 0 0; box-shadow: 0 -16px 40px rgba(15,31,69,0.25); }
    .ag-access.is-open { display: block; }
    .ag-access-close { display: block; position: absolute; top: 10px; right: 12px; width: 36px; height: 36px; border: 0; border-radius: 50%; background: var(--pa-bg-soft); font-size: 20px; color: var(--pa-navy); cursor: pointer; }
    .ag-unlock-bar[hidden] { display: none; }
    .ag-unlock-bar { display: block; position: fixed; left: 12px; right: 12px; bottom: 12px; z-index: 50; padding: 15px; border: 0; border-radius: var(--pa-r-pill); background: var(--pa-green); color: #fff; font-family: var(--pa-geist); font-weight: 600; font-size: 15px; box-shadow: 0 10px 24px rgba(0,166,81,0.35); cursor: pointer; }
    .ag-msg { max-width: 92%; }
    .ag-header-links a.ag-hide-mobile { display: none; }
  }
`;
