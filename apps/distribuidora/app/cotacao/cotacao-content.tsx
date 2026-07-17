"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@mypet/core/components/cart-provider";
import { submitLead } from "@mypet/core/leads";
import { buildQuoteMessage, buildWhatsAppLink } from "@mypet/core/whatsapp";
import type { Palette } from "@mypet/core/theme";

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "";

export function CotacaoContent({ palette: PALETTE }: { palette: Palette }) {
  const { cart, removeItem, updateQty, clear } = useCart();
  const [form, setForm] = useState({ nome: "", empresa: "", whatsapp: "", cnpj: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div style={{ background: PALETTE.white, border: `1px solid ${PALETTE.gray200}`, borderRadius: 16, padding: 32, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: PALETTE.navy, marginBottom: 8 }}>
          Cotação enviada!
        </h2>
        <p style={{ fontSize: 14, color: PALETTE.gray600, marginBottom: 20 }}>
          Abrimos o WhatsApp com os itens da sua cotação. Nossa equipe vai te responder por lá.
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
        <h2 style={{ fontSize: 18, fontWeight: 800, color: PALETTE.navy, marginBottom: 8 }}>
          Sua cotação está vazia
        </h2>
        <p style={{ fontSize: 14, color: PALETTE.gray600, marginBottom: 20 }}>
          Adicione produtos do catálogo para montar sua cotação.
        </p>
        <Link href="/" className="cta-primary" style={{ textDecoration: "none", display: "inline-block" }}>
          Ver catálogo
        </Link>
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
    const error = await submitLead(form);
    if (error) {
      setSubmitError(error);
      setSubmitting(false);
      return;
    }

    const message = buildQuoteMessage(cart.items, form);
    window.open(buildWhatsAppLink(WHATSAPP_NUMBER, message), "_blank");

    clear();
    setSubmitted(true);
    setSubmitting(false);
  };

  return (
    <>
      <div style={{ background: PALETTE.white, border: `1px solid ${PALETTE.gray200}`, borderRadius: 16, marginBottom: 24, overflow: "hidden" }}>
        {cart.items.map((item, index) => (
          <div
            key={item.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: 16,
              borderBottom: index < cart.items.length - 1 ? `1px solid ${PALETTE.gray100}` : "none",
            }}
          >
            <img src={item.img} alt={item.name} style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              {item.brand && (
                <p style={{ fontSize: 10, color: PALETTE.pink, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>
                  {item.brand}
                </p>
              )}
              <p style={{ fontSize: 14, fontWeight: 700, color: PALETTE.navy, lineHeight: 1.3 }}>{item.name}</p>
              {item.sku && <p style={{ fontSize: 11, color: PALETTE.gray400 }}>SKU: {item.sku}</p>}
            </div>
            <div style={{ display: "flex", alignItems: "center", border: `1.5px solid ${PALETTE.gray200}`, borderRadius: 8 }}>
              <button
                type="button"
                onClick={() => updateQty(item.id, item.qty - 1)}
                aria-label="Diminuir quantidade"
                style={{ width: 28, height: 28, border: "none", background: "transparent", cursor: "pointer", fontSize: 16, color: PALETTE.gray600 }}
              >
                −
              </button>
              <span style={{ minWidth: 24, textAlign: "center", fontSize: 13, fontWeight: 700, color: PALETTE.navy }}>{item.qty}</span>
              <button
                type="button"
                onClick={() => updateQty(item.id, item.qty + 1)}
                aria-label="Aumentar quantidade"
                style={{ width: 28, height: 28, border: "none", background: "transparent", cursor: "pointer", fontSize: 16, color: PALETTE.gray600 }}
              >
                +
              </button>
            </div>
            <button
              type="button"
              onClick={() => removeItem(item.id)}
              aria-label={`Remover ${item.name} da cotação`}
              style={{ border: "none", background: "transparent", color: PALETTE.gray400, cursor: "pointer", fontSize: 13, fontWeight: 700 }}
            >
              Remover
            </button>
          </div>
        ))}
      </div>

      <div style={{ background: PALETTE.white, border: `1px solid ${PALETTE.gray200}`, borderRadius: 16, padding: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: PALETTE.navy, marginBottom: 16 }}>
          Seus dados para a cotação
        </h2>
        <form onSubmit={handleSubmit}>
          <input className="form-input" placeholder="Seu nome" required value={form.nome} onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))} />
          <input className="form-input" placeholder="Nome do pet shop / empresa" required value={form.empresa} onChange={(e) => setForm((prev) => ({ ...prev, empresa: e.target.value }))} />
          <input className="form-input" placeholder="WhatsApp com DDD" required value={form.whatsapp} onChange={(e) => setForm((prev) => ({ ...prev, whatsapp: e.target.value }))} />
          <input className="form-input" placeholder="CNPJ (opcional)" value={form.cnpj} onChange={(e) => setForm((prev) => ({ ...prev, cnpj: e.target.value }))} />
          {submitError && (
            <p style={{ color: PALETTE.orange, fontSize: 13, marginBottom: 8, textAlign: "center" }}>{submitError}</p>
          )}
          <button type="submit" className="form-submit" disabled={submitting}>
            {submitting ? "Enviando..." : "Finalizar cotação →"}
          </button>
        </form>
      </div>
    </>
  );
}
