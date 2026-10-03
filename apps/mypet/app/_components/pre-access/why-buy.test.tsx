import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { WhyBuy } from "./why-buy";
import { LANDING_STYLES } from "./styles";

describe("WhyBuy", () => {
  it("mostra 4 pontos com ícone", () => {
    const { container } = render(<WhyBuy />);
    const region = screen.getByRole("region", { name: "Mesma My Pet, mesmos preços" });
    expect(within(region).getByText("Mesmos preços do site")).toBeInTheDocument();
    expect(within(region).getByText("Mesmos produtos e estoque")).toBeInTheDocument();
    expect(within(region).getByText("Todos os preços numa tela")).toBeInTheDocument();
    expect(within(region).getByText("Pedido direto com o nosso time")).toBeInTheDocument();
    expect(container.querySelectorAll(".pa-inst-item svg").length).toBe(4);
  });

  it("aplica o raio pill ao contêiner visual dos ícones", () => {
    expect(LANDING_STYLES).toMatch(
      /\.pa-inst-icon\s*\{[^}]*border-radius:\s*var\(--pa-r-pill\)/,
    );
  });
});
