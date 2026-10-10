"use client";

import Link from "next/link";
import { useCart } from "@mypet/core/components/cart-provider";
import { cartTotals } from "@mypet/core/cart";
import { formatPrice } from "@mypet/core/catalog-utils";
import { formatCnpj, formatWhatsapp } from "@mypet/core/br-validation";
import type { Palette } from "@mypet/core/theme";
import { useCheckout } from "../checkout/use-checkout";
import { useIdentity } from "../identity/identity-store";
import { useIdentityGate } from "../identity/identity-gate";

export function CotacaoContent({ palette: PALETTE }: { palette: Palette }) {
  const { cart, removeItem, updateQty } = useCart();
  const identity = useIdentity();
  const { openIdentityGate } = useIdentityGate();
  const { checkout, sending, error } = useCheckout();

  if (cart.items.length === 0) {
    return (
      <div style={{ background: PALETTE.white, border: `1px solid ${PALETTE.gray200}`, borderRadius: 16, padding: 32, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🛒</div>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: PALETTE.navy, marginBottom: 8 }}>
          Seu carrinho está vazio
        </h2>
        <p style={{ fontSize: 14, color: PALETTE.gray600, marginBottom: 20 }}>
          Adicione produtos do catálogo para montar seu pedido.
        </p>
        <Link href="/" className="cta-primary" style={{ textDecoration: "none", display: "inline-block" }}>
          Ver catálogo
        </Link>
      </div>
    );
  }

  const totals = cartTotals(cart.items);

  return (
    <>
      <div style={{ background: PALETTE.white, border: `1px solid ${PALETTE.gray200}`, borderRadius: 16, marginBottom: 16, overflow: "hidden" }}>
        {cart.items.map((item, index) => (
          <div
            key={item.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: 16,
              flexWrap: "wrap",
              borderBottom: index < cart.items.length - 1 ? `1px solid ${PALETTE.gray100}` : "none",
            }}
          >
            <img src={item.img} alt={item.name} style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
            <div style={{ flex: "1 1 160px", minWidth: 0 }}>
              {item.brand && (
                <p style={{ fontSize: 10, color: PALETTE.pink, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>
                  {item.brand}
                </p>
              )}
              <p style={{ fontSize: 14, fontWeight: 700, color: PALETTE.navy, lineHeight: 1.3 }}>{item.name}</p>
              {item.sku && <p style={{ fontSize: 11, color: PALETTE.gray400 }}>SKU: {item.sku}</p>}
              <p style={{ fontSize: 12, color: PALETTE.gray600, marginTop: 2 }}>
                {typeof item.unitPrice === "number" ? `${formatPrice(item.unitPrice)} / un.` : "Preço a confirmar"}
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", border: `1.5px solid ${PALETTE.gray200}`, borderRadius: 8 }}>
              <button
                type="button"
                onClick={() => updateQty(item.id, item.qty - 1)}
                aria-label="Diminuir quantidade"
                style={{ width: 32, height: 32, border: "none", background: "transparent", cursor: "pointer", fontSize: 16, color: PALETTE.gray600 }}
              >
                −
              </button>
              <span style={{ minWidth: 28, textAlign: "center", fontSize: 13, fontWeight: 700, color: PALETTE.navy }}>{item.qty}</span>
              <button
                type="button"
                onClick={() => updateQty(item.id, item.qty + 1)}
                aria-label="Aumentar quantidade"
                style={{ width: 32, height: 32, border: "none", background: "transparent", cursor: "pointer", fontSize: 16, color: PALETTE.gray600 }}
              >
                +
              </button>
            </div>
            <div style={{ minWidth: 88, textAlign: "right" }}>
              <p style={{ fontSize: 14, fontWeight: 900, color: PALETTE.navy }}>
                {typeof item.unitPrice === "number" ? formatPrice(Math.round(item.unitPrice * item.qty * 100) / 100) : "a consultar"}
              </p>
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                aria-label={`Remover ${item.name} do carrinho`}
                style={{ border: "none", background: "transparent", color: PALETTE.gray400, cursor: "pointer", fontSize: 12, fontWeight: 700 }}
              >
                Remover
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: PALETTE.white, border: `1px solid ${PALETTE.gray200}`, borderRadius: 16, padding: 20, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: PALETTE.gray600, marginBottom: 8 }}>
          <span>Total de unidades</span>
          <span style={{ fontWeight: 800, color: PALETTE.navy }}>{totals.totalUnits}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: PALETTE.navy }}>Total</span>
          <span data-testid="cart-total" style={{ fontSize: 22, fontWeight: 900, color: PALETTE.pink }}>
            {totals.pricedLines > 0 ? formatPrice(totals.totalValue) : "a consultar"}
          </span>
        </div>
        {totals.unpricedLines > 0 && totals.pricedLines > 0 && (
          <p style={{ fontSize: 12, color: PALETTE.gray600, marginTop: 8 }}>
            Itens sem preço serão confirmados pelo atendente.
          </p>
        )}
      </div>

      <div style={{ background: PALETTE.white, border: `1px solid ${PALETTE.gray200}`, borderRadius: 16, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: PALETTE.navy }}>Seus dados</h2>
          <button
            type="button"
            onClick={openIdentityGate}
            style={{ background: "none", border: "none", color: PALETTE.pink, fontSize: 13, fontWeight: 800, cursor: "pointer" }}
          >
            Alterar dados
          </button>
        </div>
        {identity && (
          <dl style={{ fontSize: 14, color: PALETTE.gray800, marginBottom: 20, display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px" }}>
            <dt style={{ color: PALETTE.gray600 }}>Nome</dt>
            <dd>{identity.nome}</dd>
            <dt style={{ color: PALETTE.gray600 }}>WhatsApp</dt>
            <dd>{formatWhatsapp(identity.whatsapp)}</dd>
            {identity.cnpj && (
              <>
                <dt style={{ color: PALETTE.gray600 }}>CNPJ</dt>
                <dd>{formatCnpj(identity.cnpj)}</dd>
              </>
            )}
          </dl>
        )}
        {error && (
          <p role="alert" style={{ color: PALETTE.orange, fontSize: 13, marginBottom: 8, textAlign: "center" }}>{error}</p>
        )}
        <button type="button" className="form-submit" disabled={sending} onClick={() => void checkout()}>
          {sending ? "Registrando pedido…" : "Fechar pedido pelo WhatsApp →"}
        </button>
      </div>
    </>
  );
}
