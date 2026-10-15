export type CartItem = {
  id: string;
  name: string;
  sku: string;
  brand: string | null;
  img: string;
  qty: number;
  campaignId?: string;
  campaignSlug?: string;
  unitPrice?: number;
  listPrice?: number;
};

export type Cart = { items: CartItem[] };

export const EMPTY_CART: Cart = { items: [] };

// Dois itens são "o mesmo" para efeito de merge quando têm o mesmo `id` E o
// mesmo `campaignId` (incluindo `undefined === undefined`, para o item sem
// campanha) — sem isso, o mesmo produto anunciado em duas campanhas
// diferentes vira uma linha só no carrinho, perdendo o preço/campanha da
// primeira adição (ver revisão final do plano de fundação da Distribuidora
// Instagram).
function sameCartLine(item: CartItem, id: string, campaignId: string | undefined): boolean {
  return item.id === id && item.campaignId === campaignId;
}

export function addItem(cart: Cart, product: Omit<CartItem, "qty">, qty: number): Cart {
  const existing = cart.items.find((item) => sameCartLine(item, product.id, product.campaignId));
  if (existing) {
    // Preço não-campanha pode mudar entre dois "adds" na mesma sessão (ou o
    // item pode ter entrado no carrinho antes do unitPrice estar disponível)
    // — atualiza para o valor mais recente. Linhas de campanha mantêm o
    // preço travado no primeiro add (mesma razão do `sameCartLine`: preço de
    // campanha é um preço fechado, não deve mudar depois).
    const refreshPrice = existing.campaignId === undefined && product.unitPrice !== undefined;
    return {
      items: cart.items.map((item) =>
        sameCartLine(item, product.id, product.campaignId)
          ? {
              ...item,
              qty: item.qty + qty,
              ...(refreshPrice
                ? { unitPrice: product.unitPrice, ...(product.listPrice !== undefined ? { listPrice: product.listPrice } : {}) }
                : {}),
            }
          : item
      ),
    };
  }
  return { items: [...cart.items, { ...product, qty }] };
}

// `campaignId` é opcional: quando informado, a operação afeta só a linha
// que bate `id` E `campaignId` (mesma regra de `sameCartLine`); quando
// omitido, mantém o comportamento histórico de afetar todas as linhas com
// aquele `id` (compatível com chamadores que não conhecem campanhas, ex.
// apps/mypet/app/cotacao/cotacao-content.tsx).
export function removeItem(cart: Cart, id: string, campaignId?: string): Cart {
  return {
    items: cart.items.filter((item) =>
      campaignId !== undefined ? !sameCartLine(item, id, campaignId) : item.id !== id
    ),
  };
}

export function updateQty(cart: Cart, id: string, qty: number, campaignId?: string): Cart {
  if (qty <= 0) return removeItem(cart, id, campaignId);
  return {
    items: cart.items.map((item) =>
      (campaignId !== undefined ? sameCartLine(item, id, campaignId) : item.id === id) ? { ...item, qty } : item
    ),
  };
}

// Define a linha SEM campanha de um produto: substitui seus dados (nome, sku,
// marca, imagem, preço) pelos de `product` e a quantidade por `qty` (final,
// não soma), mantendo a posição; se não existir, adiciona no fim; `qty <= 0`
// remove só essa linha. Linhas de campanha do mesmo id nunca são tocadas.
// Usado pelo agente, que devolve a quantidade final e o preço atual do canal.
export function setLine(
  cart: Cart,
  product: Omit<CartItem, "qty" | "campaignId" | "campaignSlug">,
  qty: number,
): Cart {
  // garante linha sem campanha mesmo se o objeto vier com esses campos
  const { campaignId: _campaignId, campaignSlug: _campaignSlug, ...plain } = product as Omit<CartItem, "qty">;
  const isTarget = (item: CartItem) => sameCartLine(item, plain.id, undefined);
  if (qty <= 0) return { items: cart.items.filter((item) => !isTarget(item)) };
  if (!cart.items.some(isTarget)) return { items: [...cart.items, { ...plain, qty }] };
  return { items: cart.items.map((item) => (isTarget(item) ? { ...plain, qty } : item)) };
}

export function totalItems(cart: Cart): number {
  return cart.items.reduce((sum, item) => sum + item.qty, 0);
}

export type CartTotals = {
  totalUnits: number;
  totalValue: number;
  pricedLines: number;
  unpricedLines: number;
};

export function cartTotals(items: CartItem[]): CartTotals {
  const totals = items.reduce<CartTotals>(
    (acc, item) => {
      const priced = typeof item.unitPrice === "number" && Number.isFinite(item.unitPrice);
      return {
        totalUnits: acc.totalUnits + item.qty,
        totalValue: priced ? acc.totalValue + (item.unitPrice as number) * item.qty : acc.totalValue,
        pricedLines: acc.pricedLines + (priced ? 1 : 0),
        unpricedLines: acc.unpricedLines + (priced ? 0 : 1),
      };
    },
    { totalUnits: 0, totalValue: 0, pricedLines: 0, unpricedLines: 0 },
  );
  return { ...totals, totalValue: Math.round(totals.totalValue * 100) / 100 };
}
