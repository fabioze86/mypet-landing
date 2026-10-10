import { describe, expect, it } from "vitest";
import type { NextRequest } from "next/server";
import { rejectForeignRequest } from "./request-guards";

function req(headers: Record<string, string>): NextRequest {
  return { headers: new Headers({ host: "loja.exemplo.com", ...headers }), nextUrl: { host: "loja.exemplo.com" } } as unknown as NextRequest;
}

describe("rejectForeignRequest", () => {
  it("415 sem JSON", () => expect(rejectForeignRequest(req({ "content-type": "text/plain" }))?.status).toBe(415));
  it("403 com Origin de outro site", () =>
    expect(rejectForeignRequest(req({ "content-type": "application/json", origin: "https://mal.com" }))?.status).toBe(403));
  it("aceita mesma origem ou sem Origin", () => {
    expect(rejectForeignRequest(req({ "content-type": "application/json", origin: "https://loja.exemplo.com" }))).toBeNull();
    expect(rejectForeignRequest(req({ "content-type": "application/json; charset=utf-8" }))).toBeNull();
  });
});
