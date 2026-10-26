import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CtaTrio } from "./cta-trio";
import { ServicesGrid } from "./services-grid";
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

  it("CTA final expõe chaves de analytics snake_case em cada link", () => {
    render(<CtaTrio />);
    const ctas = screen.getAllByRole("link").map((a) => a.getAttribute("data-cta"));
    expect(ctas).toEqual(["trio_diagnostico", "trio_guias", "trio_contato"]);
  });

  it("grade de serviços tem os 8, com a Amazon em primeiro e destacada", () => {
    render(<ServicesGrid />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(8);
    expect(links[0]).toHaveAttribute("href", "/consultoria-amazon-para-marcas");
    expect(links[0]).toHaveTextContent("Carro-chefe");
    expect(links[1]).toHaveAttribute("href", "/seo-para-ecommerce");
    expect(links.slice(1).some((a) => a.textContent?.includes("Carro-chefe"))).toBe(false);
  });

  it("grade de serviços expõe chaves de analytics snake_case", () => {
    render(<ServicesGrid />);
    const ctas = screen.getAllByRole("link").map((a) => a.getAttribute("data-cta"));
    expect(ctas[0]).toBe("home_servico_amazon");
    expect(ctas).toContain("home_servico_trafego_pago");
  });

  it("CTA final fala com quem procura a agência", () => {
    render(<CtaTrio />);
    expect(screen.getByRole("heading", { level: 2, name: "Por onde começar" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Fale com o nosso time" })).toBeInTheDocument();
  });
});
