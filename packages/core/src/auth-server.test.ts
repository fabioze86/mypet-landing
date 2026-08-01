import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const exchangeCodeForSession = vi.fn();
const buyerSingleMock = vi.fn();

vi.mock("./supabase-server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { exchangeCodeForSession },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: buyerSingleMock,
    })),
  })),
}));

import { createAuthCallbackHandler } from "./auth-server";

function fakeRequest(url: string): NextRequest {
  return { nextUrl: new URL(url) } as unknown as NextRequest;
}

beforeEach(() => {
  exchangeCodeForSession.mockReset();
  buyerSingleMock.mockReset();
});

describe("createAuthCallbackHandler", () => {
  it("redireciona para /entrar quando não há código", async () => {
    const GET = createAuthCallbackHandler();
    const res = await GET(fakeRequest("https://app.test/entrar/callback"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://app.test/entrar?erro=link-invalido");
  });

  it("redireciona para /entrar quando a troca de código falha", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: { user: null }, error: { message: "expirado" } });
    const GET = createAuthCallbackHandler();
    const res = await GET(fakeRequest("https://app.test/entrar/callback?code=abc"));
    expect(res.headers.get("location")).toBe("https://app.test/entrar?erro=link-invalido");
  });

  it("redireciona para /completar-cadastro quando o buyer ainda não existe", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    buyerSingleMock.mockResolvedValue({ data: null, error: null });
    const GET = createAuthCallbackHandler();
    const res = await GET(fakeRequest("https://app.test/entrar/callback?code=abc&next=%2Fcotacao"));
    expect(res.headers.get("location")).toBe("https://app.test/completar-cadastro?next=%2Fcotacao");
  });

  it("redireciona para next quando o buyer já existe", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    buyerSingleMock.mockResolvedValue({ data: { id: "u1" }, error: null });
    const GET = createAuthCallbackHandler();
    const res = await GET(fakeRequest("https://app.test/entrar/callback?code=abc&next=%2Fcotacao"));
    expect(res.headers.get("location")).toBe("https://app.test/cotacao");
  });

  it("usa /cotacao como destino padrão quando next não é informado", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    buyerSingleMock.mockResolvedValue({ data: { id: "u1" }, error: null });
    const GET = createAuthCallbackHandler();
    const res = await GET(fakeRequest("https://app.test/entrar/callback?code=abc"));
    expect(res.headers.get("location")).toBe("https://app.test/cotacao");
  });
});
