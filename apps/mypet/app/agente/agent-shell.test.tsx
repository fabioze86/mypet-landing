import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("./agent-chat", () => ({
  AgentChat: ({ onLockedIntent }: { onLockedIntent: (reason: string) => void }) => (
    <button type="button" onClick={() => onLockedIntent("Cadastre-se para ver os preços da tabela.")}>
      cadeado
    </button>
  ),
}));
vi.mock("../_components/pre-access/access-form", () => ({
  AccessForm: ({ redirectTo }: { redirectTo?: string }) => <form aria-label={`cadastro ${redirectTo}`} />,
}));

import { AgentShell } from "./agent-shell";

describe("AgentShell", () => {
  it("visitante: painel de acesso com cadastro que volta para /agente", () => {
    render(<AgentShell mode="visitante" initialQuestion={null} />);
    expect(screen.getByRole("heading", { name: "Acesso completo ao agente" })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "cadastro /agente" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Liberar acesso completo" })).toBeInTheDocument();
  });

  it("cadeado mostra o motivo e abre o painel", () => {
    render(<AgentShell mode="visitante" initialQuestion={null} />);
    fireEvent.click(screen.getByRole("button", { name: "cadeado" }));
    expect(screen.getByRole("status")).toHaveTextContent("Cadastre-se para ver os preços da tabela.");
    expect(screen.getByRole("complementary")).toHaveClass("is-open");
    expect(screen.queryByRole("button", { name: "Liberar acesso completo" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.getByRole("complementary")).not.toHaveClass("is-open");
  });

  it("cliente: sem painel de acesso, com links da tabela e dos pedidos", () => {
    render(<AgentShell mode="cliente" initialQuestion={null} />);
    expect(screen.queryByRole("heading", { name: "Acesso completo ao agente" })).toBeNull();
    expect(screen.getByRole("link", { name: "Tabela de preços" })).toHaveAttribute("href", "/pedido-rapido");
    expect(screen.getByRole("link", { name: "Meus pedidos" })).toHaveAttribute("href", "/pedidos");
  });

  it("rodapé informa que as conversas são guardadas", () => {
    render(<AgentShell mode="visitante" initialQuestion={null} />);
    expect(screen.getByText(/conversas com o agente são guardadas/)).toBeInTheDocument();
  });
});
