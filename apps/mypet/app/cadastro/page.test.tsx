import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("../_components/hub/hub-header", () => ({ HubHeaderSlot: () => <header data-testid="hub-header" /> }));

import CadastroPage from "./page";

describe("CadastroPage", () => {
  it("mostra o formulário de criação de acesso", () => {
    render(<CadastroPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/preços/i);
    expect(screen.getByRole("heading", { level: 2, name: "Liberar tabela" })).toBeInTheDocument();
    expect(screen.getByLabelText("CNPJ")).toBeInTheDocument();
    expect(screen.getByLabelText("WhatsApp")).toBeInTheDocument();
  });

  it("usa o cabeçalho do hub", () => {
    render(<CadastroPage />);
    expect(screen.getByTestId("hub-header")).toBeInTheDocument();
  });

  it("lista o que o cadastro libera", () => {
    render(<CadastroPage />);
    const lista = screen.getByRole("region", { name: "O que o cadastro libera" });
    for (const item of ["Tabela de preços completa", "Catálogo com preços", "Agente My Pet completo", "Pedido pelo WhatsApp"]) {
      expect(lista).toHaveTextContent(item);
    }
  });

  it("tem um único h1", () => {
    render(<CadastroPage />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("não tem em-dash nem palavras proibidas na copy visível", () => {
    const { container } = render(<CadastroPage />);
    expect(container.textContent ?? "").not.toMatch(/[–—]/);
    expect(container.textContent ?? "").not.toMatch(/atacado|cota[cç][aã]o|\bloja\b/i);
  });
});
