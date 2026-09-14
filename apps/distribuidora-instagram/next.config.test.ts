import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("next.config", () => {
  it("publica URL e anon key usando as variáveis privadas como fallback", async () => {
    vi.stubEnv("SUPABASE_URL", "https://projeto.supabase.co");
    vi.stubEnv("SUPABASE_ANON_KEY", "anon-key");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    const { default: config } = await import("./next.config");

    expect(config.env).toMatchObject({
      NEXT_PUBLIC_SUPABASE_URL: "https://projeto.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    });
  });
});
