import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QuickAccessSteps } from "./quick-access-steps";

describe("QuickAccessSteps", () => {
  it("mostra os 3 passos e um CTA para a página de cadastro", () => {
    render(<QuickAccessSteps />);
    const region = screen.getByRole("region", { name: "Quer apenas consultar nossos preços?" });
    expect(screen.getByText("Informe seu CNPJ e e-mail")).toBeInTheDocument();
    expect(screen.getByText("Consulte produtos e preços")).toBeInTheDocument();
    expect(screen.getByText("Monte seu orçamento")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Liberar meu acesso aos preços" });
    expect(link).toHaveAttribute("href", "/cadastro");
    expect(region).toContainElement(link);
  });

  it("não usa em-dash na copy", () => {
    const { container } = render(<QuickAccessSteps />);
    expect(container.textContent ?? "").not.toMatch(/[–—]/);
  });
});
