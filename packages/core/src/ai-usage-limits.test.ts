import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const rpc = vi.fn();
vi.mock("./supabase", () => ({ getHubServiceClient: () => ({ rpc }) }));

import { consumeAiQuota, getAiLimits, hashClientIp } from "./ai-usage-limits";

const headers = (h: Record<string, string> = {}) => new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1", ...h });

beforeEach(() => {
  rpc.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("hashClientIp", () => {
  it("usa o primeiro IP do x-forwarded-for e não expõe o IP", () => {
    const hash = hashClientIp(headers());
    expect(hash).toHaveLength(32);
    expect(hash).not.toContain("1.2.3.4");
    expect(hash).toBe(hashClientIp(new Headers({ "x-forwarded-for": "1.2.3.4" })));
  });

  it("cai para x-real-ip e depois para um balde comum", () => {
    expect(hashClientIp(new Headers({ "x-real-ip": "1.2.3.4" }))).toBe(hashClientIp(headers()));
    expect(hashClientIp(new Headers())).toHaveLength(32);
  });
});

describe("hash com segredo (AI_IP_HASH_SECRET)", () => {
  it("IP: muda em relação ao sem segredo e continua estável com 32 caracteres", () => {
    const semSegredo = hashClientIp(headers());
    vi.stubEnv("AI_IP_HASH_SECRET", "x");
    const comSegredo = hashClientIp(headers());
    expect(comSegredo).not.toBe(semSegredo);
    expect(comSegredo).toMatch(/^[0-9a-f]{32}$/);
    expect(hashClientIp(headers())).toBe(comSegredo);
    vi.stubEnv("AI_IP_HASH_SECRET", "y");
    expect(hashClientIp(headers())).not.toBe(comSegredo);
  });

  it("comprador: a chave da cota também usa o segredo", async () => {
    rpc.mockResolvedValue({ data: "ok", error: null });
    await consumeAiQuota("agente_cliente", "mypetbrasil", headers(), "buyer-1");
    vi.stubEnv("AI_IP_HASH_SECRET", "x");
    await consumeAiQuota("agente_cliente", "mypetbrasil", headers(), "buyer-1");
    await consumeAiQuota("agente_cliente", "mypetbrasil", headers(), "buyer-1");
    const [semSegredo, comSegredo, denovo] = rpc.mock.calls.map((c) => c[1].p_ip_hash);
    expect(comSegredo).not.toBe(semSegredo);
    expect(comSegredo).toBe(denovo);
    expect(comSegredo).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe("getAiLimits", () => {
  it("usa os padrões e aceita override por env", () => {
    expect(getAiLimits("duvidas").ipDailyMax).toBe(30);
    vi.stubEnv("AI_LIMIT_DUVIDAS_IP_DAILY", "5");
    vi.stubEnv("AI_LIMIT_DUVIDAS_GLOBAL_DAILY", "abc");
    const limits = getAiLimits("duvidas");
    expect(limits.ipDailyMax).toBe(5);
    expect(limits.globalDailyMax).toBe(1000);
  });
});

describe("consumeAiQuota", () => {
  it("libera quando a função devolve ok, passando os limites", async () => {
    rpc.mockResolvedValue({ data: "ok", error: null });
    expect(await consumeAiQuota("duvidas", "mypetbrasil", headers())).toBeNull();
    expect(rpc).toHaveBeenCalledWith("consume_ai_quota", expect.objectContaining({
      p_scope: "duvidas",
      p_channel: "mypetbrasil",
      p_ip_burst_max: 8,
      p_ip_daily_max: 30,
      p_global_daily_max: 1000,
    }));
  });

  it.each(["ip_burst", "ip_daily", "global_daily"])("devolve 429 para %s", async (code) => {
    rpc.mockResolvedValue({ data: code, error: null });
    const res = await consumeAiQuota("assistant", "mypetbrasil", headers());
    expect(res?.status).toBe(429);
    expect(res?.headers.get("Retry-After")).toBeTruthy();
    const body = await res?.json();
    expect(body.error.code).toBe("RATE_LIMITED");
    expect(typeof body.error.message).toBe("string");
  });

  it("falha fechada (503) quando não consegue contar", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "function does not exist" } });
    const res = await consumeAiQuota("duvidas", "mypetbrasil", headers());
    expect(res?.status).toBe(503);
  });

  it("desliga tudo com AI_ASSISTANTS_DISABLED", async () => {
    vi.stubEnv("AI_ASSISTANTS_DISABLED", "true");
    const res = await consumeAiQuota("duvidas", "mypetbrasil", headers());
    expect(res?.status).toBe(503);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("escopo agente_cliente", () => {
  it("tem limites próprios, ajustáveis por env", () => {
    expect(getAiLimits("agente_cliente")).toEqual({
      ipBurstMax: 20,
      ipBurstWindowSeconds: 600,
      ipDailyMax: 80,
      globalDailyMax: 3000,
    });
    vi.stubEnv("AI_LIMIT_AGENTE_CLIENTE_IP_DAILY", "120");
    expect(getAiLimits("agente_cliente").ipDailyMax).toBe(120);
  });

  it("conta por comprador quando recebe subjectKey, não pelo IP", async () => {
    rpc.mockResolvedValue({ data: "ok", error: null });
    await consumeAiQuota("agente_cliente", "mypetbrasil", headers(), "buyer-1");
    await consumeAiQuota("agente_cliente", "mypetbrasil", headers({ "x-forwarded-for": "9.9.9.9" }), "buyer-1");
    const [first, second] = rpc.mock.calls.map((c) => c[1].p_ip_hash);
    expect(first).toBe(second);
    expect(first).not.toBe(hashClientIp(headers()));
    expect(first).toHaveLength(32);
  });
});

describe("mensagens de limite", () => {
  it("limite diário orienta para a central de ajuda, sem WhatsApp", async () => {
    rpc.mockResolvedValue({ data: "ip_daily", error: null });
    const res = await consumeAiQuota("duvidas", "mypetbrasil", headers());
    const body = await res?.json();
    expect(body.error.message).toContain("central de ajuda");
    expect(body.error.message).not.toMatch(/whatsapp/i);
  });
});
