import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MetricsBar } from "./metrics-bar";

describe("MetricsBar", () => {
  it("renderiza as 4 métricas", () => {
    render(<MetricsBar />);
    const region = screen.getByRole("region", { name: "Números da operação" });
    expect(within(region).getByText("~5 mil")).toBeInTheDocument();
    expect(within(region).getByText(/itens no catálogo/)).toBeInTheDocument();
    expect(within(region).getAllByText(/.+/).length).toBeGreaterThanOrEqual(8);
  });

  it("não mostra preço de produto", () => {
    const { container } = render(<MetricsBar />);
    expect(container.textContent ?? "").not.toMatch(/R\$\s?\d/);
  });
});
