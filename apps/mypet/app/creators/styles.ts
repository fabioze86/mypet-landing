// Complemento de POP_STYLES só para /creators (prefixo cr-).
export const CREATORS_STYLES = `
  .cr-collage { position: relative; height: 360px; }
  .cr-collage span { position: absolute; width: 44%; aspect-ratio: 1; background: #fff; border-radius: 10px; padding: 6%; box-shadow: 0 14px 30px rgba(7,63,149,.18); display: grid; place-items: center; }
  .cr-collage img { width: 100%; height: 100%; object-fit: contain; }
  .cr-collage span:nth-child(1) { left: 0; top: 70px; transform: rotate(-7deg); }
  .cr-collage span:nth-child(2) { left: 28%; top: 0; z-index: 1; transform: rotate(2deg); border: 4px solid var(--cp-laranja); }
  .cr-collage span:nth-child(3) { right: 0; top: 110px; transform: rotate(7deg); }

  .cr-markets { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .cr-market { background: var(--cp-surface); border: 1px solid var(--cp-line); border-top: 6px solid #ffe600; border-radius: 8px; padding: 22px; display: flex; flex-direction: column; gap: 14px; }
  .cr-market--shopee { border-top-color: #ee4d2d; }
  .cr-market h3 { margin: 0; font-family: var(--cp-display); font-style: italic; font-weight: 900; font-size: 30px; text-transform: uppercase; color: var(--cp-azul); }
  .cr-market ol { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 10px; counter-reset: passo; }
  .cr-market li { counter-increment: passo; display: grid; grid-template-columns: 30px 1fr; gap: 10px; align-items: start; }
  .cr-market li::before { content: counter(passo); display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: var(--cp-laranja); color: #fff; font-family: var(--cp-display); font-style: italic; font-weight: 900; font-size: 17px; }
  .cr-market-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: auto; }
  .cr-market-actions .cp-btn { font-size: 18px; min-height: 46px; padding: 8px 18px; }
  .cr-note { margin-top: 16px !important; color: var(--cp-muted); font-size: 14.5px; border-left: 4px solid var(--cp-laranja); padding-left: 12px; }

  .cr-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
  .cr-chips a { text-decoration: none; font-weight: 700; font-size: 14px; color: var(--cp-azul); background: var(--cp-tag); border: 1px solid var(--cp-line); padding: 6px 14px; border-radius: 999px; }
  .cr-chips a:hover { border-color: var(--cp-azul); }
  .cr-line { padding-top: 32px; scroll-margin-top: 70px; }
  .cr-line > h3 { margin: 0; font-family: var(--cp-display); font-style: italic; font-weight: 800; font-size: 26px; text-transform: uppercase; color: var(--cp-azul); }
  .cr-line > p { color: var(--cp-muted); margin: 2px 0 14px; }
  .cr-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 12px; list-style: none; padding: 0; margin: 0; }
  .cr-card { display: flex; flex-direction: column; gap: 8px; background: var(--cp-surface); border: 1px solid var(--cp-line); border-radius: 8px; padding: 10px; }
  .cr-card-media { aspect-ratio: 1; display: grid; place-items: center; background: linear-gradient(180deg, #e9f5fe 0%, #fff 100%); border-radius: 6px; padding: 10px; }
  .cr-card-media img { width: 100%; height: 100%; object-fit: contain; }
  .cr-card-name { font-weight: 700; font-size: 14px; line-height: 1.3; flex: 1; }
  .cr-card-actions { display: flex; flex-wrap: wrap; gap: 6px; }
  .cr-mini { display: inline-flex; align-items: center; gap: 4px; font-family: var(--cp-body); font-weight: 700; font-size: 13px; color: var(--cp-azul) !important; background: #fff; border: 1.5px solid var(--cp-line); border-radius: 4px; padding: 5px 10px; cursor: pointer; text-decoration: none; }
  .cr-mini:hover { border-color: var(--cp-azul); }
  .cr-mini:focus-visible { outline: 3px solid var(--cp-ceu); outline-offset: 2px; }

  .cr-scripts-sec { background: #e3f0fc; }
  .cr-scripts { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
  .cr-script { background: var(--cp-surface); border: 1px solid var(--cp-line); border-radius: 8px; padding: 20px; display: flex; flex-direction: column; gap: 10px; }
  .cr-script h3 { margin: 0; font-family: var(--cp-display); font-style: italic; font-weight: 800; font-size: 24px; line-height: 1.1; color: var(--cp-azul); }
  .cr-script small { color: var(--cp-muted); font-weight: 600; }
  .cr-script ol { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 4px; font-size: 15px; }
  .cr-caption { background: var(--cp-bg); border: 1px dashed var(--cp-line); border-radius: 6px; padding: 10px 12px; font-size: 14.5px; margin-top: auto !important; }

  @media (max-width: 860px) {
    .cr-markets { grid-template-columns: 1fr; }
    .cr-collage { height: 300px; max-width: 420px; width: 100%; margin: 0 auto; }
  }
  @media (max-width: 640px) {
    .cr-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
    .cr-scripts { grid-template-columns: 1fr; }
    .cr-collage { height: 230px; }
  }
`;
