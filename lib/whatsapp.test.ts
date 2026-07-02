import { describe, it, expect } from "vitest";
import { buildQuoteMessage, buildWhatsAppLink } from "./whatsapp";
import type { CartItem } from "./cart";

const customer = { nome: "João", empresa: "Pet Shop X", whatsapp: "11999999999" };

describe("buildQuoteMessage", () => {
  it("monta a mensagem com um item e sem cnpj", () => {
    const items: CartItem[] = [
      { id: "p1", name: "RAÇÃO PREMIUM 15KG", sku: "15675", brand: "NAPI", img: "/img.jpg", qty: 2 },
    ];
    const message = buildQuoteMessage(items, customer);
    expect(message).toBe(
      [
        "Olá! Gostaria de uma cotação de atacado:",
        "",
        "- RAÇÃO PREMIUM 15KG (SKU 15675) — Qtd: 2",
        "",
        "Meus dados:",
        "Nome: João",
        "Empresa: Pet Shop X",
        "WhatsApp: 11999999999",
      ].join("\n")
    );
  });

  it("inclui o cnpj quando informado", () => {
    const items: CartItem[] = [
      { id: "p1", name: "AREIA HIGIÊNICA 4KG", sku: "", brand: null, img: "/img.jpg", qty: 1 },
    ];
    const message = buildQuoteMessage(items, { ...customer, cnpj: "12.345.678/0001-99" });
    expect(message).toContain("CNPJ: 12.345.678/0001-99");
    expect(message).toContain("- AREIA HIGIÊNICA 4KG — Qtd: 1");
  });

  it("junta múltiplos itens em linhas separadas", () => {
    const items: CartItem[] = [
      { id: "p1", name: "RAÇÃO X", sku: "1", brand: "A", img: "/1.jpg", qty: 2 },
      { id: "p2", name: "AREIA Y", sku: "2", brand: "B", img: "/2.jpg", qty: 3 },
    ];
    const message = buildQuoteMessage(items, customer);
    expect(message).toContain("- RAÇÃO X (SKU 1) — Qtd: 2");
    expect(message).toContain("- AREIA Y (SKU 2) — Qtd: 3");
  });
});

describe("buildWhatsAppLink", () => {
  it("monta a URL codificando a mensagem", () => {
    const link = buildWhatsAppLink("5511999999999", "Olá! Teste com acento é ção");
    expect(link).toBe(
      "https://wa.me/5511999999999?text=Ol%C3%A1!%20Teste%20com%20acento%20%C3%A9%20%C3%A7%C3%A3o"
    );
  });
});
