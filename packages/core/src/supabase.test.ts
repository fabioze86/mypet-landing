import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn((url: string, key: string) => ({ url, key }));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

describe("getCatalogClient", () => {
  beforeEach(() => {
    vi.resetModules();
    createClient.mockClear();
    vi.stubEnv("SUPABASE_URL", "https://hub.supabase.co");
    vi.stubEnv("SUPABASE_ANON_KEY", "anon-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("usa a service role quando a chave está no ambiente", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
    const { getCatalogClient } = await import("./supabase");

    expect(getCatalogClient()).toMatchObject({ key: "service-key" });
  });

  it("sem a service role, cai para a anon e avisa uma vez só", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { getCatalogClient } = await import("./supabase");

    expect(getCatalogClient()).toMatchObject({ key: "anon-key" });
    getCatalogClient();
    expect(error).toHaveBeenCalledTimes(1);
  });
});
