// Estilo da área logada (pedido rápido, cotação, pedidos). Mesmos tokens da
// landing de pré-acesso (_components/pre-access/styles.ts): navy como âncora,
// verde como único acento, fonte Geist, botões em pílula. Um único bloco
// <style> por página.
export const BUYER_STYLES = `
  :root {
    --ba-navy: #1A3472; --ba-navy-dark: #0F1F45;
    --ba-green: #00A651; --ba-green-dark: #068A47; --ba-green-soft: #E3F5EC;
    --ba-ink: #0F1F45; --ba-muted: #5A6580; --ba-line: #DDE2EC; --ba-soft: #F0F2F6;
    --ba-bg: #F8F9FB;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--ba-bg); color: var(--ba-ink); font-family: var(--font-geist), system-ui, sans-serif; }

  .ba-page { background: var(--ba-bg); min-height: 100vh; color: var(--ba-ink); }
  .ba-main { max-width: 1100px; margin: 0 auto; padding: 28px 24px 120px; }
  .ba-main--narrow { max-width: 720px; }
  .ba-h1 { font-weight: 700; letter-spacing: -0.02em; color: var(--ba-navy); font-size: clamp(22px, 3vw, 28px); line-height: 1.15; margin: 0 0 6px; }
  .ba-lead { color: var(--ba-muted); font-size: 15px; line-height: 1.55; margin: 0 0 20px; max-width: 62ch; }
  .ba-card { background: #fff; border: 1px solid var(--ba-line); border-radius: 16px; }

  .ba-back { display: inline-flex; align-items: center; gap: 6px; color: var(--ba-muted); font-size: 14px; font-weight: 500; text-decoration: none; margin-bottom: 16px; }
  .ba-back:hover { color: var(--ba-navy); }

  .ba-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; border-radius: 999px; font-family: inherit; font-weight: 600; font-size: 15px; padding: 12px 22px; cursor: pointer; text-decoration: none; border: 1.5px solid transparent; transition: background .18s ease, border-color .18s ease; }
  .ba-btn-primary { background: var(--ba-green); color: #fff; }
  .ba-btn-primary:hover { background: var(--ba-green-dark); }
  .ba-btn-primary:disabled { opacity: .6; cursor: default; }
  .ba-btn-ghost { background: #fff; color: var(--ba-navy); border-color: var(--ba-line); }
  .ba-btn-ghost:hover { border-color: var(--ba-navy); }
  .ba-btn-block { width: 100%; }

  @media (max-width: 640px) {
    .ba-main { padding: 20px 16px 120px; }
    .ba-lead { font-size: 14px; margin-bottom: 16px; }
  }
`;
