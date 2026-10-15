import type { CartItem } from "@mypet/core/cart";
import type { CartChange } from "@mypet/core/agent-client";

type CartOps = {
  items: { id: string; campaignId?: string }[];
  addItem: (product: Omit<CartItem, "qty">, qty: number) => void;
  updateQty: (id: string, qty: number) => void;
  removeItem: (id: string) => void;
};

// Aplica no carrinho o que o agente fez com alterar_pedido: a quantidade é a
// final (não soma); 0 tira o produto. O updateQty/removeItem do carrinho, sem
// campaignId, mexe em TODAS as linhas com aquele id (inclusive de campanha),
// então só os usamos quando existe apenas a linha avulsa. Se há linha avulsa e
// de campanha com o mesmo id, a mudança é ignorada (não dá para mirar só a avulsa).
// Se só há linha de campanha: qty > 0 cria uma linha avulsa separada; 0 não faz nada.
export function applyCartChanges(changes: CartChange[], cart: CartOps): void {
  const plain = new Set(cart.items.filter((item) => !item.campaignId).map((item) => item.id));
  const campaign = new Set(cart.items.filter((item) => item.campaignId).map((item) => item.id));
  for (const change of changes) {
    const hasPlain = plain.has(change.id);
    if (hasPlain && campaign.has(change.id)) {
      console.warn(`applyCartChanges: "${change.id}" tem linha avulsa e de campanha; mudança ignorada.`);
      continue;
    }
    if (change.qty === 0) {
      if (hasPlain) {
        cart.removeItem(change.id);
        plain.delete(change.id);
      }
      continue;
    }
    if (hasPlain) {
      cart.updateQty(change.id, change.qty);
      continue;
    }
    cart.addItem(
      { id: change.id, name: change.name, sku: change.sku, brand: change.brand, img: change.img, unitPrice: change.unitPrice },
      change.qty,
    );
    plain.add(change.id);
  }
}
