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
