import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AgentEntry } from "./agent-entry";

const assign = vi.fn();

beforeEach(() => {
  assign.mockReset();
  vi.stubGlobal("location", { ...window.location, assign });
});
afterEach(() => vi.unstubAllGlobals());

describe("AgentEntry", () => {
  it("leva a pergunta para o /agente", () => {
    render(<AgentEntry />);
    fireEvent.change(screen.getByLabelText("Sua pergunta para o agente"), { target: { value: " Tem shampoo neutro? " } });
    fireEvent.click(screen.getByRole("button", { name: "Perguntar" }));
    expect(assign).toHaveBeenCalledWith("/agente?pergunta=Tem%20shampoo%20neutro%3F");
  });

  it("sem pergunta abre o /agente", () => {
    render(<AgentEntry />);
    fireEvent.click(screen.getByRole("button", { name: "Perguntar" }));
    expect(assign).toHaveBeenCalledWith("/agente");
  });
});
