import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ComparisonTable } from "./comparison-table";
import { FaqList } from "./faq-list";
import { OfferLadder } from "./offer-ladder";
import { Pillars } from "./pillars";

describe("blocos", () => {
  it("comparativo é uma tabela real com cabeçalho das três opções", () => {
    render(<ComparisonTable />);
    const table = screen.getByRole("table");
    expect(table).toBeInTheDocument();
    for (const name of ["Zemann", "Agência", "Curso ou mentoria"]) {
      expect(screen.getByRole("columnheader", { name })).toBeInTheDocument();
    }
  });

  it("pilares não insinuam vínculo com a Amazon", () => {
    const { container } = render(<Pillars />);
    expect(container.textContent?.toLowerCase()).not.toContain("parceiro oficial");
    expect(container.textContent).toContain("API oficial da Amazon");
  });

  it("escada mostra os três degraus e o preço do diagnóstico", () => {
    render(<OfferLadder />);
    expect(screen.getByRole("heading", { name: "Diagnóstico da conta" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Implantação" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Gestão contínua" })).toBeInTheDocument();
    expect(screen.getByText(/valor informado no agendamento/)).toBeInTheDocument();
  });

  it("FAQ usa o nível de título pedido", () => {
    render(<FaqList items={[{ q: "Pergunta?", a: "Resposta." }]} headingLevel={2} />);
    expect(screen.getByRole("heading", { level: 2, name: "Pergunta?" })).toBeInTheDocument();
    expect(screen.getByText("Resposta.")).toBeInTheDocument();
  });
});
