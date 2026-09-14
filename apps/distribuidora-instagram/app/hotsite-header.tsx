"use client";

import Link from "next/link";
import { useClientConfig } from "@mypet/core/theme";
import { useCart } from "@mypet/core/components/cart-provider";

// Cabeçalho mínimo fixo do hotsite: nome/logo à esquerda, link para o
// carrinho com contador à direita. Sem menus/categorias — o app tem só duas
// telas (listagem de ofertas e carrinho), então um SiteNav completo seria
// over-engineering aqui. Existe para resolver um problema concreto: depois
// de "Adicionar" numa oferta na listagem, não havia nenhum jeito visível de
// chegar em /carrinho.
export function HotsiteHeader() {
  const clientConfig = useClientConfig();
  const { totalItems } = useCart();
  const { palette } = clientConfig;

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 20px",
        background: palette.navy,
        color: palette.white,
      }}
    >
      <Link
        href="/ofertas-para-lojistas"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          color: palette.white,
          textDecoration: "none",
          fontWeight: 800,
          fontSize: 14,
        }}
      >
        <span style={{ fontSize: 20 }}>{clientConfig.logo.emoji}</span>
        {clientConfig.name}
      </Link>

      <Link
        href="/carrinho"
        aria-label={
          totalItems > 0
            ? `Carrinho com ${totalItems} ${totalItems === 1 ? "item" : "itens"}`
            : "Carrinho vazio"
        }
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 6,
          color: palette.white,
          textDecoration: "none",
          fontSize: 13,
          fontWeight: 700,
          background: "rgba(255,255,255,0.12)",
          borderRadius: 100,
          padding: "6px 14px",
        }}
      >
        🛒 Carrinho
        {totalItems > 0 && (
          <span
            style={{
              minWidth: 18,
              height: 18,
              padding: "0 4px",
              borderRadius: 100,
              background: palette.pink,
              color: palette.white,
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
    </header>
  );
}
