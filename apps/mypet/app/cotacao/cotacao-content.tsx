"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@mypet/core/components/cart-provider";
import { buildQuoteMessage, buildWhatsAppLink } from "@mypet/core/whatsapp";
import type { Palette } from "@mypet/core/theme";
import { finalizeQuote } from "./actions";

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "";
const WHATSAPP_INTRO = "Olá! Quero fazer este pedido pela Tabela de Preços My Pet Brasil:";

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

export function CotacaoContent({ palette: PALETTE }: { palette: Palette }) {
  const { cart, removeItem, updateQty, clear } = useCart();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const total = cart.items.reduce(
    (sum, item) => sum + (item.unitPrice != null ? item.unitPrice * item.qty : 0),
    0,
  );

  if (submitted) {
    return (
      <div className="ba-card" style={{ padding: "32px 20px", textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: PALETTE.navy, margin: "0 0 8px" }}>
          Pedido enviado!
        </h2>
        <p style={{ fontSize: 14, lineHeight: 1.55, color: PALETTE.gray600, margin: "0 0 20px" }}>
          Abrimos o WhatsApp com o seu pedido. Nosso time confirma estoque, frete e pagamento e fecha o pedido com você por lá.
        </p>
        <div className="cq-done-actions">
          <Link href="/pedido-rapido" className="ba-btn ba-btn-primary">
            Fazer novo pedido
          </Link>
          <Link href="/pedidos" className="ba-btn ba-btn-ghost">
            Ver meus pedidos
          </Link>
        </div>
        <style>{COTACAO_STYLES}</style>
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className="ba-card" style={{ padding: "32px 20px", textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🛒</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: PALETTE.navy, margin: "0 0 8px" }}>
          Seu pedido está vazio
        </h2>
        <p style={{ fontSize: 14, lineHeight: 1.55, color: PALETTE.gray600, margin: "0 0 20px" }}>
          Consulte a tabela e adicione produtos para montar seu pedido.
        </p>
        <Link href="/pedido-rapido" className="ba-btn ba-btn-primary">
          Abrir tabela de preços
        </Link>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!WHATSAPP_NUMBER) {
      setSubmitError("Não foi possível abrir o WhatsApp agora. Tente novamente mais tarde.");
      return;
    }
    setSubmitting(true);
    setSubmitError("");

    const result = await finalizeQuote(cart.items);

    if (!result.ok) {
      if (result.needsAuth) {
        router.push("/cadastro");
        return;
      }
      setSubmitError(result.error);
      setSubmitting(false);
      return;
    }

    const message = buildQuoteMessage(
      cart.items,
      { ...result.buyer, cnpj: result.buyer.cnpj ?? undefined },
      WHATSAPP_INTRO,
    );
    window.open(buildWhatsAppLink(WHATSAPP_NUMBER, message), "_blank");

    clear();
    setSubmitted(true);
    setSubmitting(false);
  };

  return (
    <>
      <style>{COTACAO_STYLES}</style>
      <div className="ba-card" style={{ marginBottom: 16, overflow: "hidden" }}>
        {cart.items.map((item) => (
          <div key={item.id} className="cq-row" style={{ borderColor: PALETTE.gray100 }}>
            <img src={item.img} alt={item.name} className="cq-img" />
            <div className="cq-info">
              {item.brand && (
                <p className="cq-brand" style={{ color: PALETTE.pinkDark }}>
                  {item.brand}
                </p>
              )}
              <p className="cq-name" style={{ color: PALETTE.navy }}>{item.name}</p>
              <p className="cq-meta" style={{ color: PALETTE.gray400 }}>
                {[item.sku ? `SKU: ${item.sku}` : null, item.unitPrice != null ? `${brl(item.unitPrice)} / un.` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <div className="cq-stepper" style={{ borderColor: PALETTE.gray200 }}>
              <button
                type="button"
                onClick={() => updateQty(item.id, item.qty - 1)}
                aria-label="Diminuir quantidade"
                style={{ color: PALETTE.gray600 }}
              >
                −
              </button>
              <span style={{ color: PALETTE.navy }}>{item.qty}</span>
              <button
                type="button"
                onClick={() => updateQty(item.id, item.qty + 1)}
                aria-label="Aumentar quantidade"
                style={{ color: PALETTE.gray600 }}
              >
                +
              </button>
            </div>
            <div className="cq-subtotal" style={{ color: PALETTE.navy }}>
              {item.unitPrice != null ? brl(item.unitPrice * item.qty) : "—"}
            </div>
            <button
              type="button"
              onClick={() => removeItem(item.id)}
              aria-label={`Remover ${item.name} do pedido`}
              className="cq-remove"
              style={{ color: PALETTE.gray600 }}
            >
              Remover
            </button>
          </div>
        ))}
      </div>

      <div className="ba-card" style={{ padding: 20 }}>
        <div className="cq-total" style={{ color: PALETTE.navy }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>Total:</span>
          <span style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{brl(total)}</span>
        </div>
        {submitError && (
          <p style={{ color: "#C0392B", fontSize: 13, fontWeight: 600, margin: "0 0 12px", textAlign: "center" }}>{submitError}</p>
        )}
        <button type="button" className="ba-btn ba-btn-primary ba-btn-block" disabled={submitting} onClick={handleSubmit}>
          {submitting ? "Enviando..." : "Enviar pedido pelo WhatsApp"}
        </button>
        <p style={{ fontSize: 12, lineHeight: 1.5, color: PALETTE.gray600, margin: "10px 0 0", textAlign: "center" }}>
          Abriremos o WhatsApp com o pedido pronto. Nosso time confirma estoque, frete e pagamento com você.
        </p>
      </div>
    </>
  );
}

const COTACAO_STYLES = `
  .cq-row { display: grid; grid-template-columns: 56px minmax(0, 1fr) auto 96px auto; align-items: center; gap: 16px; padding: 16px; border-bottom: 1px solid; }
  .cq-row:last-child { border-bottom: 0; }
  .cq-img { width: 56px; height: 56px; object-fit: contain; border-radius: 8px; }
  .cq-info { min-width: 0; }
  .cq-brand { margin: 0 0 2px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
  .cq-name { margin: 0; font-size: 14px; font-weight: 600; line-height: 1.35; overflow-wrap: anywhere; }
  .cq-meta { margin: 2px 0 0; font-size: 12px; line-height: 1.4; overflow-wrap: anywhere; }
  .cq-stepper { display: flex; align-items: center; border: 1.5px solid; border-radius: 8px; }
  .cq-stepper button { width: 32px; height: 32px; border: 0; background: transparent; font-size: 16px; cursor: pointer; }
  .cq-stepper span { min-width: 28px; text-align: center; font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .cq-subtotal { text-align: right; font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .cq-remove { border: 0; background: transparent; font-family: inherit; font-size: 13px; font-weight: 500; text-decoration: underline; text-underline-offset: 2px; cursor: pointer; padding: 6px 0; }
  .cq-remove:hover { color: #C0392B !important; }
  .cq-total { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 16px; }
  .cq-done-actions { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }

  @media (max-width: 640px) {
    .cq-row {
      grid-template-columns: 56px auto minmax(0, 1fr) auto;
      grid-template-areas: "img info info info" "stepper stepper remove subtotal";
      gap: 10px 12px;
      padding: 14px;
    }
    .cq-img { grid-area: img; align-self: start; }
    .cq-info { grid-area: info; }
    .cq-stepper { grid-area: stepper; justify-self: start; }
    .cq-stepper button { width: 38px; height: 38px; font-size: 18px; }
    .cq-remove { grid-area: remove; justify-self: start; }
    .cq-subtotal { grid-area: subtotal; font-size: 15px; }
    .cq-done-actions .ba-btn { flex: 1 1 100%; }
  }
`;
