"use client";

import { useCallback, useState } from "react";
import { useCart } from "@mypet/core/components/cart-provider";
import { AGENT_LEAD_STORAGE_KEY, AGENT_STORAGE_KEY } from "@mypet/core/agent-client";
import { goTo } from "../../agente/navigate";

export const LOGOUT_ERROR = "Não foi possível sair agora. Tente de novo.";

// Só limpa carrinho e conversa depois que o cookie foi apagado: se a rota
// falhar, o cliente continua logado com o pedido intacto.
export function useLogout() {
  const { clear: clearCart } = useCart();
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const logout = useCallback(async () => {
    setError(null);
    setLoggingOut(true);
    try {
      const res = await fetch("/api/sair", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
    } catch {
      setLoggingOut(false);
      setError(LOGOUT_ERROR);
      return;
    }
    clearCart();
    try {
      window.sessionStorage.removeItem(AGENT_STORAGE_KEY);
    } catch {
      // storage bloqueado: nada guardado para apagar
    }
    try {
      // o lead é dado pessoal: sair apaga o nome e o WhatsApp deste navegador
      window.localStorage.removeItem(AGENT_LEAD_STORAGE_KEY);
    } catch {
      // storage bloqueado: nada guardado para apagar
    }
    goTo("/");
  }, [clearCart]);

  return { logout, loggingOut, error };
}
