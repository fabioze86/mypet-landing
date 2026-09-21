import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { WhyBuy } from "./why-buy";
import { LANDING_STYLES } from "./styles";

describe("WhyBuy", () => {
  it("mostra 4 pontos com ícone", () => {
    const { container } = render(<WhyBuy />);
    const region = screen.getByRole("region", { name: "Por que comprar na My Pet Brasil?" });
    expect(within(region).getByText("Variedade para sua loja")).toBeInTheDocument();
    expect(within(region).getByText("Compra para CNPJ")).toBeInTheDocument();
    expect(within(region).getByText("Consulte antes de comprar")).toBeInTheDocument();
    expect(within(region).getByText("Compra sem caixa fechada")).toBeInTheDocument();
    expect(container.querySelectorAll(".pa-inst-item svg").length).toBe(4);
  });

  it("aplica o raio pill ao contêiner visual dos ícones", () => {
    expect(LANDING_STYLES).toMatch(
      /\.pa-inst-icon\s*\{[^}]*border-radius:\s*var\(--pa-r-pill\)/,
    );
  });
});
