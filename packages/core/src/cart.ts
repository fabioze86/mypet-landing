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
    return {
      items: cart.items.map((item) =>
        sameCartLine(item, product.id, product.campaignId) ? { ...item, qty: item.qty + qty } : item
      ),
    };
  }
  return { items: [...cart.items, { ...product, qty }] };
}

export function removeItem(cart: Cart, id: string): Cart {
  return { items: cart.items.filter((item) => item.id !== id) };
}

export function updateQty(cart: Cart, id: string, qty: number): Cart {
  if (qty <= 0) return removeItem(cart, id);
  return {
    items: cart.items.map((item) => (item.id === id ? { ...item, qty } : item)),
  };
}

export function totalItems(cart: Cart): number {
  return cart.items.reduce((sum, item) => sum + item.qty, 0);
}
