import { describe, expect, it, vi } from "vitest";
import { createCatalogRevalidationHandler } from "./catalog-revalidation";

describe("createCatalogRevalidationHandler", () => {
  it("expira o catálogo quando recebe o segredo válido", async () => {
    const invalidateCatalog = vi.fn();
    const POST = createCatalogRevalidationHandler({ secret: "segredo-de-teste", invalidateCatalog });

    const response = await POST(
      new Request("https://distribuidorapetshop.com.br/api/revalidate-catalog", {
        method: "POST",
        headers: { authorization: "Bearer segredo-de-teste" },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(invalidateCatalog).toHaveBeenCalledTimes(1);
  });

  it("recusa uma chamada sem o segredo e preserva o cache", async () => {
    const invalidateCatalog = vi.fn();
    const POST = createCatalogRevalidationHandler({ secret: "segredo-de-teste", invalidateCatalog });

    const response = await POST(new Request("https://distribuidorapetshop.com.br/api/revalidate-catalog", { method: "POST" }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Não autorizado" });
    expect(invalidateCatalog).not.toHaveBeenCalled();
  });

  it("permanece fechado quando o segredo não está configurado", async () => {
    const invalidateCatalog = vi.fn();
    const POST = createCatalogRevalidationHandler({ secret: undefined, invalidateCatalog });

    const response = await POST(
      new Request("https://distribuidorapetshop.com.br/api/revalidate-catalog", {
        method: "POST",
        headers: { authorization: "Bearer qualquer-valor" },
      }),
    );

    expect(response.status).toBe(401);
    expect(invalidateCatalog).not.toHaveBeenCalled();
  });
});
