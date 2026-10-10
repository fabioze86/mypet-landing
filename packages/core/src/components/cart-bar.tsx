"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useClientConfig } from "../theme";
import { useCart } from "./cart-provider";
import { cartTotals } from "../cart";
import { formatPrice } from "../catalog-utils";

export const CART_BAR_HEIGHT = 60;
const DEFAULT_HREF = "/cotacao";

// Se a barra está na tela: outros elementos fixos no rodapé (ex.: banner de
// instalação) usam isso para ficar acima dela.
export function useCartBarVisible(href: string = DEFAULT_HREF): boolean {
  const { cart } = useCart();
  const pathname = usePathname();
  return cartTotals(cart.items).totalUnits > 0 && pathname !== href;
}

// Barra fixa no rodapé com unidades e total do carrinho; o espaçador no fluxo
// evita que a barra cubra o fim da página.
export function CartBar({
  href = DEFAULT_HREF,
  actionLabel = "Enviar pedido",
  onAction,
  busy = false,
  secondaryHref,
  secondaryLabel,
}: {
  href?: string;
  actionLabel?: string;
  /** Quando presente, a barra vira botão de ação em vez de link para `href`. */
  onAction?: () => void;
  busy?: boolean;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  const { cart } = useCart();
  const { palette } = useClientConfig();
  const visible = useCartBarVisible(href);
  const totals = cartTotals(cart.items);

  if (!visible) return null;

  const unitsLabel = `${totals.totalUnits} ${totals.totalUnits === 1 ? "item" : "itens"}`;
  const valueLabel = totals.pricedLines > 0 ? ` · ${formatPrice(totals.totalValue)}` : "";
  const pendingLabel = totals.pricedLines > 0 && totals.unpricedLines > 0 ? " + itens a consultar" : "";

  const barStyle: React.CSSProperties = {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 40,
    minHeight: CART_BAR_HEIGHT,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "12px 20px calc(12px + env(safe-area-inset-bottom))",
    background: palette.pink,
    color: palette.white,
    textDecoration: "none",
    fontFamily: "var(--font-nunito), sans-serif",
    fontSize: 15,
    fontWeight: 800,
    boxShadow: "0 -6px 20px rgba(15,31,69,0.18)",
  };

  const summary = (
    <span>
      {unitsLabel}
      {valueLabel}
      {pendingLabel && <span style={{ fontWeight: 600, opacity: 0.9 }}>{pendingLabel}</span>}
    </span>
  );

  return (
    <>
      <div aria-hidden style={{ height: `calc(${CART_BAR_HEIGHT}px + env(safe-area-inset-bottom))` }} />
      {onAction ? (
        <div style={barStyle}>
          {summary}
          <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {secondaryHref && secondaryLabel && (
              <Link href={secondaryHref} style={{ color: palette.white, fontSize: 13, fontWeight: 700, textDecoration: "underline", whiteSpace: "nowrap" }}>
                {secondaryLabel}
              </Link>
            )}
            <button
              type="button"
              onClick={onAction}
              disabled={busy}
              style={{
                whiteSpace: "nowrap",
                background: palette.white,
                color: palette.pinkDark,
                border: "none",
                borderRadius: 100,
                padding: "8px 16px",
                fontFamily: "inherit",
                fontSize: 14,
                fontWeight: 900,
                cursor: busy ? "default" : "pointer",
                opacity: busy ? 0.7 : 1,
              }}
            >
              {busy ? "Enviando…" : `${actionLabel} →`}
            </button>
          </span>
        </div>
      ) : (
        <Link href={href} style={barStyle}>
          {summary}
          <span style={{ whiteSpace: "nowrap" }}>{actionLabel} →</span>
        </Link>
      )}
    </>
  );
}
