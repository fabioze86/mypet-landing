import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { InstitutionalTrust } from "./institutional-trust";
import { LANDING_STYLES } from "./styles";

describe("InstitutionalTrust", () => {
  it("mostra 3 pontos com ícone", () => {
    const { container } = render(<InstitutionalTrust categoryCount={12} />);
    const region = screen.getByRole("region", { name: "Como a My Pet opera" });
    expect(within(region).getByText(/Compra por CNPJ/)).toBeInTheDocument();
    expect(within(region).getByText(/12 categorias/)).toBeInTheDocument();
    expect(container.querySelectorAll(".pa-inst-item svg").length).toBe(3);
  });

  it("aplica o raio pill ao contêiner visual dos ícones", () => {
    expect(LANDING_STYLES).toMatch(
      /\.pa-inst-icon\s*\{[^}]*border-radius:\s*var\(--pa-r-pill\)/,
    );
  });
});
