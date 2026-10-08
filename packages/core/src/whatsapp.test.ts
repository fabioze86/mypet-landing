import { describe, it, expect } from "vitest";
import { buildQuoteMessage, buildWhatsAppLink, buildProductInterestMessage, buildRetailQuoteMessage } from "./whatsapp";
import { formatPrice } from "./catalog-utils";
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

describe("buildProductInterestMessage", () => {
  it("monta a mensagem de interesse com o nome do produto", () => {
    const message = buildProductInterestMessage("Bandana Xadrez Verde");
    expect(message).toBe("Olá! Tenho interesse no produto: Bandana Xadrez Verde");
  });
});

describe("buildRetailQuoteMessage", () => {
  const items = [
    { id: "1", name: "Ração Golden 15kg", sku: "GOLD15", brand: "Golden", img: "", qty: 2 },
    { id: "2", name: "Coleira antipulgas", sku: "", brand: null, img: "", qty: 1 },
  ];

  it("lista itens e dados do cliente sem empresa/CNPJ", () => {
    const msg = buildRetailQuoteMessage(items, { nome: "Maria", whatsapp: "11988887777" });
    expect(msg).toContain("Gostaria de finalizar este pedido:");
    expect(msg).toContain("- Ração Golden 15kg (SKU GOLD15) — Qtd: 2");
    expect(msg).toContain("- Coleira antipulgas — Qtd: 1");
    expect(msg).toContain("Nome: Maria");
    expect(msg).toContain("WhatsApp: 11988887777");
    expect(msg).not.toContain("Empresa:");
    expect(msg).not.toContain("CNPJ:");
  });
});

describe("buildQuoteMessage com options", () => {
  const items: CartItem[] = [
    { id: "p1", name: "COLEIRA P", sku: "COL-1", brand: null, img: "/1.jpg", qty: 12, unitPrice: 9.9 },
    { id: "p2", name: "GUIA M", sku: "", brand: null, img: "/2.jpg", qty: 2 },
  ];

  it("sem options mantém a saída atual", () => {
    expect(buildQuoteMessage(items, customer)).toBe(
      [
        "Olá! Gostaria de uma cotação de atacado:",
        "",
        "- COLEIRA P (SKU COL-1) — Qtd: 12",
        "- GUIA M — Qtd: 2",
        "",
        "Meus dados:",
        "Nome: João",
        "Empresa: Pet Shop X",
        "WhatsApp: 11999999999",
      ].join("\n"),
    );
  });

  it("com showPrices mostra preço por linha, a consultar e totais", () => {
    const message = buildQuoteMessage(items, customer, "Olá! Quero fazer este pedido:", { showPrices: true });
    expect(message).toContain(`- COLEIRA P (SKU COL-1) — 12 × ${formatPrice(9.9)} = ${formatPrice(118.8)}`);
    expect(message).toContain("- GUIA M — Qtd: 2 (a consultar)");
    expect(message).toContain("Total de unidades: 14");
    expect(message).toContain(`Total: ${formatPrice(118.8)} + itens a consultar`);
  });

  it("sem nenhum preço não mostra linha de Total", () => {
    const message = buildQuoteMessage([items[1]], customer, undefined, { showPrices: true });
    expect(message).toContain("Total de unidades: 2");
    expect(message).not.toContain("Total: ");
  });

  it("com orderNumber a primeira linha é o número do pedido", () => {
    const message = buildQuoteMessage(items, customer, "Olá! Quero fazer este pedido:", { showPrices: true, orderNumber: 1042 });
    expect(message.split("\n")[0]).toBe("Pedido #1042");
    expect(message.split("\n")[2]).toBe("Olá! Quero fazer este pedido:");
  });
});
