"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@mypet/core/components/cart-provider";
import { buildRetailQuoteMessage, buildWhatsAppLink } from "@mypet/core/whatsapp";
import type { Palette } from "@mypet/core/theme";
import { finalizeQuote } from "./actions";

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "";

export function CotacaoContent({ palette: PALETTE }: { palette: Palette }) {
  const { cart, removeItem, updateQty, clear } = useCart();
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div style={{ background: PALETTE.white, border: `1px solid ${PALETTE.gray200}`, borderRadius: 16, padding: 32, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: PALETTE.navy, marginBottom: 8 }}>Pedido enviado!</h2>
        <p style={{ fontSize: 14, color: PALETTE.gray600, marginBottom: 20 }}>
          Abrimos o WhatsApp com os itens do seu pedido. Nossa equipe vai te responder por lá.
        </p>
        <Link href="/" className="cta-primary" style={{ textDecoration: "none", display: "inline-block" }}>
          Voltar ao catálogo
        </Link>
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div style={{ background: PALETTE.white, border: `1px solid ${PALETTE.gray200}`, borderRadius: 16, padding: 32, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🛒</div>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: PALETTE.navy, marginBottom: 8 }}>Seu carrinho está vazio</h2>
        <Link href="/" className="cta-primary" style={{ textDecoration: "none", display: "inline-block" }}>Ver catálogo</Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!WHATSAPP_NUMBER) {
      setSubmitError("Não foi possível abrir o WhatsApp agora. Tente novamente mais tarde.");
      return;
    }
    setSubmitting(true);
    setSubmitError("");

    const result = await finalizeQuote({ nome, whatsapp });
    if (!result.ok) {
      setSubmitError(result.error);
      setSubmitting(false);
      return;
    }

    const message = buildRetailQuoteMessage(cart.items, { nome, whatsapp });
    window.open(buildWhatsAppLink(WHATSAPP_NUMBER, message), "_blank");

    clear();
    setSubmitted(true);
    setSubmitting(false);
  };

  return (
    <>
      <div style={{ background: PALETTE.white, border: `1px solid ${PALETTE.gray200}`, borderRadius: 16, marginBottom: 24, overflow: "hidden" }}>
        {cart.items.map((item, index) => (
          <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: 16, borderBottom: index < cart.items.length - 1 ? `1px solid ${PALETTE.gray100}` : "none" }}>
            <img src={item.img} alt={item.name} style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: PALETTE.navy, lineHeight: 1.3 }}>{item.name}</p>
              {item.sku && <p style={{ fontSize: 11, color: PALETTE.gray400 }}>SKU: {item.sku}</p>}
            </div>
            <div style={{ display: "flex", alignItems: "center", border: `1.5px solid ${PALETTE.gray200}`, borderRadius: 8 }}>
              <button type="button" onClick={() => updateQty(item.id, item.qty - 1)} aria-label="Diminuir quantidade" style={{ width: 28, height: 28, border: "none", background: "transparent", cursor: "pointer", fontSize: 16, color: PALETTE.gray600 }}>−</button>
              <span style={{ minWidth: 24, textAlign: "center", fontSize: 13, fontWeight: 700, color: PALETTE.navy }}>{item.qty}</span>
              <button type="button" onClick={() => updateQty(item.id, item.qty + 1)} aria-label="Aumentar quantidade" style={{ width: 28, height: 28, border: "none", background: "transparent", cursor: "pointer", fontSize: 16, color: PALETTE.gray600 }}>+</button>
            </div>
            <button type="button" onClick={() => removeItem(item.id)} aria-label={`Remover ${item.name}`} style={{ border: "none", background: "transparent", color: PALETTE.gray400, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Remover</button>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} style={{ background: PALETTE.white, border: `1px solid ${PALETTE.gray200}`, borderRadius: 16, padding: 24 }}>
        <input
          className="form-input"
          placeholder="Seu nome"
          required
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          style={{ width: "100%", padding: "12px 16px", border: `1.5px solid ${PALETTE.gray200}`, borderRadius: 10, fontSize: 15, marginBottom: 12 }}
        />
        <input
          className="form-input"
          placeholder="WhatsApp com DDD"
          required
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          style={{ width: "100%", padding: "12px 16px", border: `1.5px solid ${PALETTE.gray200}`, borderRadius: 10, fontSize: 15, marginBottom: 12 }}
        />
        {submitError && <p style={{ color: PALETTE.orange, fontSize: 13, marginBottom: 12, textAlign: "center" }}>{submitError}</p>}
        <button type="submit" className="form-submit" disabled={submitting} style={{ width: "100%", padding: 14, background: PALETTE.pink, color: "#fff", border: "none", borderRadius: 10, fontSize: 16, fontWeight: 800, cursor: "pointer" }}>
          {submitting ? "Enviando..." : "Enviar pedido pelo WhatsApp →"}
        </button>
      </form>
    </>
  );
}
