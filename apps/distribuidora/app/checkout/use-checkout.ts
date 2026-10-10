"use client";

import { useCallback, useRef, useState } from "react";
import { useCart } from "@mypet/core/components/cart-provider";
import { buildQuoteMessage, buildWhatsAppLink } from "@mypet/core/whatsapp";
import { formatCnpj, formatWhatsapp } from "@mypet/core/br-validation";
import { useIdentity } from "../identity/identity-store";
import { useIdentityGate } from "../identity/identity-gate";
import { applyServerPrices, registerOrder } from "../cotacao/register-order";

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5511981030532";
const ORDER_INTRO = "Olá! Quero fazer este pedido:";

// Grava o pedido com os dados do pop-up e abre o WhatsApp. Só erro de validação (400) segura o envio.
export function useCheckout() {
  const { cart, clear } = useCart();
  const identity = useIdentity();
  const { openIdentityGate } = useIdentityGate();
  const [sending, setSending] = useState(false);
  // Erro de validação vale para o carrinho que foi enviado: mudou o carrinho, some o aviso
  // (derivado da assinatura, sem setState em efeito).
  const cartSignature = cart.items.map((item) => `${item.id}:${item.qty}`).join("|");
  const [failure, setFailure] = useState<{ error: string; signature: string } | null>(null);
  const error = failure && failure.signature === cartSignature ? failure.error : "";
  // Guarda síncrona contra duplo toque: o disabled só vale após o render.
  const inFlight = useRef(false);

  const checkout = useCallback(async () => {
    if (inFlight.current || cart.items.length === 0) return;
    if (!identity) {
      openIdentityGate();
      return;
    }
    inFlight.current = true;
    setSending(true);
    setFailure(null);

    const result = await registerOrder(cart.items, {
      nome: identity.nome,
      whatsapp: identity.whatsapp,
      ...(identity.cnpj ? { cnpj: identity.cnpj } : {}),
    });
    if (result.kind === "invalid") {
      setFailure({ error: result.error, signature: cartSignature });
      setSending(false);
      inFlight.current = false;
      return;
    }

    const items = result.kind === "ok" ? applyServerPrices(cart.items, result.prices, result.unavailableIds) : cart.items;
    const message = buildQuoteMessage(
      items,
      {
        nome: identity.nome,
        whatsapp: formatWhatsapp(identity.whatsapp),
        ...(identity.cnpj ? { cnpj: formatCnpj(identity.cnpj) } : {}),
      },
      ORDER_INTRO,
      { showPrices: true, orderNumber: result.kind === "ok" ? result.number : undefined },
    );
    window.open(buildWhatsAppLink(WHATSAPP_NUMBER, message), "_self");
    clear();
    setSending(false);
    inFlight.current = false;
  }, [cart.items, cartSignature, clear, identity, openIdentityGate]);

  return { checkout, sending, error };
}
