import { describe, it, expect, vi, beforeEach } from "vitest";

const requireBuyer = vi.fn();
vi.mock("@/lib/require-buyer", () => ({ requireBuyer: () => requireBuyer() }));
vi.mock("./agent-shell", () => ({ AgentShell: () => null }));

import { AgentePageBody } from "./page";
import { AgentShell } from "./agent-shell";
import { initialQuestionFrom } from "./agent-params";

beforeEach(() => requireBuyer.mockReset());

describe("initialQuestionFrom", () => {
  it("normaliza a pergunta da URL", () => {
    expect(initialQuestionFrom("  Qual o mínimo? ")).toBe("Qual o mínimo?");
    expect(initialQuestionFrom(["primeira", "segunda"])).toBe("primeira");
    expect(initialQuestionFrom("   ")).toBeNull();
    expect(initialQuestionFrom(undefined)).toBeNull();
    expect(initialQuestionFrom("a".repeat(600))).toHaveLength(500);
  });
});

describe("AgentePageBody", () => {
  it("visitante quando não há comprador", async () => {
    requireBuyer.mockResolvedValue(null);
    const tree = await AgentePageBody({ searchParams: Promise.resolve({ pergunta: "Tem shampoo?" }) });
    expect(tree.type).toBe(AgentShell);
    expect(tree.props).toEqual({ mode: "visitante", initialQuestion: "Tem shampoo?" });
  });

  it("cliente quando há comprador", async () => {
    requireBuyer.mockResolvedValue({ id: "b1" });
    const tree = await AgentePageBody({ searchParams: Promise.resolve({}) });
    expect(tree.props).toEqual({ mode: "cliente", initialQuestion: null });
  });
});
