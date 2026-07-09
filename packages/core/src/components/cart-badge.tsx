"use client";

import Link from "next/link";
import { PALETTE } from "../theme";
import { useCart } from "./cart-provider";

export function CartBadge() {
  const { totalItems } = useCart();

  return (
    <Link
      href="/cotacao"
      aria-label={
        totalItems > 0
          ? `Carrinho de cotação com ${totalItems} ${totalItems === 1 ? "item" : "itens"}`
          : "Carrinho de cotação vazio"
      }
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 38,
        height: 38,
        borderRadius: "50%",
        background: PALETTE.gray100,
        textDecoration: "none",
        fontSize: 18,
      }}
    >
      🛒
      {totalItems > 0 && (
        <span
          style={{
            position: "absolute",
            top: -4,
            right: -4,
            minWidth: 18,
            height: 18,
            padding: "0 4px",
            borderRadius: 100,
            background: PALETTE.pink,
            color: PALETTE.white,
            fontSize: 11,
            fontWeight: 800,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 1,
          }}
        >
          {totalItems}
        </span>
      )}
    </Link>
  );
}
