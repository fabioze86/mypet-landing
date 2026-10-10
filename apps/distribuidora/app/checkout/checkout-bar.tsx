"use client";

import { CartBar, CART_BAR_HEIGHT } from "@mypet/core/components/cart-bar";
import { useClientConfig } from "@mypet/core/theme";
import { useCheckout } from "./use-checkout";

export function CheckoutBar() {
  const { checkout, sending, error } = useCheckout();
  const { palette } = useClientConfig();
  return (
    <>
      {error && (
        <p
          role="alert"
          style={{
            position: "fixed",
            left: 16,
            right: 16,
            bottom: `calc(${CART_BAR_HEIGHT + 8}px + env(safe-area-inset-bottom))`,
            zIndex: 41,
            background: palette.white,
            color: palette.orange,
            border: `1px solid ${palette.gray200}`,
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 13,
            fontWeight: 700,
            boxShadow: "0 6px 20px rgba(15,31,69,0.15)",
          }}
        >
          {error}
        </p>
      )}
      <CartBar
        actionLabel="Fechar pedido"
        onAction={() => void checkout()}
        busy={sending}
        secondaryHref="/cotacao"
        secondaryLabel="ver itens"
      />
    </>
  );
}
