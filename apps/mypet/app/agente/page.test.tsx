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
    expect(tree.props).toEqual({ mode: "visitante", initialQuestion: "Tem shampoo?", displayName: null });
  });

  it("cliente quando há comprador, com o nome do cadastro", async () => {
    requireBuyer.mockResolvedValue({ id: "b1", nome: " Ana ", empresa: "Pet X" });
    const tree = await AgentePageBody({ searchParams: Promise.resolve({}) });
    expect(tree.props).toEqual({ mode: "cliente", initialQuestion: null, displayName: "Ana" });
  });

  it("cliente sem nome usa a empresa; sem os dois, null", async () => {
    requireBuyer.mockResolvedValue({ id: "b1", nome: null, empresa: "Pet X" });
    expect((await AgentePageBody({ searchParams: Promise.resolve({}) })).props.displayName).toBe("Pet X");
    requireBuyer.mockResolvedValue({ id: "b1", nome: "  ", empresa: null });
    expect((await AgentePageBody({ searchParams: Promise.resolve({}) })).props.displayName).toBeNull();
  });
});
