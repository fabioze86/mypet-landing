import { describe, it, expect, vi, afterEach } from "vitest";
import type { CartItem } from "@mypet/core/cart";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

const items = [{ id: "p1", name: "Ração X", sku: "100", brand: null, img: "", qty: 2, unitPrice: 10 }] as CartItem[];
const buyer = { nome: "Ana", empresa: "Pet Shop X", whatsapp: "5511999990000", cnpj: "12345678000195" };

describe("buildOrderWhatsAppUrl", () => {
  it("monta o link do WhatsApp com a mensagem do pedido", async () => {
    vi.stubEnv("NEXT_PUBLIC_WHATSAPP_NUMBER", "5511988887777");
    const { buildOrderWhatsAppUrl, hasWhatsAppNumber } = await import("./whatsapp-order");
    expect(hasWhatsAppNumber()).toBe(true);
    const url = buildOrderWhatsAppUrl(items, buyer)!;
    expect(url.startsWith("https://wa.me/5511988887777?text=")).toBe(true);
    const text = decodeURIComponent(url.split("?text=")[1]);
    expect(text).toContain("Olá! Quero fazer este pedido pela Tabela de Preços My Pet Brasil:");
    expect(text).toContain("Ração X (SKU 100) — Qtd: 2");
    expect(text).toContain("Empresa: Pet Shop X");
  });

  it("sem número configurado devolve null", async () => {
    vi.stubEnv("NEXT_PUBLIC_WHATSAPP_NUMBER", "");
    const { buildOrderWhatsAppUrl, hasWhatsAppNumber } = await import("./whatsapp-order");
    expect(hasWhatsAppNumber()).toBe(false);
    expect(buildOrderWhatsAppUrl(items, buyer)).toBeNull();
  });
});
