export type CartItem = {
  id: string;
  name: string;
  sku: string;
  brand: string | null;
  img: string;
  qty: number;
};

export type Cart = { items: CartItem[] };

export const EMPTY_CART: Cart = { items: [] };

export function addItem(cart: Cart, product: Omit<CartItem, "qty">, qty: number): Cart {
  const existing = cart.items.find((item) => item.id === product.id);
  if (existing) {
    return {
      items: cart.items.map((item) =>
        item.id === product.id ? { ...item, qty: item.qty + qty } : item
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
