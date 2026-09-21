import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CadastroPage from "./page";

describe("CadastroPage", () => {
  it("mostra o formulário de criação de acesso", () => {
    render(<CadastroPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/preços/i);
    expect(screen.getByRole("heading", { level: 2, name: "Criar acesso à loja" })).toBeInTheDocument();
    expect(screen.getByLabelText("CNPJ")).toBeInTheDocument();
    expect(screen.getByLabelText("WhatsApp")).toBeInTheDocument();
  });

  it("tem um único h1", () => {
    render(<CadastroPage />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("não tem em-dash na copy visível da página", () => {
    const { container } = render(<CadastroPage />);
    expect(container.textContent ?? "").not.toMatch(/[–—]/);
  });
});
