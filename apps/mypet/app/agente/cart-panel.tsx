"use client";

import { useState, type RefObject } from "react";
import { useCart } from "@mypet/core/components/cart-provider";
import { finalizeQuote } from "../cotacao/actions";
import { buildOrderWhatsAppUrl, hasWhatsAppNumber } from "../cotacao/whatsapp-order";

const brl = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
const NO_WHATSAPP = "Não foi possível abrir o WhatsApp agora. Tente novamente mais tarde.";

type SendState = { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "error"; message: string };

export function CartPanel({
  conversationId,
  headingRef,
}: {
  conversationId: string | null;
  headingRef?: RefObject<HTMLHeadingElement | null>;
}) {
  const { cart, updateQty, removeItem, clear } = useCart();
  const [state, setState] = useState<SendState>({ kind: "idle" });
  const total = cart.items.reduce((sum, item) => sum + (item.unitPrice ?? 0) * item.qty, 0);

  async function send() {
    if (!hasWhatsAppNumber()) {
      setState({ kind: "error", message: NO_WHATSAPP });
      return;
    }
    setState({ kind: "sending" });
    const result = await finalizeQuote(cart.items, conversationId ? { agentConversationId: conversationId } : {});
    if (!result.ok) {
      if (result.needsAuth) {
        window.location.assign("/agente");
        return;
      }
      setState({ kind: "error", message: result.error });
      return;
    }
    const url = buildOrderWhatsAppUrl(cart.items, result.buyer);
    if (url) window.open(url, "_blank");
    clear();
    setState({ kind: "sent" });
  }

  return (
    <div className="ag-cart">
      <h2 className="ag-cart-title" ref={headingRef} tabIndex={-1}>
        Seu pedido
      </h2>

      {state.kind === "sent" ? (
        <p className="ag-cart-done" role="status">
          Pedido enviado! Abrimos o WhatsApp com o seu pedido. Nosso time confirma estoque, frete e pagamento por lá.
        </p>
      ) : cart.items.length === 0 ? (
        <p className="ag-cart-empty">
          Seu pedido está vazio. Peça ao agente (ex.: “põe 10 do shampoo neutro 5L”) ou use a{" "}
          <a href="/pedido-rapido">tabela de preços</a>.
        </p>
      ) : (
        <>
          <ul className="ag-cart-items">
            {cart.items.map((item) => (
              <li key={`${item.id}-${item.campaignId ?? ""}`} className="ag-cart-item">
                <div className="ag-cart-item-info">
                  <span className="ag-cart-item-name">{item.name}</span>
                  <span className="ag-cart-item-price">
                    {item.unitPrice != null ? brl(item.unitPrice * item.qty) : "Sob consulta"}
                  </span>
                </div>
                <div className="ag-cart-stepper">
                  <button
                    type="button"
                    aria-label={`Diminuir quantidade de ${item.name}`}
                    onClick={() => updateQty(item.id, item.qty - 1, item.campaignId)}
                  >
                    −
                  </button>
                  <span aria-label={`Quantidade de ${item.name}`}>{item.qty}</span>
                  <button
                    type="button"
                    aria-label={`Aumentar quantidade de ${item.name}`}
                    onClick={() => updateQty(item.id, item.qty + 1, item.campaignId)}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className="ag-cart-remove"
                    aria-label={`Tirar ${item.name} do pedido`}
                    onClick={() => removeItem(item.id, item.campaignId)}
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <p className="ag-cart-total">
            <span>Total</span>
            <strong>{brl(total)}</strong>
          </p>
          {state.kind === "error" && (
            <p className="ag-cart-error" role="alert">
              {state.message}
            </p>
          )}
          <button type="button" className="ag-cart-send" disabled={state.kind === "sending"} onClick={send}>
            {state.kind === "sending" ? "Enviando…" : "Enviar pedido pelo WhatsApp"}
          </button>
        </>
      )}
    </div>
  );
}
