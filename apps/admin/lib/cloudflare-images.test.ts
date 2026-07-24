import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { uploadImageToCloudflare } from "./cloudflare-images";

const file = new File(["conteudo"], "banner.jpg", { type: "image/jpeg" });

beforeEach(() => {
  process.env.CLOUDFLARE_ACCOUNT_ID = "acc-123";
  process.env.CLOUDFLARE_API_TOKEN = "token-abc";
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.CLOUDFLARE_ACCOUNT_ID;
  delete process.env.CLOUDFLARE_API_TOKEN;
});

describe("uploadImageToCloudflare", () => {
  it("retorna a URL da primeira variante em caso de sucesso", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, result: { variants: ["https://imagedelivery.net/x/y/public"] } }),
      }),
    );
    const result = await uploadImageToCloudflare(file);
    expect(result).toEqual({ url: "https://imagedelivery.net/x/y/public" });
  });

  it("retorna erro quando faltam credenciais", async () => {
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    const result = await uploadImageToCloudflare(file);
    expect(result).toEqual({ error: expect.stringContaining("Cloudflare Images") });
  });

  it("retorna erro genérico quando a API falha", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ success: false, errors: [] }) }));
    const result = await uploadImageToCloudflare(file);
    expect(result).toEqual({ error: "Não foi possível enviar a imagem. Tente novamente." });
  });
});
