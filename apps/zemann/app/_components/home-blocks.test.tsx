import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CtaTrio } from "./cta-trio";
import { StatsBand } from "./stats-band";

describe("blocos da home", () => {
  it("faixa de números mostra valor e legenda de cada indicador", () => {
    render(<StatsBand />);
    expect(screen.getByText("3.000+")).toBeInTheDocument();
    expect(screen.getByText(/produtos no catálogo/)).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });

  it("CTA final tem três caminhos com destinos distintos", () => {
    render(<CtaTrio />);
    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["/diagnostico-conta-amazon", "/guias", "/contato"]);
  });
});
