"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useCart } from "@mypet/core/components/cart-provider";
import { cartTotals } from "@mypet/core/cart";
import { formatPrice } from "@mypet/core/catalog-utils";
import { buildQuoteMessage, buildWhatsAppLink } from "@mypet/core/whatsapp";
import type { Palette } from "@mypet/core/theme";
import { applyServerPrices, registerOrder } from "./register-order";

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5511981030532";
const ORDER_INTRO = "Olá! Quero fazer este pedido:";

export function CotacaoContent({ palette: PALETTE }: { palette: Palette }) {
  const { cart, removeItem, updateQty, clear } = useCart();
  const [form, setForm] = useState({ nome: "", empresa: "", whatsapp: "", cnpj: "" });
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Guarda síncrona contra duplo toque: o disabled do botão só vale após o render.
  const inFlight = useRef(false);

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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setSubmitError("");
    setSubmitting(true);

    const result = await registerOrder(cart.items, form);
    if (result.kind === "invalid") {
      setSubmitError(result.error);
      setSubmitting(false);
      inFlight.current = false;
      return;
    }

    const items = result.kind === "ok" ? applyServerPrices(cart.items, result.prices, result.unavailableIds) : cart.items;
    const message = buildQuoteMessage(items, form, ORDER_INTRO, {
      showPrices: true,
      orderNumber: result.kind === "ok" ? result.number : undefined,
    });
    window.open(buildWhatsAppLink(WHATSAPP_NUMBER, message), "_self");
    clear();
  };

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
        <h2 style={{ fontSize: 16, fontWeight: 800, color: PALETTE.navy, marginBottom: 16 }}>
          Seus dados para o pedido
        </h2>
        <form onSubmit={handleSubmit}>
          <input className="form-input" placeholder="Seu nome" required value={form.nome} onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))} />
          <input className="form-input" placeholder="Nome do pet shop / empresa" required value={form.empresa} onChange={(event) => setForm((current) => ({ ...current, empresa: event.target.value }))} />
          <input className="form-input" placeholder="WhatsApp com DDD" required inputMode="tel" value={form.whatsapp} onChange={(event) => setForm((current) => ({ ...current, whatsapp: event.target.value }))} />
          <input className="form-input" placeholder="CNPJ (opcional)" inputMode="numeric" value={form.cnpj} onChange={(event) => setForm((current) => ({ ...current, cnpj: event.target.value }))} />
          {submitError && (
            <p role="alert" style={{ color: PALETTE.orange, fontSize: 13, marginBottom: 8, textAlign: "center" }}>{submitError}</p>
          )}
          <button type="submit" className="form-submit" disabled={submitting}>
            {submitting ? "Registrando pedido…" : "Enviar pedido pelo WhatsApp →"}
          </button>
        </form>
      </div>
    </>
  );
}
