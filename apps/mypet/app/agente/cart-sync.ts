import type { CartItem } from "@mypet/core/cart";
import type { CartChange } from "@mypet/core/agent-client";

type CartOps = {
  items: { id: string; campaignId?: string }[];
  setLine: (product: Omit<CartItem, "qty" | "campaignId" | "campaignSlug">, qty: number) => void;
};

// Aplica no carrinho o que o agente fez com alterar_pedido: a quantidade é a
// final (não soma); 0 tira o produto. `setLine` mexe só na linha sem campanha
// do produto — define quantidade, preço atual do canal, nome, sku, marca e
// imagem (ou a cria) — e nunca toca linhas de campanha do mesmo id.
// Quantidade 0 para produto sem linha sem campanha não faz nada.
export function applyCartChanges(changes: CartChange[], cart: CartOps): void {
  const plain = new Set(cart.items.filter((item) => !item.campaignId).map((item) => item.id));
  for (const change of changes) {
    if (change.qty <= 0 && !plain.has(change.id)) continue;
    cart.setLine(
      { id: change.id, name: change.name, sku: change.sku, brand: change.brand, img: change.img, unitPrice: change.unitPrice },
      change.qty,
    );
    if (change.qty > 0) plain.add(change.id);
    else plain.delete(change.id);
  }
}
