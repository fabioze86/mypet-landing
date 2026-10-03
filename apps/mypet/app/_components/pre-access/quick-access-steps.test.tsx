import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QuickAccessSteps } from "./quick-access-steps";

describe("QuickAccessSteps", () => {
  it("mostra os 3 passos e um CTA para a página de cadastro", () => {
    render(<QuickAccessSteps />);
    const region = screen.getByRole("region", { name: "Como usar a tabela" });
    expect(screen.getByText("Informe seu CNPJ")).toBeInTheDocument();
    expect(screen.getByText("Consulte os preços")).toBeInTheDocument();
    expect(screen.getByText("Envie seu pedido pelo WhatsApp")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Liberar tabela de preços" });
    expect(link).toHaveAttribute("href", "/cadastro");
    expect(region).toContainElement(link);
  });

  it("não usa em-dash na copy", () => {
    const { container } = render(<QuickAccessSteps />);
    expect(container.textContent ?? "").not.toMatch(/[–—]/);
  });
});
