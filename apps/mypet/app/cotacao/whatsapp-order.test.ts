import { describe, it, expect, vi, afterEach } from "vitest";
import type { CartItem } from "@mypet/core/cart";
import type { PedidoResumo } from "./actions";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

const items = [{ id: "p1", name: "Ração X", sku: "100", brand: null, img: "", qty: 2, unitPrice: 10 }] as CartItem[];
const buyer = { nome: "Ana", empresa: "Pet Shop X", whatsapp: "5511999990000", cnpj: "12345678000195" };

const FRETE_A_COMBINAR = { tipo: "a_combinar", modalidade: "normal", valorCentavos: null, faltaParaGratisCentavos: 30000, minimoGratisCentavos: 40000, prioritariaDisponivel: false, prazo: null } as const;
const pedido: PedidoResumo = { vitrine: "completo", items, subtotal: 20, zona: "interior_30", frete: FRETE_A_COMBINAR };

describe("buildOrderWhatsAppUrl", () => {
  it("monta o link do WhatsApp com a mensagem do pedido", async () => {
    vi.stubEnv("NEXT_PUBLIC_WHATSAPP_NUMBER", "5511988887777");
    const { buildOrderWhatsAppUrl, hasWhatsAppNumber } = await import("./whatsapp-order");
    expect(hasWhatsAppNumber()).toBe(true);
    const url = buildOrderWhatsAppUrl(buyer, pedido)!;
    expect(url.startsWith("https://wa.me/5511988887777?text=")).toBe(true);
    const text = decodeURIComponent(url.split("?text=")[1]);
    expect(text).toContain("Olá! Quero fazer este pedido pela Tabela de Preços My Pet Brasil:");
    expect(text).toMatch(/Ração X \(SKU 100\) — 2 × R\$\s10,00/);
    expect(text).toContain("Empresa: Pet Shop X");
  });

  it("sem número configurado devolve null", async () => {
    vi.stubEnv("NEXT_PUBLIC_WHATSAPP_NUMBER", "");
    const { buildOrderWhatsAppUrl, hasWhatsAppNumber } = await import("./whatsapp-order");
    expect(hasWhatsAppNumber()).toBe(false);
    expect(buildOrderWhatsAppUrl(buyer, pedido)).toBeNull();
  });
});

describe("buildOrderWhatsAppUrl com frete", () => {
  const ITEM = { id: "p1", name: "Ração", sku: "R1", brand: null, img: "", qty: 2, unitPrice: 50 } as CartItem;

  it("abre com a vitrine e fecha com região, entrega e frete", async () => {
    vi.stubEnv("NEXT_PUBLIC_WHATSAPP_NUMBER", "5511988887777");
    const { buildOrderWhatsAppUrl } = await import("./whatsapp-order");
    const url = buildOrderWhatsAppUrl(buyer, {
      vitrine: "fabrica",
      items: [ITEM],
      subtotal: 100,
      zona: "fora",
      frete: { tipo: "fixo", modalidade: "normal", valorCentavos: 1990, faltaParaGratisCentavos: 19900, minimoGratisCentavos: 29900, prioritariaDisponivel: false, prazo: null },
    })!;
    const text = decodeURIComponent(url.split("text=")[1]);
    expect(text.startsWith("Pedido · Linha de Fábrica\n")).toBe(true);
    expect(text).toMatch(/Frete: R\$\s19,90/);
    expect(text).toMatch(/Total com frete: R\$\s119,90/);
    expect(text).toContain("Região: Fora da área de entrega direta");
  });

  it("frete a combinar", async () => {
    vi.stubEnv("NEXT_PUBLIC_WHATSAPP_NUMBER", "5511988887777");
    const { buildOrderWhatsAppUrl } = await import("./whatsapp-order");
    const text = decodeURIComponent(buildOrderWhatsAppUrl(buyer, { ...pedido, items: [ITEM], subtotal: 100 })!.split("text=")[1]);
    expect(text.startsWith("Pedido · Catálogo completo\n")).toBe(true);
    expect(text).toContain("Frete: a combinar");
    expect(text).not.toContain("Total com frete");
  });
});
