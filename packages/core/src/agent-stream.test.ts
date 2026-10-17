import { describe, it, expect, vi } from "vitest";
import { openStreamWithFallback } from "./agent-stream";

type Part = { type: string; value?: string; error?: unknown };

function streamOf(parts: Part[]): ReadableStream<Part> {
  return new ReadableStream({
    start(controller) {
      for (const part of parts) controller.enqueue(part);
      controller.close();
    },
  });
}

async function readAll<T>(stream: ReadableStream<T>): Promise<T[]> {
  const out: T[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return out;
    out.push(value);
  }
}

vi.spyOn(console, "error").mockImplementation(() => {});

const ok = [{ type: "start" }, { type: "start-step" }, { type: "text-delta", value: "Oi" }, { type: "finish" }];

describe("openStreamWithFallback", () => {
  it("usa o primeiro provedor quando ele responde", async () => {
    const second = vi.fn(() => streamOf(ok));
    const { stream } = await openStreamWithFallback([
      { provider: "openai", open: () => streamOf(ok) },
      { provider: "google", open: second },
    ]);
    expect(await readAll(stream!)).toEqual(ok);
    expect(second).not.toHaveBeenCalled();
  });

  it("troca de provedor quando o erro vem antes do primeiro conteúdo", async () => {
    const { stream } = await openStreamWithFallback([
      { provider: "openai", open: () => streamOf([{ type: "start" }, { type: "start-step" }, { type: "error", error: "429" }]) },
      { provider: "google", open: () => streamOf(ok) },
    ]);
    expect(await readAll(stream!)).toEqual(ok);
  });

  it("troca de provedor quando abrir o stream lança", async () => {
    const { stream } = await openStreamWithFallback([
      {
        provider: "openai",
        open: () => {
          throw new Error("sem chave");
        },
      },
      { provider: "google", open: () => streamOf(ok) },
    ]);
    expect(await readAll(stream!)).toEqual(ok);
  });

  it("depois do primeiro conteúdo, erros passam adiante sem trocar de provedor", async () => {
    const parts = [{ type: "start" }, { type: "text-delta", value: "Oi" }, { type: "error", error: "caiu" }];
    const second = vi.fn(() => streamOf(ok));
    const { stream } = await openStreamWithFallback([
      { provider: "openai", open: () => streamOf(parts) },
      { provider: "google", open: second },
    ]);
    expect(await readAll(stream!)).toEqual(parts);
    expect(second).not.toHaveBeenCalled();
  });

  it("devolve null quando todos falham", async () => {
    const { stream } = await openStreamWithFallback([
      { provider: "openai", open: () => streamOf([{ type: "error", error: "x" }]) },
      { provider: "google", open: () => streamOf([{ type: "start" }, { type: "error", error: "y" }]) },
    ]);
    expect(stream).toBeNull();
  });

  it("stream sem conteúdo (só preâmbulo) não é falha", async () => {
    const parts = [{ type: "start" }, { type: "start-step" }];
    const { stream } = await openStreamWithFallback([{ provider: "openai", open: () => streamOf(parts) }]);
    expect(await readAll(stream!)).toEqual(parts);
  });

  it("abort antes do primeiro conteúdo troca de provedor", async () => {
    const { stream } = await openStreamWithFallback([
      { provider: "openai", open: () => streamOf([{ type: "start" }, { type: "abort" }]) },
      { provider: "google", open: () => streamOf(ok) },
    ]);
    expect(await readAll(stream!)).toEqual(ok);
  });

  it("devolve null quando todos abortam antes do conteúdo", async () => {
    const { stream } = await openStreamWithFallback([
      { provider: "openai", open: () => streamOf([{ type: "start" }, { type: "abort" }]) },
      { provider: "google", open: () => streamOf([{ type: "abort" }]) },
    ]);
    expect(stream).toBeNull();
  });

  it("abort depois do primeiro conteúdo passa adiante sem trocar de provedor", async () => {
    const parts = [{ type: "start" }, { type: "text-delta", value: "Oi" }, { type: "abort" }];
    const second = vi.fn(() => streamOf(ok));
    const { stream } = await openStreamWithFallback([
      { provider: "openai", open: () => streamOf(parts) },
      { provider: "google", open: second },
    ]);
    expect(await readAll(stream!)).toEqual(parts);
    expect(second).not.toHaveBeenCalled();
  });

  it("informa o provedor vencedor e o índice, sem falhas", async () => {
    const result = await openStreamWithFallback([{ provider: "openai", open: () => streamOf(ok) }]);
    expect(result.stream).not.toBeNull();
    expect(result).toMatchObject({ provider: "openai", index: 0, failures: [] });
  });

  it("lista os provedores que caíram antes do vencedor", async () => {
    const result = await openStreamWithFallback([
      {
        provider: "openai",
        open: () => {
          throw new Error("sem chave");
        },
      },
      { provider: "google-vertex", open: () => streamOf([{ type: "start" }, { type: "error", error: "429" }]) },
      { provider: "google", open: () => streamOf(ok) },
    ]);
    expect(result).toMatchObject({ provider: "google", index: 2 });
    expect(result.failures.map((f) => f.provider)).toEqual(["openai", "google-vertex"]);
    expect((result.failures[0].error as Error).message).toBe("sem chave");
    expect(result.failures[1].error).toBe("429");
  });

  it("todos falham: stream null e todas as falhas", async () => {
    const result = await openStreamWithFallback([
      { provider: "openai", open: () => streamOf([{ type: "start" }, { type: "abort" }]) },
      { provider: "google", open: () => streamOf([{ type: "error", error: "y" }]) },
    ]);
    expect(result.stream).toBeNull();
    expect(result.failures).toEqual([
      { provider: "openai", error: "abortado (timeout ou cancelamento)" },
      { provider: "google", error: "y" },
    ]);
  });
});
