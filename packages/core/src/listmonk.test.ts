import { afterEach, describe, expect, it, vi } from "vitest";
import { sendListmonkTx } from "./listmonk";

const cfg = { baseUrl: "https://mail.exemplo.com/", apiUser: "user", apiToken: "tok" };
const msg = { templateId: 7, email: "maria@exemplo.com", data: { numero: 1042 } };

afterEach(() => vi.restoreAllMocks());

describe("sendListmonkTx", () => {
  it("envia o corpo e o header de autorização corretos", async () => {
    const fetchFn = vi.fn(async () => new Response("{}", { status: 200 }));
    const ok = await sendListmonkTx(cfg, msg, fetchFn as unknown as typeof fetch);
    expect(ok).toBe(true);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://mail.exemplo.com/api/tx");
    expect((init.headers as Record<string, string>).Authorization).toBe("token user:tok");
    expect(JSON.parse(init.body as string)).toEqual({
      subscriber_email: "maria@exemplo.com",
      template_id: 7,
      data: { numero: 1042 },
      content_type: "html",
    });
  });

  it("HTTP 4xx devolve false", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchFn = vi.fn(async () => new Response("erro", { status: 400 }));
    expect(await sendListmonkTx(cfg, msg, fetchFn as unknown as typeof fetch)).toBe(false);
  });

  it("exceção de rede devolve false", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchFn = vi.fn(async () => { throw new Error("rede"); });
    expect(await sendListmonkTx(cfg, msg, fetchFn as unknown as typeof fetch)).toBe(false);
  });
});
