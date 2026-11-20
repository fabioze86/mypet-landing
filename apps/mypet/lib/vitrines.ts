import type { RegraFrete } from "@mypet/core/frete";

export type VitrineId = "completo" | "fabrica";
export type Vitrine = {
  id: VitrineId;
  rotulo: string;
  basePath: string;
  homePath: string;
  alsoInChannel?: string;
  regraFrete: RegraFrete;
  cartKey: string;
};

export const VITRINES: Record<VitrineId, Vitrine> = {
  completo: { id: "completo", rotulo: "Catálogo completo", basePath: "", homePath: "/produtos", regraFrete: "zona", cartKey: "mypet_cart" },
  fabrica: {
    id: "fabrica",
    rotulo: "Linha de Fábrica",
    basePath: "/fabrica",
    homePath: "/fabrica",
    alsoInChannel: "ffa_fabrica",
    regraFrete: "fabrica",
    cartKey: "mypet_cart_fabrica",
  },
};

export function isVitrineId(v: unknown): v is VitrineId {
  return v === "completo" || v === "fabrica";
}
