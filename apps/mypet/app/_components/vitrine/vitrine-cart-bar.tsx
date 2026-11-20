"use client";

import Link from "next/link";
import { formatBRL } from "@mypet/core/catalog-utils";
import { useCart } from "@mypet/core/components/cart-provider";
import { calcularFrete, paraCentavos, type Zona } from "@mypet/core/frete";
import type { Palette } from "@mypet/core/theme";
import { FRETE_CONFIG } from "@/lib/frete.config";
import type { Vitrine } from "@/lib/vitrines";

export function VitrineCartBar({ vitrine, zona, palette: P }: { vitrine: Vitrine; zona: Zona; palette: Palette }) {
  const { cart, totalItems } = useCart();
  if (totalItems === 0) return null;
  const subtotal = cart.items.reduce((s, i) => s + (i.unitPrice ?? 0) * i.qty, 0);
  const f = calcularFrete({ regra: vitrine.regraFrete, zona, subtotalCentavos: paraCentavos(subtotal), modalidade: "normal" }, FRETE_CONFIG);
  return (
    <div className="vt-cartbar" style={{ background: P.white, borderColor: P.gray200 }}>
      <div className="vt-cartbar-info" style={{ color: P.navy }}>
        <span>{totalItems} {totalItems === 1 ? "item" : "itens"} — {formatBRL(subtotal)}</span>
        {f.tipo === "gratis" && <span className="vt-cartbar-frete">Frete grátis</span>}
        {f.tipo !== "gratis" && !!f.faltaParaGratisCentavos && (
          <span className="vt-cartbar-frete">Faltam {formatBRL(f.faltaParaGratisCentavos / 100)} para o frete grátis</span>
        )}
      </div>
      <Link href={`${vitrine.basePath}/cotacao`} className="ba-btn ba-btn-primary">
        Ver pedido
      </Link>
    </div>
  );
}
