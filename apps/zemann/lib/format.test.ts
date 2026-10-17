import { describe, expect, it } from "vitest";
import { formatDateBR, formatPriceFrom } from "./format";

describe("formatPriceFrom", () => {
  it("formata o valor em reais", () => {
    expect(formatPriceFrom(1500)).toBe("a partir de R$ 1.500");
  });

  it("sem valor definido, avisa que o valor vem no agendamento", () => {
    expect(formatPriceFrom(null)).toBe("valor informado no agendamento");
  });
});

describe("formatDateBR", () => {
  it("escreve a data por extenso", () => {
    expect(formatDateBR("2026-10-17")).toBe("17 de outubro de 2026");
  });
});
