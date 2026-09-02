"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  buildEstimate,
  LOGISTICS_DISCOUNT_PCT,
  type BalcaoEligibleProduct,
  type BalcaoLogistics,
} from "@mypet/core/balcao-calc";
import type { Palette } from "@mypet/core/theme";
import { submitBalcaoRequest } from "./actions";

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

const DISCLAIMER = "Condição sujeita à validação de estoque, margem e disponibilidade.";

export function BalcaoContent({
  products,
  palette: P,
}: {
  products: BalcaoEligibleProduct[];
  palette: Palette;
}) {
  const router = useRouter();
  const [qty, setQty] = useState<Record<string, number>>({});
  const [logistics, setLogistics] = useState<BalcaoLogistics>("retirada");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const selections = useMemo(
    () =>
      Object.entries(qty)
        .map(([productId, q]) => ({ productId, qty: q }))
        .filter((s) => s.qty >= 1),
    [qty],
  );

  const estimate = useMemo(
    () => buildEstimate({ products, selections, logistics }),
    [products, selections, logistics],
  );

  if (submitted) {
    return (
      <div
        style={{
          background: P.white,
          border: `1px solid ${P.gray200}`,
          borderRadius: 16,
          padding: 32,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: P.navy, marginBottom: 8 }}>
          Solicitação enviada!
        </h2>
        <p style={{ fontSize: 14, color: P.gray600, marginBottom: 8 }}>
          Nossa equipe vai analisar e entrar em contato com a condição confirmada.
        </p>
        <p style={{ fontSize: 12, color: P.gray400, marginBottom: 20 }}>{DISCLAIMER}</p>
        <Link
          href="/loja"
          className="cta-primary"
          style={{ textDecoration: "none", display: "inline-block" }}
        >
          Voltar ao catálogo
        </Link>
      </div>
    );
  }

  const setQ = (id: string, v: number) =>
    setQty((cur) => ({ ...cur, [id]: Number.isFinite(v) && v > 0 ? Math.floor(v) : 0 }));

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    let result: Awaited<ReturnType<typeof submitBalcaoRequest>>;
    try {
      result = await submitBalcaoRequest({ selections, logistics, note });
    } catch {
      setError("Não foi possível enviar agora. Tente novamente.");
      setSubmitting(false);
      return;
    }
    if (!result.ok) {
      if (result.needsAuth) {
        router.push("/entrar");
        return;
      }
      setError(result.error);
      setSubmitting(false);
      return;
    }
    setSubmitted(true);
    setSubmitting(false);
  };

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <div
        style={{
          background: P.white,
          border: `1px solid ${P.gray200}`,
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        {products.map((p, i) => {
          const line = estimate.lines.find((l) => l.product.id === p.id);
          return (
            <div
              key={p.id}
              style={{
                display: "flex",
                gap: 16,
                padding: 16,
                alignItems: "center",
                borderBottom: i < products.length - 1 ? `1px solid ${P.gray100}` : "none",
              }}
            >
              <img
                src={p.img}
                alt={p.name}
                style={{
                  width: 56,
                  height: 56,
                  objectFit: "contain",
                  borderRadius: 8,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: P.navy }}>{p.name}</p>
                <p style={{ fontSize: 11, color: P.gray400 }}>
                  SKU: {p.sku} · base {brl(p.basePrice)}
                </p>
                <p style={{ fontSize: 11, color: P.gray600 }}>
                  Faixas:{" "}
                  {p.rule.tiers
                    .map((t) => `${t.minQty}+ (−${t.discountPct}%)`)
                    .join(" · ") || "sem faixa"}
                </p>
              </div>
              <input
                type="number"
                min={0}
                aria-label={`Quantidade de ${p.name}`}
                value={qty[p.id] ?? ""}
                onChange={(e) => setQ(p.id, Number(e.target.value))}
                style={{
                  width: 72,
                  padding: "8px 10px",
                  border: `1.5px solid ${P.gray200}`,
                  borderRadius: 8,
                  fontSize: 14,
                }}
              />
              <div style={{ width: 150, textAlign: "right" }}>
                {line ? (
                  <>
                    <p style={{ fontSize: 14, fontWeight: 800, color: P.navy }}>
                      {brl(line.unitPrice)}/un.
                    </p>
                    <p style={{ fontSize: 11, color: line.tier ? P.green : P.gray400 }}>
                      {line.tier
                        ? `faixa ${line.tier.minQty}+ · −${line.volumePct}%`
                        : "sem faixa"}{" "}
                      · −{line.logisticsPct}% log.
                    </p>
                    <p style={{ fontSize: 11, color: P.gray600 }}>{brl(line.lineTotal)}</p>
                  </>
                ) : (
                  <p style={{ fontSize: 12, color: P.gray400 }}>—</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          background: P.white,
          border: `1px solid ${P.gray200}`,
          borderRadius: 16,
          padding: 20,
          display: "grid",
          gap: 16,
        }}
      >
        <div>
          <p style={{ fontSize: 13, fontWeight: 800, color: P.navy, marginBottom: 8 }}>
            Modalidade logística (−{LOGISTICS_DISCOUNT_PCT}%)
          </p>
          <label style={{ display: "block", fontSize: 14, marginBottom: 6 }}>
            <input
              type="radio"
              name="logistics"
              checked={logistics === "retirada"}
              onChange={() => setLogistics("retirada")}
            />{" "}
            Retirada no ponto de apoio
          </label>
          <label style={{ display: "block", fontSize: 14 }}>
            <input
              type="radio"
              name="logistics"
              checked={logistics === "frete_proprio"}
              onChange={() => setLogistics("frete_proprio")}
            />{" "}
            Frete por conta própria
          </label>
        </div>
        <div>
          <label
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: P.navy,
              display: "block",
              marginBottom: 6,
            }}
          >
            Observação (opcional)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={2000}
            style={{
              width: "100%",
              padding: 10,
              border: `1.5px solid ${P.gray200}`,
              borderRadius: 8,
              fontSize: 14,
              resize: "vertical",
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <p style={{ fontSize: 12, color: P.gray600 }}>Total estimado</p>
            <p style={{ fontSize: 22, fontWeight: 900, color: P.navy }}>
              {brl(estimate.totalEstimated)}
            </p>
          </div>
          <button
            className="cta-primary"
            disabled={submitting || !estimate.qualifies}
            onClick={handleSubmit}
          >
            {submitting ? "Enviando..." : "Enviar solicitação"}
          </button>
        </div>
        {!estimate.qualifies && selections.length > 0 && (
          <p style={{ fontSize: 12, color: P.orange }}>
            Aumente a quantidade de ao menos um item até a menor faixa para enviar.
          </p>
        )}
        {error && <p style={{ fontSize: 13, color: "#c0143c" }}>{error}</p>}
        <p style={{ fontSize: 12, color: P.gray400 }}>{DISCLAIMER}</p>
      </div>
    </div>
  );
}
