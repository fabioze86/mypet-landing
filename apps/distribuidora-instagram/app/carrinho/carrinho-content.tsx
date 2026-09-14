"use client";

import Link from "next/link";
import { useClientConfig } from "@mypet/core/theme";
import { useCart } from "@mypet/core/components/cart-provider";
import { formatPrice } from "@mypet/core/catalog-utils";

export default function CarrinhoContent() {
  const { palette } = useClientConfig();
  const { cart, removeItem, updateQty } = useCart();

  if (cart.items.length === 0) {
    return (
      <div style={{ maxWidth: 480, margin: "60px auto", textAlign: "center", padding: "0 20px" }}>
        <p style={{ fontSize: 15, color: palette.gray600, marginBottom: 16 }}>Seu carrinho está vazio.</p>
        <Link href="/ofertas-para-lojistas" style={{ color: palette.pink, fontWeight: 700, textDecoration: "none" }}>
          Ver ofertas →
        </Link>
      </div>
    );
  }

  const total = cart.items.reduce((sum, item) => sum + (item.unitPrice ?? 0) * item.qty, 0);

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "32px 20px 120px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 900, color: palette.navy, marginBottom: 20 }}>Seu carrinho</h1>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {cart.items.map((item) => (
          <div key={item.id} style={{ background: palette.white, border: `1px solid ${palette.gray200}`, borderRadius: 12, padding: 16, display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 800, color: palette.navy }}>{item.name}</p>
              <p style={{ fontSize: 13, color: palette.gray600 }}>
                {item.unitPrice != null ? formatPrice(item.unitPrice) : "Preço sob consulta"} × {item.qty}
              </p>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button type="button" onClick={() => updateQty(item.id, item.qty - 1)} style={{ border: `1px solid ${palette.gray200}`, borderRadius: 6, background: "transparent", cursor: "pointer" }}>−</button>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{item.qty}</span>
                <button type="button" onClick={() => updateQty(item.id, item.qty + 1)} style={{ border: `1px solid ${palette.gray200}`, borderRadius: 6, background: "transparent", cursor: "pointer" }}>+</button>
                <button type="button" onClick={() => removeItem(item.id)} style={{ marginLeft: 12, border: "none", background: "transparent", color: palette.orange, cursor: "pointer", fontSize: 13 }}>Remover</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 16, fontWeight: 900, color: palette.navy }}>
        <span>Total</span>
        <span>{formatPrice(total)}</span>
      </div>

      <p style={{ marginTop: 20, fontSize: 13, color: palette.gray600, textAlign: "center" }}>
        A finalização do pedido chega em uma próxima etapa. Por enquanto, seu carrinho fica salvo neste navegador.
      </p>
    </main>
  );
}
