import { describe, it, expect } from "vitest";
import { buildAgentInstructions, formatKnowledge } from "./agent-prompt";

const faq = [{ q: "Qual é o pedido mínimo?", a: "R$ 250,00 na capital de SP." }];
const artigo = {
  id: "a1",
  categoriaId: "c1",
  slug: "prazo-entrega",
  titulo: "Prazo de entrega",
  resumo: "r",
  ordem: 0,
  corpoMarkdown: "Sul e Sudeste: 3 a 7 dias úteis.",
};

const base = { siteName: "My Pet Brasil", faq, artigos: [artigo], empresa: null, cart: [] };

describe("formatKnowledge", () => {
  it("inclui FAQ e artigos com o caminho", () => {
    const text = formatKnowledge(faq, [artigo]);
    expect(text).toContain("Qual é o pedido mínimo?");
    expect(text).toContain("/central-de-ajuda/a/prazo-entrega");
  });

  it("limita o tamanho total", () => {
    const muitos = Array.from({ length: 50 }, (_, i) => ({ ...artigo, slug: `a${i}`, corpoMarkdown: "x".repeat(5000) }));
    expect(formatKnowledge(faq, muitos).length).toBeLessThanOrEqual(60000);
  });
});

describe("buildAgentInstructions", () => {
  const visitante = buildAgentInstructions({ ...base, mode: "visitante" });
  const cliente = buildAgentInstructions({
    ...base,
    mode: "cliente",
    empresa: "Pet Shop Bichos",
    cart: [{ id: "p1", name: "Shampoo Neutro 5L", qty: 10, unitPrice: 89.9 }],
  });

  it("regras comuns nos dois modos", () => {
    for (const prompt of [visitante, cliente]) {
      expect(prompt).toContain("Nunca prometa desconto");
      expect(prompt).toContain('"buscar_produtos"');
      expect(prompt).toContain("Não escreva preços no texto");
      expect(prompt).toContain("/central-de-ajuda");
      expect(prompt).toContain('"atacado"');
      expect(prompt).not.toMatch(/fal(e|ar) com o (nosso )?time/i);
      expect(prompt).toContain("R$ 250,00 na capital de SP.");
    }
  });

  it("visitante: convite ao cadastro e sem pedido atual", () => {
    expect(visitante).toContain("Você atende visitantes que ainda não fizeram cadastro.");
    expect(visitante).toContain("se cadastra com CNPJ e WhatsApp");
    expect(visitante).not.toContain("PEDIDO ATUAL");
  });

  it("cliente: nome da empresa e pedido atual", () => {
    expect(cliente).toContain("Pet Shop Bichos");
    expect(cliente).toContain("PEDIDO ATUAL DO CLIENTE:");
    expect(cliente).toContain("- 10 x Shampoo Neutro 5L (id p1)");
    expect(cliente).toContain('"Enviar pedido pelo WhatsApp"');
  });

  it("cliente com pedido vazio", () => {
    const vazio = buildAgentInstructions({ ...base, mode: "cliente" });
    expect(vazio).toContain("O pedido atual está vazio.");
  });
});
