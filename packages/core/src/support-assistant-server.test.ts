import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { NextRequest } from "next/server";

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return { ...actual, generateText: vi.fn() };
});

vi.mock("./catalog", () => ({ getCatalog: vi.fn(), getCategories: vi.fn() }));

vi.mock("./help-center", () => ({ getArtigosAjudaPublicados: vi.fn() }));

vi.mock("./ai-provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./ai-provider")>();
  return {
    ...actual,
    getAssistantModelChain: vi.fn(() => [
      { provider: "openai", model: { modelId: "fake-openai" } },
      { provider: "google", model: { modelId: "fake-google" } },
    ]),
  };
});

import { generateText } from "ai";
import { getArtigosAjudaPublicados } from "./help-center";
import { getAssistantModelChain } from "./ai-provider";
import { createSupportAssistantHandler, buildSupportSystemPrompt } from "./support-assistant-server";

const faq = [{ q: "Qual é o pedido mínimo?", a: "R$ 250,00 na capital de SP." }];
const artigo = {
  id: "a1",
  categoriaId: "c1",
  slug: "prazo-entrega",
  titulo: "Prazo de entrega",
  resumo: "r",
  ordem: 0,
  corpoMarkdown: "Sul e Sudeste: 3 a 7 dias úteis.",
};

const POST = createSupportAssistantHandler({ channel: "mypetbrasil", siteName: "My Pet Brasil", faq });

function makeRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/api/duvidas", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

const validBody = { channel: "mypetbrasil", messages: [{ role: "user", content: "Qual o prazo?" }] };

beforeEach(() => {
  vi.clearAllMocks();
  (getArtigosAjudaPublicados as Mock).mockResolvedValue([artigo]);
});

describe("buildSupportSystemPrompt", () => {
  it("inclui FAQ e artigos com o caminho do artigo", () => {
    const prompt = buildSupportSystemPrompt("My Pet Brasil", faq, [artigo]);
    expect(prompt).toContain("Qual é o pedido mínimo?");
    expect(prompt).toContain("R$ 250,00 na capital de SP.");
    expect(prompt).toContain("/central-de-ajuda/a/prazo-entrega");
    expect(prompt).toContain("Sul e Sudeste: 3 a 7 dias úteis.");
  });

  it("limita o tamanho da base de conhecimento", () => {
    const muitos = Array.from({ length: 50 }, (_, i) => ({ ...artigo, slug: `a${i}`, corpoMarkdown: "x".repeat(5000) }));
    expect(buildSupportSystemPrompt("My Pet Brasil", faq, muitos).length).toBeLessThan(70000);
  });
});

describe("POST /api/duvidas", () => {
  it("responde com o texto do modelo", async () => {
    (generateText as Mock).mockResolvedValue({ text: "De 3 a 7 dias úteis no Sul e Sudeste." });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, reply: "De 3 a 7 dias úteis no Sul e Sudeste." });
    const call = (generateText as Mock).mock.calls[0][0];
    expect(call.system).toContain("/central-de-ajuda/a/prazo-entrega");
    expect(call.messages).toEqual(validBody.messages);
    expect(call.tools).toBeUndefined();
  });

  it("ignora provedor/modelo enviados pelo cliente", async () => {
    (generateText as Mock).mockResolvedValue({ text: "ok" });
    await POST(makeRequest({ ...validBody, provider: "openai", model: "gpt-4o-mini", adminKey: "x" }));
    expect(getAssistantModelChain).toHaveBeenCalledWith();
  });

  it("cai para o próximo provedor quando o primeiro falha", async () => {
    (generateText as Mock).mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce({ text: "do google" });
    const res = await POST(makeRequest(validBody));
    expect(await res.json()).toEqual({ ok: true, reply: "do google" });
  });

  it("devolve 502 quando todos os provedores falham", async () => {
    (generateText as Mock).mockRejectedValue(new Error("boom"));
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(502);
  });

  it("devolve 400 para corpo inválido", async () => {
    const res = await POST(makeRequest({ channel: "mypetbrasil", messages: [] }));
    expect(res.status).toBe(400);
    expect(generateText).not.toHaveBeenCalled();
  });

  it("devolve 403 para canal de outro site", async () => {
    const res = await POST(makeRequest({ ...validBody, channel: "outro" }));
    expect(res.status).toBe(403);
  });

  it("rejeita requisição de outra origem", async () => {
    const res = await POST(makeRequest(validBody, { origin: "https://evil.example" }));
    expect(res.status).toBe(403);
    expect(generateText).not.toHaveBeenCalled();
  });

  it("rejeita corpo que não é JSON", async () => {
    const res = await POST(makeRequest(validBody, { "content-type": "text/plain" }));
    expect(res.status).toBe(415);
  });
});
