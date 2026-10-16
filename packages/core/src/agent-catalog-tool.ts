import { tool } from "ai";
import { z } from "zod";
import { getBrands } from "./catalog";
import { getCatalogLineItems, type CatalogLineItem } from "./catalog-line-items";

// Ferramenta do agente para consultar o catálogo do Hub. Para visitante o
// preço sai nulo: nunca chega ao modelo nem à tela.

export type AgentProduct = {
  id: string;
  name: string;
  sku: string;
  brand: string | null;
  variantLabel: string | null;
  img: string;
  unitPrice: number | null;
  priceLabel: string | null;
};

const MAX_TOOL_ITEMS = 8;

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

// O filtro de marca do catálogo é igualdade exata; o modelo escreve a marca do
// jeito que a pessoa digitou.
export async function resolveBrand(raw: string | undefined, channel: string): Promise<string | undefined> {
  if (!raw?.trim()) return undefined;
  const target = normalize(raw);
  const brands = await getBrands(channel);
  return brands.find((brand) => normalize(brand) === target);
}

function toAgentProduct(item: CatalogLineItem, showPrices: boolean): AgentProduct {
  return {
    id: item.id,
    name: item.name,
    sku: item.sku,
    brand: item.brand,
    variantLabel: item.variantLabel,
    img: item.img,
    unitPrice: showPrices ? item.unitPrice : null,
    priceLabel: showPrices ? item.priceLabel : null,
  };
}

export function buildCatalogTool({ channel, showPrices }: { channel: string; showPrices: boolean }) {
  return tool({
    description:
      "Busca produtos da tabela por tipo ou nome de produto. Use para qualquer pergunta sobre produtos, marcas ou disponibilidade.",
    inputSchema: z.object({
      query: z.string().min(1).describe("Tipo ou nome do produto, ex.: 'shampoo neutro', 'ração filhote'"),
      marca: z.string().optional().describe("Marca do produto, se a pessoa citou uma"),
    }),
    execute: async ({ query, marca }) => {
      const brand = await resolveBrand(marca, channel);
      const result = await getCatalogLineItems({ q: query, brand, page: 1, channel, matchWords: true });
      return {
        total: result.total,
        produtos: result.items.slice(0, MAX_TOOL_ITEMS).map((item) => toAgentProduct(item, showPrices)),
      };
    },
    // O cartão na tela usa a saída completa; o modelo recebe só o resumo, sem
    // imagem/sku, para não listar produtos nem montar markdown no texto.
    toModelOutput: ({ output }) => ({
      type: "json",
      value: {
        total: output.total,
        produtos: output.produtos.map((p) => ({
          id: p.id,
          nome: p.variantLabel ? `${p.name} — ${p.variantLabel}` : p.name,
          marca: p.brand,
          ...(showPrices ? { preco: p.priceLabel } : {}),
        })),
      },
    }),
  });
}
