import { describe, it, expect, vi, beforeEach } from "vitest";

const cookieGet = vi.fn();
const maybeSingle = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookieGet }),
}));

vi.mock("@mypet/core/supabase", () => ({
  getHubServiceClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ single: maybeSingle }) }) }),
  }),
}));

vi.mock("@mypet/core/access-session", () => ({
  ACCESS_COOKIE: "mypet_acesso",
  verifyAccessToken: (token: string | undefined) =>
    token === "good" ? { buyerId: "b-1" } : null,
}));

import { requireBuyer } from "./require-buyer";

beforeEach(() => {
  cookieGet.mockReset();
  maybeSingle.mockReset();
});

describe("requireBuyer", () => {
  it("retorna null quando não há cookie", async () => {
    cookieGet.mockReturnValue(undefined);
    expect(await requireBuyer()).toBeNull();
    expect(maybeSingle).not.toHaveBeenCalled();
  });

  it("retorna null quando o token é inválido", async () => {
    cookieGet.mockReturnValue({ value: "bad" });
    expect(await requireBuyer()).toBeNull();
  });

  it("retorna o comprador quando o token é válido", async () => {
    cookieGet.mockReturnValue({ value: "good" });
    maybeSingle.mockResolvedValue({ data: { id: "b-1", cnpj: "12345678000195" }, error: null });
    expect(await requireBuyer()).toMatchObject({ id: "b-1" });
  });
});
