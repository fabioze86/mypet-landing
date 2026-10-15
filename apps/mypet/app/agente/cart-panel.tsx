"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { formatBRL } from "@mypet/core/catalog-utils";
import { useCart } from "@mypet/core/components/cart-provider";
import { finalizeQuote } from "../cotacao/actions";
import { buildOrderWhatsAppUrl, hasWhatsAppNumber } from "../cotacao/whatsapp-order";

const SEND_FAILED = "Não foi possível enviar seu pedido agora. Tente novamente em instantes.";
const NO_WHATSAPP = "Não foi possível abrir o WhatsApp agora. Tente novamente mais tarde.";

// "sent" guarda a URL do WhatsApp: o window.open roda depois do await e pode
// ser bloqueado (ex.: iOS Safari), então a confirmação mostra um link visível.
type SendState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent"; whatsappUrl: string | null }
  | { kind: "error"; message: string };

export function CartPanel({
  conversationId,
  headingRef,
}: {
  conversationId: string | null;
  headingRef?: RefObject<HTMLHeadingElement | null>;
}) {
  const { cart, updateQty, removeItem, clear } = useCart();
  const [state, setState] = useState<SendState>({ kind: "idle" });
  const doneRef = useRef<HTMLDivElement>(null);
  const sent = state.kind === "sent";
  // o botão de envio some com a confirmação: leva o foco até ela (senão cai no <body>)
  useEffect(() => {
    if (sent) doneRef.current?.focus();
  }, [sent]);
  const [seenItems, setSeenItems] = useState(cart.items);
  // Itens mudaram: o erro some; "enviado" só some quando chegam itens novos
  // (o clear() logo após o envio esvazia o carrinho e a mensagem deve ficar).
  if (seenItems !== cart.items) {
    setSeenItems(cart.items);
    if (state.kind === "error" || (state.kind === "sent" && cart.items.length > 0)) setState({ kind: "idle" });
  }
  const hasUnpriced = cart.items.some((item) => item.unitPrice == null);
  const total = cart.items.reduce((sum, item) => sum + (item.unitPrice ?? 0) * item.qty, 0);

  async function send() {
    if (!hasWhatsAppNumber()) {
      setState({ kind: "error", message: NO_WHATSAPP });
      return;
    }
    setState({ kind: "sending" });
    let result: Awaited<ReturnType<typeof finalizeQuote>>;
    try {
      result = await finalizeQuote(cart.items, conversationId ? { agentConversationId: conversationId } : {});
    } catch {
      setState({ kind: "error", message: SEND_FAILED });
      return;
    }
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
    setState({ kind: "sent", whatsappUrl: url });
  }

  return (
    <div className="ag-cart">
      <h2 className="ag-cart-title" ref={headingRef} tabIndex={-1}>
        Seu pedido
      </h2>

      {state.kind === "sent" ? (
        <div className="ag-cart-done" role="status" tabIndex={-1} ref={doneRef}>
          <p>
            Pedido enviado! Abrimos o WhatsApp com o seu pedido. Nosso time confirma estoque, frete e pagamento por lá.
          </p>
          {state.whatsappUrl && (
            <p>
              O WhatsApp não abriu?{" "}
              <a href={state.whatsappUrl} target="_blank" rel="noopener noreferrer">
                Abrir WhatsApp
              </a>
            </p>
          )}
        </div>
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
                    {item.unitPrice != null ? formatBRL(item.unitPrice * item.qty) : "Preço na tabela"}
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
                  <span className="ag-cart-qty" aria-live="polite">
                    {item.qty}
                  </span>
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
            <span>
              Total{" "}
              {hasUnpriced && <small className="ag-cart-total-note">+ itens sem preço</small>}
            </span>
            <strong>{formatBRL(total)}</strong>
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
