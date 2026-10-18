import { describe, it, expect } from "vitest";
import {
  awaitingConversations,
  buildTimeline,
  describeToolPart,
  eventLabel,
  formatDateTime,
  formatSeconds,
  liveBadge,
  parseFilters,
  periodStart,
  toolParts,
  whoLabel,
  type StoredEvent,
  type StoredMessage,
} from "./agent-dashboard";

const now = new Date("2026-10-17T15:00:00Z"); // 12:00 em São Paulo
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

describe("parseFilters", () => {
  it("padrão: hoje, todos os modos, sem filtro de falha", () => {
    expect(parseFilters({})).toEqual({ period: "hoje", mode: null, onlyFailures: false });
  });
  it("lê valores válidos", () => {
    expect(parseFilters({ periodo: "7d", modo: "cliente", falhas: "1" })).toEqual({
      period: "7d",
      mode: "cliente",
      onlyFailures: true,
    });
  });
  it("valores inválidos caem no padrão", () => {
    expect(parseFilters({ periodo: "ontem", modo: "admin", falhas: "sim" })).toEqual({
      period: "hoje",
      mode: null,
      onlyFailures: false,
    });
  });
});

describe("periodStart", () => {
  it("hoje: 00:00 de São Paulo (03:00 UTC)", () => {
    expect(periodStart("hoje", now).toISOString()).toBe("2026-10-17T03:00:00.000Z");
  });
  it("hoje logo depois da meia-noite UTC ainda é o dia anterior em São Paulo", () => {
    expect(periodStart("hoje", new Date("2026-10-17T01:30:00Z")).toISOString()).toBe("2026-10-16T03:00:00.000Z");
  });
  it("7d e 30d: agora menos N dias", () => {
    expect(periodStart("7d", now).toISOString()).toBe("2026-10-10T15:00:00.000Z");
    expect(periodStart("30d", now).toISOString()).toBe("2026-09-17T15:00:00.000Z");
  });
});

describe("awaitingConversations", () => {
  const start = (conversation_id: string, message_id: string, msAgo: number) => ({
    conversation_id,
    detail: { message_id },
    created_at: ago(msAgo),
  });

  it("turno aberto há menos de 60 s → aguardando", () => {
    expect([...awaitingConversations([start("c1", "m1", 10_000)], [], [], now)]).toEqual(["c1"]);
  });
  it("fechado pela mensagem do usuário com o mesmo message_id", () => {
    const users = [{ conversation_id: "c1", message_id: "m1", created_at: ago(2_000) }];
    expect(awaitingConversations([start("c1", "m1", 10_000)], users, [], now).size).toBe(0);
  });
  it("mensagem do usuário com outro message_id não fecha", () => {
    const users = [{ conversation_id: "c1", message_id: "m0", created_at: ago(2_000) }];
    expect(awaitingConversations([start("c1", "m1", 10_000)], users, [], now).has("c1")).toBe(true);
  });
  it("fechado por evento terminal mais novo que o início", () => {
    const terminals = [{ conversation_id: "c1", created_at: ago(5_000) }];
    expect(awaitingConversations([start("c1", "m1", 10_000)], [], terminals, now).size).toBe(0);
  });
  it("evento terminal mais antigo que o início não fecha", () => {
    const terminals = [{ conversation_id: "c1", created_at: ago(20_000) }];
    expect(awaitingConversations([start("c1", "m1", 10_000)], [], terminals, now).has("c1")).toBe(true);
  });
  it("turn_started com mais de 60 s não conta", () => {
    expect(awaitingConversations([start("c1", "m1", 61_000)], [], [], now).size).toBe(0);
  });
  it("vale só o turno mais recente da conversa", () => {
    const users = [{ conversation_id: "c1", message_id: "m2", created_at: ago(1_000) }];
    const starts = [start("c1", "m1", 30_000), start("c1", "m2", 5_000)];
    expect(awaitingConversations(starts, users, [], now).size).toBe(0);
  });
  it("ignora turn_started sem conversa", () => {
    expect(awaitingConversations([{ conversation_id: null, detail: null, created_at: ago(1_000) }], [], [], now).size).toBe(0);
  });
});

describe("liveBadge", () => {
  it("aguardando tem precedência", () => {
    expect(liveBadge(ago(1_000), true, now)).toBe("aguardando");
  });
  it("conversando dentro de 5 minutos", () => {
    expect(liveBadge(ago(4 * 60_000), false, now)).toBe("conversando");
  });
  it("nada depois de 5 minutos", () => {
    expect(liveBadge(ago(6 * 60_000), false, now)).toBeNull();
  });
});

const message = (id: string, created_at: string, role: "user" | "assistant" = "user"): StoredMessage => ({
  id,
  message_id: id,
  role,
  content: "texto",
  parts: [],
  mode: "visitante",
  created_at,
  provider: null,
  model: null,
  latency_ms: null,
  first_token_ms: null,
  input_tokens: null,
  output_tokens: null,
  steps: null,
});
const event = (id: number, kind: string, created_at: string, detail: Record<string, unknown> = {}): StoredEvent => ({
  id,
  kind,
  detail,
  question: "Tem shampoo?",
  provider: null,
  latency_ms: null,
  created_at,
});

describe("buildTimeline", () => {
  it("ordena por horário, omite turn_started e mantém falhas", () => {
    const items = buildTimeline(
      [message("a", "2026-10-17T10:00:02Z", "assistant"), message("u", "2026-10-17T10:00:01Z")],
      [event(1, "turn_started", "2026-10-17T10:00:00Z"), event(2, "aborted", "2026-10-17T10:00:03Z")],
    );
    expect(items.map((i) => (i.type === "message" ? i.message.id : i.event.kind))).toEqual(["u", "a", "aborted"]);
  });
  it("empate de horário: mensagem antes do evento", () => {
    const items = buildTimeline([message("u", "2026-10-17T10:00:01Z")], [event(1, "quota_blocked", "2026-10-17T10:00:01Z")]);
    expect(items.map((i) => i.type)).toEqual(["message", "event"]);
  });
});

describe("toolParts e describeToolPart", () => {
  it("filtra só partes de ferramenta", () => {
    const parts = [{ type: "text", text: "Oi" }, { type: "tool-buscar_produtos", input: { query: "x" } }, null, "lixo"];
    expect(toolParts(parts).map((p) => p.type)).toEqual(["tool-buscar_produtos"]);
    expect(toolParts("não é lista")).toEqual([]);
  });
  it("buscar_produtos com total", () => {
    expect(
      describeToolPart({ type: "tool-buscar_produtos", input: { query: "shampoo" }, output: { total: 6, produtos: [] } }),
    ).toBe("Buscou produtos: 'shampoo' → 6 resultados");
  });
  it("buscar_produtos com 1 resultado e sem total usa produtos.length", () => {
    expect(
      describeToolPart({ type: "tool-buscar_produtos", input: { query: "ração" }, output: { produtos: [{}] } }),
    ).toBe("Buscou produtos: 'ração' → 1 resultado");
  });
  it("buscar_produtos sem saída", () => {
    expect(describeToolPart({ type: "tool-buscar_produtos", input: { query: "x" } })).toBe("Buscou produtos: 'x'");
  });
  it("ferramentas de pedido e desconhecida", () => {
    expect(describeToolPart({ type: "tool-alterar_pedido" })).toBe("Alterou o pedido");
    expect(describeToolPart({ type: "tool-sugerir_reposicao" })).toBe("Sugeriu reposição");
    expect(describeToolPart({ type: "tool-status_pedidos" })).toBe("Consultou pedidos");
    expect(describeToolPart({ type: "tool-outra_coisa" })).toBe("outra_coisa");
  });
});

describe("eventLabel", () => {
  it("falhas em vermelho", () => {
    expect(eventLabel(event(1, "provider_error", "x"))).toEqual({ text: "Erro do provedor", tone: "error" });
    expect(eventLabel(event(1, "aborted", "x"))).toEqual({ text: "Resposta interrompida", tone: "error" });
    expect(eventLabel(event(1, "empty_reply", "x"))).toEqual({ text: "Resposta vazia", tone: "error" });
  });
  it("troca de provedor e cota com detalhe", () => {
    expect(eventLabel({ ...event(1, "provider_fallback", "x", { failed_provider: "openai" }), provider: "google" })).toEqual({
      text: "Troca de provedor: openai falhou, google respondeu",
      tone: "warning",
    });
    expect(eventLabel(event(1, "quota_blocked", "x", { reason: "ip_burst" }))).toEqual({
      text: "Bloqueado pela cota (ip_burst)",
      tone: "warning",
    });
  });
  it("conversa proibida, duplicada e tipo desconhecido", () => {
    expect(eventLabel(event(1, "conversation_forbidden", "x")).tone).toBe("warning");
    expect(eventLabel(event(1, "duplicate_message", "x"))).toEqual({ text: "Mensagem duplicada recusada", tone: "info" });
    expect(eventLabel(event(1, "novo_tipo", "x"))).toEqual({ text: "novo_tipo", tone: "info" });
  });
});

describe("formatação", () => {
  it("whoLabel", () => {
    expect(whoLabel("Pet Shop X", "b1")).toBe("Pet Shop X");
    expect(whoLabel(null, "b1")).toBe("Cliente sem empresa");
    expect(whoLabel(null, null)).toBe("Visitante");
  });
  it("formatSeconds", () => {
    expect(formatSeconds(3429)).toBe("3,4 s");
    expect(formatSeconds(null)).toBeNull();
  });
  it("formatDateTime no horário de São Paulo", () => {
    expect(formatDateTime("2026-10-17T10:31:44Z")).toBe("17/10 07:31");
  });
});
