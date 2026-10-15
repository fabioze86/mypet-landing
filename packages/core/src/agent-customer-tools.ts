import { tool } from "ai";
import { z } from "zod";
import { queryLineItemsByIds, type CatalogLineItem } from "./catalog-line-items";
import { computeReplenishment } from "./agent-replenishment";
import { getOrdersByBuyer, type OrderWithItems } from "./orders-server";
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
const DEFAULT_STATUS_LIMIT = 5;
const MAX_STATUS_LIMIT = 10;

function displayName(item: CatalogLineItem): string {
  return item.variantLabel ? `${item.name} — ${item.variantLabel}` : item.name;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date(iso));
}

async function loadOrders(buyerId: string): Promise<OrderWithItems[]> {
  try {
    return await getOrdersByBuyer(getHubServiceClient(), buyerId);
  } catch (error) {
    console.error("[agent-customer-tools] falha ao carregar pedidos:", error);
    return [];
  }
}

export function buildCustomerTools({ channel, buyerId }: { channel: string; buyerId: string }) {
  return {
    alterar_pedido: tool({
      description:
        "Coloca, muda a quantidade ou tira produtos do pedido do cliente. Use só ids que vieram de buscar_produtos ou sugerir_reposicao nesta conversa. Quantidade 0 tira o produto do pedido.",
      inputSchema: z.object({
        itens: z
          .array(
            z.object({
              productId: z.string().min(1).describe("id do produto vindo de buscar_produtos ou sugerir_reposicao"),
              quantidade: z.number().int().min(0).max(MAX_QTY).describe("quantidade final no pedido; 0 tira"),
            }),
          )
          .min(1)
          .max(MAX_CHANGE_ITEMS),
      }),
      execute: async ({ itens }) => {
        const found = new Map(
          (await queryLineItemsByIds(itens.map((i) => i.productId), channel)).map((item) => [item.id, item]),
        );
        const aplicados: CartChange[] = [];
        const recusados: CartRefusal[] = [];
        for (const { productId, quantidade } of itens) {
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
    }),

    sugerir_reposicao: tool({
      description: "Sugere o que o cliente precisa repor, com base no histórico de pedidos dele.",
      inputSchema: z.object({}),
      execute: async () => {
        const plan = computeReplenishment(await loadOrders(buyerId), new Date(), MAX_SUGGESTIONS);
        if (plan.itens.length === 0) return { tipo: plan.tipo, itens: [] };
        const current = new Map(
          (await queryLineItemsByIds(plan.itens.map((s) => s.productId), channel)).map((item) => [item.id, item]),
        );
        return {
          tipo: plan.tipo,
          itens: plan.itens.flatMap((suggestion) => {
            const item = current.get(suggestion.productId);
            if (!item) return [];
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
          }),
        };
      },
    }),

    status_pedidos: tool({
      description: "Mostra os últimos pedidos do cliente com data, status e quantidade de itens.",
      inputSchema: z.object({
        limite: z.number().int().min(1).max(MAX_STATUS_LIMIT).optional().describe("quantos pedidos mostrar"),
      }),
      execute: async ({ limite }) => {
        const orders = await loadOrders(buyerId);
        return {
          pedidos: orders.slice(0, limite ?? DEFAULT_STATUS_LIMIT).map((order) => ({
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
