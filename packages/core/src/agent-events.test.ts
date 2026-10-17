import { describe, it, expect, vi } from "vitest";
import { fakeSupabase } from "./test-utils/fake-supabase";
import {
  buildEventRow,
  recordAgentEvent,
  shouldRecordQuotaBlock,
  summarizeError,
  type AgentEventContext,
} from "./agent-events";

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

describe("shouldRecordQuotaBlock", () => {
  const now = new Date("2026-10-16T12:00:00.000Z");
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000).toISOString();

  it("sem evento recente: grava; consulta por ip_hash, buyer_id nulo e janela de 10 min no ip_burst", async () => {
    const { client, calls } = fakeSupabase({ agent_events: [{ data: [] }] });
    await expect(shouldRecordQuotaBlock(client, context, "ip_burst", now)).resolves.toBe(true);
    expect(calls).toEqual([
      { table: "agent_events", method: "select", args: ["id"] },
      { table: "agent_events", method: "eq", args: ["kind", "quota_blocked"] },
      { table: "agent_events", method: "is", args: ["buyer_id", null] },
      { table: "agent_events", method: "eq", args: ["ip_hash", "h"] },
      { table: "agent_events", method: "gte", args: ["created_at", minutesAgo(10)] },
      { table: "agent_events", method: "limit", args: [1] },
    ]);
  });
  it("com evento recente: não grava", async () => {
    const { client } = fakeSupabase({ agent_events: [{ data: [{ id: 1 }] }] });
    await expect(shouldRecordQuotaBlock(client, context, "ip_burst", now)).resolves.toBe(false);
  });
  it("cliente: o sujeito é o comprador", async () => {
    const { client, calls } = fakeSupabase({ agent_events: [{ data: [] }] });
    await shouldRecordQuotaBlock(client, { ...context, buyerId: "b1" }, "ip_burst", now);
    expect(calls).toContainEqual({ table: "agent_events", method: "eq", args: ["buyer_id", "b1"] });
    expect(calls.some((c) => c.method === "is")).toBe(false);
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "ip_hash")).toBe(false);
  });
  it("global_daily e unavailable: sempre grava, sem consultar", async () => {
    const { client, calls } = fakeSupabase({});
    await expect(shouldRecordQuotaBlock(client, context, "global_daily", now)).resolves.toBe(true);
    await expect(shouldRecordQuotaBlock(client, context, "unavailable", now)).resolves.toBe(true);
    expect(calls).toEqual([]);
  });
  it("erro do banco: grava (fail-open)", async () => {
    const { client } = fakeSupabase({ agent_events: [{ error: { message: "down" } }] });
    await expect(shouldRecordQuotaBlock(client, context, "ip_burst", now)).resolves.toBe(true);
  });
  it("cliente que lança: grava (fail-open)", async () => {
    const broken = { from: () => { throw new Error("sem cliente"); } } as never;
    await expect(shouldRecordQuotaBlock(broken, context, "ip_burst", now)).resolves.toBe(true);
  });
  it("sem cliente: não grava", async () => {
    await expect(shouldRecordQuotaBlock(null, context, "ip_burst", now)).resolves.toBe(false);
  });
  it("ip_daily e disabled usam janela de 60 min", async () => {
    for (const reason of ["ip_daily", "disabled"]) {
      const { client, calls } = fakeSupabase({ agent_events: [{ data: [] }] });
      await shouldRecordQuotaBlock(client, context, reason, now);
      expect(calls).toContainEqual({ table: "agent_events", method: "gte", args: ["created_at", minutesAgo(60)] });
    }
  });
});
