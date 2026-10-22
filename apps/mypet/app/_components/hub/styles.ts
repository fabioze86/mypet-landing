// Cabeçalho do hub. Cores próprias porque ele aparece tanto nas páginas da
// landing (pa-*) quanto nas do cliente (ba-*). No celular as portas descem
// para uma segunda linha com rolagem lateral, para nunca sumirem.
export const HUB_STYLES = `
  .hub-header {
    --hub-navy: #1A3472; --hub-green: #00A651; --hub-green-dark: #068A47;
    --hub-muted: #5A6580; --hub-line: #DDE2EC; --hub-soft: #EDF0F8;
    position: sticky; top: 0; z-index: 50;
    background: rgba(255,255,255,0.95); backdrop-filter: saturate(180%) blur(8px);
    border-bottom: 1px solid var(--hub-line);
    font-family: var(--font-geist), system-ui, sans-serif;
  }
  .hub-row {
    position: relative; max-width: 1180px; margin: 0 auto; padding: 0 24px; min-height: 64px;
    display: grid; grid-template-columns: auto 1fr auto; grid-template-areas: "brand doors actions";
    align-items: center; gap: 8px 24px;
  }
  .hub-brand { grid-area: brand; display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 17px; color: var(--hub-navy); text-decoration: none; white-space: nowrap; }
  .hub-doors { grid-area: doors; display: flex; gap: 4px; justify-content: center; }
  .hub-door { display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px; border-radius: 999px; color: var(--hub-muted); font-weight: 500; font-size: 14px; text-decoration: none; white-space: nowrap; }
  .hub-door:hover { color: var(--hub-navy); background: #F0F2F6; }
  .hub-door[aria-current="page"] { color: var(--hub-navy); font-weight: 600; background: var(--hub-soft); }
  .hub-lock { font-size: 11px; font-weight: 600; color: var(--hub-green-dark); background: #E3F5EC; padding: 2px 8px; border-radius: 999px; }
  .hub-actions { grid-area: actions; display: flex; align-items: center; justify-content: flex-end; gap: 14px; }
  .hub-actions a { color: var(--hub-muted); font-size: 14px; font-weight: 500; text-decoration: none; white-space: nowrap; }
  .hub-actions a:hover { color: var(--hub-navy); }
  .hub-actions a.hub-cta { color: #fff; background: var(--hub-green); padding: 8px 16px; border-radius: 999px; font-weight: 600; }
  .hub-actions a.hub-cta:hover { background: var(--hub-green-dark); color: #fff; }
  .hub-hello { font-size: 14px; font-weight: 600; color: var(--hub-navy); white-space: nowrap; }
  .hub-logout { background: none; border: 1px solid var(--hub-line); border-radius: 999px; padding: 6px 14px; font: inherit; font-size: 14px; color: var(--hub-muted); cursor: pointer; }
  .hub-logout:hover { color: var(--hub-navy); border-color: var(--hub-navy); }
  .hub-logout:disabled { opacity: .6; cursor: default; }
  .hub-logout-error { position: absolute; right: 24px; top: 100%; margin: 4px 0 0; padding: 6px 12px; background: #FFF4E5; color: #B35C00; border-radius: 8px; font-size: 13px; }
  @media (max-width: 900px) {
    .hub-row { grid-template-columns: 1fr auto; grid-template-areas: "brand actions" "doors doors"; padding: 8px 16px 0; min-height: 0; }
    .hub-doors { justify-content: flex-start; overflow-x: auto; margin: 0 -16px; padding: 0 16px 8px; scrollbar-width: none; }
    .hub-doors::-webkit-scrollbar { display: none; }
    .hub-hello { display: none; }
    .hub-logout-error { right: 16px; }
  }
  @media (max-width: 420px) {
    .hub-brand-name { display: none; }
    .hub-actions { gap: 10px; }
  }
`;
