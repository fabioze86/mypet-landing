import { formatBRL } from "@mypet/core/catalog-utils";
import { ZONA_ROTULO, type RegraFrete, type Zona } from "@mypet/core/frete";
import type { Palette } from "@mypet/core/theme";
import { FRETE_CONFIG } from "@/lib/frete.config";

export function textoFaixa(regra: RegraFrete, zona: Zona): string {
  if (regra === "fabrica") {
    return `Frete grátis para todo o Brasil acima de ${formatBRL(FRETE_CONFIG.fabrica.minimoGratis / 100)}. Abaixo disso, ${formatBRL(FRETE_CONFIG.fabrica.fixo / 100)}.`;
  }
  const minimo = FRETE_CONFIG.zonas[zona].minimoGratis;
  if (zona === "fora" || minimo === null) return "Frete sob consulta para a sua região.";
  return `Sua região: ${ZONA_ROTULO[zona]} · frete grátis a partir de ${formatBRL(minimo / 100)}.`;
}

export function FreteFaixa({ regra, zona, palette: P }: { regra: RegraFrete; zona: Zona; palette: Palette }) {
  return (
    <p role="note" style={{ background: P.pinkLight, color: P.navy, borderRadius: 10, padding: "10px 14px", fontSize: 14, fontWeight: 600, margin: "0 0 16px" }}>
      🚚 {textoFaixa(regra, zona)}
    </p>
  );
}
