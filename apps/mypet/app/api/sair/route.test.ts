import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

function request(headers: Record<string, string>): NextRequest {
  return new NextRequest("http://localhost/api/sair", { method: "POST", headers, body: "{}" });
}

describe("POST /api/sair", () => {
  it("expira o cookie de acesso", async () => {
    const res = await POST(request({ "content-type": "application/json", origin: "http://localhost", host: "localhost" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("mypet_acesso=;");
    expect(res.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("recusa requisição de outra origem e não mexe no cookie", async () => {
    const res = await POST(request({ "content-type": "application/json", origin: "https://evil.example", host: "localhost" }));
    expect(res.status).toBe(403);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("recusa corpo que não é JSON", async () => {
    const res = await POST(request({ "content-type": "text/plain" }));
    expect(res.status).toBe(415);
  });
});
