import { tool } from "ai";
import { z } from "zod";
import { queryLineItemsByIds, type CatalogLineItem } from "./catalog-line-items";
import { computeReplenishment } from "./agent-replenishment";
import { fetchRecentOrdersByBuyer } from "./orders-server";
import { getHubServiceClient } from "./supabase";

// Ferramentas do modo cliente. O comprador vem do cookie (buyerId passado pelo
// handler); nenhuma ferramenta aceita id de comprador vindo do modelo.

export type CartChange = {
  id: string;
  name: string;
  sku: string;
  brand: string | null;
  img: string;
  unitPrice: number;
  qty: number;
};
export type CartRefusal = { productId: string; motivo: string };

const MAX_CHANGE_ITEMS = 20;
const MAX_QTY = 9999;
const MAX_SUGGESTIONS = 8;
const SUGGESTION_CANDIDATES = 30;
const HISTORY_ORDERS = 100;
const DEFAULT_STATUS_LIMIT = 5;
const MAX_STATUS_LIMIT = 10;

function displayName(item: CatalogLineItem): string {
  return item.variantLabel ? `${item.name} — ${item.variantLabel}` : item.name;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date(iso));
}

export function buildCustomerTools({ channel, buyerId }: { channel: string; buyerId: string }) {
  return {
    alterar_pedido: tool({
      description:
        "Coloca, muda a quantidade ou tira produtos do pedido do cliente. Use só ids que vieram de buscar_produtos ou sugerir_reposicao nesta conversa, ou que aparecem em PEDIDO ATUAL DO CLIENTE. Informe a quantidade final de cada produto: \"mais N\" significa a quantidade atual no pedido + N. Quantidade 0 tira o produto do pedido.",
      inputSchema: z.object({
        itens: z
          .array(
            z.object({
              productId: z.string().min(1).describe("id do produto vindo de buscar_produtos, sugerir_reposicao ou do pedido atual"),
              quantidade: z.number().int().min(0).max(MAX_QTY).describe("quantidade final no pedido; 0 tira"),
            }),
          )
          .min(1)
          .max(MAX_CHANGE_ITEMS),
      }),
      execute: async ({ itens }) => {
        // Produto repetido na mesma chamada: vale o último.
        const lastById = new Map(itens.map((i) => [i.productId, i.quantidade]));
        const found = new Map(
          (await queryLineItemsByIds([...lastById.keys()], channel)).map((item) => [item.id, item]),
        );
        const aplicados: CartChange[] = [];
        const recusados: CartRefusal[] = [];
        for (const [productId, quantidade] of lastById) {
          const item = found.get(productId);
          if (!item) {
            recusados.push({ productId, motivo: "Produto não encontrado na tabela." });
            continue;
          }
          if (item.unitPrice == null) {
            recusados.push({ productId, motivo: "Produto sem preço na tabela no momento." });
            continue;
          }
          aplicados.push({
            id: item.id,
            name: displayName(item),
            sku: item.sku,
            brand: item.brand,
            img: item.img,
            unitPrice: item.unitPrice,
            qty: quantidade,
          });
        }
        return { aplicados, recusados };
      },
      toModelOutput: ({ output }) => ({
        type: "json",
        value: {
          aplicados: output.aplicados.map((a) => ({ id: a.id, nome: a.name, quantidade: a.qty, preco: a.unitPrice })),
          recusados: output.recusados,
        },
      }),
    }),

    sugerir_reposicao: tool({
      description: "Sugere o que o cliente precisa repor, com base no histórico de pedidos dele.",
      inputSchema: z.object({}),
      execute: async () => {
        const orders = await fetchRecentOrdersByBuyer(getHubServiceClient(), buyerId, {
          channel,
          limit: HISTORY_ORDERS,
        });
        const plan = computeReplenishment(orders, new Date(), SUGGESTION_CANDIDATES);
        if (plan.itens.length === 0) return { tipo: plan.tipo, itens: [] };
        const current = new Map(
          (await queryLineItemsByIds(plan.itens.map((s) => s.productId), channel)).map((item) => [item.id, item]),
        );
        return {
          tipo: plan.tipo,
          itens: plan.itens.flatMap((suggestion) => {
            const item = current.get(suggestion.productId);
            if (!item || item.unitPrice == null) return [];
            return [
              {
                id: item.id,
                name: item.name,
                sku: item.sku,
                brand: item.brand,
                variantLabel: item.variantLabel,
                img: item.img,
                unitPrice: item.unitPrice,
                priceLabel: item.priceLabel,
                ultimaCompraDias: suggestion.daysSinceLast,
                intervaloMedioDias: suggestion.averageIntervalDays,
                qtdUltimaCompra: suggestion.lastQty,
              },
            ];
          }).slice(0, MAX_SUGGESTIONS),
        };
      },
      toModelOutput: ({ output }) => ({
        type: "json",
        value: {
          tipo: output.tipo,
          itens: output.itens.map((i) => ({
            id: i.id,
            nome: i.variantLabel ? `${i.name} — ${i.variantLabel}` : i.name,
            marca: i.brand,
            preco: i.priceLabel,
            ultimaCompraDias: i.ultimaCompraDias,
            intervaloMedioDias: i.intervaloMedioDias,
            qtdUltimaCompra: i.qtdUltimaCompra,
          })),
        },
      }),
    }),

    status_pedidos: tool({
      description: "Mostra os últimos pedidos do cliente com data, status e quantidade de itens.",
      inputSchema: z.object({
        limite: z.number().int().min(1).max(MAX_STATUS_LIMIT).optional().describe("quantos pedidos mostrar"),
      }),
      execute: async ({ limite }) => {
        const orders = await fetchRecentOrdersByBuyer(getHubServiceClient(), buyerId, {
          channel,
          limit: limite ?? DEFAULT_STATUS_LIMIT,
        });
        return {
          pedidos: orders.map((order) => ({
            data: formatDate(order.createdAt),
            status: order.status,
            itens: order.items.length,
            unidades: order.items.reduce((sum, item) => sum + item.qty, 0),
          })),
        };
      },
    }),
  };
}
