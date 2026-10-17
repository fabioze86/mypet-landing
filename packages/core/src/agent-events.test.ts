import { describe, it, expect, vi } from "vitest";
import { fakeSupabase } from "./test-utils/fake-supabase";
import { buildEventRow, recordAgentEvent, summarizeError, type AgentEventContext } from "./agent-events";

vi.spyOn(console, "error").mockImplementation(() => {});

const context: AgentEventContext = {
  conversationId: "conv-1",
  channel: "mypetbrasil",
  mode: "visitante",
  buyerId: null,
  ipHash: "h",
  question: "Tem shampoo?",
};

describe("summarizeError", () => {
  it("usa a mensagem do Error, sem stack", () => {
    expect(summarizeError(new Error("provedor fora do ar"))).toBe("provedor fora do ar");
  });
  it("aceita string e objeto", () => {
    expect(summarizeError("429")).toBe("429");
    expect(summarizeError({ status: 500 })).toBe('{"status":500}');
  });
  it("aceita undefined", () => {
    expect(summarizeError(undefined)).toBe("undefined");
  });
  it("corta em 500 caracteres", () => {
    expect(summarizeError("x".repeat(800))).toHaveLength(500);
  });
});

describe("buildEventRow", () => {
  it("monta a linha com contexto e evento", () => {
    expect(
      buildEventRow(context, { kind: "provider_fallback", detail: { failed_provider: "openai" }, provider: "google", latencyMs: 120 }),
    ).toEqual({
      conversation_id: "conv-1",
      channel: "mypetbrasil",
      mode: "visitante",
      buyer_id: null,
      ip_hash: "h",
      kind: "provider_fallback",
      detail: { failed_provider: "openai" },
      question: "Tem shampoo?",
      provider: "google",
      latency_ms: 120,
    });
  });
  it("sem detail, provider e latência: valores padrão", () => {
    const row = buildEventRow(context, { kind: "aborted" });
    expect(row.detail).toEqual({});
    expect(row.provider).toBeNull();
    expect(row.latency_ms).toBeNull();
  });
});

describe("recordAgentEvent", () => {
  it("insere em agent_events", async () => {
    const { client, calls } = fakeSupabase({ agent_events: [{}] });
    await recordAgentEvent(client, context, { kind: "turn_started", detail: { message_id: "m1" } });
    expect(calls).toContainEqual({
      table: "agent_events",
      method: "insert",
      args: [buildEventRow(context, { kind: "turn_started", detail: { message_id: "m1" } })],
    });
  });
  it("erro do banco não lança", async () => {
    const { client } = fakeSupabase({ agent_events: [{ error: { message: "down" } }] });
    await expect(recordAgentEvent(client, context, { kind: "aborted" })).resolves.toBeUndefined();
  });
  it("cliente que lança não propaga o erro", async () => {
    const broken = { from: () => { throw new Error("sem cliente"); } } as never;
    await expect(recordAgentEvent(broken, context, { kind: "aborted" })).resolves.toBeUndefined();
  });
  it("sem cliente, não faz nada", async () => {
    await expect(recordAgentEvent(null, context, { kind: "aborted" })).resolves.toBeUndefined();
  });
});
