import { afterEach, describe, expect, it, vi } from "vitest";
import { quoteShipping } from "./melhor-envio";

const cfg = { baseUrl: "https://sandbox.melhorenvio.com.br", token: "tk", userAgent: "AZ Pet Shop (contato@x.com)", fromCep: "01001000" };
const pkg = { widthCm: 20, heightCm: 15, lengthCm: 30, weightKg: 1 };

function fakeFetch(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("quoteShipping", () => {
  it("chama a API com token, origem, destino e pacote, e devolve só opções sem erro, mais baratas primeiro", async () => {
    const fetchFn = fakeFetch(200, [
      { id: 2, name: "SEDEX", price: "32.10", custom_price: "30.00", delivery_time: 2, custom_delivery_time: 3, company: { name: "Correios" } },
      { id: 1, name: "PAC", price: "20.00", custom_price: "18.50", delivery_time: 6, custom_delivery_time: 7, company: { name: "Correios" } },
      { id: 3, name: "Jadlog", error: "Serviço indisponível", company: { name: "Jadlog" } },
    ]);
    const r = await quoteShipping(cfg, { toCep: "20040002", pkg, insuranceValue: 99.9 }, fetchFn);
    expect(r).toEqual({
      ok: true,
      options: [
        { serviceId: 1, name: "PAC", company: "Correios", price: 18.5, deliveryDays: 7 },
        { serviceId: 2, name: "SEDEX", company: "Correios", price: 30, deliveryDays: 3 },
      ],
    });
    const [url, init] = (fetchFn as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
    expect(url).toBe("https://sandbox.melhorenvio.com.br/api/v2/me/shipment/calculate");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tk");
    expect(JSON.parse(init.body as string)).toEqual({
      from: { postal_code: "01001000" },
      to: { postal_code: "20040002" },
      package: { width: 20, height: 15, length: 30, weight: 1 },
      options: { insurance_value: 99.9, receipt: false, own_hand: false },
    });
  });

  it("erro HTTP vira erro amigável", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await quoteShipping(cfg, { toCep: "20040002", pkg, insuranceValue: 10 }, fakeFetch(500, { message: "x" }));
    expect(r).toEqual({ ok: false, error: "Não conseguimos calcular o frete agora. Tente novamente." });
  });

  it("nenhuma opção disponível vira erro", async () => {
    const r = await quoteShipping(cfg, { toCep: "20040002", pkg, insuranceValue: 10 }, fakeFetch(200, [{ id: 1, error: "x", company: { name: "C" } }]));
    expect(r).toEqual({ ok: false, error: "Não há opção de entrega para este CEP." });
  });

  it("falha de rede vira erro amigável", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchFn = vi.fn(async () => { throw new Error("offline"); }) as unknown as typeof fetch;
    const r = await quoteShipping(cfg, { toCep: "20040002", pkg, insuranceValue: 10 }, fetchFn);
    expect(r.ok).toBe(false);
  });
});
