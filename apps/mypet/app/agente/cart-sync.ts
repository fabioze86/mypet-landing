import type { CartItem } from "@mypet/core/cart";
import type { CartChange } from "@mypet/core/agent-client";

type CartOps = {
  items: { id: string; campaignId?: string }[];
  addItem: (product: Omit<CartItem, "qty">, qty: number) => void;
  updateQty: (id: string, qty: number) => void;
  removeItem: (id: string) => void;
};

// Aplica no carrinho o que o agente fez com alterar_pedido: a quantidade é a
// final (não soma); 0 tira o produto. Linhas de campanha não são tocadas.
export function applyCartChanges(changes: CartChange[], cart: CartOps): void {
  const present = new Set(cart.items.filter((item) => !item.campaignId).map((item) => item.id));
  for (const change of changes) {
    if (change.qty === 0) {
      if (present.has(change.id)) {
        cart.removeItem(change.id);
        present.delete(change.id);
      }
      continue;
    }
    if (present.has(change.id)) {
      cart.updateQty(change.id, change.qty);
      continue;
    }
    cart.addItem(
      { id: change.id, name: change.name, sku: change.sku, brand: change.brand, img: change.img, unitPrice: change.unitPrice },
      change.qty,
    );
    present.add(change.id);
  }
}
