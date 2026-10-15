import type { AgentProduct } from "@mypet/core/agent-client";
import type { AgentPageMode } from "./agent-chat";

export const PRICE_LOCK_REASON = "Cadastre-se para ver os preços da tabela.";

export function ProductCards({
  products,
  mode,
  onLockedIntent,
}: {
  products: AgentProduct[];
  mode: AgentPageMode;
  onLockedIntent: (reason: string) => void;
}) {
  return (
    <ul className="ag-products" aria-label="Produtos encontrados">
      {products.map((p, i) => (
        <li key={`${p.id}-${i}`} className="ag-product">
          <img src={p.img} alt="" className="ag-product-img" />
          <div className="ag-product-info">
            <span className="ag-product-name">
              {p.name}
              {p.variantLabel ? ` — ${p.variantLabel}` : ""}
            </span>
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
