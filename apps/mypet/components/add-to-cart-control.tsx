"use client";

import { useState } from "react";
import { PALETTE } from "@/lib/theme";
import { useCart } from "@/components/cart-provider";
import type { CartItem } from "@/lib/cart";

export function AddToCartControl({ product }: { product: Omit<CartItem, "qty"> }) {
  const { addItem } = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const handleAdd = () => {
    addItem(product, qty);
    setQty(1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center", border: `1.5px solid ${PALETTE.gray200}`, borderRadius: 8 }}>
        <button
          type="button"
          onClick={() => setQty((q) => Math.max(1, q - 1))}
          aria-label="Diminuir quantidade"
          style={{ width: 28, height: 28, border: "none", background: "transparent", cursor: "pointer", fontSize: 16, color: PALETTE.gray600 }}
        >
          −
        </button>
        <span style={{ minWidth: 24, textAlign: "center", fontSize: 13, fontWeight: 700, color: PALETTE.navy }}>{qty}</span>
        <button
          type="button"
          onClick={() => setQty((q) => q + 1)}
          aria-label="Aumentar quantidade"
          style={{ width: 28, height: 28, border: "none", background: "transparent", cursor: "pointer", fontSize: 16, color: PALETTE.gray600 }}
        >
          +
        </button>
      </div>
      <button
        type="button"
        onClick={handleAdd}
        style={{
          flex: 1,
          padding: "8px 0",
          background: added ? PALETTE.green : PALETTE.gray100,
          color: added ? PALETTE.white : PALETTE.navy,
          border: "none",
          borderRadius: 8,
          fontFamily: "Nunito, sans-serif",
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          transition: "background 0.2s, color 0.2s",
        }}
      >
        {added ? "Adicionado ✓" : "+ Adicionar à cotação"}
      </button>
    </div>
  );
}
