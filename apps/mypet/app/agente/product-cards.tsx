import { useEffect, useRef, useState } from "react";
import type { AgentProduct } from "@mypet/core/agent-client";
import type { AgentPageMode } from "./agent-chat";

export const PRICE_LOCK_REASON = "Cadastre-se para ver os preços da tabela.";
const ADDED_FEEDBACK_MS = 1500;

export function productDisplayName(p: AgentProduct): string {
  return p.variantLabel ? `${p.name} — ${p.variantLabel}` : p.name;
}

function AddButton({ label, onAdd }: { label: string; onAdd: () => void }) {
  const [added, setAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return (
    <button
      type="button"
      className="ag-product-add"
      aria-label={`Adicionar ${label} ao pedido`}
      onClick={() => {
        onAdd();
        setAdded(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setAdded(false), ADDED_FEEDBACK_MS);
      }}
    >
      {added ? "Adicionado ✓" : "Adicionar"}
    </button>
  );
}

export function ProductCards({
  products,
  mode,
  onLockedIntent,
  onAdd,
}: {
  products: AgentProduct[];
  mode: AgentPageMode;
  onLockedIntent: (reason: string) => void;
  // só no modo cliente
  onAdd?: (product: AgentProduct) => void;
}) {
  return (
    <ul className="ag-products" aria-label="Produtos encontrados">
      {products.map((p, i) => (
        <li key={`${p.id}-${i}`} className="ag-product">
          <img src={p.img} alt="" className="ag-product-img" />
          <div className="ag-product-info">
            <span className="ag-product-name">{productDisplayName(p)}</span>
            {p.brand && <span className="ag-product-brand">{p.brand}</span>}
          </div>
          {mode === "cliente" ? (
            <div className="ag-product-side">
              {p.priceLabel ? (
                <>
                  <span className="ag-product-price">{p.priceLabel}</span>
                  <a href="/pedido-rapido" className="ag-product-link">
                    Ver na tabela
                  </a>
                  {p.unitPrice != null && onAdd && (
                    <AddButton label={productDisplayName(p)} onAdd={() => onAdd(p)} />
                  )}
                </>
              ) : (
                // mensagem antiga de antes do cadastro: veio sem preço
                <a href="/pedido-rapido" className="ag-product-link">
                  Ver preço na tabela
                </a>
              )}
            </div>
          ) : (
            <button type="button" className="ag-product-lock" onClick={() => onLockedIntent(PRICE_LOCK_REASON)}>
              Cadastre-se para ver o preço
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
