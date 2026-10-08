"use client";

import { useClientConfig } from "../theme";
import { useCart } from "./cart-provider";
import type { CartItem } from "../cart";

// Controle "adicionar e pronto": sem o item no carrinho mostra "Adicionar";
// com o item vira − N + ligado direto ao carrinho (N = quantidade no carrinho).
export function CartStepperControl({ product }: { product: Omit<CartItem, "qty"> }) {
  const { cart, addItem, updateQty } = useCart();
  const { palette } = useClientConfig();
  const qty = cart.items.find((item) => item.id === product.id && item.campaignId === undefined)?.qty ?? 0;

  if (qty === 0) {
    return (
      <button
        type="button"
        onClick={() => addItem(product, 1)}
        aria-label={`Adicionar ${product.name}`}
        style={{
          width: "100%",
          height: 38,
          marginTop: 8,
          background: palette.pink,
          color: palette.white,
          border: "none",
          borderRadius: 10,
          fontFamily: "var(--font-nunito), sans-serif",
          fontSize: 14,
          fontWeight: 800,
          cursor: "pointer",
        }}
      >
        Adicionar
      </button>
    );
  }

  const stepButton: React.CSSProperties = {
    width: 38,
    height: 38,
    border: "none",
    background: "transparent",
    color: palette.white,
    fontSize: 20,
    fontWeight: 800,
    cursor: "pointer",
  };

  return (
    <div
      role="group"
      aria-label={`Quantidade de ${product.name} no carrinho`}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 8,
        height: 38,
        background: palette.pinkDark,
        borderRadius: 10,
      }}
    >
      <button type="button" aria-label="Diminuir quantidade" onClick={() => updateQty(product.id, qty - 1)} style={stepButton}>
        −
      </button>
      <span aria-live="polite" style={{ color: palette.white, fontSize: 15, fontWeight: 900 }}>{qty}</span>
      <button type="button" aria-label="Aumentar quantidade" onClick={() => updateQty(product.id, qty + 1)} style={stepButton}>
        +
      </button>
    </div>
  );
}
