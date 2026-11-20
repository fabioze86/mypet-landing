"use client";

import { formatBRL } from "@mypet/core/catalog-utils";
import { calcularFrete, paraCentavos, type Modalidade, type RegraFrete, type Zona } from "@mypet/core/frete";
import type { Palette } from "@mypet/core/theme";
import { FRETE_CONFIG } from "@/lib/frete.config";

export function FreteResumo({
  regra,
  zona,
  subtotal,
  modalidade,
  onModalidade,
  palette: P,
}: {
  regra: RegraFrete;
  zona: Zona;
  subtotal: number;
  modalidade: Modalidade;
  onModalidade: (m: Modalidade) => void;
  palette: Palette;
}) {
  const frete = calcularFrete({ regra, zona, subtotalCentavos: paraCentavos(subtotal), modalidade }, FRETE_CONFIG);
  const freteNormal = calcularFrete({ regra, zona, subtotalCentavos: paraCentavos(subtotal), modalidade: "normal" }, FRETE_CONFIG);
  const valor = frete.valorCentavos === null ? null : frete.valorCentavos / 100;
  const tarifaPrioritaria = FRETE_CONFIG.zonas[zona].prioritaria;

  return (
    <div className="fr-box" style={{ borderColor: P.gray200 }}>
      {frete.prioritariaDisponivel && regra === "zona" && (
        <fieldset className="fr-modes">
          <legend className="fr-legend" style={{ color: P.navy }}>Entrega</legend>
          <label>
            <input type="radio" name="modalidade" checked={modalidade === "normal"} onChange={() => onModalidade("normal")} />{" "}
            Normal ({FRETE_CONFIG.prazoNormal}) · {freteNormal.tipo === "gratis" ? "grátis" : formatBRL((freteNormal.valorCentavos ?? 0) / 100)}
          </label>
          <label>
            <input type="radio" name="modalidade" checked={modalidade === "prioritaria"} onChange={() => onModalidade("prioritaria")} />{" "}
            Prioritária (mesmo dia, pedidos até 12h) · {formatBRL((tarifaPrioritaria ?? 0) / 100)}
          </label>
        </fieldset>
      )}

      <div className="fr-line" style={{ color: P.navy }}>
        <span>Frete</span>
        <strong>{frete.tipo === "a_combinar" ? "A combinar no WhatsApp" : frete.tipo === "gratis" ? "Frete grátis" : formatBRL(valor ?? 0)}</strong>
      </div>

      {frete.modalidade === "normal" && frete.faltaParaGratisCentavos !== null && frete.faltaParaGratisCentavos > 0 && (
        <p className="fr-hint" style={{ color: P.pinkDark }}>
          Faltam {formatBRL(frete.faltaParaGratisCentavos / 100)} para o frete grátis
        </p>
      )}
      {frete.tipo !== "a_combinar" && (
        <div className="fr-line fr-total" style={{ color: P.navy }}>
          <span>Total com frete</span>
          <strong>{formatBRL(subtotal + (valor ?? 0))}</strong>
        </div>
      )}
      <style>{FRETE_STYLES}</style>
    </div>
  );
}

const FRETE_STYLES = `
  .fr-box { border-top: 1px solid; margin-top: 12px; padding-top: 12px; display: grid; gap: 8px; }
  .fr-modes { border: 0; padding: 0; margin: 0; display: grid; gap: 6px; font-size: 13px; }
  .fr-legend { font-size: 13px; font-weight: 700; margin-bottom: 4px; }
  .fr-line { display: flex; justify-content: space-between; align-items: baseline; font-size: 14px; }
  .fr-total strong { font-size: 18px; font-variant-numeric: tabular-nums; }
  .fr-hint { margin: 0; font-size: 13px; font-weight: 600; }
`;
