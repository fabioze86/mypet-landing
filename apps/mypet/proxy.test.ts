import { describe, it, expect, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("@mypet/core/access-session", () => ({
  ACCESS_COOKIE: "mypet_acesso",
  verifyAccessToken: (t: string | undefined) => (t === "good" ? { buyerId: "b" } : null),
}));

import { proxy } from "./proxy";

function fakeRequest(url: string, cookie?: string): NextRequest {
  return {
    nextUrl: new URL(url),
    url,
    cookies: { get: (n: string) => (cookie ? { name: n, value: cookie } : undefined), getAll: () => [] },
  } as unknown as NextRequest;
}

describe("proxy", () => {
  it("redireciona /loja anônimo para /", async () => {
    const res = await proxy(fakeRequest("https://app.test/loja"));
    expect(res.headers.get("location")).toBe("https://app.test/");
  });

  it("deixa passar /loja com cookie válido", async () => {
    const res = await proxy(fakeRequest("https://app.test/loja", "good"));
    expect(res.headers.get("location")).toBeNull();
  });
});
