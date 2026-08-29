import { describe, it, expect, beforeEach } from "vitest";
import {
  signAccessToken,
  verifyAccessToken,
  ACCESS_COOKIE,
  ACCESS_COOKIE_OPTS,
} from "./access-session";

beforeEach(() => {
  process.env.ACCESS_SESSION_SECRET = "test-secret-0123456789";
});

describe("access-session", () => {
  it("faz round-trip de um buyerId válido", () => {
    const token = signAccessToken("buyer-1", 1_000_000);
    expect(verifyAccessToken(token, 1_000_000)).toEqual({ buyerId: "buyer-1" });
  });

  it("rejeita token com assinatura adulterada", () => {
    const token = signAccessToken("buyer-1", 1_000_000);
    const tampered = token.slice(0, -2) + (token.endsWith("a") ? "bb" : "aa");
    expect(verifyAccessToken(tampered, 1_000_000)).toBeNull();
  });

  it("rejeita token expirado", () => {
    const token = signAccessToken("buyer-1", 1_000_000);
    const later = 1_000_000 + 2_592_000_000 + 1;
    expect(verifyAccessToken(token, later)).toBeNull();
  });

  it("rejeita token malformado ou ausente", () => {
    expect(verifyAccessToken(undefined)).toBeNull();
    expect(verifyAccessToken("")).toBeNull();
    expect(verifyAccessToken("sem-ponto")).toBeNull();
    expect(verifyAccessToken("a.b.c")).toBeNull();
  });

  it("rejeita token assinado com outro segredo", () => {
    const token = signAccessToken("buyer-1", 1_000_000);
    process.env.ACCESS_SESSION_SECRET = "outro-segredo";
    expect(verifyAccessToken(token, 1_000_000)).toBeNull();
  });

  it("expõe o nome e as opções do cookie exigidas pela spec", () => {
    expect(ACCESS_COOKIE).toBe("mypet_acesso");
    expect(ACCESS_COOKIE_OPTS).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 2_592_000,
    });
  });

  it("lança erro claro quando falta o segredo", () => {
    delete process.env.ACCESS_SESSION_SECRET;
    expect(() => signAccessToken("buyer-1")).toThrow(/ACCESS_SESSION_SECRET/);
  });
});
