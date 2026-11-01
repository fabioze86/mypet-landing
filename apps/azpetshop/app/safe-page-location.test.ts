import { describe, expect, it } from "vitest";
import { safePageLocation } from "./safe-page-location";

describe("safePageLocation", () => {
  it("remove a query string (token) das páginas de pedido", () => {
    expect(safePageLocation("https://www.azpetshop.com.br/pedido/abc-123?t=segredo")).toBe("https://www.azpetshop.com.br/pedido/abc-123");
  });

  it("remove o hash também nas páginas de pedido", () => {
    expect(safePageLocation("https://www.azpetshop.com.br/pedido/abc?t=x#topo")).toBe("https://www.azpetshop.com.br/pedido/abc");
  });

  it("mantém a URL completa nas outras páginas", () => {
    const url = "https://www.azpetshop.com.br/busca?q=racao&utm_source=meta";
    expect(safePageLocation(url)).toBe(url);
  });

  it("devolve o texto original se a URL for inválida", () => {
    expect(safePageLocation("não é url")).toBe("não é url");
  });
});
