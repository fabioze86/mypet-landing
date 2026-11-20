// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { clientConfig } from "@/client.config";
import { FreteResumo } from "./frete-resumo";

const P = clientConfig.palette;

describe("FreteResumo", () => {
  it("fábrica abaixo do mínimo mostra o fixo e quanto falta", () => {
    render(<FreteResumo regra="fabrica" zona="fora" subtotal={100} modalidade="normal" onModalidade={() => {}} palette={P} />);
    expect(screen.getByText(/Faltam R\$\s?199,00 para o frete grátis/)).toBeTruthy();
    expect(screen.getByText(/R\$\s?19,90/)).toBeTruthy();
    expect(screen.queryByLabelText(/Prioritária/)).toBeNull();
  });

  it("capital oferece prioritária e avisa a troca", () => {
    const onModalidade = vi.fn();
    render(<FreteResumo regra="zona" zona="capital" subtotal={250} modalidade="normal" onModalidade={onModalidade} palette={P} />);
    expect(screen.getByText(/Frete grátis/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/Prioritária/));
    expect(onModalidade).toHaveBeenCalledWith("prioritaria");
  });

  it("fora mostra a combinar", () => {
    render(<FreteResumo regra="zona" zona="fora" subtotal={250} modalidade="normal" onModalidade={() => {}} palette={P} />);
    expect(screen.getByText(/a combinar/i)).toBeTruthy();
  });
});
